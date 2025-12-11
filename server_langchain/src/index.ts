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
import { 
    processAudioWithZhipu, 
    processTTSResponse, 
    formatAudioProcessingError,
    detectAudioFormatFromBuffer
} from "./lib/audio_processor";

const app = new Hono();
const WS_PORT = 8888;
const connectedClients = new Set<WebSocket>();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("/", serveStatic({ path: "./static/index.html" }));
app.use("/static/*", serveStatic({ root: "./" }));
app.use("/responses", serveStatic({ path: "./static/responses.html" }));

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

app.get("/api/responses/text/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, "text", filename);
    
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

app.get("/api/responses/audio/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, "audio", filename);
    
    if (!filePath.startsWith(path.join(process.cwd(), "responses"))) {
      return c.json({ error: 'Invalid path' }, 403);
    }

    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const audioData = fs.readFileSync(filePath);
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg'; 
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.aac') contentType = 'audio/aac';

    return c.body(audioData, 200, { 'Content-Type': contentType });
  } catch (error) {
    console.error('Error reading audio file:', error);
    return c.json({ error: 'Failed to read file' }, 500);
  }
});

app.get("/api/responses/metadata/:sessionId/:filename", (c) => {
  const { sessionId, filename } = c.req.param();
  
  try {
    const filePath = path.join(process.cwd(), "responses", sessionId, filename);
    
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

app.post("/api/process-file", async (c) => {
  try {
    if (!process.env.ZHIPU_API_KEY) {
      return c.json({ error: 'ZHIPU_API_KEY is not set' }, 500);
    }

    const body = await c.req.json();
    const filename = body.filename || 'test.mp3';
    const instructions = body.instructions || "You must respond ONLY in English. Return TEXT ONLY (no audio).";

    const recordingsDir = path.join(process.cwd(), "recordings");
    const filePath = path.join(recordingsDir, filename);

    if (!fs.existsSync(filePath)) {
      return c.json({ error: `File not found: ${filename}` }, 404);
    }

    console.log(`Processing file: ${filePath}`);

    const audioBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(filename).toLowerCase().slice(1); // Remove the dot
    const audioFormat = (fileExt === 'mp3' ? 'mp3' : fileExt === 'wav' ? 'wav' : fileExt === 'aac' ? 'aac' : 'mp3') as 'mp3' | 'wav' | 'aac';

    console.log(`Audio format: ${audioFormat}, size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    // Initialize Zhipu client and response saver
    const client = new ZhipuAiClient(process.env.ZHIPU_API_KEY);
    const responseSaver = new ResponseSaver();
    
    const responseText = await processAudioWithZhipu({
      audioBuffer,
      audioFormat,
      instructions,
      client,
      responseSaver
    });

    const textPath = responseSaver.saveTextResponse(responseText);


    let audioPath: string | undefined;
    
    try {
      const ttsResult = await processTTSResponse({
        responseText,
        responseSaver
      });
      
      audioPath = ttsResult.audioFilePath;
      
    } catch (ttsError: any) {
      console.error('Error converting text to speech:', ttsError.message);
      
      // Nếu pyttsx3 thất bại, chỉ trả về text
      console.log("TTS failed, returning text only");
      console.log('\n' + 'AI Response Text:');
      console.log("\n" + responseText);
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
    const errorMessage = formatAudioProcessingError(error);
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
              client.send(data);
            } catch (e) {
              client.send(data);
            }
          }
        });
      };

      const agent = new ZhipuVoiceAgent({
        apiKey: process.env.ZHIPU_API_KEY,
        instructions: "You must respond ONLY in English. Return TEXT ONLY (no audio).",
        audioConfig: {
          sampleRate: 44100,
          channels: 1,
          bitDepth: 16
        }
      });

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
