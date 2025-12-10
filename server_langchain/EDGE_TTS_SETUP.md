# Hướng dẫn cài đặt Edge-TTS

## Cài đặt Python và edge-tts

### Bước 1: Cài đặt Python
Đảm bảo bạn đã cài đặt Python 3.7 trở lên:
```bash
python --version
```

### Bước 2: Cài đặt edge-tts

**Trên Windows:**
```bash
# Sử dụng py launcher (khuyên dùng)
py -3 -m pip install edge-tts

# Hoặc nếu biết version cụ thể (ví dụ Python 3.13)
py -3.13 -m pip install edge-tts
```

**Trên Linux/Mac:**
```bash
pip install edge-tts
# hoặc
pip3 install edge-tts
```

Hoặc sử dụng requirements.txt:
```bash
# Windows
py -3 -m pip install -r requirements.txt

# Linux/Mac
pip install -r requirements.txt
```

**Lưu ý:** Nếu bạn có nhiều bản Python cài đặt, hãy đảm bảo cài edge-tts vào đúng Python mà hệ thống sẽ sử dụng. Code tự động dùng `py -3` trên Windows để chọn Python 3 mới nhất.

## Cách sử dụng

Sau khi cài đặt, hệ thống sẽ tự động sử dụng edge-tts để chuyển text response từ AI thành audio.

### Luồng hoạt động:
1. Nhận text response từ AI (Zhipu)
2. Chuyển text thành audio sử dụng edge-tts
3. Hiển thị text trên terminal (sau khi audio đã được tạo)
4. Lưu cả text và audio vào thư mục `responses/`

### Giọng đọc mặc định
- **Voice**: `en-US-AriaNeural` (Tiếng Anh - Mỹ, giọng nữ)
- Có thể thay đổi trong code nếu cần

### Kiểm tra cài đặt
Chạy thử script Python:
```bash
# Windows
py -3 tts_edge.py "Hello, this is a test" test_output.mp3

# Linux/Mac
python3 tts_edge.py "Hello, this is a test" test_output.mp3
```

Nếu thành công, bạn sẽ thấy `SUCCESS:test_output.mp3` và file `test_output.mp3` sẽ được tạo.

## Lưu ý
- Nếu edge-tts không hoạt động, hệ thống sẽ tự động fallback về audio từ Zhipu (nếu có)
- File audio được lưu trong thư mục `tmp/` và `responses/{session_id}/audio/`

