# 🚀 Bước Tiếp Theo - Server Đã Chạy Trên Port 8888

## ✅ Server đang chạy!

Server Zhipu Voice Assistant đã khởi động thành công trên `http://localhost:8888`

---

## 📋 Các Bước Tiếp Theo

### 1. 🎵 Mô Phỏng ESP32 Gửi Audio (Khuyến nghị đầu tiên)

**Giống như ESP32 thực tế:** Gửi binary chunks qua WebSocket, nhận response từ AI

Mở terminal mới (giữ server chạy ở terminal cũ):

```powershell
cd server_langchain
node simulate_esp32.js test.mp3
```

Script sẽ:
- ✅ Kết nối WebSocket đến server
- ✅ Gửi `start_recording` message
- ✅ Gửi audio data thành chunks 1024 bytes (giống ESP32)
- ✅ Gửi `stop_recording` message
- ✅ Nhận text và audio response từ AI
- ✅ Hiển thị kết quả trong terminal

**Bạn sẽ thấy trong terminal server:**
- `===Received binary message: { type: 'ArrayBuffer', size: 1024 }`
- `Starting recording session`
- `Stopping recording and processing audio`
- `Processing audio buffer`
- `Zhipu response text: ...`
- `Audio response saved to: ...`

---

### 2. 🎵 Test Xử Lý File MP3 (Endpoint API)

Bạn có file `test.mp3` trong thư mục `recordings/`. Hãy test endpoint:

#### Cách 1: Dùng Script Test (Dễ nhất)

Mở terminal mới (giữ server chạy ở terminal cũ):

```powershell
cd server_langchain
node test_process_file.js test.mp3
```

#### Cách 2: Dùng PowerShell

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

#### Cách 3: Dùng Browser (POST request)

Mở Developer Tools (F12) → Console, chạy:

```javascript
fetch('http://localhost:8888/api/process-file', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({filename: 'test.mp3'})
})
.then(r => r.json())
.then(console.log)
```

**Kết quả mong đợi:**
- ✅ Text response được trả về
- ✅ Audio và text được lưu trong `responses/<session_id>/`

---

### 2. 🌐 Xem Web Interface

Mở browser và truy cập:

#### Trang chính:
```
http://localhost:8888
```

#### Xem responses đã lưu:
```
http://localhost:8888/responses
```

#### Test WebSocket client:
```
http://localhost:8888/static/zhipu_client.html
```

---

### 3. 📱 Kết Nối ESP32 (Nếu có)

Nếu bạn có ESP32 đã cấu hình:

1. **Cấu hình ESP32** để kết nối đến:
   ```
   ws://localhost:8888/device
   ```
   Hoặc nếu server chạy trên máy khác:
   ```
   ws://<IP_SERVER>:8888/device
   ```

2. **ESP32 sẽ:**
   - Kết nối WebSocket
   - Gửi audio khi nhấn nút
   - Nhận text và audio response
   - Tự động phát audio qua speaker

3. **Server sẽ tự động:**
   - Lưu audio và text vào `responses/`
   - Xử lý qua Zhipu API
   - Gửi response về ESP32

---

### 4. 📁 Xem Files Đã Lưu

Sau khi xử lý, files được lưu tại:

```
server_langchain/
└── responses/
    └── <session_id>/
        ├── audio/
        │   └── response_*.mp3    ← Audio response
        ├── text/
        │   └── response_*.txt   ← Text response
        └── metadata_*.json      ← Metadata
```

**Xem qua PowerShell:**
```powershell
# Xem tất cả sessions
ls responses

# Xem audio files
ls responses\*\audio\

# Xem text files
ls responses\*\text\
```

---

### 5. 🔧 Test Với File MP3 Khác

Nếu bạn muốn test với file khác:

1. **Copy file vào `recordings/`:**
   ```powershell
   copy "C:\path\to\your\file.mp3" recordings\
   ```

2. **Xử lý file:**
   ```powershell
   node test_process_file.js your_file.mp3
   ```

---

## 🐛 Troubleshooting

### Server không chạy?

```powershell
# Kiểm tra port 8888 có đang được dùng không
netstat -ano | findstr :8888

# Khởi động lại server
npm run dev
```

### Lỗi "ZHIPU_API_KEY is not set"?

1. Tạo file `.env` trong `server_langchain/`
2. Thêm dòng:
   ```
   ZHIPU_API_KEY=your_api_key_here
   ```
3. Khởi động lại server

### Lỗi "File not found"?

- Kiểm tra file có trong `recordings/` không
- Kiểm tra tên file (phân biệt hoa thường)

### Request timeout?

- File quá lớn (> 25MB)
- Thử convert sang MP3 chất lượng thấp hơn:
  ```powershell
  ffmpeg -i input.wav -q:a 5 output.mp3
  ```

---

## 📚 Tài Liệu Tham Khảo

- **Hướng dẫn chi tiết:** `PROCESS_FILE_GUIDE.md`
- **Setup server:** `ZHIPU_SETUP.md`
- **ESP32 setup:** `../esp32/ESP32_ZHIPU_SETUP.md`

---

## 🎯 Checklist

- [ ] Server chạy trên port 8888 ✅
- [ ] Test endpoint với `test.mp3`
- [ ] Xem web interface tại `http://localhost:8888`
- [ ] Kiểm tra files đã lưu trong `responses/`
- [ ] (Tùy chọn) Kết nối ESP32

---

## 💡 Tips

1. **Giữ server chạy** trong một terminal riêng
2. **Mở terminal mới** để chạy test scripts
3. **Xem logs** trong terminal server để debug
4. **Files tự động lưu** - không cần cấu hình thêm

Chúc bạn thành công! 🎉

