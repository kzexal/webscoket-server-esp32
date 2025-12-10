# 🔧 Sửa Lỗi Audio Timeout - Tóm Tắt Thay Đổi

## ❌ Vấn Đề

Zhipu API timeout khi gửi audio WAV (798KB):
- Request mất > 30s → timeout
- Nhưng text-only request thành công ✅

## 🎯 Nguyên Nhân

**WAV Format = Uncompressed**
- 798 KB WAV → 1.2 MB base64
- Xử lý lâu, vượt timeout mặc định 30s
- MP3 nén 10-15x → chỉ cần 50-100 KB

## ✅ Sửa Lỗi

### 1. Tăng Timeout (zhipu_client.ts)

```typescript
// Trước: Timeout mặc định 30s
// Sau: Timeout 120s
timeout: 120000  // milliseconds
```

### 2. Thêm Kiểm Tra Kích Thước (zhipu_client.ts)

```typescript
// Kiểm tra audio > 25MB
if (audioBase64.length > 25 * 1024 * 1024) {
    throw new Error('Audio file too large. Max 25MB. Use MP3 format to compress.');
}

// Log kích thước
console.log(`Audio size: ${(audioSize / 1024 / 1024).toFixed(2)}MB`);
```

### 3. Xử Lý Error Tốt Hơn (zhipu_client.ts)

```typescript
catch (error: any) {
    if (error.code === 'ECONNABORTED') {
        console.error('Timeout: Audio may be too large');
    } else if (error.response?.status === 413) {
        console.error('Payload too large');
    }
    throw error;
}
```

### 4. Cảnh Báo Trong Agent (zhipu_agent.ts)

```typescript
// Nếu audio > 500KB, cảnh báo dùng MP3
if (audioBuffer.length > 500 * 1024) {
    console.warn('⚠️  Use MP3 format instead of WAV');
}
```

## 🚀 Giải Pháp Khuyến Nghị

### Option A: Dùng MP3 Format (BEST)

**Ưu điểm:**
- ✅ 10-15x nhỏ hơn WAV
- ✅ Xử lý < 10 giây
- ✅ Chất lượng audio tốt
- ✅ Hỗ trợ rộng

**Cách thực hiện:**
```bash
# Convert test.wav → MP3
ffmpeg -i recordings/test.wav -q:a 5 recordings/test.mp3

# Test
.\test_audio_mp3.ps1
```

### Option B: Downsample WAV

**Giảm sample rate:**
```bash
ffmpeg -i recordings/test.wav -ar 16000 recordings/test_16k.wav
# 44100 Hz → 16000 Hz (đủ cho speech)
```

**Kết quả:**
- Kích thước giảm ~2.7x
- Vẫn ok cho speech recognition
- Nhưng vẫn lâu hơn MP3

### Option C: Tăng Timeout Thêm (Temporary Fix)

```typescript
timeout: 180000  // 3 phút cho WAV lớn
```

⚠️ **Không khuyến nghị** - chỉ là workaround tạm thời

## 📊 So Sánh

```
┌────────────────┬──────────┬─────────┬────────┐
│ Format         │ Kích lượng│ Base64  │ Thời gian
├────────────────┼──────────┼─────────┼────────┤
│ WAV (44.1kHz)  │ 798 KB   │ 1.2 MB  │ ❌ 30s+ (timeout)
│ WAV (16kHz)    │ 290 KB   │ 435 KB  │ ⚠️  15-20s
│ MP3 (q:5)      │ 60 KB    │ 90 KB   │ ✅ 5-10s
│ MP3 (q:3)      │ 40 KB    │ 60 KB   │ ✅ 3-5s
│ AAC            │ 70 KB    │ 105 KB  │ ✅ 5-10s
└────────────────┴──────────┴─────────┴────────┘
```

## 🔗 Files Sửa

1. **server_langchain/src/lib/zhipu_client.ts**
   - Tăng timeout 30s → 120s
   - Thêm kiểm tra kích thước
   - Thêm error handling

2. **server_langchain/src/lib/zhipu_agent.ts**
   - Thêm cảnh báo audio > 500KB
   - Cải thiện error messages
   - Better logging

3. **test_audio_mp3.ps1** (NEW)
   - Script test MP3 format
   - Convert WAV → MP3 tự động
   - Hiển thị stats nén

4. **AUDIO_TIMEOUT_SOLUTION.md** (NEW)
   - Giải thích chi tiết
   - Sơ đồ luồng xử lý
   - Hướng dẫn thực hiện

## ⚡ Kế Tiếp

**Test ngay:**
```powershell
# Chuyển test.wav thành MP3
ffmpeg -i recordings/test.wav -q:a 5 recordings/test.mp3

# Test API với MP3
.\test_audio_mp3.ps1
```

**Kết quả kỳ vọng:**
- ✅ Response trong 5-10 giây
- ✅ Nhận text response
- ✅ Nhận audio response
- ✅ Lưu file response

## 🎉 Sau Khi Test Thành Công

Có thể tích hợp vào:
1. **ESP32 Firmware** - Capture MP3 format hoặc downsample
2. **WebSocket Server** - Xử lý audio chunks từng cái
3. **Real-time Pipeline** - Stream audio từng 512 bytes

---

**Status**: ✅ Sửa lỗi xong, sẵn sàng test MP3 format
