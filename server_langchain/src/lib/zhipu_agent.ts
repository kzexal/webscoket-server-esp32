import WebSocket from "ws";
import { ZhipuAiClient, ZhipuResponse } from "./zhipu_client";
import { AudioManager } from "./audio";
import { ResponseSaver } from "./response_saver";
import { textToSpeech, readAudioFile } from "./tts_local";
import * as path from 'path';
import * as fs from 'fs';

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
}

export interface ZhipuVoiceAgentOptions {
    apiKey?: string;
    instructions?: string;
    audioConfig?: AudioConfig;
}

/**
 * ZhipuVoiceAgent handles WebSocket communication with ESP32
 * and communicates with Zhipu GLM-4-Voice API
 */
export class ZhipuVoiceAgent {
    private client: ZhipuAiClient;
    private audioManager: AudioManager;
    private responseSaver: ResponseSaver;
    private instructions?: string;
    private audioConfig: AudioConfig;
    private isProcessing: boolean = false;

    constructor(params: ZhipuVoiceAgentOptions) {
        const apiKey = params.apiKey || process.env.ZHIPU_API_KEY;
        if (!apiKey) {
            throw new Error("ZHIPU_API_KEY is not set");
        }

        this.client = new ZhipuAiClient(apiKey);
        this.audioManager = new AudioManager();
        this.responseSaver = new ResponseSaver();
        this.instructions = params.instructions;
        this.audioConfig = params.audioConfig || {
            sampleRate: 44100,
            channels: 1,
            bitDepth: 16
        };
    }

    /**
     * Connect to WebSocket and handle audio streaming from ESP32
     */
    public async connect(
        ws: WebSocket,
        broadcastToClients: (data: string) => void
    ): Promise<void> {
        console.log("ZhipuVoiceAgent connected");

        // Create tmp directory if it doesn't exist
        const tmpDir = path.join(__dirname, '../../tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Handle incoming audio data from ESP32
        ws.on('message', async (data: Buffer | string) => {
            try {
                // Try to parse as JSON first (for control messages)
                let parsedMessage: any = null;
                let dataString: string | null = null;
                
                if (typeof data === 'string') {
                    dataString = data;
                } else if (Buffer.isBuffer(data)) {
                    // Try to parse buffer as UTF-8 string (for JSON messages)
                    try {
                        dataString = data.toString('utf8');
                        // Check if it looks like JSON
                        if (dataString.trim().startsWith('{') || dataString.trim().startsWith('[')) {
                            parsedMessage = JSON.parse(dataString);
                        }
                    } catch (e) {
                        // Not a string, treat as binary
                    }
                } else if (data instanceof ArrayBuffer) {
                    try {
                        dataString = Buffer.from(data).toString('utf8');
                        if (dataString.trim().startsWith('{') || dataString.trim().startsWith('[')) {
                            parsedMessage = JSON.parse(dataString);
                        }
                    } catch (e) {
                        // Not a string, treat as binary
                    }
                }

                // If we successfully parsed a JSON message, handle it as control message
                if (parsedMessage && typeof parsedMessage === 'object' && parsedMessage.type) {
                    console.log(`📨 Received control message: ${dataString?.substring(0, 200)}`);
                    await this.handleControlMessage(parsedMessage, ws, broadcastToClients);
                    return;
                }
                
                // Also check if buffer is small and might be a text message
                if (Buffer.isBuffer(data) && data.length < 500) {
                    const textAttempt = data.toString('utf8');
                    if (textAttempt.trim().startsWith('{')) {
                        try {
                            const msg = JSON.parse(textAttempt);
                            if (msg.type) {
                                console.log(`📨 Received control message (small buffer): ${textAttempt.substring(0, 200)}`);
                                await this.handleControlMessage(msg, ws, broadcastToClients);
                                return;
                            }
                        } catch (e) {
                            // Not JSON, continue as binary
                        }
                    }
                }

                // Otherwise, treat as binary audio data
                if (Buffer.isBuffer(data)) {
                    console.log(`===Received binary message: { type: 'Buffer', size: ${data.length} }`);
                    this.audioManager.handleAudioBuffer(data);
                } else if (data instanceof ArrayBuffer) {
                    const buffer = Buffer.from(data);
                    console.log(`===Received binary message: { type: 'ArrayBuffer', size: ${buffer.length} }`);
                    this.audioManager.handleAudioBuffer(buffer);
                } else if (typeof data === 'string') {
                    // String but not JSON, log it
                    console.log(`===Received string (not JSON): ${data.substring(0, 100)}`);
                }
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
                console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
                console.error('Data type:', typeof data);
                console.error('Data preview:', Buffer.isBuffer(data) ? data.toString('hex').substring(0, 100) : String(data).substring(0, 100));
            }
        });

        ws.on('close', () => {
            console.log("Client disconnected");
            this.audioManager.resetRecording();
        });

        ws.on('error', (error: Error) => {
            console.error("WebSocket error:", error);
        });
    }

    /**
     * Handle control messages from ESP32 (e.g., start/stop recording)
     */
    private async handleControlMessage(
        message: any,
        ws: WebSocket,
        broadcastToClients: (data: string) => void
    ): Promise<void> {
        console.log(`📨 Received control message: ${JSON.stringify(message)}`);
        if (message.type === 'start_recording') {
            console.log("🎙️  Starting recording session");
            this.audioManager.startRecording();
        } else if (message.type === 'stop_recording') {
            console.log("⏹️  Stopping recording and processing audio");
            // Close file writer before processing
            this.audioManager.closeFile();
            // Wait a bit for file to be fully written
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log("🚀 Starting to process recorded audio...");
            await this.processRecordedAudio(ws, broadcastToClients);
        } else {
            console.log(`⚠️  Unknown control message type: ${message.type}`);
        }
    }

    /**
     * Process recorded audio: send to Zhipu, get response, and send back
     */
    private async processRecordedAudio(
        ws: WebSocket,
        broadcastToClients: (data: string) => void
    ): Promise<void> {
        if (this.isProcessing) {
            console.log("Already processing audio, skipping");
            return;
        }

        this.isProcessing = true;

        try {
            // Get recorded audio buffer
            const audioBuffer = this.audioManager.getCurrentBuffer();
            if (audioBuffer.length === 0) {
                console.log("No audio data to process");
                broadcastToClients(JSON.stringify({
                    type: 'error',
                    message: 'No audio data recorded'
                }));
                return;
            }

            console.log(`📊 Processing ${audioBuffer.length} bytes of audio (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
            
            // Warn if audio is too large (WAV > 500KB will likely timeout)
            if (audioBuffer.length > 500 * 1024) {
                console.warn(`⚠️  Audio size ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB is large`);
                console.warn('Recommendation: Use MP3 format instead of WAV for faster processing');
            }

            // Get detected format from AudioManager
            const detectedFormat = this.audioManager.getDetectedFormat();
            let audioFormat: 'wav' | 'mp3' | 'aac' = 'wav';
            
            if (detectedFormat) {
                if (detectedFormat === 'mp3') {
                    audioFormat = 'mp3';
                    console.log('🎵 Using MP3 format (detected from stream)');
                } else if (detectedFormat === 'aac') {
                    audioFormat = 'aac';
                    console.log('🎵 Using AAC format (detected from stream)');
                } else {
                    audioFormat = 'wav';
                    console.log('🎵 Using WAV format (detected from stream)');
                }
            } else {
                // Fallback: detect from buffer header
                if (audioBuffer.length >= 3) {
                    if (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0) {
                        audioFormat = 'mp3';
                        console.log('🎵 Detected MP3 format from buffer header');
                    } else if (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) {
                        audioFormat = 'mp3';
                        console.log('🎵 Detected MP3 format (ID3 tag)');
                    } else if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
                        audioFormat = 'wav';
                        console.log('🎵 Detected WAV format from header');
                    }
                }
            }
            
            console.log(`📤 Sending audio to Zhipu GLM-4-Voice (format: ${audioFormat}, timeout: 120s)...`);
            
            const instructions = this.instructions || "You must respond ONLY in English. If the user speaks Chinese (or any non‑English), translate it to English and respond in fluent English. Never include Chinese characters in the output. Focus on the specific audio content; do not give generic greetings.";
            
            console.log(`📝 Instructions: ${instructions.substring(0, 100)}...`);
            
            const response = await this.client.chat({
                audioData: audioBuffer,
                audioFormat: audioFormat,
                text: instructions
            });

            // Extract text response
            const responseText = this.client.getTextFromResponse(response);

            // Save text response to file
            this.responseSaver.saveTextResponse(responseText);

            // Chuyển text thành audio sử dụng pyttsx3 (local TTS)
            console.log("🎤 Converting text to speech using pyttsx3...");
            let audioFilePath: string | null = null;
            let ttsAudioBuffer: Buffer | null = null;
            
            try {
                // Tạo audio từ text sử dụng pyttsx3
                audioFilePath = await textToSpeech(responseText, {
                    outputDir: path.join(__dirname, '../../tmp')
                });
                
                // Đọc file audio đã tạo
                ttsAudioBuffer = readAudioFile(audioFilePath);
                console.log(`✅ Audio generated: ${audioFilePath} (${(ttsAudioBuffer.length / 1024).toFixed(2)} KB)`);
                
                // Sau khi chuyển thành audio, hiển thị text trên terminal (đồng bộ)
                console.log('\n' + '═'.repeat(60));
                console.log('💬 AI Response Text:');
                console.log('─'.repeat(60));
                console.log(responseText);
                console.log('─'.repeat(60));
                console.log('═'.repeat(60) + '\n');
                
                // Lưu audio response
                const audioPath = this.responseSaver.saveAudioResponse(
                    ttsAudioBuffer,
                    'wav'
                );
                console.log(`💾 Audio saved: ${audioPath}`);
                
                // Lưu complete response với metadata
                this.responseSaver.saveCompleteResponse(
                    responseText,
                    ttsAudioBuffer,
                    'wav'
                );
                
                // Gửi text response về client
                broadcastToClients(JSON.stringify({
                    type: 'text_response',
                    content: responseText,
                    timestamp: new Date().toISOString()
                }));
                
                // Gửi audio data đến ESP32 qua WebSocket
                const CHUNK_SIZE = 1024;
                for (let i = 0; i < ttsAudioBuffer.length; i += CHUNK_SIZE) {
                    const chunk = ttsAudioBuffer.slice(i, i + CHUNK_SIZE);
                    ws.send(chunk);

                    // Thêm delay nhỏ giữa các chunks
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                // Gửi tín hiệu hoàn thành
                broadcastToClients(JSON.stringify({
                    type: 'audio_response_complete',
                    timestamp: new Date().toISOString()
                }));
                
            } catch (ttsError: any) {
                console.error('❌ Error converting text to speech:', ttsError.message);
                
                // Nếu pyttsx3 thất bại, thử dùng audio từ Zhipu (nếu có)
                const audioResponse = this.client.getAudioFromResponse(response);
                if (audioResponse) {
                    console.log("⚠️  Falling back to Zhipu audio response...");
                    
                    // Save audio response to file
                    const audioPath = this.responseSaver.saveAudioResponse(
                        audioResponse.data,
                        'mp3'
                    );
                    
                    console.log(`Audio response saved to: ${audioPath}`);

                    // Also save complete response with metadata
                    this.responseSaver.saveCompleteResponse(
                        responseText,
                        audioResponse.data,
                        'mp3'
                    );

                    // Send text response back to client
                    broadcastToClients(JSON.stringify({
                        type: 'text_response',
                        content: responseText,
                        timestamp: new Date().toISOString()
                    }));

                    // Send audio data to ESP32 via WebSocket
                    const fallbackAudioBuffer = Buffer.from(audioResponse.data, 'base64');

                    // Send audio in chunks for ESP32 compatibility
                    const CHUNK_SIZE = 1024;
                    for (let i = 0; i < fallbackAudioBuffer.length; i += CHUNK_SIZE) {
                        const chunk = fallbackAudioBuffer.slice(i, i + CHUNK_SIZE);
                        ws.send(chunk);

                        // Add small delay between chunks
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }

                    // Send completion signal
                    broadcastToClients(JSON.stringify({
                        type: 'audio_response_complete',
                        timestamp: new Date().toISOString()
                    }));
                } else {
                    // Không có audio từ cả pyttsx3 và Zhipu
                    console.log("⚠️  No audio available, sending text only");
                    
                    // Hiển thị text trên terminal
                    console.log('\n' + '═'.repeat(60));
                    console.log('💬 AI Response Text:');
                    console.log('─'.repeat(60));
                    console.log(responseText);
                    console.log('─'.repeat(60));
                    console.log('═'.repeat(60) + '\n');
                    
                    // Gửi text response về client
                    broadcastToClients(JSON.stringify({
                        type: 'text_response',
                        content: responseText,
                        timestamp: new Date().toISOString()
                    }));
                    
                    broadcastToClients(JSON.stringify({
                        type: 'info',
                        message: 'Text response only (no audio generated)'
                    }));
                }
            }

        } catch (error: any) {
            console.error('Error processing audio:', error);
            
            // Better error messages
            let errorMessage = 'Failed to process audio';
            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Request timeout: Audio file too large. Use MP3 format.';
            } else if (error.response?.status === 413) {
                errorMessage = 'Audio payload too large. Use MP3 format to compress.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            broadcastToClients(JSON.stringify({
                type: 'error',
                message: errorMessage
            }));
        } finally {
            this.isProcessing = false;
            // Reset for next recording
            this.audioManager.resetRecording();
        }
    }

    /**
     * Get current buffer from audio manager (for testing)
     */
    public getAudioBuffer(): Buffer {
        return this.audioManager.getCurrentBuffer();
    }

    /**
     * Reset recording session
     */
    public resetRecording(): void {
        this.audioManager.resetRecording();
    }

    /**
     * Get session information
     */
    public getSessionInfo(): {
        sessionId: string;
        sessionPath: string;
        stats: any;
    } {
        return {
            sessionId: this.responseSaver.getSessionId(),
            sessionPath: this.responseSaver.getSessionPath(),
            stats: this.responseSaver.getSessionStats()
        };
    }

    /**
     * Create index of all responses in current session
     */
    public createSessionIndex(): void {
        this.responseSaver.createIndex();
    }
}
