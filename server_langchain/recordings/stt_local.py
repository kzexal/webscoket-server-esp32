import os
import sys
from faster_whisper import WhisperModel

# Fix lỗi hiển thị
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# --- CẤU HÌNH TỐI ƯU CHO TIẾNG ANH ---
# Sử dụng model "distil-medium.en"
# Đây là model được chưng cất (distilled), nhẹ hơn và nhanh gấp 6 lần model thường.
MODEL_SIZE = "distil-medium.en"
COMPUTE_TYPE = "int8" 

print(f"⏳ Loading English Model: {MODEL_SIZE}...")

try:
    # Tự động chọn GPU hoặc CPU
    model = WhisperModel(MODEL_SIZE, device="auto", compute_type=COMPUTE_TYPE)
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"⚠️ GPU failed, switching to CPU: {e}")
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type=COMPUTE_TYPE)

# Prompt giúp model nhận diện tên người Việt khi nói tiếng Anh
# Ví dụ: "Call Huy" thay vì "Call Who"
ENGLISH_PROMPT = "The user may mention names like Huy, Khanh, Dung, or technical terms like ESP32, Firmware."

def transcribe_audio_local(file_path):
    if not os.path.exists(file_path):
        return "Error: File not found"

    try:
        segments, info = model.transcribe(
            file_path,
            beam_size=1,            # Giảm beam_size xuống 1 để tốc độ nhanh nhất (Greedy Search)
            language="en",          # Ép buộc tiếng Anh
            initial_prompt=ENGLISH_PROMPT,
            vad_filter=True         # Lọc bỏ khoảng lặng
        )

        full_text = " ".join([segment.text for segment in segments])
        return full_text.strip()

    except Exception as e:
        print(f"❌ Error Local STT: {e}")
        return ""

# --- TEST ---
if __name__ == "__main__":
    import time
    print("🎙️ Testing with an English audio file...")
    # Bạn nhớ kiếm một file nói tiếng Anh để test nhé, ví dụ "hello.mp3"
    # start = time.time()
    # text = transcribe_audio_local("hello.mp3") 
    # print(f"📝 Result: {text}")
    # print(f"⏱️ Time: {time.time() - start:.2f}s")