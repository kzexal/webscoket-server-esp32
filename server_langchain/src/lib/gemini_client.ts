
import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as fs from 'fs';

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{
        text?: string;
        inlineData?: {
            mimeType: string;
            data: string;
        };
    }>;
}

export class GeminiClient {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private modelName: string = 'gemini-2.5-flash-lite';

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            tools: [
                {
                    googleSearch: {}
                } as any // Cast to any to avoid Tool type error
            ],
            generationConfig: {
                temperature: 0.7,
                topP: 0.7,
                maxOutputTokens: 300,
            } as any,
        });

        // Note: For thinking models, we might need to handle safety settings differently or they might be stricter.
        // Keeping existing settings for now.
    }

    /**
     * Gửi request đến Gemini.
     */
    public async chat(options: {
        text?: string;
        systemPrompt?: string;
    }): Promise<string> {
        if (!options.text) {
            throw new Error('Message content cannot be empty. Please provide text.');
        }

        try {
            console.log(`Sending request to Gemini (${this.modelName})...`);

            const parts: any[] = [{ text: options.text }];

            // Note: Gemini API treats system instructions differently (usually passed at model creation),
            // but for simple chat, we can prepend it or use the systemInstruction param if generating a new model instance.
            // For now, let's prepend it if provided, or use a fresh model instance with system instruction.

            let modelToUse = this.model;
            if (options.systemPrompt) {
                modelToUse = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: options.systemPrompt,
                    tools: [
                        {
                            googleSearch: {}
                        } as any
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.7,
                        maxOutputTokens: 300,
                    } as any
                });
            }

            const result = await modelToUse.generateContent(options.text);
            const response = result.response;
            return response.text();
        } catch (error: any) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }

    /**
     * Gửi request đến Gemini với streaming mode
     */
    public async chatStream(options: {
        text?: string;
        systemPrompt?: string;
        onChunk?: (text: string, isDone: boolean) => void;
    }): Promise<string> {
        if (!options.text) {
            throw new Error('Message content cannot be empty. Please provide text.');
        }

        try {
            console.log(`→ Gemini: "${options.text.substring(0, 100)}${options.text.length > 100 ? '...' : ''}"`);

            let modelToUse = this.model;
            if (options.systemPrompt) {
                modelToUse = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: options.systemPrompt,
                    tools: [
                        {
                            googleSearch: {}
                        } as any
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.7,
                        maxOutputTokens: 300,
                    } as any
                });
            }

            const result = await modelToUse.generateContentStream(options.text);

            let fullText = '';

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;
                process.stdout.write(chunkText);
                if (options.onChunk) {
                    options.onChunk(chunkText, false);
                }
            }

            console.log('\n'); // Xuống dòng sau khi streaming xong
            if (options.onChunk) {
                options.onChunk('', true);
            }

            return fullText;

        } catch (error: any) {
            console.error("Gemini API Stream Error:", error);
            throw error;
        }
    }
}
