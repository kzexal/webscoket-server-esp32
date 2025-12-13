import { ZhipuAiClient } from "./zhipu_client";
import { ResponseSaver } from "./response_saver";
import { textToSpeech, readAudioFile } from "./tts_local";
import { AudioFormat } from "./audio";
import { DeepgramService } from "./deepgram_service"; // Import mới
import * as fs from 'fs';

export interface ProcessAudioOptions {
    audioBuffer: Buffer;
    audioFormat?: 'wav' | 'mp3' | 'aac';
    detectedFormat?: AudioFormat | null;
    instructions?: string;
    client: ZhipuAiClient;
    deepgramClient: DeepgramService; // [MỚI] Thêm Deepgram Client vào đây
    responseSaver: ResponseSaver;
}

export interface ProcessAudioResult {
    responseText: string;
    audioFilePath: string | null;
    ttsAudioBuffer: Buffer | null;
}

export interface ProcessTTSOptions {
    responseText: string;
    responseSaver: ResponseSaver;
}

export interface ProcessTTSResult {
    audioFilePath: string;
    ttsAudioBuffer: Buffer;
    fileSize: number;
}

/**
 * Phát hiện format audio từ buffer header
 */
export function detectAudioFormatFromBuffer(audioBuffer: Buffer, detectedFormat?: AudioFormat | null): 'wav' | 'mp3' | 'aac' {
    if (detectedFormat) {
        if (detectedFormat === AudioFormat.MP3) {
            return 'mp3';
        } else if (detectedFormat === AudioFormat.AAC) {
            return 'aac';
        } else {
            return 'wav';
        }
    }
    
    // Fallback: detect từ buffer header
    if (audioBuffer.length >= 3) {
        if (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0) {
            return 'mp3';
        } else if (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) {
            return 'mp3';
        } else if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
            return 'wav';
        }
    }
    
    return 'wav'; // default
}

/**
 * Xử lý input (audio hoặc text): gửi đến Zhipu API và nhận text response
 * Sử dụng streaming mode để giảm độ trễ
 */
export async function processAudioWithZhipu(options: ProcessAudioOptions): Promise<string> {
    const { audioBuffer, audioFormat, detectedFormat, instructions, client, deepgramClient } = options;
    
    // 1. Xác định format
    const finalFormat = audioFormat || detectAudioFormatFromBuffer(audioBuffer, detectedFormat);
    const mimeType = finalFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';

    // 2. [QUAN TRỌNG] Gọi Deepgram để lấy Text từ Audio với streaming mode
    // Sử dụng streaming để phù hợp với ESP32 real-time audio
    let userTranscript = "";
    try {
        // Chia audio buffer thành chunks nhỏ để stream (giả lập real-time)
        const CHUNK_SIZE = 4096; // 4KB chunks
        const chunks: Buffer[] = [];
        for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
            chunks.push(audioBuffer.slice(i, i + CHUNK_SIZE));
        }

        if (chunks.length > 0) {
            // Sử dụng streaming transcription (phù hợp cho ESP32 real-time)
            // Logging được xử lý trong deepgram_service.ts, không cần log lại ở đây
            userTranscript = await deepgramClient.transcribeStream(chunks, mimeType);
        } else {
            // Fallback nếu không có chunks
            userTranscript = await deepgramClient.transcribe(audioBuffer, mimeType);
        }
    } catch (error) {
        console.error("STT Error, falling back to empty text:", error);
    }

    // Nếu không nghe thấy gì, có thể return luôn hoặc để Zhipu xử lý
    if (!userTranscript.trim()) {
        console.log("No speech detected via Deepgram.");
        return "I didn't hear anything.";
    }

    console.log(`Sending transcript to Zhipu: "${userTranscript}"`);

    // 3. Gửi Text (Transcript) đến Zhipu GLM-4-FlashX với streaming mode
    // System prompt được cập nhật để giới hạn response ~70 từ
    const defaultSystemPrompt = "You are a helpful assistant. Keep your response concise and under 70 words. Be direct and to the point.";
    let fullResponse = "";
    try {
        console.log(`← Zhipu:`); // Bắt đầu response từ Zhipu
        fullResponse = await client.chatStream({
            text: userTranscript,
            systemPrompt: instructions || defaultSystemPrompt
            // onChunk được xử lý trong zhipu_client.ts
        });
    } catch (error) {
        // Fallback về non-streaming nếu streaming thất bại
        console.warn("Streaming failed, falling back to non-streaming mode:", error);
        const response = await client.chat({
            text: userTranscript,
            systemPrompt: instructions || defaultSystemPrompt
        });
        fullResponse = client.getTextFromResponse(response);
    }

    return fullResponse;
}

/**
 * Xử lý TTS: chuyển text thành audio và lưu file
 */
export async function processTTSResponse(options: ProcessTTSOptions): Promise<ProcessTTSResult> {
    const { responseText, responseSaver } = options;
    
    const audioDir = responseSaver.getAudioDir();
    
    // Gọi hàm TTS local (eSpeak hoặc thư viện khác bạn đã cài)
    const audioFilePath = await textToSpeech(responseText, {
        outputDir: audioDir
    });
    
    const ttsAudioBuffer = readAudioFile(audioFilePath);
    
    // Log response text
    console.log('\n' + 'AI Response Text:');
    console.log("--------------------------------------------------");
    console.log(responseText);
    console.log("--------------------------------------------------");
    
    // Lưu complete response với metadata
    responseSaver.saveCompleteResponse(
        responseText,
        undefined, // Input text (chưa lưu ở đây)
        'wav',
        audioFilePath
    );

    const fileSize = fs.statSync(audioFilePath).size;
    console.log(`\nAudio generated: ${audioFilePath} (${(fileSize / 1024).toFixed(2)} KB)`);
    
    return {
        audioFilePath,
        ttsAudioBuffer,
        fileSize
    };
}

/**
 * Format error message từ exception
 */
export function formatAudioProcessingError(error: any): string {
    return error.message || "Unknown error";
}
