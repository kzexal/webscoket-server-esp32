import "dotenv/config";
import { WebSocket } from "ws";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { serveStatic } from "@hono/node-server/serve-static";
import * as fs from 'fs';
import * as path from 'path';

import { ZhipuVoiceAgent } from "./lib/zhipu_agent";
import { ZhipuAiClient } from "./lib/zhipu_client";
import { ResponseSaver } from "./lib/response_saver";
import { textToSpeech, readAudioFile } from "./lib/tts_local";
// import { audioToText } from "./lib/deepgram_stt"; // DEEPGRAM STT ĐÃ TẮT - Xem DEEPGRAM_ENABLE_GUIDE.md

// Helper function để tạo language instructions
function getLanguageInstructions(languageCode: string): string {
    const languageMap: { [key: string]: string } = {
        'vi': 'IMPORTANT: Respond in Vietnamese (Tiếng Việt). Use Vietnamese language for your response.',
        'en': 'IMPORTANT: Respond in English. Use English language for your response.',
        'zh': 'IMPORTANT: Respond in Chinese (中文). Use Chinese language for your response.',
        'ja': 'IMPORTANT: Respond in Japanese (日本語). Use Japanese language for your response.',
        'ko': 'IMPORTANT: Respond in Korean (한국어). Use Korean language for your response.',
        'fr': 'IMPORTANT: Respond in French (Français). Use French language for your response.',
        'de': 'IMPORTANT: Respond in German (Deutsch). Use German language for your response.',
        'es': 'IMPORTANT: Respond in Spanish (Español). Use Spanish language for your response.',
        'pt': 'IMPORTANT: Respond in Portuguese (Português). Use Portuguese language for your response.',
        'ru': 'IMPORTANT: Respond in Russian (Русский). Use Russian language for your response.',
        'th': 'IMPORTANT: Respond in Thai (ไทย). Use Thai language for your response.',
    };

    const langKey = languageCode.toLowerCase().split('-')[0];
    return languageMap[langKey] || `IMPORTANT: Respond in the same language as the user's input. The detected language code is: ${languageCode}`;
}

const app = new Hono();
const WS_PORT = 8888;
const connectedClients = new Set<WebSocket>();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("/", serveStatic({ path: "./static/index.html" }));
app.use("/static/*", serveStatic({ root: "./" }));
app.use("/responses", serveStatic({ path: "./static/responses.html" }));

// API endpoint to get list of response sessions
app.get("/api/sessions", (c) => {
  try {
    const responsesDir = path.join(process.cwd(), "responses");
    if (!fs.existsSync(responsesDir)) {
      return c.json({ sessions: [] });
    }

    const sessions = fs.readdirSync(responsesDir)
      .filter(file => {
        const fullPath = path.join(responsesDir, file);
        return fs.statSync(fullPath).isDirectory();
      })
      .map(session => {
        const sessionPath = path.join(responsesDir, session);
        const audioDir = path.join(sessionPath, 'audio');
        const textDir = path.join(sessionPath, 'text');
        
        const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : [];
        const textFiles = fs.existsSync(textDir) ? fs.readdirSync(textDir) : [];

        return {
          id: session,
          audioCount: audioFiles.length,
          textCount: textFiles.length,
          createdAt: session.split('_')[0]
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return c.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return c.json({ error: 'Failed to fetch sessions' }, 500);
  }
});

// API endpoint to get responses from a specific session
app.get("/api/sessions/:sessionId", (c) => {
  const sessionId = c.req.param('sessionId');
  
  try {
    const sessionPath = path.join(process.cwd(), "responses", sessionId);
    
    if (!fs.existsSync(sessionPath)) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const audioDir = path.join(sessionPath, 'audio');
    const textDir = path.join(sessionPath, 'text');
    
    const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).sort() : [];
    const textFiles = fs.existsSync(textDir) ? fs.readdirSync(textDir).sort() : [];
    const metadataFiles = fs.readdirSync(sessionPath)
      .filter(f => f.startsWith('metadata_') && f.endsWith('.json'))
      .sort();

    const responses = [];
    
    // Match paired audio and text responses
    for (let i = 0; i < Math.max(audioFiles.length, textFiles.length); i++) {
      responses.push({
        index: i + 1,
        audio: audioFiles[i] || null,
        text: textFiles[i] || null,
        metadata: metadataFiles[i] || null
      });
    }

    return c.json({
      sessionId,
      responses,
      summary: {
        totalResponses: responses.length,
        audioCount: audioFiles.length,
        textCount: textFiles.length
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

// API endpoint to get text response content
app.get("/api/responses/text/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, "text", filename);
    
    // Security check: ensure path is within responses directory
    if (!filePath.startsWith(path.join(process.cwd(), "responses"))) {
      return c.json({ error: 'Invalid path' }, 403);
    }

    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return c.json({ content });
  } catch (error) {
    console.error('Error reading text file:', error);
    return c.json({ error: 'Failed to read file' }, 500);
  }
});

// API endpoint to download audio response
app.get("/api/responses/audio/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, "audio", filename);
    
    // Security check: ensure path is within responses directory
    if (!filePath.startsWith(path.join(process.cwd(), "responses"))) {
      return c.json({ error: 'Invalid path' }, 403);
    }

    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const audioData = fs.readFileSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg'; // default to mp3
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.aac') contentType = 'audio/aac';

    return c.body(audioData, 200, { 'Content-Type': contentType });
  } catch (error) {
    console.error('Error reading audio file:', error);
    return c.json({ error: 'Failed to read file' }, 500);
  }
});

// API endpoint to get metadata
app.get("/api/responses/metadata/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, filename);
    
    // Security check: ensure path is within responses directory
    if (!filePath.startsWith(path.join(process.cwd(), "responses"))) {
      return c.json({ error: 'Invalid path' }, 403);
    }

    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return c.json(content);
  } catch (error) {
    console.error('Error reading metadata:', error);
    return c.json({ error: 'Failed to read metadata' }, 500);
  }
});

// API endpoint to upload and process audio file
app.post("/api/upload-audio", async (c) => {
  try {
    if (!process.env.ZHIPU_API_KEY) {
      return c.json({ error: 'ZHIPU_API_KEY is not set' }, 500);
    }

    const body = await c.req.parseBody();
    const file = body.audio as File;
    const instructions = (body.instructions as string) || "Please carefully listen to the audio content, understand what the user is saying, and respond in English based on the specific content in the audio. Do not just give generic greetings, but answer the specific questions or topics mentioned in the audio. Always respond in English, not Chinese.";

    if (!file) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    // Validate file type
    const fileName = file.name || 'audio';
    const fileExt = path.extname(fileName).toLowerCase().slice(1);
    const audioFormat = (fileExt === 'mp3' ? 'mp3' : fileExt === 'wav' ? 'wav' : fileExt === 'aac' ? 'aac' : 'mp3') as 'mp3' | 'wav' | 'aac';
    
    if (!['mp3', 'wav', 'aac'].includes(fileExt)) {
      return c.json({ error: 'Unsupported audio format. Please use MP3, WAV, or AAC.' }, 400);
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    console.log(`Processing uploaded audio file: ${fileName}`);
    console.log(`Audio format: ${audioFormat}, size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    // Validate file size (max 25MB)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 25MB. Please use MP3 format to compress.' }, 400);
    }

    // Initialize Zhipu client and response saver
    const client = new ZhipuAiClient(process.env.ZHIPU_API_KEY);
    const responseSaver = new ResponseSaver();

    // ============================================
    // DEEPGRAM STT ĐÃ TẮT - GỬI THẲNG AUDIO CHO AI
    // Để bật lại Deepgram STT, xem file: DEEPGRAM_ENABLE_GUIDE.md
    // ============================================
    
    // Gửi thẳng audio buffer cho Zhipu GLM-4-Voice (không cần transcript)
    console.log(" Sending audio directly to Zhipu GLM-4-Voice...");
    console.log(` Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB, format: ${audioFormat}`);
    
    const response = await client.chat({
      audioData: audioBuffer,
      audioFormat: audioFormat,
      text: instructions  // Instructions để hướng dẫn AI
    });

    // Extract text response
    const responseText = client.getTextFromResponse(response);

    // Save text response to file
    const textPath = responseSaver.saveTextResponse(responseText);

    // Chuyển text thành audio sử dụng pyttsx3 (offline TTS)
    console.log(" Converting text to speech using pyttsx3 (offline TTS)...");
    let audioPath: string | undefined;
    
    try {
      // Tạo audio từ text sử dụng pyttsx3
      const ttsAudioFile = await textToSpeech(responseText, {
        outputDir: path.join(process.cwd(), 'tmp')
      });
      
      // Đọc file audio đã tạo
      const audioBuffer = readAudioFile(ttsAudioFile);
      console.log(` Audio generated: ${ttsAudioFile} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
      
      // Sau khi chuyển thành audio, hiển thị text trên terminal (đồng bộ)
      console.log('\n' + ''.repeat(60));
      console.log(' AI Response Text:');
      console.log(''.repeat(60));
      console.log(responseText);
      console.log(''.repeat(60));
      console.log(''.repeat(60) + '\n');
      
      // Lưu audio response (pyttsx3 xuất ra .wav)
      audioPath = responseSaver.saveAudioResponse(
        audioBuffer,
        'wav'
      );
      console.log(` Audio saved: ${audioPath}`);
      
      // Lưu complete response với metadata (pyttsx3 xuất ra .wav)
      responseSaver.saveCompleteResponse(
        responseText,
        audioBuffer,
        'wav'
      );
      
    } catch (ttsError: any) {
      console.error(' Error converting text to speech:', ttsError.message);
      
      // Nếu pyttsx3 thất bại, thử dùng audio từ Zhipu (nếu có)
      const audioResponse = client.getAudioFromResponse(response);
      if (audioResponse) {
        console.log("  Falling back to Zhipu audio response...");
        
        // Save audio response to file
        audioPath = responseSaver.saveAudioResponse(
          audioResponse.data,
        'mp3'
      );
      
      console.log(`Audio response saved to: ${audioPath}`);

      // Also save complete response with metadata
      responseSaver.saveCompleteResponse(
        responseText,
        audioResponse.data,
        'mp3'
      );
      } else {
        // Không có audio từ cả pyttsx3 và Zhipu
        console.log("  No audio available");
        
        // Hiển thị text trên terminal
        console.log('\n' + ''.repeat(60));
        console.log(' AI Response Text:');
        console.log(''.repeat(60));
        console.log(responseText);
        console.log(''.repeat(60));
        console.log(''.repeat(60) + '\n');
      }
    }

    return c.json({
      success: true,
      text: responseText,
      textPath: textPath,
      audioPath: audioPath,
      sessionId: responseSaver.getSessionId(),
      message: 'Audio file processed successfully'
    });

  } catch (error: any) {
    console.error('Error processing uploaded audio:', error);
    
    let errorMessage = 'Failed to process audio file';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout: Audio file too large. Use MP3 format.';
    } else if (error.response?.status === 413) {
      errorMessage = 'Audio payload too large. Use MP3 format to compress.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return c.json({ error: errorMessage }, 500);
  }
});

// API endpoint to process MP3 file from recordings folder
app.post("/api/process-file", async (c) => {
  try {
    if (!process.env.ZHIPU_API_KEY) {
      return c.json({ error: 'ZHIPU_API_KEY is not set' }, 500);
    }

    const body = await c.req.json();
    const filename = body.filename || 'test.mp3';
    const instructions = body.instructions || "Please carefully listen to the audio content, understand what the user is saying, and respond in English based on the specific content in the audio. Do not just give generic greetings, but answer the specific questions or topics mentioned in the audio. Always respond in English, not Chinese.";

    // Read MP3 file from recordings folder
    const recordingsDir = path.join(process.cwd(), "recordings");
    const filePath = path.join(recordingsDir, filename);

    if (!fs.existsSync(filePath)) {
      return c.json({ error: `File not found: ${filename}` }, 404);
    }

    console.log(`Processing file: ${filePath}`);

    // Read audio file
    const audioBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(filename).toLowerCase().slice(1); // Remove the dot
    const audioFormat = (fileExt === 'mp3' ? 'mp3' : fileExt === 'wav' ? 'wav' : fileExt === 'aac' ? 'aac' : 'mp3') as 'mp3' | 'wav' | 'aac';

    console.log(`Audio format: ${audioFormat}, size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    // Initialize Zhipu client and response saver
    const client = new ZhipuAiClient(process.env.ZHIPU_API_KEY);
    const responseSaver = new ResponseSaver();

    // ============================================
    // DEEPGRAM STT ĐÃ TẮT TẠM THỜI
    // Để bật lại, xem file: DEEPGRAM_ENABLE_GUIDE.md
    // ============================================
    
    // Chuyển audio thành text sử dụng Deepgram STT
    // console.log("🎙️  Converting audio to text using Deepgram STT...");
    // let sttResult: { transcript: string; language: string };
    // 
    // try {
    //   sttResult = await audioToText(audioBuffer, audioFormat);
    //   console.log(` User said: ${sttResult.transcript}`);
    //   console.log(`🌐 Detected language: ${sttResult.language}`);
    // } catch (sttError: any) {
    //   console.error(' Error converting audio to text:', sttError.message);
    //   return c.json({ 
    //     error: `STT failed: ${sttError.message}` 
    //   }, 500);
    // }
    // 
    // const userText = sttResult.transcript;
    // const detectedLanguage = sttResult.language;
    
    // ============================================
    // DEEPGRAM STT ĐÃ TẮT - GỬI THẲNG AUDIO CHO AI
    // Để bật lại Deepgram STT, xem file: DEEPGRAM_ENABLE_GUIDE.md
    // ============================================
    
    // Gửi thẳng audio buffer cho Zhipu GLM-4-Voice (không cần transcript)
    console.log(" Sending audio directly to Zhipu GLM-4-Voice...");
    console.log(` Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB, format: ${audioFormat}`);
    
    const response = await client.chat({
      audioData: audioBuffer,
      audioFormat: audioFormat,
      text: instructions  // Instructions để hướng dẫn AI
    });

    // Extract text response
    const responseText = client.getTextFromResponse(response);

    // Save text response to file
    const textPath = responseSaver.saveTextResponse(responseText);

    // Chuyển text thành audio sử dụng pyttsx3 (offline TTS)
    console.log(" Converting text to speech using pyttsx3 (offline TTS)...");
    let audioPath: string | undefined;
    
    try {
      // Tạo audio từ text sử dụng pyttsx3
      const ttsAudioFile = await textToSpeech(responseText, {
        outputDir: path.join(process.cwd(), 'tmp')
      });
      
      // Đọc file audio đã tạo
      const audioBuffer = readAudioFile(ttsAudioFile);
      console.log(` Audio generated: ${ttsAudioFile} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
      
      // Sau khi chuyển thành audio, hiển thị text trên terminal (đồng bộ)
      console.log('\n' + ''.repeat(60));
      console.log(' AI Response Text:');
      console.log(''.repeat(60));
      console.log(responseText);
      console.log(''.repeat(60));
      console.log(''.repeat(60) + '\n');
      
      // Lưu audio response (pyttsx3 xuất ra .wav)
      audioPath = responseSaver.saveAudioResponse(
        audioBuffer,
        'wav'
      );
      console.log(` Audio saved: ${audioPath}`);
      
      // Lưu complete response với metadata (pyttsx3 xuất ra .wav)
      responseSaver.saveCompleteResponse(
        responseText,
        audioBuffer,
        'wav'
      );
      
    } catch (ttsError: any) {
      console.error(' Error converting text to speech:', ttsError.message);
      
      // Nếu pyttsx3 thất bại, thử dùng audio từ Zhipu (nếu có)
      const audioResponse = client.getAudioFromResponse(response);
      if (audioResponse) {
        console.log("  Falling back to Zhipu audio response...");
        
        // Save audio response to file
        audioPath = responseSaver.saveAudioResponse(
          audioResponse.data,
        'mp3'
      );
      
      console.log(`Audio response saved to: ${audioPath}`);

      // Also save complete response with metadata
      responseSaver.saveCompleteResponse(
        responseText,
        audioResponse.data,
        'mp3'
      );
      } else {
        // Không có audio từ cả pyttsx3 và Zhipu
        console.log("  No audio available");
        
        // Hiển thị text trên terminal
        console.log('\n' + ''.repeat(60));
        console.log(' AI Response Text:');
        console.log(''.repeat(60));
        console.log(responseText);
        console.log(''.repeat(60));
        console.log(''.repeat(60) + '\n');
      }
    }

    return c.json({
      success: true,
      text: responseText,
      textPath: textPath,
      audioPath: audioPath,
      sessionId: responseSaver.getSessionId(),
      message: 'File processed successfully'
    });

  } catch (error: any) {
    console.error('Error processing file:', error);
    
    let errorMessage = 'Failed to process audio file';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout: Audio file too large. Use MP3 format.';
    } else if (error.response?.status === 413) {
      errorMessage = 'Audio payload too large. Use MP3 format to compress.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return c.json({ error: errorMessage }, 500);
  }
});

app.get(
  "/device",
  upgradeWebSocket((c) => ({
    onOpen: async (c, ws) => {
      if (!process.env.ZHIPU_API_KEY) {
        console.error("ZHIPU_API_KEY is not set");
        return ws.close();
      }

      const rawWs = ws.raw as WebSocket;
      connectedClients.add(rawWs);

      const broadcastToClients = (data: string) => {
        connectedClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              const parsed = JSON.parse(data);
              // Send JSON messages to all connected clients
              client.send(data);
            } catch (e) {
              // If parsing fails, send as binary
              client.send(data);
            }
          }
        });
      };

      const agent = new ZhipuVoiceAgent({
        apiKey: process.env.ZHIPU_API_KEY,
        instructions: "Please carefully listen to the audio content, understand what the user is saying, and respond in English based on the specific content in the audio. Do not just give generic greetings, but answer the specific questions or topics mentioned in the audio. Always respond in English, not Chinese.",
        audioConfig: {
          sampleRate: 44100,
          channels: 1,
          bitDepth: 16
        }
      });

      // Wait for WebSocket setup
      await new Promise(resolve => setTimeout(resolve, 100));
      await agent.connect(rawWs, broadcastToClients);
    },
    onClose: (c, ws) => {
      const rawWs = ws.raw as WebSocket;
      connectedClients.delete(rawWs);
      console.log("Client disconnected");
    },
  }))
);

const server = serve({
  fetch: app.fetch,
  port: WS_PORT,
});

injectWebSocket(server);

console.log(`Zhipu Voice Assistant Server running on port ${WS_PORT}`);
