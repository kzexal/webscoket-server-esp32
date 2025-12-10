# Zhipu Integration - Summary of Changes

## 🎯 Overview

Chuyển đổi từ OpenAI realtime API sang **Zhipu GLM-4-Voice** API với luồng xử lý WebSocket.

### Architecture

```
ESP32 (Ghi âm)
    ↓ WebSocket
Server (Node.js)
    ↓ HTTP/REST
Zhipu API (GLM-4-Voice)
    ↓ Returns: text + audio
Server
    ↓ WebSocket
ESP32 (Phát âm)
```

---

## 📝 Files Changed/Created

### 1. **`.env`** (Modified)
```diff
- OPENAI_API_KEY=...
+ ZHIPU_API_KEY=95b0172f52594e7886ad6f353a991dd9.feIwLW6x4Ylhj2W8
  TAVILY_API_KEY=...
```

### 2. **`package.json`** (Modified)
```diff
  "dependencies": {
    ...
+   "axios": "^1.6.0",
    ...
  }
```

### 3. **`src/lib/zhipu_client.ts`** (NEW)
- Client wrapper để giao tiếp với Zhipu API
- Hỗ trợ audio input (WAV format)
- Trích xuất text + audio response
- Chuyển đổi file WAV ↔ Base64

**Main Classes:**
- `ZhipuAiClient` - REST client cho Zhipu API

**Main Methods:**
```typescript
- chat({audioData, text}) → ZhipuResponse
- getTextFromResponse(response) → string
- getAudioFromResponse(response) → {data, format}
- saveAudioAsWav(audioData, filepath) → void
- getBase64FromWav(wavPath) → string
- getBase64FromBuffer(buffer) → string
```

### 4. **`src/lib/zhipu_agent.ts`** (NEW)
- WebSocket handler chính cho Zhipu
- Quản lý audio recording từ ESP32
- Xử lý control messages
- Gửi response tới ESP32

**Main Classes:**
- `ZhipuVoiceAgent` - WebSocket agent cho Zhipu

**Main Methods:**
```typescript
- connect(ws, broadcastToClients) → void
- processRecordedAudio() → void
- handleControlMessage(message) → void
- resetRecording() → void
```

### 5. **`src/index.ts`** (Modified)
```diff
- import { OpenAIVoiceReactAgent } from "./lib/agent";
+ import { ZhipuVoiceAgent } from "./lib/zhipu_agent";

- const agent = new OpenAIVoiceReactAgent({
+ const agent = new ZhipuVoiceAgent({
-   model: "gpt-4o-realtime-preview",
+   apiKey: process.env.ZHIPU_API_KEY,
+   instructions: "你好，请认真听这段音频...",
  });
```

### 6. **`static/zhipu_client.html`** (NEW)
- WebSocket client test interface
- UI để kiểm tra kết nối
- Buttons: Connect, Start Recording, Stop Recording
- Message log (JSON messages + binary data info)
- Real-time status indicator

### 7. **`ZHIPU_SETUP.md`** (NEW)
- Hướng dẫn cài đặt Zhipu integration
- Định dạng WebSocket messages
- Quy trình xử lý audio
- Troubleshooting guide

### 8. **`esp32/src/zhipu_voice_client.cpp`** (NEW)
- ESP32 firmware example
- WebSocket client connection
- Microphone I2S reading
- Speaker I2S playback (stub)
- Button handling

### 9. **`esp32/ESP32_ZHIPU_SETUP.md`** (NEW)
- Hướng dẫn cài đặt Arduino IDE
- Pin configuration
- Libraries needed
- Testing procedure
- Troubleshooting

---

## 🔄 Data Flow

### Start Recording:
```
ESP32
  └─ {type: "start_recording"}
       ↓ WebSocket (JSON)
    Server (ZhipuVoiceAgent)
       └─ audioManager.startRecording()
```

### During Recording:
```
ESP32
  └─ Binary PCM 16-bit WAV data (2048 bytes chunks)
       ↓ WebSocket (binary)
    Server
       └─ audioManager.handleAudioBuffer(data)
          └─ store in buffer
```

### Stop Recording:
```
ESP32
  └─ {type: "stop_recording"}
       ↓ WebSocket (JSON)
    Server
       └─ processRecordedAudio()
          ├─ Get audio buffer
          ├─ Send to Zhipu API
          │   ├─ audio: Buffer (base64)
          │   ├─ text: instruction
          │   └─ model: "glm-4-voice"
          ├─ Receive response
          │  ├─ text response
          │  └─ audio response (base64)
          ├─ Send text via WebSocket (JSON)
          │  {type: "text_response", content: "..."}
          ├─ Send audio via WebSocket (binary chunks)
          │  └─ decode base64 → send 1024 bytes/chunk
          └─ Send completion signal
             {type: "audio_response_complete"}
```

---

## 🧪 Testing Endpoints

### 1. Test WebSocket HTML Client:
```
http://localhost:8888/static/zhipu_client.html
```

### 2. Test with cURL + socat (simulate audio):
```bash
# Create dummy WAV data
sox -n -b 16 -c 1 -r 44100 -t wav test.wav trim 0 1

# Send via WebSocket
# (requires socat or wscat)
```

### 3. Check server logs:
```bash
yarn dev
# Should show:
# - ZhipuVoiceAgent connected
# - Processing ... bytes of audio
# - Sending audio to Zhipu GLM-4-Voice...
# - Zhipu response text: ...
```

---

## 🔐 API Details

### Zhipu Endpoint:
```
https://open.bigmodel.cn/api/paas/v4/chat/completions
```

### Request Format:
```typescript
{
  "model": "glm-4-voice",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "instruction"
        },
        {
          "type": "input_audio",
          "input_audio": {
            "data": "base64_encoded_audio",
            "format": "wav"
          }
        }
      ]
    }
  ],
  "stream": false
}
```

### Response Format:
```typescript
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": [
          {
            "type": "text",
            "text": "回复文本"
          },
          {
            "type": "audio",
            "audio": {
              "data": "base64_audio",
              "format": "wav"
            }
          }
        ]
      }
    }
  ]
}
```

---

## ⚠️ Important Notes

### Audio Format:
- Input: PCM 16-bit, mono, 44100Hz (WAV)
- Output: Same format (WAV)
- Transmission: base64 for API, binary for WebSocket

### Chunk Size:
- Send to Zhipu: all at once (full recording)
- ESP32 → Server: 2048 bytes/chunk
- Server → ESP32: 1024 bytes/chunk

### Latency:
- API response time: ~2-5 seconds
- Full roundtrip: record (variable) + API (2-5s) + network (~0.5s)

### Concurrency:
- Only one request at a time (controlled by `isProcessing` flag)
- Cannot start new recording until previous is complete

---

## 🚀 Deployment Checklist

- [ ] Update `.env` with actual ZHIPU_API_KEY
- [ ] Run `yarn install` to get dependencies
- [ ] Test server: `yarn dev`
- [ ] Test WebSocket client: open `zhipu_client.html`
- [ ] Upload ESP32 firmware with correct WiFi credentials
- [ ] Test end-to-end: button press → audio → response
- [ ] Monitor server logs for errors
- [ ] Check Zhipu API quota/limits

---

## 🔄 Migration from OpenAI

### What Changed:
1. **API**: REST (Zhipu) vs WebSocket Realtime (OpenAI)
2. **Audio Format**: WAV base64 vs OpenAI format
3. **Response**: Immediate JSON vs streaming events
4. **Tools**: Removed LangChain tools integration
5. **Latency**: Higher but simpler architecture

### What Stayed:
1. **WebSocket server** (still uses Hono + WebSocket)
2. **Audio management** (AudioManager still handles buffering)
3. **ESP32 integration** (same pin configuration)
4. **File structure** (same directory layout)

---

## 📖 Documentation Files

1. **`ZHIPU_SETUP.md`** - Server setup & API details
2. **`ESP32_ZHIPU_SETUP.md`** - ESP32 firmware guide
3. **`zhipu_client.html`** - Web testing interface
4. **This file** - Migration summary

---

## 💡 Tips

- Keep WAV files in `tmp/` folder for debugging
- Monitor Zhipu API usage in dashboard
- Test with short audio first (< 1 minute)
- Check network latency with `ping`
- Use Serial Monitor for ESP32 debugging
