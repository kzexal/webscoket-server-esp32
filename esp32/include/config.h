#pragma once
#include <Arduino.h>

// ====== Chân bạn đang dùng ======
static const int PIN_BUTTON = 13; // nút nhấn xuống GND (INPUT_PULLUP)

// I2S MIC (INMP441) - I2S input (I2S_NUM_1)
static const int I2S_IN_BCLK = 38;
static const int I2S_IN_WS = 37;
static const int I2S_IN_SD = 36;

// I2S AMP (MAX98357A) - I2S output (I2S_NUM_0)
static const int I2S_OUT_BCLK = 16;
static const int I2S_OUT_WS = 17;
static const int I2S_OUT_DOUT = 15;

// ====== Audio params ======
static const uint32_t MIC_SAMPLE_RATE = 16000;
static const uint32_t SPEAKER_SAMPLE_RATE = 16500;
static const size_t DMA_BUF_LEN = 256;
static const int DMA_BUF_CNT = 8;

static const float OUTPUT_GAIN = 1.2f;

// ====== WiFi & WebSocket config (fill with your values) ======
// WiFi network that ESP32 will connect to
static const char* WIFI_SSID     = "17_501.502.503";
static const char* WIFI_PASSWORD = "nopassdau101";

// Machine running `server_langchain` (use your PC's LAN IP)
static const char* WS_HOST = "192.168.52.143";
static const uint16_t WS_PORT = 8888;
static const char* WS_PATH = "/device";