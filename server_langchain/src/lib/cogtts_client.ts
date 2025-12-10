import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface CogTTSOptions {
    voice?: 'female' | 'male' | 'tongtong' | 'xiaochen' | 'chuchui' | 'jam' | 'kazi' | 'douji' | 'luodo';
    speed?: number; // 0.5 - 2.0, default 1.0
    volume?: number; // 0.0 - 1.0, default 1.0
    response_format?: 'wav' | 'pcm';
    encode_format?: 'base64';
    stream?: boolean;
}

export interface CogTTSResponse {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta?: {
            role: string;
            return_sample_rate?: number;
            content: string;
        };
        finish_reason?: string;
    }>;
}

export class CogTTSClient {
    private apiKey: string;
    private client: AxiosInstance;
    private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
    private model = 'cogtts';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 seconds
        });
    }

    /**
     * Convert text to speech using CogTTS
     */
    public async textToSpeech(
        text: string,
        options: CogTTSOptions = {}
    ): Promise<Buffer> {
        const {
            voice = 'female',
            speed = 1.0,
            volume = 1.0,
            response_format = 'wav',
            encode_format = 'base64',
            stream = false
        } = options;

        try {
            console.log(`Converting text to speech with CogTTS (${voice} voice, speed: ${speed}, volume: ${volume})...`);
            console.log(`Text length: ${text.length} characters`);

            const requestBody: any = {
                model: this.model,
                input: text,
                voice: voice,
                speed: speed,
                volume: volume
            };

            // For streaming, add response_format, encode_format, and stream
            // For non-streaming, API returns WAV binary directly (no need for these params)
            if (stream) {
                requestBody.response_format = response_format;
                requestBody.encode_format = encode_format;
                requestBody.stream = true;
            }

            console.log(`CogTTS request: model=${this.model}, voice=${voice}, stream=${stream}, text_length=${text.length}`);

            const response = await this.client.post('/audio/speech', requestBody, {
                responseType: stream ? 'text' : 'arraybuffer' // Non-streaming returns WAV binary directly
            });

            if (stream) {
                // Handle streaming response
                return this.handleStreamingResponse(response);
            } else {
                // Handle non-streaming response
                return this.handleNonStreamingResponse(response);
            }
        } catch (error: any) {
            console.error('CogTTS API error:', error.message);
            if (error.response) {
                const errorData = error.response.data;
                let errorMessage = 'Unknown error';
                
                // Try to decode error message
                if (Buffer.isBuffer(errorData)) {
                    try {
                        const errorJson = JSON.parse(errorData.toString('utf8'));
                        if (errorJson.error) {
                            errorMessage = `Code: ${errorJson.error.code}, Message: ${errorJson.error.message}`;
                        } else {
                            errorMessage = errorData.toString('utf8');
                        }
                    } catch (e) {
                        errorMessage = errorData.toString('utf8');
                    }
                } else if (typeof errorData === 'object') {
                    if (errorData.error) {
                        errorMessage = `Code: ${errorData.error.code}, Message: ${errorData.error.message}`;
                    } else {
                        errorMessage = JSON.stringify(errorData);
                    }
                } else {
                    errorMessage = String(errorData);
                }
                
                console.error('CogTTS error details:', errorMessage);
                console.error('Status code:', error.response.status);
                
                // 429 = Rate limit or quota exceeded
                if (error.response.status === 429) {
                    console.error('CogTTS rate limit or quota exceeded. Check your API quota.');
                }
            }
            throw error;
        }
    }

    /**
     * Handle non-streaming response
     */
    private handleNonStreamingResponse(response: any): Buffer {
        // Non-streaming returns audio data directly as binary (ArrayBuffer)
        if (response.data instanceof ArrayBuffer) {
            return Buffer.from(response.data);
        } else if (response.data instanceof Buffer) {
            return response.data;
        } else if (typeof response.data === 'string') {
            // Base64 encoded string
            return Buffer.from(response.data, 'base64');
        } else if (response.data && typeof response.data === 'object') {
            // Check if it's a JSON response with base64 content
            if (response.data.choices && response.data.choices[0]?.delta?.content) {
                const base64Audio = response.data.choices[0].delta.content;
                return Buffer.from(base64Audio, 'base64');
            } else if (response.data.content) {
                // Direct content field
                return Buffer.from(response.data.content, 'base64');
            }
        }
        
        throw new Error('Unexpected response format from CogTTS. Response type: ' + typeof response.data);
    }

    /**
     * Handle streaming response
     */
    private async handleStreamingResponse(response: any): Promise<Buffer> {
        const audioChunks: Buffer[] = [];
        
        // For streaming, we need to collect all chunks
        // This is a simplified version - actual streaming would use SSE
        if (response.data && typeof response.data === 'string') {
            // If it's a string with data: prefix (SSE format)
            const lines = response.data.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.choices && data.choices[0]?.delta?.content) {
                            const base64Audio = data.choices[0].delta.content;
                            audioChunks.push(Buffer.from(base64Audio, 'base64'));
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }

        if (audioChunks.length === 0) {
            throw new Error('No audio data received from CogTTS streaming');
        }

        return Buffer.concat(audioChunks);
    }

    /**
     * Save audio to file
     */
    public saveAudioToFile(audioBuffer: Buffer, filepath: string): void {
        try {
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filepath, audioBuffer);
            console.log(`CogTTS audio saved: ${filepath} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        } catch (error) {
            console.error('Error saving CogTTS audio:', error);
            throw error;
        }
    }
}

