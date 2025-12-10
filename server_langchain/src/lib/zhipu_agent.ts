import WebSocket from "ws";
import { ZhipuAiClient, ZhipuResponse } from "./zhipu_client";
import { AudioManager } from "./audio";
import { ResponseSaver } from "./response_saver";
import { textToSpeech, readAudioFile } from "./tts_local";
// import { audioToText } from "./deepgram_stt"; // DEEPGRAM STT ĐÃ TẮT - Xem DEEPGRAM_ENABLE_GUIDE.md
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
                } else if (data && typeof data === 'object' && 'byteLength' in data) {
                    try {
                        dataString = Buffer.from(data as ArrayBuffer).toString('utf8');
                        if (dataString.trim().startsWith('{') || dataString.trim().startsWith('[')) {
                            parsedMessage = JSON.parse(dataString);
                        }
                    } catch (e) {
                        // Not a string, treat as binary
                    }
                }

                // If we successfully parsed a JSON message, handle it as control message
                if (parsedMessage && typeof parsedMessage === 'object' && parsedMessage.type) {
                    console.log(`Received control message: ${dataString?.substring(0, 200)}`);
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
                                console.log(`Received control message (small buffer): ${textAttempt.substring(0, 200)}`);
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
                } else if (data && typeof data === 'object' && 'byteLength' in data) {
                    const buffer = Buffer.from(data as ArrayBuffer);
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
        console.log(`Received control message: ${JSON.stringify(message)}`);
        if (message.type === 'start_recording') {
            console.log("Starting recording session");
            this.audioManager.startRecording();
        } else if (message.type === 'stop_recording') {
            console.log("Stopping recording and processing audio");
            this.audioManager.closeFile();
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log("Starting to process recorded audio...");
            await this.processRecordedAudio(ws, broadcastToClients);
        } else {
            console.log(`Unknown control message type: ${message.type}`);
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

            console.log(`Processing ${audioBuffer.length} bytes of audio (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
            
            if (audioBuffer.length > 500 * 1024) {
                console.warn(`Audio size ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB is large`);
                console.warn('Recommendation: Use MP3 format instead of WAV for faster processing');
            }

            const detectedFormat = this.audioManager.getDetectedFormat();
            let audioFormat: 'wav' | 'mp3' | 'aac' = 'wav';
            
            if (detectedFormat) {
                if (detectedFormat === 'mp3') {
                    audioFormat = 'mp3';
                    console.log('Using MP3 format (detected from stream)');
                } else if (detectedFormat === 'aac') {
                    audioFormat = 'aac';
                    console.log('Using AAC format (detected from stream)');
                } else {
                    audioFormat = 'wav';
                    console.log('Using WAV format (detected from stream)');
                }
            } else {
                if (audioBuffer.length >= 3) {
                    if (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0) {
                        audioFormat = 'mp3';
                        console.log('Detected MP3 format from buffer header');
                    } else if (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) {
                        audioFormat = 'mp3';
                        console.log('Detected MP3 format (ID3 tag)');
                    } else if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
                        audioFormat = 'wav';
                        console.log('Detected WAV format from header');
                    }
                }
            }
            
            console.log(`Sending audio directly to Zhipu GLM-4-Voice (timeout: 120s)...`);
            console.log(`Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB, format: ${audioFormat}`);
            
            const baseInstructions = this.instructions || "Please carefully listen to the audio content, understand what the user is saying, and respond based on the specific content. Do not just give generic greetings, but answer the specific questions or topics mentioned.";
            
            const response = await this.client.chat({
                audioData: audioBuffer,
                audioFormat: audioFormat,
                text: baseInstructions
            });

            // Extract text response
            let responseText = this.client.getTextFromResponse(response);
            
            // Clean text response - remove null bytes, BOM, và các ký tự không hợp lệ
            if (responseText) {
                responseText = responseText
                    .replace(/\x00/g, '') // Remove null bytes
                    .replace(/\uFEFF/g, '') // Remove BOM
                    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
                    .trim();
            }
            
            if (!responseText || responseText.length === 0) {
                console.warn('Empty response text from GLM');
                broadcastToClients(JSON.stringify({
                    type: 'error',
                    message: 'Empty response from AI'
                }));
                return;
            }

            this.responseSaver.saveTextResponse(responseText);
            
            console.log("Converting text to speech using pyttsx3...");
            let audioFilePath: string | null = null;
            let ttsAudioBuffer: Buffer | null = null;
            
            try {
                // Tạo audio từ text sử dụng pyttsx3
                audioFilePath = await textToSpeech(responseText, {
                    outputDir: path.join(__dirname, '../../tmp')
                });
                
                ttsAudioBuffer = readAudioFile(audioFilePath);
                console.log(`Audio generated: ${audioFilePath} (${(ttsAudioBuffer.length / 1024).toFixed(2)} KB)`);
                
                console.log('\nAI Response Text:');
                console.log(responseText);
                console.log('');
                
                const audioPath = this.responseSaver.saveAudioResponse(
                    ttsAudioBuffer,
                    'wav'
                );
                console.log(`Audio saved: ${audioPath}`);
                
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
                console.error('Error converting text to speech:', ttsError.message);
                console.error('Retrying...');
                
                try {
                    console.log('Retrying pyttsx3...');
                    audioFilePath = await textToSpeech(responseText, {
                        outputDir: path.join(__dirname, '../../tmp')
                    });
                    ttsAudioBuffer = readAudioFile(audioFilePath);
                    console.log(`Audio generated on retry: ${audioFilePath} (${(ttsAudioBuffer.length / 1024).toFixed(2)} KB)`);
                } catch (retryError: any) {
                    console.error('Retry also failed:', retryError.message);
                    console.error('pyttsx3 is not working. Sending text only.');
                    
                    console.log("No audio available, sending text only");
                    
                    console.log('\nAI Response Text:');
                    console.log(responseText);
                    console.log('');
                    
                    // Gửi text response về client
                    broadcastToClients(JSON.stringify({
                        type: 'text_response',
                        content: responseText,
                        timestamp: new Date().toISOString()
                    }));
                    
                    broadcastToClients(JSON.stringify({
                        type: 'info',
                        message: 'Text response only (pyttsx3 failed)'
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

    /**
     * Tạo instructions dựa trên ngôn ngữ được detect
     */
    private getLanguageInstructions(languageCode: string): string {
        const languageMap: { [key: string]: string } = {
            'vi': 'IMPORTANT: Respond in Vietnamese (Tiếng Việt). Use Vietnamese language for your response.',
            'en': 'IMPORTANT: Respond in English. Use English language for your response.',
            'zh': 'IMPORTANT: Respond in Chinese (中文). Use Chinese language for your response.',
            'ja': 'IMPORTANT: Respond in Japanese (日本語). Use Japanese language for your response.',
            'ko': 'IMPORTANT: Respond in Korean (한국어). Use Korean language for your response.',
            'fr': 'IMPORTANT: Respond in French (Français). Use French language for your response.',
            'de': 'IMPORTANT: Respond in German (Deutsch). Use German language for your response.',
            'es': 'IMPORTANT: Respond in Spanish (Español). Use Spanish language for your response.',
            'pt': 'IMPORTANT: Respond in Portuguese (Português). Use Portuguese language for your response.',
            'ru': 'IMPORTANT: Respond in Russian (Русский). Use Russian language for your response.',
            'th': 'IMPORTANT: Respond in Thai (ไทย). Use Thai language for your response.',
        };

        // Lấy 2 ký tự đầu của language code (ví dụ: 'vi-VN' -> 'vi')
        const langKey = languageCode.toLowerCase().split('-')[0];
        return languageMap[langKey] || `IMPORTANT: Respond in the same language as the user's input. The detected language code is: ${languageCode}`;
    }
}
