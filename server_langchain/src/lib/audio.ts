import { WebSocket } from 'ws';
import * as wav from 'wav';
import { Writable } from 'stream';
import * as fs from 'fs';
import path from 'path';

export enum AudioFormat {
    WAV = 'wav',
    MP3 = 'mp3',
    AAC = 'aac',
    PCM = 'pcm'
}

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
}

export enum SampleRate {
    RATE_16000 = 16000,
    RATE_44100 = 44100,
    RATE_24000 = 24000,
    RATE_22050 = 22050
}

export class AudioManager {
    private configMediumDef: AudioConfig = {
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16
    };

    private configLowDef: AudioConfig = {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
    };

    private configHighDef: AudioConfig = {
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16
    };

    private configUltraHighDef: AudioConfig = {
        sampleRate: 96000,
        channels: 1,
        bitDepth: 16
    };

    private fileWriter: wav.FileWriter | undefined;
    private writeTimeout: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private config = this.configHighDef;
    private detectedFormat: AudioFormat | null = null;
    private recordingFilePath: string | null = null;

    constructor() {
    }

    private initializeFileWriter(filename: string) {
        this.fileWriter = new wav.FileWriter(filename, {
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            bitDepth: this.config.bitDepth
        });
    }

    public resetRecording(): void {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
        
        //Đóng trình ghi tệp hiện có nếu có
        if (this.fileWriter) {
            this.fileWriter.end();
            this.fileWriter = undefined;
        }
        
        //Đặt lại bộ đệm và trạng thái xử lý
        this.audioBuffer = Buffer.alloc(0);
        this.isProcessing = false;
        this.detectedFormat = null;
        this.recordingFilePath = null;
    }

    public startRecording() {
        this.resetRecording();
        
        //Tạo tên tệp với ID ngẫu nhiên
        const randomId = Math.random().toString(36).substring(2, 15);
        const tmpDir = path.join(__dirname, '../../tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        const filename = path.join(tmpDir, `recording-${randomId}`);
        this.recordingFilePath = filename;
        
        console.log(`Started new recording session: ${filename}`);
    }

    private detectFormat(buffer: Buffer): AudioFormat {
        if (buffer.length < 3) {
            return AudioFormat.PCM; 
        }

        //Kiểm tra định dạng MP3
        if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
            return AudioFormat.MP3;
        }
        
        if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
            return AudioFormat.MP3;
        }
        
        //Kiểmểm tra định dạng WAV
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            return AudioFormat.WAV;
        }
        
       
        if (buffer[0] === 0xFF && (buffer[1] & 0xF0) === 0xF0) {
            return AudioFormat.MP3;
        }
        return AudioFormat.PCM;
    }

    private audioBuffer: Buffer = Buffer.alloc(0);
    private readonly WRITE_DELAY = 500; 
    private readonly MAX_BUFFER_SIZE = 1024 * 1024; 
    private readonly MIN_BUFFER_SIZE = this.config.sampleRate; 

    public handleAudioBuffer(buffer: Buffer): void {
        try {
            //Xác định định dạng trong bộ đệm đầu tiên
            if (this.detectedFormat === null && buffer.length > 0) {
                this.detectedFormat = this.detectFormat(buffer);
                console.log(`Detected audio format: ${this.detectedFormat}`);
                if (this.detectedFormat === AudioFormat.PCM || this.detectedFormat === AudioFormat.WAV) {
                    if (this.recordingFilePath) {
                        const filename = `${this.recordingFilePath}.wav`;
                        this.initializeFileWriter(filename);
                        console.log(`Initialized WAV file writer: ${filename}`);
                    }
                } else if (this.detectedFormat === AudioFormat.MP3 || this.detectedFormat === AudioFormat.AAC) {
                    if (this.recordingFilePath) {
                        const ext = this.detectedFormat === AudioFormat.MP3 ? 'mp3' : 'aac';
                        this.recordingFilePath = `${this.recordingFilePath}.${ext}`;
                        console.log(`Will save compressed audio to: ${this.recordingFilePath}`);
                    }
                }
            }
            if (this.audioBuffer.length + buffer.length > this.MAX_BUFFER_SIZE) {
                this.processAndWriteBuffer();
            }

            this.audioBuffer = Buffer.concat([this.audioBuffer, buffer]);
            if (this.detectedFormat === AudioFormat.MP3 || this.detectedFormat === AudioFormat.AAC) {
                return;
            }

            if (this.writeTimeout) {
                clearTimeout(this.writeTimeout);
            }

            this.writeTimeout = setTimeout(() => {
                if (this.audioBuffer.length > 0) {
                    this.processAndWriteBuffer();
                }
            }, this.WRITE_DELAY);

            if (this.audioBuffer.length >= this.MIN_BUFFER_SIZE && !this.isProcessing) {
                this.processAndWriteBuffer();
            }

        } catch (error) {
            console.error('Error handling audio buffer:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message, error.stack);
            }
            this.audioBuffer = Buffer.alloc(0);
            this.isProcessing = false;
        }
    }

    private processAndWriteBufferSimple(): void {
        console.log('******Processing audio buffer:', {
            bufferSize: this.audioBuffer.length,
            hasFileWriter: !!this.fileWriter,
            isProcessing: this.isProcessing
        });
        if (!this.fileWriter || this.audioBuffer.length === 0 || this.isProcessing) {
            console.log('Skipping write - conditions not met:', {
                hasFileWriter: !!this.fileWriter,
                bufferLength: this.audioBuffer.length,
                isProcessing: this.isProcessing
            });
            return;
        }

        try {
            this.isProcessing = true;
            const bufferToWrite = this.audioBuffer;
            this.audioBuffer = Buffer.alloc(0);
            this.fileWriter.write(bufferToWrite);
            console.log(`Successfully wrote ${bufferToWrite.length} bytes of audio data`);
        } catch (error) {
            console.error('Error writing audio buffer:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    public getCurrentBuffer(): Buffer {
        try {
            if (this.detectedFormat === AudioFormat.MP3 || this.detectedFormat === AudioFormat.AAC) {
                console.log(`Getting buffer for ${this.detectedFormat.toUpperCase()}: ${this.audioBuffer.length} bytes`);
                if (this.audioBuffer.length > 0) {
                    if (this.recordingFilePath) {
                        fs.writeFileSync(this.recordingFilePath, this.audioBuffer);
                        console.log(`Saved ${this.detectedFormat.toUpperCase()} file: ${this.recordingFilePath} (${(this.audioBuffer.length / 1024).toFixed(2)} KB)`);
                    }
                    return this.audioBuffer;
                }
                console.warn('Audio buffer is empty!');
                return Buffer.alloc(0);
            }
            if (!this.fileWriter) {
                console.error('No file writer available');
                return Buffer.alloc(0);
            }

            const audioFilePath = this.fileWriter.path;
            const fileBuffer = fs.readFileSync(audioFilePath);
            console.log(`Successfully read audio file: ${audioFilePath}`);
            return fileBuffer;
        } catch (error) {
            console.error('Error reading current audio buffer:', error);
            return Buffer.alloc(0);
        }
    }

    
     //Lấy định dạng âm thanh đã phát hiện
     
    public getDetectedFormat(): AudioFormat | null {
        return this.detectedFormat;
    }

    private processAndWriteBuffer(): void {
        return this.processAndWriteBufferSimple();
    }

    private processAndWriteBufferWithGain(): void {
        if (this.isProcessing || this.audioBuffer.length === 0) return;

        this.isProcessing = true;
        try {
            //Chuyển đổi buffer thành mẫu PCM 16-bit
            const samples = new Int16Array(this.audioBuffer.length / 2);
            for (let i = 0; i < this.audioBuffer.length; i += 2) {
                const sample = this.audioBuffer.readInt16LE(i);
                samples[i / 2] = sample;
            }

            const maxAmplitude = Math.max(...Array.from(samples).map(Math.abs));
            
            if (maxAmplitude > 100) {
                const processedBuffer = this.processAudioSamples(samples, maxAmplitude);
                this.fileWriter?.write(processedBuffer);
                console.log(`Processed and wrote ${this.audioBuffer.length} bytes of audio data`);
            } else {
                console.log('Skipping buffer - insufficient audio level');
            }

            //Xoá bộ đệm sau khi xử lý
            this.audioBuffer = Buffer.alloc(0);
        } finally {
            this.isProcessing = false;
        }
    }
    private processAudioSamples(samples: Int16Array, maxAmplitude: number): Buffer {
        const processedSamples = new Int16Array(samples.length);
        const GAIN = 0.1; 
        const normalizeRatio = maxAmplitude > 0 ? (32767 / maxAmplitude) * GAIN : 1;
        const noiseFloor = 15; 
        const maxVal = 32767 * 0.6;
        
        let prevSample = 0; 
        const smoothingFactor = 0.1;

        for (let i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i]) < noiseFloor) {
                processedSamples[i] = 0;
                continue;
            }

            let normalizedSample = samples[i] * normalizeRatio;
            
            normalizedSample = prevSample + smoothingFactor * (normalizedSample - prevSample);
            prevSample = normalizedSample;

            processedSamples[i] = Math.round(
                Math.max(Math.min(normalizedSample, maxVal), -maxVal)
            );
        }

        return Buffer.from(processedSamples.buffer);
    }

    public closeFile(): void {
        console.log('Closing file writer');
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }

       

        if (this.audioBuffer.length > 0) {
            console.log(`Processing remaining ${this.audioBuffer.length} bytes before closing`);
            this.processAndWriteBuffer();
        }
  
        if (this.fileWriter) {
            this.fileWriter.end();
            console.log('WAV file writer closed');

        }
    }
}
