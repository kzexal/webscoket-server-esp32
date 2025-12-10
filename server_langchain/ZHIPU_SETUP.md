# Zhipu Voice Assistant - Setup & Usage Guide

## 🎯 Quy trình hoạt động

```
ESP32 (ghi âm) 
    ↓ (gửi WAV qua WebSocket)
Server (nhận audio)
    ↓ (chuyển đổi sang base64)
Zhipu API (GLM-4-Voice)
    ↓ (xử lý: nhận audio → text + sinh giọng nói)
Server (nhận phản hồi)
    ↓ (gửi text + audio qua WebSocket)
ESP32 (phát âm thanh, lưu transcript)
```

## 📋 Cài đặt

### 1. Cập nhật dependencies
```bash
cd server_langchain
yarn install
# hoặc
npm install
```

### 2. Cấu hình .env
Đã cập nhật file `.env` với:
```env
ZHIPU_API_KEY=95b0172f52594e7886ad6f353a991dd9.feIwLW6x4Ylhj2W8
TAVILY_API_KEY=
```

### 3. Chạy server
```bash
yarn dev
# Server sẽ chạy trên http://localhost:8888
```

## 🔌 Quy trình WebSocket

### Từ ESP32 gửi tới Server:
1. **Binary Audio Data** - Dữ liệu WAV ghi âm từ ESP32
   ```
   Buffer (PCM 16-bit, 44100Hz, mono)
   ```

2. **Control Messages** - JSON commands:
   ```json
   {
     "type": "start_recording",
     "timestamp": 1234567890
   }
   ```
   ```json
   {
     "type": "stop_recording",
     "timestamp": 1234567890
   }
   ```

### Từ Server gửi tới ESP32:
1. **Text Response** - JSON:
   ```json
   {
     "type": "text_response",
     "content": "Xin chào, tôi là trợ lý AI của bạn",
     "timestamp": "2024-12-04T10:30:00.000Z"
   }
   ```

2. **Audio Response** - Binary WAV data
   ```
   Buffer (WAV format, base64 decoded)
   Gửi theo chunks 1024 bytes
   ```

3. **Completion Signal**:
   ```json
   {
     "type": "audio_response_complete",
     "timestamp": "2024-12-04T10:30:05.000Z"
   }
   ```

4. **Error Messages**:
   ```json
   {
     "type": "error",
     "message": "Failed to process audio: ..."
   }
   ```

## 📝 Cấu trúc Files

```
server_langchain/
├── src/
│   ├── index.ts                 # Main server (Zhipu Agent)
│   ├── lib/
│   │   ├── zhipu_client.ts     # Zhipu API Client (NEW)
│   │   ├── zhipu_agent.ts      # Zhipu Voice Agent (NEW)
│   │   ├── audio.ts            # Audio Manager
│   │   └── utils.ts            # Utilities
│   └── static/
│       └── index.html
├── .env                          # API Keys
├── package.json                  # Dependencies
└── tsconfig.json
```

## 🔄 Luồng xử lý Audio

### 1. Nhận Audio từ ESP32
```typescript
ws.on('message', (data: Buffer) => {
    audioManager.handleAudioBuffer(data);
});
```

### 2. Gửi tới Zhipu API
```typescript
const response = await client.chat({
    audioData: audioBuffer,
    audioFormat: 'wav',
    text: "Xin lưu ý điều gì đó..."
});
```

### 3. Xử lý Response
```typescript
// Trích xuất text
const responseText = client.getTextFromResponse(response);
broadcastToClients(JSON.stringify({
    type: 'text_response',
    content: responseText
}));

// Trích xuất audio
const audioResponse = client.getAudioFromResponse(response);
if (audioResponse) {
    const audioBuffer = Buffer.from(audioResponse.data, 'base64');
    // Gửi audio tới ESP32 theo chunks
    ws.send(chunk);
}
```

## 🛠 Tùy chỉnh

### Thay đổi Instructions
Edit `src/index.ts`:
```typescript
const agent = new ZhipuVoiceAgent({
  apiKey: process.env.ZHIPU_API_KEY,
  instructions: "Bạn là một trợ lý AI thân thiện...",  // Customize here
  audioConfig: {
    sampleRate: 44100,
    channels: 1,
    bitDepth: 16
  }
});
```

### Thay đổi Audio Config
```typescript
audioConfig: {
  sampleRate: 48000,  // Thay đổi tần số lấy mẫu
  channels: 1,
  bitDepth: 16
}
```

## 📊 API Response Format

Zhipu GLM-4-Voice trả về:
```typescript
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": [
          {
            "type": "text",
            "text": "..."
          },
          {
            "type": "audio",
            "audio": {
              "data": "base64_encoded_audio",
              "format": "wav"
            }
          }
        ]
      }
    }
  ]
}
```

## 🐛 Troubleshooting

### Error: ZHIPU_API_KEY is not set
- Kiểm tra file `.env` có chứa `ZHIPU_API_KEY`
- Khởi động lại server sau khi thay đổi `.env`

### Zhipu API returns error 400
- Kiểm tra format của audio data (phải là WAV)
- Kiểm tra API key có hợp lệ
- Kiểm tra messages format đúng

### Audio không phát trên ESP32
- Kiểm tra WebSocket connection status
- Kiểm tra audio chunks size (1024 bytes)
- Kiểm tra sample rate khớp với ESP32 config

## 📚 Tài liệu tham khảo

- [Zhipu API Docs](https://open.bigmodel.cn/dev/api)
- [GLM-4-Voice Model Docs](https://open.bigmodel.cn/dev/howuse/voice)
