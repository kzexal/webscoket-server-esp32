# 📁 Hướng Dẫn Xử Lý File MP3 từ Thư Mục Recordings

## 🎯 Tổng Quan

Endpoint `/api/process-file` cho phép bạn xử lý file MP3 từ thư mục `recordings` như thể ESP32 đã gửi audio. Server sẽ tự động:
- ✅ Đọc file MP3 từ thư mục `recordings`
- ✅ Gửi đến Zhipu API để xử lý (STT → LLM → TTS)
- ✅ Lưu audio và text response vào thư mục `responses`

## 📋 Cách Sử Dụng

### 1. Đảm Bảo File MP3 Có Sẵn

Đặt file MP3 vào thư mục `server_langchain/recordings/`:
```
server_langchain/
└── recordings/
    └── test.mp3  ← File của bạn ở đây
```

### 2. Khởi Động Server

```bash
cd server_langchain
npm run dev
# hoặc nếu đã cài yarn:
# yarn dev
```

Server sẽ chạy trên `http://localhost:8888`

### 3. Gọi API Endpoint

#### Cách 1: Dùng Script Test (Khuyến nghị)

```bash
# Xử lý file test.mp3 với instructions mặc định
node test_process_file.js

# Xử lý file cụ thể
node test_process_file.js myfile.mp3

# Xử lý với instructions tùy chỉnh
node test_process_file.js test.mp3 "Hãy tóm tắt nội dung audio này"
```

#### Cách 2: Dùng curl

```bash
curl -X POST http://localhost:8888/api/process-file \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.mp3",
    "instructions": "你好，请认真听这段音频，然后用中文和我对话。"
  }'
```

#### Cách 3: Dùng PowerShell

```powershell
$body = @{
    filename = "test.mp3"
    instructions = "你好，请认真听这段音频，然后用中文和我对话。"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8888/api/process-file" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### Cách 4: Dùng JavaScript/TypeScript

```javascript
const response = await fetch('http://localhost:8888/api/process-file', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filename: 'test.mp3',
    instructions: '你好，请认真听这段音频，然后用中文和我对话。'
  })
});

const result = await response.json();
console.log(result);
```

## 📤 Response Format

Khi thành công, API sẽ trả về:

```json
{
  "success": true,
  "text": "你好，我是智谱清言...",
  "textPath": "responses/2025-12-04_123456/text/response_2025-12-04T12-34-56.txt",
  "audioPath": "responses/2025-12-04_123456/audio/response_2025-12-04T12-34-56.mp3",
  "sessionId": "2025-12-04_123456",
  "message": "File processed successfully"
}
```

## 📁 Files Được Lưu Tự Động

Sau khi xử lý, các file sau sẽ được lưu tự động:

```
responses/
└── 2025-12-04_123456/          (Session ID)
    ├── audio/
    │   └── response_2025-12-04T12-34-56.mp3  ← Audio response
    ├── text/
    │   └── response_2025-12-04T12-34-56.txt  ← Text response
    └── metadata_2025-12-04T12-34-56.json      ← Metadata
```

## 🔧 Parameters

### Request Body

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filename` | string | No | `test.mp3` | Tên file MP3 trong thư mục `recordings` |
| `instructions` | string | No | `"你好，请认真听这段音频，然后用中文和我对话。"` | Instructions cho LLM |

### Supported Audio Formats

- ✅ **MP3** (khuyến nghị - nhỏ nhất)
- ✅ **WAV** (lớn hơn, có thể timeout)
- ✅ **AAC** (tốt)

## ⚠️ Lưu Ý

1. **File Size**: File MP3 nên < 25MB để tránh timeout
2. **Format**: MP3 được khuyến nghị vì nhỏ nhất và nhanh nhất
3. **Server Running**: Đảm bảo server đang chạy trước khi gọi API
4. **API Key**: Đảm bảo `ZHIPU_API_KEY` đã được set trong `.env`

## 🐛 Troubleshooting

### Lỗi: "File not found"
- Kiểm tra file có trong thư mục `server_langchain/recordings/` không
- Kiểm tra tên file có đúng không (phân biệt hoa thường)

### Lỗi: "ZHIPU_API_KEY is not set"
- Kiểm tra file `.env` trong `server_langchain/`
- Đảm bảo có dòng: `ZHIPU_API_KEY=your_key_here`

### Lỗi: "Request timeout"
- File quá lớn (> 25MB)
- Thử convert sang MP3 với chất lượng thấp hơn:
  ```bash
  ffmpeg -i input.wav -q:a 5 output.mp3
  ```

### Lỗi: "Audio payload too large"
- File quá lớn để gửi đến API
- Giảm chất lượng hoặc độ dài audio

## 📝 Ví Dụ Đầy Đủ

```bash
# 1. Đặt file vào recordings
cp my_audio.mp3 server_langchain/recordings/

# 2. Khởi động server
cd server_langchain
yarn dev

# 3. Trong terminal khác, chạy script test
node test_process_file.js my_audio.mp3 "Hãy tóm tắt nội dung"

# 4. Xem kết quả trong responses/
ls responses/*/text/
ls responses/*/audio/
```

## 🎉 Kết Quả

Sau khi xử lý thành công:
- ✅ Text response được lưu trong `responses/<session_id>/text/`
- ✅ Audio response được lưu trong `responses/<session_id>/audio/`
- ✅ Metadata được lưu trong `responses/<session_id>/`
- ✅ Có thể xem qua web interface: `http://localhost:8888/responses`


