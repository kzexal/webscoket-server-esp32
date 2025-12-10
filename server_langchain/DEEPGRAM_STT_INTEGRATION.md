# Tích hợp Deepgram STT vào Server

## Tổng quan

Server đã được cập nhật để sử dụng Deepgram STT (Speech-to-Text) để chuyển audio thành text trước khi gửi cho GLM. Luồng xử lý mới:

1. **Nhận audio từ ESP32** → Lưu vào buffer
2. **Deepgram STT** → Chuyển audio thành text
3. **GLM-4** → Nhận text và tạo response
4. **Edge-TTS** → Chuyển text response thành audio
5. **Gửi audio về ESP32**

## Thay đổi

### 1. File mới: `src/lib/deepgram_stt.ts`
- Utility function `audioToText()` để gọi Deepgram STT script
- Tự động lưu audio buffer vào file tạm
- Parse output từ Python script
- Cleanup file tạm sau khi xong

### 2. Cập nhật: `src/lib/zhipu_agent.ts`
- Import `audioToText` từ `deepgram_stt`
- Thay đổi luồng xử lý:
  - Dùng Deepgram STT để chuyển audio → text
  - Gửi text đến GLM (không gửi audio nữa)
  - Nhận text response từ GLM
  - Dùng edge-tts để chuyển text response → audio

### 3. Cập nhật: `src/index.ts` (API endpoint)
- Tương tự như `zhipu_agent.ts`
- Endpoint `/api/process-file` cũng dùng Deepgram STT

### 4. Cập nhật: `recordings/stt_deepgram.py`
- Cải thiện output format để dễ parse từ Node.js
- Transcript được in trực tiếp vào stdout (không có separator)
- Error messages vào stderr

## Cài đặt

### Python dependencies
```bash
# Cài đặt deepgram package
py -3 -m pip install deepgram

# Hoặc trên Linux/Mac
pip3 install deepgram
```

### API Key
Deepgram API key đã được hardcode trong `recordings/stt_deepgram.py`. 
Nếu cần thay đổi, sửa biến `DEEPGRAM_API_KEY` trong file đó.

## Lợi ích

1. **Tốc độ**: STT nhanh hơn so với gửi audio trực tiếp cho GLM
2. **Chi phí**: Deepgram STT có thể rẻ hơn GLM Voice API
3. **Chất lượng**: Deepgram STT chuyên về transcription, chất lượng tốt
4. **Linh hoạt**: Có thể thay đổi STT provider dễ dàng

## Lưu ý

- File audio tạm được lưu trong `tmp/` và tự động xóa sau khi xử lý
- Nếu Deepgram STT thất bại, server sẽ trả về error và không tiếp tục xử lý
- Format audio được tự động detect từ buffer (mp3/wav/aac)




