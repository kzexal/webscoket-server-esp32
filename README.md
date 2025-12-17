# ESP32 AI Voice Assistant

Dự án này là một hệ thống trợ lý ảo thông minh sử dụng **ESP32-S3** làm thiết bị đầu cuối để thu/phát âm thanh và **Node.js Server** để xử lý AI (Voice-to-Voice).

## 📑 Mục lục
- [Giới thiệu](#-giới-thiệu)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Phần 1: Server (Xử lý AI)](#phần-1-server-xử-lý-ai)
- [Phần 2: Client/Device (ESP32)](#phần-2-clientdevice-esp32)
- [Hướng dẫn cài đặt & Chạy](#-hướng-dẫn-cài-đặt--chạy)
- [Cách sử dụng](#-cách-sử-dụng)

---

## 🚀 Giới thiệu
Hệ thống cho phép người dùng giao tiếp bằng giọng nói với AI thông qua thiết bị phần cứng ESP32.
- **Người dùng bấm nút & nói**: ESP32 thu âm (I2S Mic) và stream dữ liệu audio qua WebSocket lên Server.
- **Server xử lý**: Nhận audio -> STT (Speech to Text) -> Gửi cho LLM (ZhipuAI/LangChain) -> Nhận phản hồi văn bản -> TTS (Text to Speech).
- **Phản hồi**: Server stream audio phản hồi về ESP32.
- **ESP32 phát lại**: Nhận audio chunk, buffer và phát ra loa (I2S Speaker).

## 🏗 Kiến trúc hệ thống
Dự án chia làm 2 thư mục chính:
1. **`server_langchain/`**: Backend viết bằng TypeScript (Node.js/Hono).
   - WebSocket Server: Giao tiếp realtime với ESP32.
   - Tích hợp **Deepgram** (STT), **ZhipuAI** (LLM), và engine **TTS** (Local Python/API).
   - Quản lý phiên hội thoại và lưu trữ lịch sử.

2. **`esp32/`**: Firmware viết bằng C++ (PlatformIO/Arduino).
   - Quản lý phần cứng: I2S Mic, I2S Speaker, Button.
   - Xử lý Audio Buffer (Circular Buffer) để playback mượt mà.
   - Kết nối WiFi & WebSocket Client.

---

## Phần 1: Server (Xử lý AI)
Thư mục: `server_langchain`

### Công nghệ sử dụng
- **Runtime**: Node.js
- **Framework**: Hono, `ws` (WebSocket)
- **AI Services**:
  - STT: Deepgram
  - LLM: ZhipuAI (ChatGLM)
  - LangChain: Orchestration

### Chức năng chính
- Lắng nghe kết nối WebSocket tại port `8888`.
- Nhận luồng binary audio từ ESP32.
- Xử lý hội thoại thông minh và trả về audio để phát.
- Có giao diện web đơn giản để xem lại lịch sử hội thoại (`/responses`).

---

## Phần 2: Client/Device (ESP32)
Thư mục: `esp32`

### Phần cứng hỗ trợ
- **MCU**: ESP32-S3 (Adafruit Feather hoặc tương đương)
- **Microphone**: INMP441 (I2S)
- **Amplifier/Speaker**: MAX98357A (I2S) + Loa 4-8 Ohm
- **Button**: Nút nhấn (Push button)

### Sơ đồ đấu nối (Pinout)
Được cấu hình trong `include/config.h`:

| Thiết bị | Chân ESP32 | Chức năng |
|----------|------------|-----------|
| **INMP441** | | **Microphone** |
| SCK (BCLK)| 38 | Clock |
| WS | 37 | Word Select |
| SD | 36 | Audio Data |
| **MAX98357A**| | **Speaker** |
| BCLK | 16 | Clock |
| LRC (WS) | 17 | Word Select |
| DIN | 15 | Audio Data |
| **Khác** | | |
| Button | 13 | Push-to-Talk |

### Tính năng Firmware
- **Streaming Audio**: Gửi dữ liệu mic thời gian thực lên server.
- **Circular Buffer**: Cơ chế đệm vòng (`48KB`) giúp nhận và phát audio liên tục, tránh hiện tượng giật cục (stuttering).
- **Stereo Expansion**: Tự động nhân đôi mẫu mono để phù hợp với clock của I2S Speaker, giúp sửa lỗi phát quá nhanh.

---

## 🛠 Hướng dẫn cài đặt & Chạy

### 1. Cài đặt Server
Yêu cầu: Node.js (v18+), cấu hình API Key.

1. Truy cập thư mục server: `cd server_langchain`
2. Cài đặt dependencies: `npm install` hoặc `yarn`
3. Tạo file `.env` và điền key:
   ```env
   ZHIPU_API_KEY=your_zhipu_key
   DEEPGRAM_API_KEY=your_deepgram_key
   ```
4. Chạy server: `npm run dev`
   - Server sẽ chạy tại: `ws://0.0.0.0:8888` và `http://localhost:8888`

### 2. Cài đặt ESP32
Yêu cầu: VS Code + Extension PlatformIO.

1. Mở thư mục `esp32` bằng VS Code.
2. Chỉnh sửa file `include/config.h`:
   - `WIFI_SSID` / `WIFI_PASSWORD`: Thông tin WiFi của bạn.
   - `WS_HOST`: Địa chỉ IP LAN của máy tính chạy server (VD: `192.168.1.10`).
3. Build và Upload code nạp vào ESP32.

---

## 🎮 Cách sử dụng
1. Cấp nguồn cho ESP32. Mở Serial Monitor (Baud 115200) để kiểm tra log.
2. Đợi ESP32 kết nối WiFi và báo `[WS] Connected`.
3. **Thu âm**:
   - Nhấn và **giữ** nút bấm (Button).
   - Nói câu lệnh (VD: "Hello, how are you today?").
   - Thả nút bấm.
4. **Phản hồi**:
   - ESP32 sẽ gửi tín hiệu kết thúc thu âm.
   - Sau vài giây xử lý, Server sẽ gửi audio về.
   - Loa sẽ phát ra câu trả lời của AI.

---

## 🔧 Xử lý sự cố thường gặp (Troubleshooting)
- **Audio phát quá nhanh (Chipmunk)**: Do sai lệch Sample Rate hoặc Mono/Stereo. Code hiện tại đã fix bằng cách convert Mono sang Stereo giả lập trong `processAudioPlayback`.
- **Audio bị giật**: Do mạng yếu hoặc buffer chưa đủ. Code đã tích hợp cơ chế `Pre-buffering` (đợi buffer đầy >50% mới phát).
- **Không kết nối được Server**: Kiểm tra lại IP trong `config.h` và đảm bảo máy tính đã tắt Firewall hoặc cho phép Node.js đi qua port 8888.
