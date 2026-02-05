# ESP32 AI Voice Assistant

Dự án này là một hệ thống trợ lý ảo thông minh sử dụng **ESP32-S3** làm thiết bị đầu cuối để thu/phát âm thanh và **Node.js Server** để xử lý AI (Voice-to-Voice). Hệ thống tích hợp **Google Gemini** để xử lý ngôn ngữ tự nhiên và **Deepgram** để nhận dạng giọng nói tốc độ cao.

## Mục lục
- [Giới thiệu](#giới-thiệu)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Phần 1: Server (Xử lý AI)](#phần-1-server-xử-lý-ai)
- [Phần 2: Client/Device (ESP32)](#phần-2-clientdevice-esp32)
- [Hướng dẫn cài đặt & Chạy](#hướng-dẫn-cài-đặt--chạy)
- [Cách sử dụng](#cách-sử-dụng)

---

## Giới thiệu
Hệ thống cho phép người dùng giao tiếp bằng giọng nói với AI thông qua thiết bị phần cứng ESP32.
- **Người dùng bấm nút & nói**: ESP32 thu âm (I2S Mic) và stream dữ liệu audio qua WebSocket lên Server.
- **Server xử lý**: 
  1. Nhận luồng audio từ ESP32.
  2. Dùng **Deepgram** để chuyển giọng nói thành văn bản (STT) với độ trễ cực thấp.
  3. Gửi văn bản đến **Google Gemini** (Flash/Pro model) để lấy câu trả lời thông minh.
  4. Chuyển đổi câu trả lời văn bản thành âm thanh (TTS - Text to Speech).
- **Phản hồi**: Server cắt nhỏ file âm thanh và stream về ESP32.
- **ESP32 phát lại**: Nhận dữ liệu, lưu vào bộ đệm (buffer) và phát ra loa (I2S Speaker).

## Kiến trúc hệ thống
Dự án chia làm 2 thư mục chính:
1. **`server_langchain/`**: Backend viết bằng TypeScript (Node.js/Hono).
   - WebSocket Server: Giao tiếp realtime với ESP32.
   - **Agent**: Quản lý logic hội thoại (`GeminiVoiceAgent`).
   - **Services**: Tích hợp API Deepgram và Gemini Client.
   - **Lưu trữ**: Tự động lưu file ghi âm và hội thoại vào thư mục `responses/`.

2. **`esp32/`**: Firmware viết bằng C++ (PlatformIO/Arduino).
   - Quản lý phần cứng: I2S Mic, I2S Speaker, Button.
   - Xử lý Audio Buffer: Dùng cơ chế Circular Buffer để playback mượt mà.
   - Kết nối: WiFi & WebSocket Client.

---

## Phần 1: Server (Xử lý AI)
Thư mục: `server_langchain`

### Công nghệ sử dụng
- **Runtime**: Node.js
- **Nền tảng**: Hono Web Framework
- **Giao thức**: WebSocket (`ws`)
- **AI Services**:
  - **STT (Speech-to-Text)**: Deepgram Nova-2 (trả kết quả cực nhanh).
  - **LLM**: Google Gemini 2.5 Flash Lite (phản hồi nhanh và thông minh).
  - **TTS**: Python pyttsx3 (Offline) hoặc các API TTS online khác.

### Chức năng chính
- Lắng nghe kết nối WebSocket tại port `8888`.
- Nhận và xử lý gói tin binary audio.
- Quản lý trạng thái "Đang ghi âm", "Đang xử lý", "Đang phát".
- Tự động chuẩn hóa format âm thanh (Mono, 16-bit, Sample Rate chuẩn) trước khi gửi về ESP32.

---

## Phần 2: Client/Device (ESP32)
Thư mục: `esp32`

### Phần cứng hỗ trợ
- **MCU**: ESP32-S3
- **Microphone**: INMP441 (I2S Omnidirectional Microphone)
- **Amplifier/Speaker**: MAX98357A (I2S Amplifier) + Loa 4-8 Ohm
- **Button**: Nút nhấn thường (Push button)

### Sơ đồ đấu nối (Pinout)
Cấu hình mặc định trong `include/config.h`:

| Thiết bị | Chân ESP32 | Chức năng |
|----------|------------|-----------|
| **INMP441** | | **Microphone** |
| SCK (BCLK)| 38 | Serial Clock |
| WS (LRC) | 37 | Word Select |
| SD | 36 | Serial Data |
| **MAX98357A**| | **Speaker** |
| BCLK | 16 | Bit Clock |
| LRC (WS) | 17 | Word Select |
| DIN | 15 | Data In |
| **Khác** | | |
| Button | 13 | Push-to-Talk (Kéo xuống GND) |

### Tính năng Firmware
- **Smart Buffering**: Tự động pre-buffer (đợi đầy một phần bộ nhớ) trước khi phát để tránh tiếng bị méo/giật.
- **Resampling**: Hỗ trợ tinh chỉnh sample rate để khớp với tốc độ phần cứng.

---

## Hướng dẫn cài đặt & Chạy

### 1. Cài đặt Server
Yêu cầu: Node.js (v18 trở lên).

1. Truy cập thư mục server: `cd server_langchain`
2. Cài đặt các thư viện: `npm install`
3. Tạo file `.env` tại thư mục gốc của server và điền API Key:
   ```env
   GOOGLE_API_KEY=your_google_gemini_key
   DEEPGRAM_API_KEY=your_deepgram_key
   ```
4. Chạy server: `npm run dev`
   - Server sẽ khởi động tại: `ws://0.0.0.0:8888`

### 2. Cài đặt ESP32
Yêu cầu: VS Code, Extension PlatformIO.

1. Mở thư mục `esp32` bằng VS Code.
2. Mở file `include/config.h` để chỉnh sửa cấu hình mạng:
   - `WIFI_SSID`: Tên WiFi nhà bạn.
   - `WIFI_PASSWORD`: Mật khẩu WiFi.
   - `WS_HOST`: Địa chỉ IP của máy tính chạy Server (ví dụ: `192.168.1.5`).
3. Cắm cáp USB kết nối ESP32 với máy tính.
4. Nhấn nút **Upload** (mũi tên sang phải) trên thanh công cụ PlatformIO để nạp code.

---

## Cách sử dụng
1. Cấp nguồn cho ESP32. Mở Serial Monitor (Baud 115200) để theo dõi trạng thái.
2. Đợi ESP32 báo `Connected to WebSocket server`.
3. **Thao tác hội thoại**:
   - **Nhấn và Giữ** nút bấm trên ESP32.
   - **Nói** câu lệnh vào Microphone (ví dụ: "Hello Gemini, tell me a joke").
   - **Thả** nút bấm ra.
4. **Kết quả**:
   - ESP32 sẽ gửi audio lên server.
   - Sau 1-3 giây, loa sẽ phát ra câu trả lời từ AI.



