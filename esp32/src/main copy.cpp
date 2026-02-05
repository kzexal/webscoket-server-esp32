#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <string.h>
#include "driver/i2s.h"
#include "config.h"

// ===== State flags =====
static bool recording = false;     // Đang thu và gửi audio lên server
static bool wsConnected = false;   // Trạng thái WebSocket

// ===== WebSocket client =====
WebSocketsClient wsClient;

// ===== Audio Streaming Buffer (Circular Buffer) =====
// ===== Audio Streaming Buffer (Circular Buffer) =====
// Thao tác streaming: Vừa nhận vừa phát để không cần buffer cực lớn
#define AUDIO_BUFFER_SIZE  (48 * 1024) 
#define MIN_PREBUFFER_BYTES (26 * 1024) 

static uint8_t audioBuffer[AUDIO_BUFFER_SIZE];
static volatile size_t writeHead = 0;
static volatile size_t readHead = 0;
static volatile size_t availableBytes = 0;
static bool isPlayingTTS = false;
static bool isBuffering = false;       // Flag for pre-buffering state
static bool isResponseComplete = false; // Flag to indicate server finished sending

// ===== MIC I2S =====
void setupMic() {
  i2s_config_t cfg = {};
  cfg.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  cfg.sample_rate = MIC_SAMPLE_RATE;
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT;
  cfg.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.dma_buf_count = DMA_BUF_CNT;
  cfg.dma_buf_len = DMA_BUF_LEN;

  i2s_driver_install(I2S_NUM_1, &cfg, 0, nullptr);

  i2s_pin_config_t pin = {};
  pin.bck_io_num = I2S_IN_BCLK;
  pin.ws_io_num  = I2S_IN_WS;
  pin.data_in_num = I2S_IN_SD;
  pin.data_out_num = I2S_PIN_NO_CHANGE;

  i2s_set_pin(I2S_NUM_1, &pin);
}

// ===== SPEAKER I2S =====
void setupSpeaker() {
  i2s_config_t cfg = {};
  cfg.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX);
  cfg.sample_rate = SPEAKER_SAMPLE_RATE; 
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
  cfg.channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT; // Revert to Stereo for correct speed
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.dma_buf_count = DMA_BUF_CNT;
  cfg.dma_buf_len = DMA_BUF_LEN;
  cfg.tx_desc_auto_clear = true; 

  i2s_driver_install(I2S_NUM_0, &cfg, 0, nullptr);

  i2s_pin_config_t pin = {};
  pin.bck_io_num = I2S_OUT_BCLK;
  pin.ws_io_num  = I2S_OUT_WS;
  pin.data_out_num = I2S_OUT_DOUT;
  pin.data_in_num  = I2S_PIN_NO_CHANGE;

  i2s_set_pin(I2S_NUM_0, &pin);
}

// ===== SAMPLE CONVERT =====
inline int16_t mic32_to_pcm16(int32_t s) {
  s >>= 14;
  if (s > 32767) s = 32767;
  if (s < -32768) s = -32768;
  return (int16_t)s;
}

// ===== WebSocket callbacks =====
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      wsConnected = false;
      isPlayingTTS = false;
      break;

    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to: %s\n", payload);
      wsConnected = true;
      break;

    case WStype_TEXT: {
      const char* text = (const char*)payload;
      if (strstr(text, "tts_start")) {
        Serial.println("[TTS] tts_start -> Reset buffer");
        writeHead = 0;
        readHead = 0;
        availableBytes = 0;
        isPlayingTTS = true; 
        isBuffering = true;         // Start buffering
        isResponseComplete = false; // Reset complete flag
        Serial.println("[AUDIO] Buffering...");
      } else if (strstr(text, "audio_config")) {
        // Example: {"type": "audio_config", "sampleRate": 24000}
        char* ratePtr = strstr(text, "\"sampleRate\":");
        if (ratePtr) {
            // Move past "sampleRate":
            ratePtr += 13; 
            int newRate = atoi(ratePtr);
            if (newRate > 0) {
                // Serial.printf("[AUDIO] Switching Sample Rate to %d Hz\n", newRate);
                // i2s_set_sample_rates(I2S_NUM_0, newRate);
                Serial.printf("[AUDIO] Server requested %d Hz but IGNORING to force SLOW playback at %d Hz\n", newRate, SPEAKER_SAMPLE_RATE);
            }
        }
      } else if (strstr(text, "audio_response_complete")) {
        Serial.println("[TTS] audio_response_complete");
        isResponseComplete = true; // Mark as complete, so we can drain the rest
      }
      break;
    }

    case WStype_BIN:
      if (isPlayingTTS) {
          for(size_t i=0; i<length; i++) {
             audioBuffer[writeHead] = payload[i];
             writeHead++;
             if(writeHead >= AUDIO_BUFFER_SIZE) writeHead = 0;
             if(availableBytes < AUDIO_BUFFER_SIZE) {
                 availableBytes++;
             } else {
                 readHead++; // Overflow
                 if(readHead >= AUDIO_BUFFER_SIZE) readHead = 0;
             }
          }
      }
      break;

    default:
      break;
  }
}

// ===== Play Chunk from Buffer =====
void processAudioPlayback() {
   if (!isPlayingTTS) return;

   // 1. Handle Buffering Logic
   if (isBuffering) {
       // Wait for a larger chunk (MIN_PREBUFFER_BYTES)
       if (availableBytes < MIN_PREBUFFER_BYTES && !isResponseComplete) {
           return; 
       }
       Serial.printf("[AUDIO] Starting Playback (Buffer: %d bytes)\n", availableBytes);
       isBuffering = false;
   }

   // 2. Stop if buffer empty
   if (availableBytes == 0) {
       if (isResponseComplete) {
           return; 
       } else {
           Serial.println("[AUDIO] Underrun -> Buffering...");
           isBuffering = true;
           return;
       }
   }

   // Process chunk
   size_t chunkBytes = availableBytes;
   if(chunkBytes > 256) chunkBytes = 256; // Limit chunk size
   
   // Align to 2 bytes
   chunkBytes &= ~1;

   if(chunkBytes == 0) return;

   // Read Mono from Ring Buffer
   uint8_t monoBuf[256];
   for(size_t i=0; i<chunkBytes; i++) {
       monoBuf[i] = audioBuffer[readHead];
       readHead++;
       if(readHead >= AUDIO_BUFFER_SIZE) readHead = 0;
   }
   
   availableBytes -= chunkBytes;

   // Expand Mono -> Stereo (Duplicate sample) to fix "Too Fast" playback
   int16_t stereoBuf[256]; // 128 stereo frames -> 256 int16s
   
   int16_t* pSamples = (int16_t*)monoBuf;
   int sampleCount = chunkBytes / 2; // Number of samples (16-bit)
   
   for(int i=0; i<sampleCount; i++) {
       int16_t val = pSamples[i];
       // Interleaved: Left, Right
       stereoBuf[i*2] = val;
       stereoBuf[i*2+1] = val;
   }

   // Write to I2S (Stereo data)
   size_t bytesWritten = 0;
   i2s_write(I2S_NUM_0, stereoBuf, sampleCount * 4, &bytesWritten, 10);
}


// ===== WiFi & WebSocket init =====
void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection FAILED");
  }
}

void setupWebSocket() {
  wsClient.begin(WS_HOST, WS_PORT, WS_PATH);
  wsClient.onEvent(webSocketEvent);
  wsClient.setReconnectInterval(5000); 
}

void sendStartRecording() {
  wsClient.sendTXT("{\"type\":\"start_recording\"}");
}

void sendStopRecording() {
  wsClient.sendTXT("{\"type\":\"stop_recording\"}");
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32-S3 STREAMING AUDIO -> WebSocket");

  pinMode(PIN_BUTTON, INPUT_PULLUP);

  setupMic();
  setupSpeaker();
  connectWiFi();
  setupWebSocket();
}

// ===== LOOP =====
void loop() {
  // 1. Maintain WebSocket (Receives Data -> Fills Buffer)
  // Flow Control: Only read from network if we have buffer space.
  // This prevents overwriting old audio if the server sends too fast.
  // TCP Backpressure will automatically slow down the server.
  if (availableBytes < (AUDIO_BUFFER_SIZE - 2048)) {
     wsClient.loop();
  }

  // 2. Process Playback (Drains Buffer -> I2S)
  processAudioPlayback();

  // 3. Button Logic (Recording)
  // ... (Keep existing logic) ...
  static bool lastBtn = HIGH;
  bool btn = digitalRead(PIN_BUTTON);

  // Logic ĐẢO (theo code cũ): LOW->HIGH = Start
  if (lastBtn == LOW && btn == HIGH) {
    if (!recording) {
      recording = true;
      Serial.println("BTN: Start Recording");
      // Stop TTS if playing
      isPlayingTTS = false; 
      isBuffering = false;
      availableBytes = 0;
      readHead = 0; writeHead = 0;
      
      if (wsConnected) sendStartRecording();
    }
  }

  // HIGH->LOW = Stop
  if (lastBtn == HIGH && btn == LOW) {
    if (recording) {
      recording = false;
      Serial.println("BTN: Stop Recording");
      if (wsConnected) sendStopRecording();
    }
  }
  lastBtn = btn;

  // 4. Recording Logic (Only if recording AND not playing TTS)
  if (recording && wsConnected && !isPlayingTTS) {
    static int32_t micBuf[DMA_BUF_LEN];
    static int16_t outBuf[DMA_BUF_LEN];

    size_t bytesRead = 0;
    // Don't block too long here either, so WS can keep alive
    if(i2s_read(I2S_NUM_1, micBuf, sizeof(micBuf), &bytesRead, 0) == ESP_OK) {
        int samples = bytesRead / 4;
        if (samples > 0) {
            for (int i = 0; i < samples; i++) {
                float v = mic32_to_pcm16(micBuf[i]) * OUTPUT_GAIN;
                outBuf[i] = (int16_t)v;
            }
            wsClient.sendBIN(reinterpret_cast<uint8_t*>(outBuf), samples * 2);
        }
    }
  }
}