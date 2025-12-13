import { createClient, DeepgramClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export class DeepgramService {
    private client: DeepgramClient;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Deepgram API Key is required");
        }
        this.client = createClient(apiKey);
    }

    /**
     * Chuyển đổi Audio Buffer thành văn bản (non-streaming)
     */
    public async transcribe(audioBuffer: Buffer, mimetype: string = 'audio/wav'): Promise<string> {
        try {
            console.log(`Sending audio to Deepgram (Size: ${audioBuffer.length} bytes)...`);
            
            const { result, error } = await this.client.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: "nova-2",
                    smart_format: true, // Tự động thêm dấu câu, viết hoa
                    language: "en",     // Hoặc "vi" nếu bạn nói tiếng Việt
                    filler_words: false,
                    punctuate: true,
                }
            );

            if (error) {
                console.error("Deepgram Error:", error);
                throw error;
            }

            // Lấy kết quả transcript
            const transcript = result.results.channels[0].alternatives[0].transcript;
            
            if (!transcript) {
                console.warn("Deepgram returned empty transcript.");
                return "";
            }

            console.log(`Deepgram Transcript: "${transcript}"`);
            return transcript;

        } catch (err) {
            console.error("Transcribe failed:", err);
            throw err;
        }
    }

    /**
     * Real-time streaming transcription - sử dụng WebSocket live connection
     * Phù hợp cho ESP32 với mic thật, gửi audio chunks theo thời gian thực
     */
    public async transcribeStream(
        audioChunks: Buffer[],
        mimetype: string = 'audio/wav',
        onTranscript?: (transcript: string, isFinal: boolean) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                // Tạo live transcription connection
                const connection = this.client.listen.live({
                    model: "nova-2",
                    smart_format: true,
                    language: "en",
                    filler_words: false,
                    punctuate: true,
                    interim_results: true, // Nhận kết quả tạm thời
                });

                let allFinalTranscripts: string[] = [];
                let lastFinalTranscript = "";
                let isResolved = false;

                connection.on(LiveTranscriptionEvents.Open, () => {
                    console.log("Deepgram streaming connection opened");
                    // Gửi tất cả audio chunks theo thứ tự
                    for (const chunk of audioChunks) {
                        // Convert Buffer to ArrayBuffer for Deepgram SDK compatibility
                        const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
                        connection.send(arrayBuffer);
                    }
                    // Đánh dấu kết thúc stream
                    connection.finish();
                });

                connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
                    try {
                        const transcript = data.channel?.alternatives?.[0]?.transcript;
                        if (transcript) {
                            const isFinal = data.is_final || false;
                            if (isFinal) {
                                // Lưu tất cả final transcripts
                                allFinalTranscripts.push(transcript.trim());
                                lastFinalTranscript = transcript.trim();
                                console.log(`Deepgram Final Transcript: "${transcript}"`);
                            } 
                            if (onTranscript) {
                                onTranscript(transcript, isFinal);
                            }
                        }
                    } catch (err) {
                        console.warn("Error processing transcript:", err);
                    }
                });

                connection.on(LiveTranscriptionEvents.Close, () => {
                    console.log("Deepgram streaming connection closed");
                    if (!isResolved) {
                        isResolved = true;
                        // Nối tất cả final transcripts lại với nhau
                        // Deepgram có thể trả về từng phần riêng biệt, cần nối lại
                        let completeTranscript = "";
                        
                        if (allFinalTranscripts.length > 0) {
                            // Loại bỏ các phần trùng lặp hoặc bị chứa trong phần khác
                            const uniqueParts: string[] = [];
                            for (const part of allFinalTranscripts) {
                                const partTrimmed = part.trim();
                                if (!partTrimmed) continue;
                                
                                const partLower = partTrimmed.toLowerCase();
                                
                                // Kiểm tra xem part này có bị chứa trong phần nào khác không
                                const isSubset = uniqueParts.some(existing => {
                                    const existingLower = existing.toLowerCase();
                                    return existingLower.includes(partLower) && existingLower !== partLower;
                                });
                                
                                if (!isSubset) {
                                    // Nếu part này chứa một phần cũ, thay thế phần cũ
                                    const indexToReplace = uniqueParts.findIndex(existing => {
                                        const existingLower = existing.toLowerCase();
                                        return partLower.includes(existingLower) && partLower !== existingLower;
                                    });
                                    
                                    if (indexToReplace >= 0) {
                                        uniqueParts[indexToReplace] = partTrimmed;
                                    } else {
                                        uniqueParts.push(partTrimmed);
                                    }
                                }
                            }
                            
                            // Nối các phần lại với space
                            completeTranscript = uniqueParts.join(" ").trim();
                            console.log(`Combined ${allFinalTranscripts.length} final transcripts into: "${completeTranscript}"`);
                        } else if (lastFinalTranscript) {
                            // Fallback: dùng transcript cuối cùng nếu không có gì khác
                            completeTranscript = lastFinalTranscript;
                        }
                        
                        console.log(`Complete Deepgram Transcript: "${completeTranscript}"`);
                        resolve(completeTranscript || "");
                    }
                });

                connection.on(LiveTranscriptionEvents.Error, (error: any) => {
                    console.error("Deepgram streaming error:", error);
                    if (!isResolved) {
                        isResolved = true;
                        // Fallback: thử gộp chunks và dùng non-streaming
                        const fullBuffer = Buffer.concat(audioChunks);
                        this.transcribe(fullBuffer, mimetype)
                            .then(resolve)
                            .catch(reject);
                    }
                });

                // Timeout safety: nếu không nhận được response sau 30s, fallback
                setTimeout(() => {
                    if (!isResolved) {
                        console.warn("Deepgram streaming timeout, using fallback");
                        isResolved = true;
                        connection.finish();
                        const fullBuffer = Buffer.concat(audioChunks);
                        this.transcribe(fullBuffer, mimetype)
                            .then(resolve)
                            .catch(reject);
                    }
                }, 30000);

            } catch (err) {
                console.error("Streaming transcribe setup failed, using fallback:", err);
                // Fallback: thử gộp chunks và dùng non-streaming
                const fullBuffer = Buffer.concat(audioChunks);
                this.transcribe(fullBuffer, mimetype)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
}