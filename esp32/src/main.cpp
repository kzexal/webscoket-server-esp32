#include <Arduino.h>
#include <Audio.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <driver/i2s.h>
#include <math.h>
#include "mic.h"
#include "config.h"
#include "lib_wifi.h"
#include "utils.h"
#include "lib_speaker.h"
#include "lib_button.h"
#include "lib_websocket.h"

int16_t sBuffer[bufferLen];
ButtonChecker button;

// Function declarations
void setupLEDs();
void setupAudioIO();

void setupLEDs()
{
  pinMode(LED_MIC, OUTPUT);
  pinMode(LED_SPKR, OUTPUT);
  digitalWrite(LED_MIC, LOW);
  digitalWrite(LED_SPKR, LOW);
}
void setupAudioIO()
{
  // Uninstall any existing I2S drivers
  // i2s_driver_uninstall(I2S_PORT_SPEAKER);
  i2s_driver_uninstall(I2S_PORT_MIC);
  
  // Setup speaker first
  setupSpeakerI2S();
  // i2s_start(I2S_PORT_SPEAKER);
  delay(200);  // Increased delay for better initialization
  
  // Then setup microphone
  setupMicrophone();
    delay(200);  // Increased delay for better initialization

  // i2s_start(I2S_PORT_MIC);
  delay(200);  // Increased delay for better initialization
}
void setup()
{
  Serial.begin(115200);
  setupLEDs();
  connectToWiFi();
  connectToWebSocket();
  
  setRecording(false);
  setupAudioIO();

  xTaskCreatePinnedToCore(micTask, "micTask", 16000, NULL, 1, NULL, 0);
}

void loop()
{
  button.loop();
  if (button.justPressed())
  {
    Serial.println("Recording...");
    sendMessage("START_RECORD");
    sendButtonState(1);
    
    // Stop speaker and clear buffer before starting mic
    i2s_stop(I2S_PORT_SPEAKER);
    i2s_zero_dma_buffer(I2S_PORT_SPEAKER);
    delay(100);  // Added delay for buffer clearing
    
    i2s_start(I2S_PORT_MIC);
    delay(100);  // Added delay for stable startup
    
    setRecording(true);
    Serial.println("Recording ready.");
  }
  else if (button.justReleased())
  {
    Serial.println("Stopped recording.");
    sendButtonState(0);
    sendMessage("STOP_RECORD");
    setRecording(false);

    // Stop microphone and clear buffer before starting speaker
    i2s_stop(I2S_PORT_MIC);
    i2s_zero_dma_buffer(I2S_PORT_MIC);
    delay(100);  // Added delay for buffer clearing
    
    i2s_start(I2S_PORT_SPEAKER);
    delay(100);  // Added delay for stable startup
  }

  loopWebsocket();
}