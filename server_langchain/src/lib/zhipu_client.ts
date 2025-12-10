import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as base64 from 'base64-js';

export interface ZhipuMessage {
    role: 'user' | 'assistant';
    content: Array<{
        type: 'text' | 'input_audio';
        text?: string;
        input_audio?: {
            data: string;
            format: 'wav' | 'mp3' | 'aac';
        };
    }>;
}

export interface ZhipuResponse {
    choices: Array<{
        message: {
            content: Array<{
                type: 'text' | 'audio';
                text?: string;
                audio?: {
                    data: string;
                    format: string;
                };
            }>;
            role: string;
        };
    }>;
}

export class ZhipuAiClient {
    private apiKey: string;
    private client: AxiosInstance;
    private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
    private model = 'glm-4-voice';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000  // 120 seconds for audio processing
        });
    }

    /**
     * Convert WAV file to Base64 string
     */
    public getBase64FromWav(wavPath: string): string {
        const audioBytes = fs.readFileSync(wavPath);
        return Buffer.from(audioBytes).toString('base64');
    }

    /**
     * Convert audio buffer to Base64 string
     */
    public getBase64FromBuffer(audioBuffer: Buffer): string {
        return audioBuffer.toString('base64');
    }

    /**
     * Send audio and/or text to Zhipu GLM-4-Voice model
     */
    public async chat(options: {
        audioData?: string | Buffer;
        audioFormat?: 'wav' | 'mp3' | 'aac';
        text?: string;
    }): Promise<ZhipuResponse> {
        const messages: ZhipuMessage[] = [];
        const content: ZhipuMessage['content'] = [];

        // Add text if provided
        if (options.text) {
            content.push({
                type: 'text',
                text: options.text
            });
        }

        // Add audio if provided
        if (options.audioData) {
            const audioBase64 = typeof options.audioData === 'string' 
                ? options.audioData 
                : this.getBase64FromBuffer(options.audioData);
            
            // Validate audio size - max 25MB base64 (roughly 19MB raw)
            if (audioBase64.length > 25 * 1024 * 1024) {
                console.warn(`Audio size ${(audioBase64.length / 1024 / 1024).toFixed(2)}MB exceeds 25MB limit`);
                console.warn('Consider using MP3 format or reducing sample rate');
                throw new Error('Audio file too large. Max 25MB. Use MP3 format to compress.');
            }
            
            content.push({
                type: 'input_audio',
                input_audio: {
                    data: audioBase64,
                    format: options.audioFormat || 'wav'
                }
            });
        }

        messages.push({
            role: 'user',
            content
        });

        try {
            console.log(`Sending request to Zhipu API with ${content.length} content items...`);
            if (options.audioData) {
                const audioSize = typeof options.audioData === 'string' 
                    ? options.audioData.length 
                    : options.audioData.length;
                console.log(`Audio size: ${(audioSize / 1024 / 1024).toFixed(2)}MB`);
            }
            
            const response = await this.client.post('/chat/completions', {
                model: this.model,
                messages,
                stream: false
            });

            return response.data as ZhipuResponse;
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                console.error('Request timeout (120s exceeded). Audio file may be too large.');
                console.error('Solutions: 1) Use MP3 format instead of WAV, 2) Reduce sample rate, 3) Send shorter audio');
            } else if (error.response?.status === 413) {
                console.error('Audio payload too large (413 Payload Too Large)');
            } else if (error.response?.status === 429) {
                console.error('Rate limited by API. Wait before retrying.');
            }
            console.error('Zhipu API error:', error.message);
            throw error;
        }
    }

    /**
     * Save audio response to WAV file
     */
    public saveAudioAsWav(
        audioData: string | Buffer,
        filepath: string,
        sampleRate: number = 44100
    ): void {
        try {
            // Ensure tmp directory exists
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            let audioBuffer: Buffer;
            if (typeof audioData === 'string') {
                // If it's base64 string, decode it
                audioBuffer = Buffer.from(audioData, 'base64');
            } else {
                audioBuffer = audioData;
            }

            // Simple WAV header generation
            const channels = 1;
            const bitDepth = 16;
            const bytesPerSample = bitDepth / 8;
            const byteRate = sampleRate * channels * bytesPerSample;
            const blockAlign = channels * bytesPerSample;

            const header = Buffer.alloc(44);
            
            // RIFF header
            header.write('RIFF', 0);
            header.writeUInt32LE(36 + audioBuffer.length, 4);
            header.write('WAVE', 8);

            // fmt sub-chunk
            header.write('fmt ', 12);
            header.writeUInt32LE(16, 16); // Subchunk1Size
            header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
            header.writeUInt16LE(channels, 22);
            header.writeUInt32LE(sampleRate, 24);
            header.writeUInt32LE(byteRate, 28);
            header.writeUInt16LE(blockAlign, 32);
            header.writeUInt16LE(bitDepth, 34);

            // data sub-chunk
            header.write('data', 36);
            header.writeUInt32LE(audioBuffer.length, 40);

            const wavFile = Buffer.concat([header, audioBuffer]);
            fs.writeFileSync(filepath, wavFile);

            console.log(`Audio saved to ${filepath}`);
        } catch (error) {
            console.error('Error saving audio:', error);
            throw error;
        }
    }

    /**
     * Extract text from Zhipu response
     */
    public getTextFromResponse(response: ZhipuResponse): string {
        if (!response.choices || response.choices.length === 0) {
            return '';
        }

        const message = response.choices[0].message;
        if (!message.content) {
            return '';
        }

        // Handle both array and string formats
        if (Array.isArray(message.content)) {
            const textContent = message.content.find(c => c.type === 'text');
            return textContent?.text || '';
        } else if (typeof message.content === 'string') {
            // If content is a string directly, return it
            return message.content;
        }

        return '';
    }

    /**
     * Extract audio from Zhipu response
     */
    public getAudioFromResponse(response: ZhipuResponse): { data: string; format: string } | null {
        if (!response.choices || response.choices.length === 0) {
            return null;
        }

        const message = response.choices[0].message;
        if (!message.content) {
            return null;
        }

        // Handle array format
        if (Array.isArray(message.content)) {
            const audioContent = message.content.find(c => c.type === 'audio');
            if (audioContent && audioContent.audio) {
                return {
                    data: audioContent.audio.data,
                    format: audioContent.audio.format
                };
            }
        }

        return null;
    }
}
