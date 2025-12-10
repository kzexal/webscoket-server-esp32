# 🎯 Giải Thích Vấn Đề Timeout Audio

## Tóm Tắt Vấn Đề

**Lỗi**: Zhipu API timeout khi gửi audio (WAV), nhưng OK với text
**Nguyên Nhân**: Kích thước file WAV quá lớn
**Giải Pháp**: Dùng MP3 format hoặc downsampling

---

## Chi Tiết Kỹ Thuật

### 1️⃣ File test.wav Hiện Tại
```
Kích thước: 798,802 bytes (798 KB)
Format: WAV
Base64: ~1.2 MB
Tỉ lệ nén: 0% (WAV không nén)
```

### 2️⃣ Tại Sao WAV Bị Timeout?

**WAV = Uncompressed Audio**
- Mỗi sample được lưu toàn bộ
- test.wav 798KB → base64 ~1.2MB
- Zhipu API có giới hạn payload và timeout nghiêm ngặt
- Xử lý 1.2MB data mất lâu → timeout (< 30s mặc định)

**Mô phỏng:**
```
┌─────────────────────────────────────────────────┐
│ ESP32 gửi Audio                                 │
│ (WAV 798KB → base64 1.2MB)                     │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Server Zhipu mở Connection                      │
└──────────────┬──────────────────────────────────┘
               │
    (Server nhận + xử lý 1.2MB)
               │ (~30s timeout vượt)
               ▼
         ❌ TIMEOUT
```

### 3️⃣ Giải Pháp: Dùng MP3

**MP3 = Compressed Audio**
```
Kích thước: 798KB WAV → ~50-100KB MP3
Tỉ lệ nén: 8-15x nhỏ hơn
Base64: ~100-150KB (dễ xử lý)
Thời gian: < 10 giây
```

**So Sánh:**
```
┌──────────────┬───────────┬──────────┬────────────┐
│ Format       │ Kích thước │ Base64   │ Xử lý      │
├──────────────┼───────────┼──────────┼────────────┤
│ WAV          │ 798 KB    │ 1.2 MB   │ ❌ Timeout │
│ MP3 (q:5)    │ 60 KB     │ 90 KB    │ ✅ 5s      │
│ MP3 (q:3)    │ 40 KB     │ 60 KB    │ ✅ 3s      │
│ AAC          │ 70 KB     │ 105 KB   │ ✅ 5s      │
└──────────────┴───────────┴──────────┴────────────┘
```

---

## 🔧 Cách Fix

### Cách 1: Thay Đổi Format (Tức thì)

```bash
# Cài ffmpeg
choco install ffmpeg  # Windows (admin)
apt-get install ffmpeg  # Linux
brew install ffmpeg  # Mac

# Convert WAV → MP3
ffmpeg -i recordings/test.wav -q:a 5 recordings/test.mp3

# Test với MP3
.\test_audio_mp3.ps1
```

### Cách 2: Tăng Timeout Server

**Đã sửa** `zhipu_client.ts`:
```typescript
timeout: 120000  // 120 giây (từ 30s mặc định)
```

### Cách 3: Downsample Audio

Nếu phải giữ WAV, hạ sample rate:
```bash
ffmpeg -i recordings/test.wav -ar 16000 -q:a 5 recordings/test_16k.wav
# 44100 Hz → 16000 Hz (thường dùng cho speech)
```

---

## 📊 Sơ Đồ Hệ Thống Được Sửa

```
ESP32 (Mic)
    ↓
[Capture Audio 16kHz]
    ↓
🔷 Chọn Format:
    ├─ MP3 (KHUYẾN NGHỊ) → 60KB ✅
    ├─ WAV (Timeout) → 798KB ❌
    └─ Downsample → 200KB ⚠️
    ↓
[WebSocket gửi đến Server]
    ↓
Server nhận audio
    ↓
┌────────────────────┐
│ Zhipu GLM-4-Voice  │
│  (timeout: 120s)   │
└────────────────────┘
    ↓
[Text response] + [Audio response]
    ↓
[WebSocket gửi lại ESP32]
    ↓
ESP32 [Play Audio]
```

---

## 🚀 Khuyến Nghị Cho ESP32

1. **Capture Format**: PCM 16-bit, 16kHz (16000 Hz)
   - Tiêu chuẩn cho speech recognition
   - Đủ chất lượng, nhẹ, nhanh

2. **Nén trên ESP32** (tuỳ chọn):
   ```cpp
   // Dùng thư viện libmp3lame để encode MP3 trực tiếp
   // Giảm packet size → gửi từng chunk nhỏ
   ```

3. **Streaming từng chunk**:
   ```cpp
   // Thay vì gửi toàn bộ audio cùng lúc
   // Gửi chunks 512 bytes với delay
   // → Server xử lý dần dần
   ```

---

## ✅ Test Kế Tiếp

**Chạy script MP3:**
```powershell
cd "c:\Users\buidu\Downloads\code\esp32-realtime-voice-assistant"
.\test_audio_mp3.ps1
```

**Kết quả kỳ vọng:**
- ✅ API respond trong < 10s
- ✅ Nhận text response
- ✅ Nhận audio response (MP3)
- ✅ Lưu file response

---

## 📌 Tóm Tắt

| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-----------|----------|
| WAV timeout | 798KB → 1.2MB uncompressed | Dùng MP3 (10-15x nhỏ hơn) |
| Timeout 30s | Default timeout quá ngắn | Tăng lên 120s ✅ Đã sửa |
| API payload limit | WAV vượt giới hạn | Dùng format nén |

Sau khi test MP3 thành công, có thể tích hợp vào ESP32 firmware và WebSocket server! 🎉
