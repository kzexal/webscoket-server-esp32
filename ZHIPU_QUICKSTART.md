# 🎙️ Zhipu Voice Assistant - Quick Start Guide

## ⚡ Quick Setup (5 minutes)

### Server Setup

```bash
cd server_langchain

# 1. Install dependencies
yarn install
# or: npm install

# 2. Dependencies are already updated with axios
# 3. .env already has ZHIPU_API_KEY configured

# 4. Start server
yarn dev
```

Server will be running at: `http://localhost:8888`

### Test WebSocket Connection

1. Open browser: `http://localhost:8888/static/zhipu_client.html`
2. Click "连接服务器" (Connect Server)
3. Should show "已连接 ✓"

### ESP32 Setup

1. Update `esp32/src/zhipu_voice_client.cpp`:
   ```cpp
   const char* ssid = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   const char* serverAddress = "192.168.1.100";  // Your server IP
   ```

2. Connect ESP32 to Arduino IDE
3. Install libraries: WebSocketsClient, ArduinoJSON
4. Upload sketch
5. Open Serial Monitor (115200 baud)
6. Should see: "WebSocket connected"

---

## 📋 What Was Changed

### Files Created:
- ✅ `server_langchain/src/lib/zhipu_client.ts` - Zhipu API client
- ✅ `server_langchain/src/lib/zhipu_agent.ts` - WebSocket handler
- ✅ `server_langchain/static/zhipu_client.html` - Test UI
- ✅ `esp32/src/zhipu_voice_client.cpp` - ESP32 firmware example
- ✅ `ZHIPU_MIGRATION_SUMMARY.md` - Full migration details
- ✅ `server_langchain/ZHIPU_SETUP.md` - Server docs
- ✅ `esp32/ESP32_ZHIPU_SETUP.md` - ESP32 docs

### Files Modified:
- ✅ `server_langchain/.env` - Updated API key
- ✅ `server_langchain/package.json` - Added axios
- ✅ `server_langchain/src/index.ts` - Switched to ZhipuVoiceAgent

---

## 🔄 Data Flow

```
User speaks to ESP32
         ↓
   Microphone records (I2S)
         ↓
   Audio sent to Server (WebSocket, binary)
         ↓
   Server buffers audio
         ↓
   Send to Zhipu API (REST, base64)
         ↓
Zhipu: STT (speech-to-text)
Zhipu: LLM (generate response)
Zhipu: TTS (text-to-speech)
         ↓
   Response: Text + Audio (base64)
         ↓
   Server extracts and sends
   - Text response (JSON)
   - Audio response (binary chunks)
         ↓
   ESP32 receives
   - Text (log/display)
   - Audio (play from speaker)
         ↓
   User hears response from speaker
```

---

## 🧪 Testing Steps

### 1️⃣ Test Server Alone
```bash
cd server_langchain
yarn dev
# Open: http://localhost:8888/static/zhipu_client.html
# Click "Connect" button
# Should connect successfully
```

### 2️⃣ Test ESP32 WebSocket
```cpp
// Upload zhipu_voice_client.cpp to ESP32
// Open Serial Monitor
// Should show:
// - WiFi connected
// - WebSocket connected
```

### 3️⃣ Test Full Flow
```
1. Server running: yarn dev
2. ESP32 connected to WiFi
3. ESP32 connected to WebSocket
4. Press button on ESP32 (starts recording)
5. Speak into microphone
6. Press button again (stops recording)
7. Server sends to Zhipu API
8. ESP32 receives response
9. Audio plays from speaker
```

---

## 🚨 Troubleshooting

### Server not starting?
```bash
# Check if port 8888 is in use
# macOS/Linux:
lsof -i :8888
# Windows:
netstat -ano | findstr :8888
```

### Can't connect to server from ESP32?
```
1. Check WiFi SSID/password correct
2. Check server IP address (get from server logs)
3. Check firewall allows port 8888
4. Ping server: ping 192.168.1.100
```

### No response from Zhipu?
```
1. Check ZHIPU_API_KEY in .env
2. Check API key is valid/active
3. Check API quota not exceeded
4. Check server logs for errors
```

### Audio issues?
```
1. Check microphone connected to I2S pins
2. Check speaker connected to I2S pins
3. Verify sample rate is 44100Hz
4. Check audio format is WAV
```

---

## 📊 Architecture Overview

### Server Architecture:
```
Hono HTTP Server (port 8888)
├── WebSocket endpoint: /device
│   ├── Receives: Binary audio from ESP32
│   ├── Processes: With ZhipuVoiceAgent
│   └── Sends: JSON messages + audio chunks
├── Static: /static/
│   ├── index.html (original)
│   └── zhipu_client.html (new test UI)
└── Dependencies:
    ├── @hono/node-server
    ├── @hono/node-ws
    ├── axios (NEW for HTTP requests)
    └── others...
```

### ZhipuVoiceAgent Flow:
```
WebSocket Connect
    ↓
Listen for messages (binary + JSON)
    ↓
IF text message:
    ├─ "start_recording" → startRecording()
    └─ "stop_recording" → processRecordedAudio()
    
IF binary data:
    └─ handleAudioBuffer(data)
    
processRecordedAudio():
    ├─ Get audio buffer
    ├─ ZhipuAiClient.chat() → Zhipu API
    ├─ Extract text → broadcast JSON
    ├─ Extract audio → decode base64 → send chunks
    └─ Send completion signal
```

---

## 🔌 WebSocket Messages

### Client → Server (JSON):
```json
{"type": "start_recording", "timestamp": 1234567890}
{"type": "stop_recording", "timestamp": 1234567890}
```

### Client → Server (Binary):
```
Raw PCM 16-bit WAV data
Chunks of 2048 bytes
```

### Server → Client (JSON):
```json
{"type": "text_response", "content": "...", "timestamp": "..."}
{"type": "error", "message": "..."}
{"type": "audio_response_complete", "timestamp": "..."}
```

### Server → Client (Binary):
```
Base64-decoded WAV audio
Chunks of 1024 bytes
```

---

## 📝 Configuration

### Server (.env):
```env
ZHIPU_API_KEY=95b0172f52594e7886ad6f353a991dd9.feIwLW6x4Ylhj2W8
TAVILY_API_KEY=  # Optional, unused
```

### Server (index.ts):
```typescript
const agent = new ZhipuVoiceAgent({
  apiKey: process.env.ZHIPU_API_KEY,
  instructions: "你好，请认真听这段音频，然后用中文和我对话。",
  audioConfig: {
    sampleRate: 44100,
    channels: 1,
    bitDepth: 16
  }
});
```

### ESP32:
```cpp
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverAddress = "192.168.1.100";
const int serverPort = 8888;
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `ZHIPU_MIGRATION_SUMMARY.md` | Complete migration details |
| `server_langchain/ZHIPU_SETUP.md` | Server setup & API details |
| `esp32/ESP32_ZHIPU_SETUP.md` | ESP32 firmware guide |
| `static/zhipu_client.html` | Web test interface |
| `src/lib/zhipu_client.ts` | Zhipu API client code |
| `src/lib/zhipu_agent.ts` | WebSocket handler code |

---

## 🎯 Next Steps

1. ✅ Update `.env` with API key (already done)
2. ✅ Install dependencies: `yarn install`
3. ✅ Start server: `yarn dev`
4. ✅ Test WebSocket: Open `zhipu_client.html`
5. ✅ Configure & upload ESP32 firmware
6. ✅ Test button → record → process → response
7. ✅ Monitor server logs for errors
8. ✅ Iterate and improve

---

## 💡 Tips & Best Practices

### Performance:
- Keep recordings < 30 seconds initially
- Test with good WiFi signal (RSSI > -50dBm)
- Monitor server CPU/memory usage
- Log Zhipu API response times

### Debugging:
- Enable Serial logging on ESP32
- Monitor server logs: `yarn dev`
- Test with `zhipu_client.html` first
- Use curl to test API directly: `curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions ...`

### Optimization:
- Reduce audio chunk size if latency is high
- Increase chunk size for better throughput
- Add compression if bandwidth limited
- Cache responses if using same queries

---

## 🆘 Support

### For errors, check:
1. Server logs (yarn dev output)
2. Browser console (F12 in zhipu_client.html)
3. ESP32 Serial Monitor
4. API key validity
5. Network connectivity

### Common errors:
- `ZHIPU_API_KEY is not set` → Update .env
- `Connection timed out` → Check server IP/port
- `Failed to process audio` → Check audio format
- `WebSocket connection failed` → Check firewall

---

## 📈 Monitoring

### Check server is working:
```bash
curl http://localhost:8888/static/zhipu_client.html
# Should return HTML
```

### Check WebSocket connection:
```bash
# Use wscat:
npm install -g wscat
wscat -c ws://localhost:8888/device
# Should show connected
```

### Check Zhipu API:
```bash
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4-voice","messages":[...]}'
```

---

**Ready to go!** 🚀 Start with `yarn dev` and test using the web interface.
