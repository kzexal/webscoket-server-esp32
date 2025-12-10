import * as fs from 'fs';
import * as path from 'path';

export interface ResponseData {
    timestamp: string;
    audioPath?: string;
    textContent: string;
    duration?: number;
    audioSize?: number;
}

export class ResponseSaver {
    private responsesDir: string;
    private currentSession: string;

    constructor(baseDir: string = 'responses') {
        this.responsesDir = path.join(process.cwd(), baseDir);
        this.currentSession = this.generateSessionId();
        this.ensureDirectoriesExist();
    }

    /**
     * Generate unique session ID based on timestamp
     */
    private generateSessionId(): string {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
               now.getTime().toString().slice(-6);
    }

    /**
     * Ensure necessary directories exist
     */
    private ensureDirectoriesExist(): void {
        const dirs = [
            this.responsesDir,
            path.join(this.responsesDir, this.currentSession),
            path.join(this.responsesDir, this.currentSession, 'audio'),
            path.join(this.responsesDir, this.currentSession, 'text')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Save audio response to file
     */
    public saveAudioResponse(
        audioData: string | Buffer,
        format: 'mp3' | 'wav' | 'aac' = 'mp3'
    ): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const audioDir = path.join(this.responsesDir, this.currentSession, 'audio');
        const filename = `response_${timestamp}.${format}`;
        const filepath = path.join(audioDir, filename);

        try {
            if (typeof audioData === 'string') {
                // If base64, decode first
                const buffer = Buffer.from(audioData, 'base64');
                fs.writeFileSync(filepath, buffer);
            } else {
                fs.writeFileSync(filepath, audioData);
            }

            console.log(`✅ Audio saved: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to save audio: ${error}`);
            throw error;
        }
    }

    /**
     * Save text response to file
     */
    public saveTextResponse(text: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const textDir = path.join(this.responsesDir, this.currentSession, 'text');
        const filename = `response_${timestamp}.txt`;
        const filepath = path.join(textDir, filename);

        try {
            fs.writeFileSync(filepath, text, 'utf-8');
            console.log(`✅ Text saved: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to save text: ${error}`);
            throw error;
        }
    }

    /**
     * Save both audio and text response with metadata
     */
    public saveCompleteResponse(
        textContent: string,
        audioData?: string | Buffer,
        audioFormat: 'mp3' | 'wav' | 'aac' = 'mp3'
    ): ResponseData {
        const timestamp = new Date().toISOString();
        let audioPath: string | undefined;
        let audioSize: number | undefined;

        // Save audio if provided
        if (audioData) {
            audioPath = this.saveAudioResponse(audioData, audioFormat);
            if (typeof audioData === 'string') {
                audioSize = Buffer.from(audioData, 'base64').length;
            } else {
                audioSize = audioData.length;
            }
        }

        // Save text
        const textPath = this.saveTextResponse(textContent);

        // Create response metadata
        const responseData: ResponseData = {
            timestamp,
            audioPath,
            textContent,
            audioSize
        };

        // Save metadata JSON
        this.saveMetadata(responseData);

        return responseData;
    }

    /**
     * Save metadata as JSON
     */
    private saveMetadata(data: ResponseData): void {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const metadataDir = path.join(this.responsesDir, this.currentSession);
        const metadataPath = path.join(metadataDir, `metadata_${timestamp}.json`);

        try {
            const metadataContent = {
                ...data,
                textSize: data.textContent.length,
                savedAt: new Date().toISOString()
            };

            fs.writeFileSync(
                metadataPath,
                JSON.stringify(metadataContent, null, 2),
                'utf-8'
            );

            console.log(`✅ Metadata saved: ${metadataPath}`);
        } catch (error) {
            console.error(`❌ Failed to save metadata: ${error}`);
        }
    }

    /**
     * Save session summary (all responses info)
     */
    public saveSummary(summary: any): void {
        const summaryPath = path.join(
            this.responsesDir,
            this.currentSession,
            'session_summary.json'
        );

        try {
            fs.writeFileSync(
                summaryPath,
                JSON.stringify(summary, null, 2),
                'utf-8'
            );

            console.log(`✅ Session summary saved: ${summaryPath}`);
        } catch (error) {
            console.error(`❌ Failed to save summary: ${error}`);
        }
    }

    /**
     * Create index file listing all responses
     */
    public createIndex(): void {
        const sessionDir = path.join(this.responsesDir, this.currentSession);
        const audioDir = path.join(sessionDir, 'audio');
        const textDir = path.join(sessionDir, 'text');

        try {
            const audioFiles = fs.existsSync(audioDir)
                ? fs.readdirSync(audioDir).sort()
                : [];
            const textFiles = fs.existsSync(textDir)
                ? fs.readdirSync(textDir).sort()
                : [];

            const indexContent = `# Session: ${this.currentSession}
Created: ${new Date().toISOString()}

## Audio Responses (${audioFiles.length} files)
${audioFiles.map((f, i) => `${i + 1}. audio/${f}`).join('\n')}

## Text Responses (${textFiles.length} files)
${textFiles.map((f, i) => `${i + 1}. text/${f}`).join('\n')}

## Directory Structure
responses/
└── ${this.currentSession}/
    ├── audio/          (Response audio files)
    ├── text/           (Response text files)
    ├── metadata_*.json (Individual response metadata)
    ├── session_summary.json
    └── index.md        (This file)
`;

            const indexPath = path.join(sessionDir, 'index.md');
            fs.writeFileSync(indexPath, indexContent, 'utf-8');
            console.log(`✅ Index created: ${indexPath}`);
        } catch (error) {
            console.error(`❌ Failed to create index: ${error}`);
        }
    }

    /**
     * Get session directory path
     */
    public getSessionPath(): string {
        return path.join(this.responsesDir, this.currentSession);
    }

    /**
     * Get current session ID
     */
    public getSessionId(): string {
        return this.currentSession;
    }

    /**
     * List all sessions
     */
    public listSessions(): string[] {
        try {
            if (!fs.existsSync(this.responsesDir)) {
                return [];
            }
            return fs.readdirSync(this.responsesDir).filter(file => {
                const fullPath = path.join(this.responsesDir, file);
                return fs.statSync(fullPath).isDirectory();
            });
        } catch (error) {
            console.error(`❌ Failed to list sessions: ${error}`);
            return [];
        }
    }

    /**
     * Get responses from a specific session
     */
    public getSessionResponses(sessionId: string): {
        audio: string[];
        text: string[];
        metadata: string[];
    } {
        const sessionDir = path.join(this.responsesDir, sessionId);
        const audioDir = path.join(sessionDir, 'audio');
        const textDir = path.join(sessionDir, 'text');

        return {
            audio: fs.existsSync(audioDir) ? fs.readdirSync(audioDir).sort() : [],
            text: fs.existsSync(textDir) ? fs.readdirSync(textDir).sort() : [],
            metadata: fs.readdirSync(sessionDir)
                .filter(f => f.startsWith('metadata_') && f.endsWith('.json'))
                .sort()
        };
    }

    /**
     * Get response statistics for current session
     */
    public getSessionStats(): {
        audioCount: number;
        textCount: number;
        totalAudioSize: number;
        totalTextSize: number;
    } {
        const sessionDir = path.join(this.responsesDir, this.currentSession);
        const audioDir = path.join(sessionDir, 'audio');
        const textDir = path.join(sessionDir, 'text');

        let audioCount = 0;
        let textCount = 0;
        let totalAudioSize = 0;
        let totalTextSize = 0;

        if (fs.existsSync(audioDir)) {
            fs.readdirSync(audioDir).forEach(file => {
                const filePath = path.join(audioDir, file);
                const stats = fs.statSync(filePath);
                audioCount++;
                totalAudioSize += stats.size;
            });
        }

        if (fs.existsSync(textDir)) {
            fs.readdirSync(textDir).forEach(file => {
                const filePath = path.join(textDir, file);
                const stats = fs.statSync(filePath);
                textCount++;
                totalTextSize += stats.size;
            });
        }

        return {
            audioCount,
            textCount,
            totalAudioSize,
            totalTextSize
        };
    }
}
