import WebSocket from "ws";
import { ZhipuAiClient, ZhipuResponse } from "./zhipu_client";
import { AudioManager } from "./audio";
import { ResponseSaver } from "./response_saver";
import { DeepgramService } from "./deepgram_service";
import { 
    processAudioWithZhipu, 
    processTTSResponse, 
    formatAudioProcessingError,
    detectAudioFormatFromBuffer
} from "./audio_processor";
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
    private deepgramClient: DeepgramService;
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

        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramApiKey) {
            throw new Error("DEEPGRAM_API_KEY is not set");
        }
        this.client = new ZhipuAiClient(apiKey);
        this.deepgramClient = new DeepgramService(deepgramApiKey);
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
            
            const detectedFormat = this.audioManager.getDetectedFormat();
            const audioFormat = detectAudioFormatFromBuffer(audioBuffer, detectedFormat);
            console.log(`Using ${audioFormat.toUpperCase()} format`);

            const responseText = await processAudioWithZhipu({
                audioBuffer,
                audioFormat,
                detectedFormat,
                instructions: this.instructions,
                client: this.client,
                deepgramClient: this.deepgramClient,
                responseSaver: this.responseSaver
            });
            
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
                const ttsResult = await processTTSResponse({
                    responseText,
                    responseSaver: this.responseSaver
                });
                
                audioFilePath = ttsResult.audioFilePath;
                ttsAudioBuffer = ttsResult.ttsAudioBuffer;

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

                // Đợi một chút để đảm bảo tất cả chunks đã được gửi
                await new Promise(resolve => setTimeout(resolve, 100));

                // Gửi tín hiệu hoàn thành - gửi trực tiếp đến client và broadcast
                const completeMessage = JSON.stringify({
                    type: 'audio_response_complete',
                    timestamp: new Date().toISOString()
                });
                ws.send(completeMessage);
                broadcastToClients(completeMessage);
            } catch (ttsError: any) {
            }

        } catch (error: any) {
            console.error('Error processing audio:', error);
            const errorMessage = formatAudioProcessingError(error);
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
