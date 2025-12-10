# ESP32 - Zhipu Voice Assistant Integration Guide

## 📋 Yêu cầu

### Hardware:
- ESP32-WROOM-32 (hoặc tương tự)
- Microphone I2S (INMP441 hoặc MAX98357A)
- Speaker I2S (MAX98357A hoặc tương tự)
- WiFi capability (built-in)
- Push button (for start/stop recording)

### Software:
- Arduino IDE 2.0+
- ESP32 Board Support Package
- WebSocketsClient library
- ArduinoJSON library (optional)

## 🔧 Cài đặt Libraries

### Via Arduino IDE:
1. Tools → Board → Boards Manager
2. Tìm "ESP32" và cài đặt
3. Sketch → Include Library → Manage Libraries
4. Tìm và cài đặt:
   - "WebSocketsClient" by Markus Sattler
   - "ArduinoJSON" by Benoit Blanchon

### Hoặc via Command Line:
```bash
# Using Arduino CLI
arduino-cli lib install "WebSocketsClient"
arduino-cli lib install "ArduinoJSON"
```

## 📌 Pin Configuration

### Microphone (INMP441 I2S):
```
INMP441 Pin → ESP32 Pin
L/R         → GND (mono)
WS          → GPIO32
SCK         → GPIO25
SD          → GPIO33
VDD         → 3.3V
GND         → GND
```

### Speaker (MAX98357A I2S):
```
MAX98357A   → ESP32 Pin
LRC         → GPIO26
BCLK        → GPIO27
DIN         → GPIO34 (hoặc speaker output pin)
VDD         → 3.3V
GND         → GND
```

### Button:
```
Push Button → ESP32 Pin
One side    → GPIO2
Other side  → GND
```

## 🔌 WiFi Configuration

Edit trong sketch:
```cpp
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverAddress = "192.168.1.100";  // Server IP
```

## 📝 Workflow ESP32

```
┌─────────────┐
│   Power On  │
└──────┬──────┘
       ↓
┌─────────────────┐
│ Init I2S & WiFi │
└──────┬──────────┘
       ↓
┌─────────────────────────┐
│ Connect to WebSocket    │
│ (server:8888/device)    │
└──────┬──────────────────┘
       ↓
┌─────────────────────────┐
│  Wait for button press  │
└────────────┬────────────┘
             ↓
     ┌───────────────┐
     │ Button Press? │
     └───────┬───────┘
             ↓
     ┌──────────────────┐
     │ Start Recording  │
     │ Send: {type:     │
     │ "start_record"}  │
     └───────┬──────────┘
             ↓
     ┌────────────────────────┐
     │ Read microphone data   │
     │ Send chunks via WS     │
     │ (binary frames)        │
     └───────┬────────────────┘
             ↓
     ┌──────────────────┐
     │ Button Press?    │
     │ (to stop)        │
     └────────┬─────────┘
              ↓
     ┌──────────────────────┐
     │ Stop Recording       │
     │ Send: {type:         │
     │ "stop_recording"}    │
     └───────┬──────────────┘
             ↓
     ┌──────────────────────────┐
     │ Wait for server response │
     │ - Text message           │
     │ - Audio chunks           │
     │ - Completion signal      │
     └───────┬───────────────────┘
             ↓
     ┌──────────────────────┐
     │ Play audio from      │
     │ speaker (if provided)│
     │ Log text response    │
     └───────┬──────────────┘
             ↓
     ┌──────────────────┐
     │ Ready for next   │
     │ recording        │
     └──────────────────┘
```

## 🎵 Audio Format

### Input (Mic → Server):
- Format: WAV (PCM 16-bit)
- Sample Rate: 44100 Hz
- Channels: Mono (1 channel)
- Bit Depth: 16-bit
- Chunk Size: ~2048 bytes

### Output (Server → Speaker):
- Format: WAV (base64 encoded, then decoded)
- Sample Rate: 44100 Hz
- Channels: Mono
- Bit Depth: 16-bit
- Sent in 1024-byte chunks

## 📨 WebSocket Message Format

### ESP32 → Server (Text):

**Start Recording:**
```json
{
  "type": "start_recording",
  "timestamp": 1701657600000
}
```

**Stop Recording:**
```json
{
  "type": "stop_recording",
  "timestamp": 1701657605000
}
```

**Audio Data (Binary):**
```
Raw PCM 16-bit WAV data in chunks
Send chunks of 2048 bytes
```

### Server → ESP32 (Text):

**Text Response:**
```json
{
  "type": "text_response",
  "content": "你好，这是我的回复",
  "timestamp": "2024-12-04T10:30:00Z"
}
```

**Audio Complete:**
```json
{
  "type": "audio_response_complete",
  "timestamp": "2024-12-04T10:30:05Z"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Failed to process audio"
}
```

### Server → ESP32 (Binary):

**Audio Data:**
```
Base64 decoded WAV audio data
Received in 1024-byte chunks
Total file may be 50KB+ depending on response length
```

## 🧪 Testing

### 1. Test WebSocket Connection:
- Upload sketch to ESP32
- Open Serial Monitor (115200 baud)
- Should see: "WebSocket connected"

### 2. Test Microphone Input:
- Press button
- Should see: "Starting recording..."
- Speak into microphone
- Serial should show bytes being read

### 3. Test Server Communication:
- Stop recording (press button again)
- Check server logs for received audio
- Should see response in Serial Monitor

## 🐛 Troubleshooting

### ESP32 won't connect to WiFi:
- Check SSID and password are correct
- Check ESP32 is in range of WiFi
- Restart ESP32

### WebSocket connection fails:
- Check server IP/port are correct
- Verify server is running: `npm run dev`
- Check firewall settings
- Verify network connectivity

### No microphone data:
- Check I2S pin connections
- Verify microphone is powered
- Check I2S configuration matches pins
- Try different microphone if available

### Audio playback not working:
- Check speaker connections
- Verify speaker I2S pins configuration
- Implement speaker output in code (currently placeholder)
- Check speaker volume isn't muted

### Zhipu API errors:
- Check ZHIPU_API_KEY in server .env
- Verify API key is valid
- Check audio format is correct WAV
- Check Zhipu API status

## 📊 Monitoring

### On Serial Monitor:
```
ESP32 Zhipu Voice Assistant Starting...
Initializing I2S Microphone...
I2S Microphone initialized
Initializing I2S Speaker...
I2S Speaker initialized
Connecting to WiFi: YOUR_SSID
Connected! IP: 192.168.1.100
Setting up WebSocket...
WebSocket setup complete
WebSocket connected
Connected to: /device
Starting recording...
Received text: {...}
Stopping recording...
Audio sent to server
```

## 🔄 Full Communication Flow Example

```
TIME    ESP32                          Server                    Zhipu API
────────────────────────────────────────────────────────────────────────────
T+0s    [Button Press]
        └─ {type: start_recording}
                                       ← Received
                                       [Preparing]

T+1s    [Mic Reading...]
        [Mic Reading...]
        └─ Binary: 2048 bytes
                                       ← Received audio chunk
                                       └─ Buffering...

T+2s    [Mic Reading...]
        └─ Binary: 2048 bytes
                                       ← Received audio chunk
                                       └─ Buffering...

T+3s    [Button Press to Stop]
        └─ {type: stop_recording}
                                       ← Received
                                       └─ Sending to API
                                                                 [Processing]
                                                                 ├─ STT: 音频 → 文本
                                                                 ├─ LLM: 生成回复
                                                                 └─ TTS: 文本 → 音频

T+5s                                   ← Response ready
                                       ├─ {text_response: "..."}
                                       ├─ Binary: audio (1024 bytes)
                                       ├─ Binary: audio (1024 bytes)
        [Received]                    ├─ ...more audio chunks
        ├─ Text logged
        ├─ Playing audio              └─ {audio_complete}
        └─ Ready for next

T+8s    [Ready for next input]
```

## 📚 Code Structure

### Main Files:
- `main.cpp` - Entry point, setup() and loop()
- `zhipu_voice_client.cpp` - Audio handling and WebSocket logic

### Key Functions:
- `setupWebSocket()` - Initialize WebSocket connection
- `initI2SMicrophone()` - Setup microphone I2S
- `readMicrophoneData()` - Read and buffer mic data
- `handleButtonPress()` - Button interrupt handler
- `webSocketEvent()` - Handle incoming WebSocket messages
- `playSpeakerAudio()` - Play audio from server

## 🚀 Next Steps

1. **Implement Speaker Playback**
   - Currently `playSpeakerAudio()` is a stub
   - Need to implement I2S output using received audio data
   - May need separate I2S configuration for speaker

2. **Add LED Indicators**
   - Recording indicator LED
   - WiFi status LED
   - Processing indicator

3. **Persistent Configuration**
   - Store WiFi credentials in SPIFFS
   - Store server address/port in EEPROM
   - Web UI for configuration

4. **Error Recovery**
   - Retry logic for failed API calls
   - Automatic reconnection on WiFi loss
   - Buffer timeout handling

5. **Performance Optimization**
   - Optimize chunk sizes for bandwidth
   - Reduce latency between recording and sending
   - Add compression if needed
