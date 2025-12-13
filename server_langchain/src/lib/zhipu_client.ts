import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Cập nhật interface để content linh hoạt hơn (string hoặc array)
export interface ZhipuMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{
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
            content: string | Array<{
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
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class ZhipuAiClient {
    private apiKey: string;
    private client: AxiosInstance;
    private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
    
    // Đã chuyển sang model glm-4-flashx theo yêu cầu
    private model = 'glm-4-flashx'; 

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // FlashX khá nhanh nên 60s là đủ
        });
    }

    // Helper: Chuyển file WAV thành base64
    public getBase64FromWav(wavPath: string): string {
        try {
            const audioBytes = fs.readFileSync(wavPath);
            return Buffer.from(audioBytes).toString('base64');
        } catch (error) {
            console.error('Error reading wav file:', error);
            return '';
        }
    }

    // Helper: Chuyển buffer thành base64
    public getBase64FromBuffer(audioBuffer: Buffer): string {
        return audioBuffer.toString('base64');
    }

    /**
     * Gửi request đến Zhipu AI.
     * Lưu ý: glm-4-flashx chỉ hỗ trợ text. Nếu có audioData, code sẽ cảnh báo và bỏ qua.
     */
    public async chat(options: {
        audioData?: string | Buffer;
        audioFormat?: 'wav' | 'mp3' | 'aac';
        text?: string;
        systemPrompt?: string; // Thêm option cho system prompt nếu cần
    }): Promise<ZhipuResponse> {
        const messages: ZhipuMessage[] = [];

        // 1. Xử lý System Prompt (nếu có)
        if (options.systemPrompt) {
            messages.push({
                role: 'system',
                content: options.systemPrompt
            });
        }

        // 2. Xử lý User Message
        // Với glm-4-flashx, dùng string trực tiếp sẽ tốt hơn array object
        if (!options.text) {
            throw new Error('Message content cannot be empty. Please provide text.');
        }

        // Với glm-4-flashx, dùng string trực tiếp cho content
        if (this.model === 'glm-4-flashx' || this.model === 'glm-4-flash') {
            messages.push({
                role: 'user',
                content: options.text // String trực tiếp
            });
        } else {
            // Với các model khác, có thể dùng array format
            const contentParts: any[] = [];
            contentParts.push({
                type: 'text',
                text: options.text
            });

            if (options.audioData) {
                const audioBase64 = typeof options.audioData === 'string' 
                    ? options.audioData 
                    : this.getBase64FromBuffer(options.audioData);
                
                if (audioBase64.length > 25 * 1024 * 1024) {
                    throw new Error('Audio file too large (Max 25MB base64 size).');
                }

                contentParts.push({
                    type: 'input_audio',
                    input_audio: {
                        data: audioBase64,
                        format: options.audioFormat || 'wav'
                    }
                });
            }

            messages.push({
                role: 'user',
                content: contentParts
            });
        }

        try {
            // Log nhẹ để debug
            console.log(`Sending request to Zhipu (${this.model})...`);
            
            const response = await this.client.post('/chat/completions', {
                model: this.model,
                messages,
                stream: false,
                // FlashX có thể chỉnh temperature thấp để phản hồi chính xác hơn
                temperature: 0.7, 
                top_p: 0.7,
                max_tokens: 150 // Giới hạn ~70 từ (khoảng 100-150 tokens)
            });

            return response.data as ZhipuResponse;
        } catch (error: any) {
            this.handleError(error);
            throw error;
        }
    }

    /**
     * Gửi request đến Zhipu AI với streaming mode để giảm độ trễ
     */
    public async chatStream(options: {
        audioData?: string | Buffer;
        audioFormat?: 'wav' | 'mp3' | 'aac';
        text?: string;
        systemPrompt?: string;
        onChunk?: (text: string, isDone: boolean) => void;
    }): Promise<string> {
        const messages: ZhipuMessage[] = [];

        // 1. Xử lý System Prompt (nếu có)
        if (options.systemPrompt) {
            messages.push({
                role: 'system',
                content: options.systemPrompt
            });
        }

        // 2. Xử lý User Message
        // Với glm-4-flashx, dùng string trực tiếp sẽ tốt hơn array object
        if (!options.text) {
            throw new Error('Message content cannot be empty. Please provide text.');
        }

        // Với glm-4-flashx, dùng string trực tiếp cho content
        if (this.model === 'glm-4-flashx' || this.model === 'glm-4-flash') {
            messages.push({
                role: 'user',
                content: options.text // String trực tiếp
            });
        } else {
            // Với các model khác, có thể dùng array format
            const contentParts: any[] = [];
            contentParts.push({
                type: 'text',
                text: options.text
            });

            if (options.audioData) {
                const audioBase64 = typeof options.audioData === 'string' 
                    ? options.audioData 
                    : this.getBase64FromBuffer(options.audioData);
                
                if (audioBase64.length > 25 * 1024 * 1024) {
                    throw new Error('Audio file too large (Max 25MB base64 size).');
                }

                contentParts.push({
                    type: 'input_audio',
                    input_audio: {
                        data: audioBase64,
                        format: options.audioFormat || 'wav'
                    }
                });
            }

            messages.push({
                role: 'user',
                content: contentParts
            });
        }

        try {
            // Log user message một cách gọn gàng
            const userMessage = messages.find(m => m.role === 'user');
            const userText = typeof userMessage?.content === 'string' 
                ? userMessage.content 
                : (userMessage?.content as any)?.find((c: any) => c.type === 'text')?.text || '';
            console.log(`→ Zhipu: "${userText.substring(0, 100)}${userText.length > 100 ? '...' : ''}"`);
            
            const response = await this.client.post('/chat/completions', {
                model: this.model,
                messages,
                stream: true, // Bật streaming mode
                temperature: 0.7, 
                top_p: 0.7,
                max_tokens: 150 // Giới hạn ~70 từ (khoảng 100-150 tokens)
            }, {
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let fullText = '';
                let buffer = '';

                response.data.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
                            continue;
                        }

                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const jsonStr = trimmedLine.slice(6);
                                const data = JSON.parse(jsonStr);
                                
                                // Zhipu streaming có thể dùng delta hoặc message.content
                                const delta = data.choices?.[0]?.delta;
                                const message = data.choices?.[0]?.message;
                                
                                if (delta?.content) {
                                    const chunkText = delta.content;
                                    fullText += chunkText;
                                    // Hiển thị từng chunk khi nhận được (streaming)
                                    process.stdout.write(chunkText);
                                    if (options.onChunk) {
                                        options.onChunk(chunkText, false);
                                    }
                                } else if (message?.content) {
                                    // Fallback: nếu không có delta, thử lấy từ message
                                    const content = typeof message.content === 'string' 
                                        ? message.content 
                                        : message.content?.find((c: any) => c.type === 'text')?.text || '';
                                    if (content && !fullText.includes(content)) {
                                        fullText += content;
                                        process.stdout.write(content);
                                        if (options.onChunk) {
                                            options.onChunk(content, false);
                                        }
                                    }
                                }
                            } catch (e) {
                                // Bỏ qua lỗi parse cho incomplete JSON
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    console.log('\n'); // Xuống dòng sau khi streaming xong
                    if (options.onChunk) {
                        options.onChunk('', true);
                    }
                    resolve(fullText);
                });

                response.data.on('error', (error: any) => {
                    this.handleError(error);
                    reject(error);
                });
            });
        } catch (error: any) {
            this.handleError(error);
            throw error;
        }
    }

    // Lấy text từ response
    public getTextFromResponse(response: ZhipuResponse): string {
        if (!response.choices || response.choices.length === 0) {
            return '';
        }

        const message = response.choices[0].message;
        
        // Trường hợp content là string (thường gặp ở FlashX)
        if (typeof message.content === 'string') {
            return message.content;
        }

        // Trường hợp content là array (thường gặp ở Voice hoặc Multimodal)
        if (Array.isArray(message.content)) {
            const textContent = message.content.find(c => c.type === 'text');
            return textContent?.text || '';
        }

        return '';
    }

    // Lấy audio từ response (Chỉ dùng được nếu model trả về audio, FlashX sẽ luôn trả về null)
    public getAudioFromResponse(response: ZhipuResponse): { data: string; format: string } | null {
        if (!response.choices || response.choices.length === 0) return null;

        const message = response.choices[0].message;
        
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

    private handleError(error: any) {
        if (error.response) {
            console.error(`Zhipu API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 400) {
                console.error('Check your message format. Sending audio to a text model causes this.');
            }
        } else {
            console.error('Network/Client Error:', error.message);
        }
    }
}