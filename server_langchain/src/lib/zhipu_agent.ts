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
    private isRecording: boolean = false;
    private debugLoggedNonRecording: boolean = false;

    constructor(params: ZhipuVoiceAgentOptions) {
        const apiKey = params.apiKey || process.env.ZHIPU_API_KEY;
        if (!apiKey) {
            throw new Error("ZHIPU_API_KEY is not set");
        }

        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramApiKey) {
            throw new Error("DEEPGRAM_API_KEY is not set");
        }
        this.audioConfig = params.audioConfig || {
            sampleRate: 44100,
            channels: 1,
            bitDepth: 16
        };
        this.client = new ZhipuAiClient(apiKey);
        this.deepgramClient = new DeepgramService(deepgramApiKey);
        this.audioManager = new AudioManager(this.audioConfig);
        this.responseSaver = new ResponseSaver();
        this.instructions = params.instructions;
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
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/04558b8f-606a-46fc-b607-0ccd441ef8fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'initial', hypothesisId: 'H2', location: 'src/lib/zhipu_agent.ts:74', message: 'ws message received on /device', data: { isBuffer: Buffer.isBuffer(data), isArrayBuffer: data instanceof ArrayBuffer, isString: typeof data === 'string', size: Buffer.isBuffer(data) ? data.length : (data instanceof ArrayBuffer ? data.byteLength : undefined) }, timestamp: Date.now() }) }).catch(() => { });
            // #endregion
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
                    if (this.isRecording) {
                        console.log(`Received binary message (recording): { type: 'Buffer', size: ${data.length} }`);
                        this.audioManager.handleAudioBuffer(data);
                    } else if (!this.debugLoggedNonRecording) {
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/04558b8f-606a-46fc-b607-0ccd441ef8fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'H4', location: 'src/lib/zhipu_agent.ts:121', message: 'binary message ignored because not recording', data: { size: data.length }, timestamp: Date.now() }) }).catch(() => { });
                        // #endregion
                        this.debugLoggedNonRecording = true;
                    }
                } else if (data instanceof ArrayBuffer) {
                    const buffer = Buffer.from(data);
                    if (this.isRecording) {
                        console.log(`Received binary message (recording): { type: 'ArrayBuffer', size: ${buffer.length} }`);
                        this.audioManager.handleAudioBuffer(buffer);
                    } else if (!this.debugLoggedNonRecording) {
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/04558b8f-606a-46fc-b607-0ccd441ef8fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'H4', location: 'src/lib/zhipu_agent.ts:126', message: 'binary message ignored because not recording', data: { size: buffer.length }, timestamp: Date.now() }) }).catch(() => { });
                        // #endregion
                        this.debugLoggedNonRecording = true;
                    }
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/04558b8f-606a-46fc-b607-0ccd441ef8fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'initial', hypothesisId: 'H3', location: 'src/lib/zhipu_agent.ts:150', message: 'handleControlMessage invoked', data: { type: message?.type }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion

        if (message.type === 'start_recording') {
            console.log("Starting recording session");
            this.isRecording = true;
            this.debugLoggedNonRecording = false;
            this.audioManager.startRecording();
        } else if (message.type === 'stop_recording') {
            console.log("Stopping recording and processing audio");
            this.isRecording = false;
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

                // --- Audio Normalization (Fix for Speed/Format issues) ---
                const rawWavBuffer = ttsAudioBuffer;
                const srcChannels = rawWavBuffer.readUInt16LE(22);
                const srcRate = rawWavBuffer.readUInt32LE(24);
                const srcBits = rawWavBuffer.readUInt16LE(34);
                const srcDataStart = 44; // Standard WAV header size

                console.log(`TTS Source: ${srcRate}Hz, ${srcChannels}ch, ${srcBits}-bit`);

                // 1. Extract Samples to Int16 (handling 8-bit or 16-bit)
                let srcSamples: Int16Array;
                const dataLen = rawWavBuffer.length - srcDataStart;

                if (srcBits === 8) {
                    // 8-bit is unsigned 0..255 (center 128)
                    const srcBytes = new Uint8Array(rawWavBuffer.buffer, rawWavBuffer.byteOffset + srcDataStart, dataLen);
                    srcSamples = new Int16Array(srcBytes.length);
                    for (let i = 0; i < srcBytes.length; i++) {
                        srcSamples[i] = (srcBytes[i] - 128) << 8;
                    }
                } else if (srcBits === 16) {
                    // 16-bit is signed
                    srcSamples = new Int16Array(rawWavBuffer.buffer, rawWavBuffer.byteOffset + srcDataStart, dataLen / 2);
                } else {
                    console.error("Unsupported bit depth:", srcBits);
                    srcSamples = new Int16Array(0); // Fallback
                }

                // 2. Convert to Mono (if stereo)
                let monoSamples: Int16Array;
                if (srcChannels === 2) {
                    monoSamples = new Int16Array(srcSamples.length / 2);
                    for (let i = 0; i < monoSamples.length; i++) {
                        // Simple mix: (L + R) / 2
                        const l = srcSamples[i * 2];
                        const r = srcSamples[i * 2 + 1];
                        monoSamples[i] = (l + r) / 2;
                    }
                } else {
                    monoSamples = srcSamples;
                }

                // 3. NO Resampling - Use Original Rate
                // Let the ESP32 handle the playback speed matching via 'audio_config'
                const finalSamples = monoSamples;
                console.log(`Sending Audio at native rate: ${srcRate}Hz`);

                // Convert back to Buffer
                const pcmBuffer = Buffer.from(finalSamples.buffer);

                // --- Send Audio Configuration to Client ---
                // This tells ESP32 to switch its I2S clock to match the TTS file
                const configMsg = JSON.stringify({
                    type: "audio_config",
                    sampleRate: srcRate
                });
                broadcastToClients(configMsg); // Send config before data

                // Give client a brief moment to switch clock (optional but good practice)
                await new Promise(resolve => setTimeout(resolve, 50));

                // --- Streaming ---
                const CHUNK_SIZE = 1024;
                // pcmBuffer is now Raw PCM (Native Rate, 16bit, Mono), no header
                for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
                    const chunk = pcmBuffer.slice(i, i + CHUNK_SIZE);
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
                // ws.send(completeMessage); <--- Removed duplicate send
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
