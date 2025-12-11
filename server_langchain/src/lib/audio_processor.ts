import { ZhipuAiClient, ZhipuResponse } from "./zhipu_client";
import { ResponseSaver } from "./response_saver";
import { textToSpeech, readAudioFile } from "./tts_local";
import { AudioFormat } from "./audio";
import * as fs from 'fs';

export interface ProcessAudioOptions {
    audioBuffer: Buffer;
    audioFormat?: 'wav' | 'mp3' | 'aac';
    detectedFormat?: AudioFormat | null;
    instructions?: string;
    client: ZhipuAiClient;
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
 * Xử lý audio buffer: gửi đến Zhipu API và nhận text response
 */
export async function processAudioWithZhipu(options: ProcessAudioOptions): Promise<string> {
    const { audioBuffer, audioFormat, detectedFormat, instructions, client } = options;
    
    // Cảnh báo nếu audio quá lớn
    if (audioBuffer.length > 500 * 1024) {
        console.warn(`Audio size ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB is large`);
        console.warn('Recommendation: Use MP3 format instead of WAV for faster processing');
    }

    const finalFormat = audioFormat || detectAudioFormatFromBuffer(audioBuffer, detectedFormat);
    console.log(`Sending audio to Zhipu GLM-4-Voice (format: ${finalFormat}, timeout: 120s)...`);
    
    const finalInstructions = instructions || "You must respond ONLY in English. Return TEXT ONLY (no audio).";
    console.log(`Instructions: ${finalInstructions.substring(0, 1000)}`);
    
    const response = await client.chat({
        audioData: audioBuffer,
        audioFormat: finalFormat,
        text: finalInstructions
    });

    const responseText = client.getTextFromResponse(response);
    return responseText;
}

/**
 * Xử lý TTS: chuyển text thành audio và lưu file
 */
export async function processTTSResponse(options: ProcessTTSOptions): Promise<ProcessTTSResult> {
    const { responseText, responseSaver } = options;
    
    const audioDir = responseSaver.getAudioDir();
    const audioFilePath = await textToSpeech(responseText, {
        outputDir: audioDir
    });
    
    const ttsAudioBuffer = readAudioFile(audioFilePath);
    
    // Log response text
    console.log('\n' + 'AI Response Text:');
    console.log("\n" + responseText);
    
    // Lưu complete response với metadata
    responseSaver.saveCompleteResponse(
        responseText,
        undefined,
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
    let errorMessage = 'Failed to process audio';
    if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout: Audio file too large. Use MP3 format.';
    } else if (error.response?.status === 413) {
        errorMessage = 'Audio payload too large. Use MP3 format to compress.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return errorMessage;
}

