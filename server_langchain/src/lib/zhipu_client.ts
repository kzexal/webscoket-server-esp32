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
            timeout: 120000  
        });
    }

    
    // Chuyển file WAV thành base64
    
    public getBase64FromWav(wavPath: string): string {
        const audioBytes = fs.readFileSync(wavPath);
        return Buffer.from(audioBytes).toString('base64');
    }

        // Chuyển buffer thành base64
    public getBase64FromBuffer(audioBuffer: Buffer): string {
        return audioBuffer.toString('base64');
    }

    // Gửi audio đến model Zhipu GLM-4-Voice
    
    public async chat(options: {
        audioData?: string | Buffer;
        audioFormat?: 'wav' | 'mp3' | 'aac';
        text?: string;
    }): Promise<ZhipuResponse> {
        const messages: ZhipuMessage[] = [];
        const content: ZhipuMessage['content'] = [];

        if (options.text) {
            content.push({
                type: 'text',
                text: options.text
            });
        }

        if (options.audioData) {
            const audioBase64 = typeof options.audioData === 'string' 
                ? options.audioData 
                : this.getBase64FromBuffer(options.audioData);
            
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

    // Lấy text từ response của Zhipu
    
    public getTextFromResponse(response: ZhipuResponse): string {
        if (!response.choices || response.choices.length === 0) {
            return '';
        }

        const message = response.choices[0].message;
        if (!message.content) {
            return '';
        }

        if (Array.isArray(message.content)) {
            const textContent = message.content.find(c => c.type === 'text');
            return textContent?.text || '';
        } else if (typeof message.content === 'string') {
            return message.content;
        }
        return '';
    }
    public getAudioFromResponse(response: ZhipuResponse): { data: string; format: string } | null {
        if (!response.choices || response.choices.length === 0) {
            return null;
        }

        const message = response.choices[0].message;
        if (!message.content) {
            return null;
        }

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
