import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface TTSLocalOptions {
    outputDir?: string;
}

/**
 * Chuyển text thành audio sử dụng pyttsx3 (Python - offline TTS)
 * 
 * @param text - Văn bản cần chuyển thành giọng nói
 * @param options - Tùy chọn (outputDir)
 * @returns Đường dẫn file audio đã tạo (.wav)
 */
export async function textToSpeech(
    text: string,
    options: TTSLocalOptions = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const outputDir = options.outputDir || path.join(process.cwd(), 'tmp');
        
        // Đảm bảo thư mục output tồn tại
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Tạo tên file output (.wav)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(outputDir, `tts_${timestamp}.wav`);
        
        // Đường dẫn đến Python script
        const scriptPath = path.join(process.cwd(), 'recordings', 'tts_local.py');
        
        // Kiểm tra script có tồn tại không
        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`Python script not found: ${scriptPath}`));
            return;
        }
        
        console.log(`Converting text to speech using pyttsx3...`);
        console.log(`Text length: ${text.length} characters`);
        
        // Xác định lệnh Python (hỗ trợ cả Windows và Unix)
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        const pythonArgs = process.platform === 'win32' 
            ? ['-3', scriptPath, outputFile]  // Windows: py -3 script.py output.wav
            : [scriptPath, outputFile];        // Unix: python3 script.py output.wav
        
        // Gọi Python script
        const pythonProcess = spawn(pythonCommand, pythonArgs, {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });
        
        // Gửi text qua stdin với encoding đúng
        const cleanText = text.replace(/\uFEFF/g, '').trim(); // Remove BOM if any
        pythonProcess.stdin.write(cleanText, 'utf-8');
        pythonProcess.stdin.end();
        
        // Debug: log text preview (first 100 chars)
        console.log(`📄 Text preview: ${cleanText.substring(0, 100)}${cleanText.length > 100 ? '...' : ''}`);
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                // Kiểm tra file đã được tạo
                if (fs.existsSync(outputFile)) {
                    const fileSize = fs.statSync(outputFile).size;
                    if (fileSize > 0) {
                        console.log(`Audio generated: ${outputFile} (${(fileSize / 1024).toFixed(2)} KB)`);
                        resolve(outputFile);
                    } else {
                        reject(new Error(`Audio file is empty: ${outputFile}`));
                    }
                } else {
                    // Fallback: kiểm tra stdout để tìm file path
                    const output = stdout.trim();
                    if (output.startsWith('SUCCESS:')) {
                        const filePath = output.substring(8).trim();
                        if (fs.existsSync(filePath)) {
                            resolve(filePath);
                        } else {
                            reject(new Error(`Audio file not found: ${filePath}`));
                        }
                    } else {
                        reject(new Error(`Audio file not created. Output: ${output}`));
                    }
                }
            } else {
                const errorMsg = stderr || stdout || `Python script exited with code ${code}`;
                console.error(`pyttsx3 error: ${errorMsg}`);
                reject(new Error(`pyttsx3 failed: ${errorMsg}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error(` Failed to spawn Python process: ${error.message}`);
            reject(new Error(`Failed to run pyttsx3: ${error.message}. Make sure Python and pyttsx3 are installed.`));
        });
    });
}

/**
 * Đọc file audio và trả về Buffer
 */
export function readAudioFile(filePath: string): Buffer {
    return fs.readFileSync(filePath);
}


