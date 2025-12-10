# 🐛 Debug Guide - Server Không Phản Hồi

## Vấn Đề

Khi chạy `simulate_esp32.js`, server không phản hồi:
- ✅ Gửi audio chunks thành công
- ✅ Gửi stop_recording thành công  
- ❌ Không nhận được text response
- ❌ Không nhận được audio response
- ❌ WebSocket đóng ngay sau khi gửi stop_recording

## Nguyên Nhân Có Thể

### 1. **MP3 Format Issue** ⚠️ QUAN TRỌNG

**Vấn đề:** MP3 file được gửi như binary chunks, nhưng server đang cố lưu vào WAV file (expect PCM raw data).

**Giải thích:**
- ESP32 thực tế gửi PCM raw data (16-bit, 44100Hz)
- Server lưu PCM data vào WAV file → OK ✅
- Nhưng script gửi MP3 file → Server cố lưu MP3 data vào WAV file → File không hợp lệ ❌

**Giải pháp:**
1. Convert MP3 sang WAV/PCM trước khi gửi
2. Hoặc sửa server để detect format và xử lý đúng

### 2. **File Writer Chưa Đóng**

Server có thể chưa đóng file WAV trước khi đọc, dẫn đến file không hoàn chỉnh.

**Đã sửa:** Thêm `closeFile()` trước khi xử lý.

### 3. **Lỗi Trong Quá Trình Xử Lý**

Có thể có lỗi nhưng không được log ra.

**Đã sửa:** Thêm logging chi tiết.

## Cách Debug

### Bước 1: Xem Logs Server

Kiểm tra terminal server có hiển thị:
```
===Received binary message: { type: 'Buffer', size: 1024 }
===Received binary message: { type: 'Buffer', size: 1024 }
...
📨 Received control message: {"type":"start_recording",...}
🎙️  Starting recording session
📨 Received control message: {"type":"stop_recording",...}
⏹️  Stopping recording and processing audio
📝 Closing WAV file writer
📊 Processing X bytes of audio
```

### Bước 2: Kiểm Tra File WAV

Kiểm tra file trong `tmp/`:
```powershell
ls tmp/recording-*.wav
```

File có tồn tại không? Kích thước bao nhiêu?

### Bước 3: Kiểm Tra Lỗi

Nếu có lỗi, sẽ hiển thị trong terminal server:
```
Error handling WebSocket message: ...
Error processing audio: ...
```

## Giải Pháp Tạm Thời

### Option 1: Convert MP3 Sang WAV Trước

```powershell
# Convert MP3 sang WAV PCM
ffmpeg -i recordings/test.mp3 -ar 44100 -ac 1 -f wav recordings/test.wav

# Sau đó dùng file WAV
node simulate_esp32.js test.wav
```

### Option 2: Dùng Endpoint API Thay Vì WebSocket

```powershell
node test_process_file.js test.mp3
```

Endpoint này xử lý MP3 trực tiếp, không cần convert.

## Logs Đã Thêm

Sau khi sửa, bạn sẽ thấy logs chi tiết:

1. **Khi nhận binary:**
   ```
   ===Received binary message: { type: 'Buffer', size: 1024 }
   ```

2. **Khi nhận control message:**
   ```
   📨 Received control message: {"type":"start_recording"}
   🎙️  Starting recording session
   ```

3. **Khi stop recording:**
   ```
   ⏹️  Stopping recording and processing audio
   📝 Closing WAV file writer
   📊 Processing X bytes of audio
   🎵 Detected MP3/WAV format
   📤 Sending audio to Zhipu GLM-4-Voice...
   ```

4. **Khi có lỗi:**
   ```
   Error handling WebSocket message: ...
   Error stack: ...
   ```

## Test Lại

1. **Restart server:**
   ```powershell
   # Dừng server (Ctrl+C)
   npm run dev
   ```

2. **Chạy script:**
   ```powershell
   node simulate_esp32.js test.mp3
   ```

3. **Xem logs trong terminal server**

4. **Nếu vẫn lỗi, thử với WAV:**
   ```powershell
   # Convert MP3 sang WAV
   ffmpeg -i recordings/test.mp3 -ar 44100 -ac 1 -f wav recordings/test.wav
   
   # Test với WAV
   node simulate_esp32.js test.wav
   ```

## Kết Luận

Vấn đề chính là **MP3 format không tương thích với WAV file writer**. 

**Khuyến nghị:**
- ✅ Dùng WAV file cho simulate_esp32.js
- ✅ Hoặc dùng endpoint `/api/process-file` cho MP3
- ✅ Hoặc sửa server để hỗ trợ MP3 trực tiếp (phức tạp hơn)

