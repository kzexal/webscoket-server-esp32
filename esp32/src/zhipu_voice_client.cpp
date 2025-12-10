/*
 * ESP32 Zhipu Voice Assistant Client
 * 
 * Chức năng:
 * - Ghi âm từ microphone
 * - Gửi audio qua WebSocket tới server Zhipu
 * - Nhận phản hồi text và audio từ server
 * - Phát audio từ loa
 * 
 * Pin Configuration:
 * - Microphone: I2S pin
 * - Speaker: I2S pin
 * - Button: GPIO pin (để start/stop recording)
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <JSON.h>
#include <I2S.h>

// WiFi Configuration
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Server Configuration
const char* serverAddress = "192.168.1.100";  // Server IP/hostname
const int serverPort = 8888;
const char* serverPath = "/device";

// Pin Configuration (adjust for your board)
const int BUTTON_PIN = 2;
const int MIC_WS = 32;
const int MIC_CLK = 25;
const int MIC_DIN = 33;
const int SPK_WS = 26;
const int SPK_CLK = 27;
const int SPK_DOUT = 34;

// Audio Configuration
const int SAMPLE_RATE = 44100;
const int BUFFER_SIZE = 4096;

// Global variables
WebSocketsClient webSocket;
bool isConnected = false;
bool isRecording = false;
byte recordBuffer[BUFFER_SIZE];
int recordBufferIndex = 0;

void setup() {
    Serial.begin(115200);
    delay(100);
    
    Serial.println("\n\nESP32 Zhipu Voice Assistant Starting...");
    
    // Initialize I2S for microphone input
    initI2SMicrophone();
    
    // Initialize I2S for speaker output
    initI2SSpeaker();
    
    // Setup button
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    
    // Connect to WiFi
    connectToWiFi();
    
    // Setup WebSocket
    setupWebSocket();
}

void loop() {
    webSocket.loop();
    
    // Check button press
    if (digitalRead(BUTTON_PIN) == LOW) {
        delay(50);  // Debounce
        if (digitalRead(BUTTON_PIN) == LOW) {
            handleButtonPress();
            delay(1000);  // Debounce wait
        }
    }
    
    // Handle recording
    if (isRecording) {
        readMicrophoneData();
    }
}

void initI2SMicrophone() {
    Serial.println("Initializing I2S Microphone...");
    
    // Configure I2S for microphone
    I2S.setAllPins(MIC_WS, MIC_CLK, -1, -1, MIC_DIN);
    
    if (!I2S.begin(I2S_PHILIPS_MODE, SAMPLE_RATE, 16, I2S_STEREO)) {
        Serial.println("Failed to initialize I2S Microphone!");
        while(1);
    }
    
    Serial.println("I2S Microphone initialized");
}

void initI2SSpeaker() {
    Serial.println("Initializing I2S Speaker...");
    // Configure I2S for speaker output
    // (implementation depends on your specific hardware setup)
    Serial.println("I2S Speaker initialized");
}

void connectToWiFi() {
    Serial.printf("Connecting to WiFi: %s\n", ssid);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\nFailed to connect to WiFi");
    }
}

void setupWebSocket() {
    Serial.println("Setting up WebSocket...");
    
    webSocket.begin(serverAddress, serverPort, serverPath);
    webSocket.onEvent(webSocketEvent);
    webSocket.setAuthorization("authorization", "Basic realm=\"Fake Realm\"");
    webSocket.setReconnectInterval(5000);
    
    Serial.println("WebSocket setup complete");
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket disconnected");
            isConnected = false;
            break;
            
        case WStype_CONNECTED:
            Serial.println("WebSocket connected");
            isConnected = true;
            Serial.printf("Connected to: %s\n", payload);
            break;
            
        case WStype_TEXT:
            handleWebSocketText((char*)payload, length);
            break;
            
        case WStype_BIN:
            handleWebSocketBinary(payload, length);
            break;
            
        case WStype_ERROR:
            Serial.println("WebSocket error");
            break;
    }
}

void handleWebSocketText(char* payload, size_t length) {
    // Parse JSON message
    Serial.printf("Received text: %.*s\n", length, payload);
    
    // Example: {"type": "text_response", "content": "..."}
    // You would parse this with ArduinoJson library
    
    // For now, just print it
}

void handleWebSocketBinary(uint8_t* payload, size_t length) {
    // Handle audio response from server
    Serial.printf("Received %d bytes of audio\n", length);
    
    // TODO: Play audio through speaker
    // playSpeakerAudio(payload, length);
}

void handleButtonPress() {
    static bool wasRecording = false;
    
    if (!isRecording) {
        // Start recording
        isRecording = true;
        recordBufferIndex = 0;
        wasRecording = true;
        Serial.println("Starting recording...");
        
        // Send start_recording message
        if (isConnected) {
            String msg = "{\"type\":\"start_recording\",\"timestamp\":" + String(millis()) + "}";
            webSocket.sendTXT(msg);
        }
    } else {
        // Stop recording
        isRecording = false;
        Serial.println("Stopping recording...");
        
        // Send stop_recording message
        if (isConnected) {
            String msg = "{\"type\":\"stop_recording\",\"timestamp\":" + String(millis()) + "}";
            webSocket.sendTXT(msg);
            
            // Send recorded audio
            sendRecordedAudio();
        }
    }
}

void readMicrophoneData() {
    size_t bytesRead = I2S.readBytes(recordBuffer + recordBufferIndex, BUFFER_SIZE - recordBufferIndex);
    
    if (bytesRead > 0) {
        recordBufferIndex += bytesRead;
        
        // Send in chunks to server
        if (recordBufferIndex >= 2048) {
            if (isConnected) {
                webSocket.sendBIN(recordBuffer, recordBufferIndex);
            }
            recordBufferIndex = 0;
        }
    }
}

void sendRecordedAudio() {
    if (recordBufferIndex > 0 && isConnected) {
        // Send remaining data
        webSocket.sendBIN(recordBuffer, recordBufferIndex);
        recordBufferIndex = 0;
        Serial.println("Audio sent to server");
    }
}

void playSpeakerAudio(uint8_t* audioData, size_t length) {
    // TODO: Implement speaker playback
    // This depends on your specific I2S speaker setup
    Serial.printf("Playing %d bytes of audio\n", length);
}

/*
 * Arduino IDE Board Settings:
 * - Board: ESP32-WROOM-32
 * - Flash Size: 4MB
 * - Partition Scheme: Default 4MB with spiffs
 * - 
 * Libraries needed:
 * - WebSocketsClient
 * - ArduinoJSON (optional, for JSON parsing)
 */
