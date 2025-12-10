# 🚀 Hướng dẫn chạy Server

## Bước 1: Kiểm tra Dependencies

### Node.js Dependencies
```bash
cd server_langchain
npm install
# hoặc
yarn install
```

### Python Dependencies
```bash
# Cài đặt edge-tts
py -3 -m pip install edge-tts

# Cài đặt deepgram
py -3 -m pip install deepgram

# Hoặc trên Linux/Mac
pip3 install edge-tts deepgram
```

## Bước 2: Cấu hình API Keys

### 1. Tạo file `.env` (nếu chưa có)
```bash
# Trong thư mục server_langchain
# Tạo file .env với nội dung:
ZHIPU_API_KEY=your_zhipu_api_key_here
```

### 2. Kiểm tra Deepgram API Key
Mở file `recordings/stt_deepgram.py` và kiểm tra:
```python
DEEPGRAM_API_KEY = "6ab4105de223f75cd42053f01b31dee07e4c396e"
```
Nếu cần, thay đổi API key của bạn.

## Bước 3: Chạy Server

```bash
npm run dev
```

Server sẽ chạy trên: **http://localhost:8888**

Bạn sẽ thấy:
```
Zhipu Voice Assistant Server running on port 8888
```

## Bước 4: Test Server

### Option 1: Test với simulate_esp32.js
```bash
# Trong terminal mới (giữ server chạy ở terminal cũ)
node simulate_esp32.js test.mp3
```

### Option 2: Test với API endpoint
```bash
# Test với curl hoặc Postman
curl -X POST http://localhost:8888/api/process-file \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.mp3"}'
```

### Option 3: Kết nối ESP32 thật
ESP32 sẽ tự động kết nối đến `ws://localhost:8888/device`

## Luồng hoạt động

```
1. ESP32 gửi audio → Server
2. Server: Audio → Deepgram STT → Text
3. Server: Text → GLM-4 → Text Response  
4. Server: Text Response → Edge-TTS → Audio
5. Server gửi audio → ESP32
```

## Kiểm tra Logs

Khi server chạy, bạn sẽ thấy các logs:
- `🎙️  Transcribing audio using Deepgram STT...`
- `✅ User said: ...`
- `📤 Sending text to Zhipu GLM-4...`
- `🎤 Converting text to speech using edge-tts...`
- `✅ Audio generated: ...`

## Troubleshooting

### Lỗi "ZHIPU_API_KEY is not set"
→ Kiểm tra file `.env` có tồn tại và có API key không

### Lỗi "Deepgram STT script not found"
→ Kiểm tra file `recordings/stt_deepgram.py` có tồn tại không

### Lỗi "ModuleNotFoundError: No module named 'edge_tts'"
→ Chạy: `py -3 -m pip install edge-tts`

### Lỗi "ModuleNotFoundError: No module named 'deepgram'"
→ Chạy: `py -3 -m pip install deepgram`

### Port 8888 đã được sử dụng
```bash
# Windows
netstat -ano | findstr :8888
# Kill process nếu cần

# Linux/Mac
lsof -i :8888
kill -9 <PID>
```

## Files được tạo tự động

- `tmp/` - File tạm (audio, STT input)
- `responses/{session_id}/` - Text và audio responses
  - `text/` - Text responses
  - `audio/` - Audio responses (MP3)

## Xem kết quả

1. **Terminal logs** - Xem text response trực tiếp
2. **Web interface** - Mở `http://localhost:8888` trong browser
3. **Files** - Xem trong thư mục `responses/`

---

✅ **Server đã sẵn sàng!** Chúc bạn thành công! 🎉




