import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface STTResult {
    transcript: string;
    language: string;
}

/**
 * Chuyển audio thành text sử dụng Deepgram STT (Python)
 * 
 * @param audioBuffer - Buffer chứa audio data
 * @param audioFormat - Format của audio ('mp3' | 'wav' | 'aac')
 * @returns Object chứa transcript và detected language
 */
export async function audioToText(
    audioBuffer: Buffer,
    audioFormat: 'mp3' | 'wav' | 'aac' = 'mp3'
): Promise<STTResult> {
    return new Promise((resolve, reject) => {
        const tmpDir = path.join(process.cwd(), 'tmp');
        
        // Đảm bảo thư mục tmp tồn tại
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        // Tạo file tạm để lưu audio
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempAudioFile = path.join(tmpDir, `stt_input_${timestamp}.${audioFormat}`);
        
        // Lưu audio buffer vào file tạm
        fs.writeFileSync(tempAudioFile, audioBuffer);
        
        // Đường dẫn đến Python script
        const scriptPath = path.join(process.cwd(), 'recordings', 'stt_deepgram.py');
        
        // Kiểm tra script có tồn tại không
        if (!fs.existsSync(scriptPath)) {
            // Cleanup temp file
            fs.unlinkSync(tempAudioFile);
            reject(new Error(`Deepgram STT script not found: ${scriptPath}`));
            return;
        }
        
        console.log(`🎙️  Transcribing audio using Deepgram STT...`);
        console.log(`📁 Audio file: ${tempAudioFile} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        
        // Xác định lệnh Python
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        const pythonArgs = process.platform === 'win32' 
            ? ['-3', scriptPath, tempAudioFile]
            : [scriptPath, tempAudioFile];
        
        // Gọi Python script
        const pythonProcess = spawn(pythonCommand, pythonArgs, {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            // Cleanup temp file
            try {
                if (fs.existsSync(tempAudioFile)) {
                    fs.unlinkSync(tempAudioFile);
                }
            } catch (e) {
                console.warn(`⚠️  Failed to cleanup temp file: ${tempAudioFile}`);
            }
            
            if (code === 0) {
                // Parse output - JSON với transcript và language
                const output = stdout.trim();
                
                if (output && !output.startsWith('Error:')) {
                    try {
                        const result = JSON.parse(output);
                        const transcript = result.transcript || '';
                        const language = result.language || 'en';
                        
                        console.log(`✅ Transcript: ${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}`);
                        console.log(`🌐 Detected language: ${language}`);
                        
                        resolve({
                            transcript: transcript,
                            language: language
                        });
                    } catch (parseError) {
                        // Fallback: nếu không parse được JSON, coi như chỉ có transcript
                        console.log(`✅ Transcript: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);
                        console.log(`⚠️  Could not parse language, defaulting to 'en'`);
                        resolve({
                            transcript: output,
                            language: 'en'
                        });
                    }
                } else {
                    const errorMsg = stderr || stdout || `Deepgram STT returned empty transcript`;
                    console.error(`❌ Deepgram STT error: ${errorMsg}`);
                    reject(new Error(`Deepgram STT failed: ${errorMsg}`));
                }
            } else {
                const errorMsg = stderr || stdout || `Python script exited with code ${code}`;
                console.error(`❌ Deepgram STT error: ${errorMsg}`);
                reject(new Error(`Deepgram STT failed: ${errorMsg}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            // Cleanup temp file
            try {
                if (fs.existsSync(tempAudioFile)) {
                    fs.unlinkSync(tempAudioFile);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
            
            console.error(`❌ Failed to spawn Python process: ${error.message}`);
            reject(new Error(`Failed to run Deepgram STT: ${error.message}. Make sure Python and deepgram package are installed.`));
        });
    });
}

