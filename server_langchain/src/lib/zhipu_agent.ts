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

    
     // Kết nối WebSocket và xử lý luồng âm thanh từ ESP32
     
    public async connect(
        ws: WebSocket,
        broadcastToClients: (data: string) => void
    ): Promise<void> {
        console.log("ZhipuVoiceAgent connected");

        //Tạo thư mục tạm thời
        const tmpDir = path.join(__dirname, '../../tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Xử lý audio từ ESP32
        ws.on('message', async (data: Buffer | ArrayBuffer | string) => {
            try {
                let parsedMessage: any = null;
                let dataString: string | null = null;
                if (typeof data === 'string') {
                    dataString = data;
                } else if (Buffer.isBuffer(data)) {
                    try {
                        dataString = data.toString('utf8');
                        if (dataString.trim().startsWith('{') || dataString.trim().startsWith('[')) {
                            parsedMessage = JSON.parse(dataString);
                        }
                    } catch (e) {

                    }
                } else if (data instanceof ArrayBuffer) {
                    try {
                        dataString = Buffer.from(data).toString('utf8');
                        if (dataString.trim().startsWith('{') || dataString.trim().startsWith('[')) {
                            parsedMessage = JSON.parse(dataString);
                        }
                    } catch (e) {
                    }
                }

                if (parsedMessage && typeof parsedMessage === 'object' && parsedMessage.type) {
                    await this.handleControlMessage(parsedMessage, ws, broadcastToClients);
                    return;
                }
                if (Buffer.isBuffer(data) && data.length < 500) {
                    const textAttempt = data.toString('utf8');
                    if (textAttempt.trim().startsWith('{')) {
                        try {
                            const msg = JSON.parse(textAttempt);
                            if (msg.type) {
                                await this.handleControlMessage(msg, ws, broadcastToClients);
                                return;
                            }
                        } catch (e) {
                        }
                    }
                }

                if (Buffer.isBuffer(data)) {
                    console.log(`Received binary message: { type: 'Buffer', size: ${data.length} }`);
                    this.audioManager.handleAudioBuffer(data);
                } else if (data instanceof ArrayBuffer) {
                    const buffer = Buffer.from(data);
                    console.log(`Received binary message: { type: 'ArrayBuffer', size: ${buffer.length} }`);
                    this.audioManager.handleAudioBuffer(buffer);
                } else if (typeof data === 'string') {
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

    private async handleControlMessage(
        message: any,
        ws: WebSocket,
        broadcastToClients: (data: string) => void
    ): Promise<void> {
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

    
     //Gửi đến Zhipu, nhận phản hồi và gửi lại
     
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
            
            //Cảnh báo nếu audio quá lớn (WAV > 500KB)
            if (audioBuffer.length > 500 * 1024) {
                console.warn(`Audio size ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB is large`);
                console.warn('Recommendation: Use MP3 format instead of WAV for faster processing');
            }

            const detectedFormat = this.audioManager.getDetectedFormat();
            let audioFormat: 'wav' | 'mp3' | 'aac' = 'wav';
            
            if (detectedFormat) {
                if (detectedFormat === 'mp3') {
                    audioFormat = 'mp3';
                    console.log('Using MP3 format');
                } else if (detectedFormat === 'aac') {
                    audioFormat = 'aac';
                    console.log('Using AAC format');
                } else {
                    audioFormat = 'wav';
                    console.log('Using WAV format');
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
            console.log(`Sending audio to Zhipu GLM-4-Voice (format: ${audioFormat}, timeout: 120s)...`);
            const instructions = this.instructions || "You must respond ONLY in English. Return TEXT ONLY (no audio).";
            console.log(`Instructions: ${instructions.substring(0, 1000)}`);
            const response = await this.client.chat({
                audioData: audioBuffer,
                audioFormat: audioFormat,
                text: instructions
            });

            const responseText = this.client.getTextFromResponse(response);
            this.responseSaver.saveTextResponse(responseText);
            broadcastToClients(JSON.stringify({
                type: 'text_response',
                content: responseText,
                timestamp: new Date().toISOString()
            }));

            broadcastToClients(JSON.stringify({
                type: 'info',
                message: 'tts_start',
                timestamp: new Date().toISOString()
            }));
            let audioFilePath: string | null = null;
            let ttsAudioBuffer: Buffer | null = null;
            
            try {
                const audioDir = this.responseSaver.getAudioDir();
                audioFilePath = await textToSpeech(responseText, {
                    outputDir: audioDir
                });
                
                ttsAudioBuffer = readAudioFile(audioFilePath);
                
                console.log('\n' + 'AI Response Text:');
              
                console.log("\n" + responseText);
              
                // File đã được lưu trực tiếp vào responses/audio/, không cần lưu lại
                const audioPath = audioFilePath;
                
                // Lưu complete response với metadata
                this.responseSaver.saveCompleteResponse(
                    responseText,
                    undefined,
                    'wav',
                    audioPath
                );

                const fileSize = fs.statSync(audioPath).size;
                console.log(`\nAudio generated: ${audioPath} (${(fileSize / 1024).toFixed(2)} KB)`);

                broadcastToClients(JSON.stringify({
                    type: 'info',
                    message: 'tts_done',
                    timestamp: new Date().toISOString()
                }));

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
            }

        } catch (error: any) {
            console.error('Error processing audio:', error);
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
            this.audioManager.resetRecording();
        }
    }
    public getAudioBuffer(): Buffer {
        return this.audioManager.getCurrentBuffer();
    }
    public resetRecording(): void {
        this.audioManager.resetRecording();
    }
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
    public createSessionIndex(): void {
        this.responseSaver.createIndex();
    }
}
