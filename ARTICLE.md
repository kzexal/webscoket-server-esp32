## Building a Real-time Voice Assistant with ESP32: Hardware and C++ Implementation

*In this two-part series, we're exploring how to build a real-time voice assistant using an ESP32 microcontroller and the power of AI. In this first installment, we'll focus on setting up the hardware and configuring the ESP32 to handle audio input and output. Then, in [part two](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-2-node-openai-1og6), we'll dive deep into the C++ implementation, exploring buffer handling, speaker output, and integrating with PlatformIO to bring our voice assistant to life.*


## The Journey Starts

What was supposed to be a cool 2-day project turned into a 2-week struggle, filled with transistors and WebSocket nightmare. But the result is pretty exciting! Now I can talk with my AI Agent anytime, just by pressing a button.

## Disclaimers and Considerations

Before we embark on this project, let's address a few important points:

1. **Beginner's Perspective:** As a newcomer to the world of C++, I welcome any suggestions and feedback to enhance the code and improve the overall implementation.
2. **System Architecture:** In this setup, the ESP32 serves as the hub for audio input and output, while a Node.js server handles the WebSocket communication. Although running the server directly on the ESP32 is an intriguing possibility, leveraging the familiarity of JavaScript/TypeScript for the server-side logic proved to be a more practical choice.
3. **Audio Challenges:** Brace yourself for a few audio-related hurdles along the way. Diagnosing whether issues stem from hardware mishaps (like faulty soldering) or software misconfigurations can be the trickiest part of the process.

## Project Overview

This voice assistant seamlessly merges the realms of embedded systems and modern AI, creating a responsive and intuitive user experience. The key components that power this project include:

- **ESP32 Microcontroller:** The brain of the operation, handling audio input/output and Wi-Fi connectivity.
- **WebSocket Communication:** Enabling real-time data transfer between the ESP32 and the server.
- **I²S Protocol:** Ensuring high-quality, synchronized audio data transfer between devices.
- **C++ Implementation:** Optimizing performance and resource utilization on the ESP32.

## Video

{% embed https://youtu.be/1H6FlWNRSYM %}

## Source Code

The complete source code for this project is available on GitHub:
[ESP32 AI Assistant Repository](https://github.com/FabrikappAgency/esp32-realtime-voice-assistant)

### Repository Structure

The project is organized into three main components:

#### 1. ESP32 Firmware (`/esp32`)
- Core firmware for audio capture and playback
- WebSocket client implementation
- Hardware configuration and I2S setup
- Button handling and WiFi management

#### 2. Audio Processing Server (`/server_audio`) 
- Node.js server handling WebSocket connections
- Real-time audio streaming and buffering
- OpenAI Whisper integration for speech-to-text
- Text-to-speech conversion using OpenAI APIs

#### 3. LangChain Server (`/server_langchain`)
- TypeScript/Node.js server for AI processing
- LangChain integration for natural language understanding
- Custom tool system for extensible commands
- OpenAI GPT integration for response generation

Each component plays a crucial role in the system:
- The ESP32 handles all hardware interactions and audio I/O
- The audio server manages speech processing and synthesis
- The LangChain server provides the AI "brain" for understanding and responding


![ESP32 AI Assistant](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/bfoowlhdm2e5dg5d9yfr.jpg)
## Required Materials

To bring this project to life, you'll need the following hardware components:

- ESP32-S3 Development Board
- I²S Digital Microphone (e.g., INMP441)
- I²S Amplifier (e.g., MAX98357A)
- Small Speaker (3W, 4Ω)
- Push Button
- Resistors (10kΩ for button pull-up)
- Jumper Wires
- Breadboard
- Soldering Equipment

With these materials in hand, you're ready to embark on the hardware setup and dive into the ESP32 implementation. This should cost you less than $40.

## Setting Up the Development Environment

Before we delve into the code, let's set up our development environment using PlatformIO, a powerful open-source ecosystem for IoT development.


![ESP32 AI Assistant](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/txjjs3l1qqtj5v6sgczz.png)

### Why PlatformIO?

- **Integrated IDE:** Works seamlessly with VSCode, offering code completion, debugging, and more.
- **Library Management:** Easily manage libraries and dependencies.
- **Board Support:** Extensive support for various microcontrollers, including ESP32.

### Installing PlatformIO

1. **Install VSCode:** If you haven't already, download and install [Visual Studio Code](https://code.visualstudio.com/).
2. **Install PlatformIO Extension:**
   - Open VSCode.
   - Go to Extensions (`Ctrl+Shift+X`).
   - Search for "PlatformIO IDE" and install it.

### Setting Up the ESP32 Project

1. **Create a New Project:**
   - Open PlatformIO Home (`Ctrl+Shift+P` -> "PlatformIO: Home").
   - Click on "New Project".
   - **Name:** `esp32-ai-assistant`.
   - **Board:** Select your ESP32 board model (e.g., ESP32 Dev Module).
   - **Framework:** Arduino.
   - Click "Finish".

2. **Organize the Project Structure:**
   - In the `src` folder, add your `.cpp` files (`main.cpp`, `mic.cpp`, etc.).
   - In the `include` folder, add your header files (`config.h`, `mic.h`, etc.).

3. **Configure `platformio.ini` File:**

   ```ini
   [env:esp32dev]
   platform = espressif32
   board = esp32dev
   framework = arduino
   monitor_speed = 115200
   build_flags = 
       -DCORE_DEBUG_LEVEL=5
       -DBOARD_HAS_PSRAM
   ```


4. **Configure ESP32-WROOM Model:**
   
   You may get in some issues while running your code. For ESP32-WROOM boards. If you are using a similar S3 Wroom Board, you may want to use the config file in the bottom of the article. You can also try specific configuration to your `platformio.ini`:

   ```ini
   [env:esp32dev]
   platform = espressif32
   board = esp32dev
   framework = arduino
   monitor_speed = 115200
   board_build.partitions = huge_app.csv
   board_build.flash_mode = qio
   board_build.f_cpu = 240000000L
   board_build.f_flash = 80000000L
   build_flags = 
       -DCORE_DEBUG_LEVEL=5
       -DBOARD_HAS_PSRAM
       -mfix-esp32-psram-cache-issue
   ```

This configuration is optimized for ESP32-WROOM modules with:
- Partition scheme for larger applications
- QIO flash mode for better performance
- CPU frequency set to 240MHz
- Flash frequency set to 80MHz
- PSRAM cache fix enabled

Download the board configuration file, and add it to your platform.io boards folder. 

## Understanding the C++ Implementation

Our ESP32 code handles multiple tasks:

- Capturing audio from a microphone.
- Sending audio data to a server via WebSockets.
- Receiving processed audio data and playing it back through a speaker.
- Managing buffer handling to ensure smooth data flow.
- Handling user inputs via a button.

Let's break down each of these components.

### Buffer Handling: From Start to Finish

Efficient buffer management is critical for real-time audio processing. We need to ensure that audio data is captured, processed, and transmitted without delays or overflows.

#### Microphone Handler (`mic.cpp`)

The `micTask` function handles audio data from the microphone.

```cpp
void micTask(void *parameter) {
    while (true) {
        if (isRecording) {
            // Read audio data from the I2S microphone
            size_t bytesRead = 0;
            esp_err_t result = i2s_read(I2S_PORT_MIC, &soundBuffer, bufferLen, &bytesRead, portMAX_DELAY);

            if (result == ESP_OK && bytesRead > 0) {
                // Process the audio data
                detectSound(soundBuffer, bytesRead / sizeof(int16_t));

                // Transmit audio data over WebSocket
                if (isWebSocketConnected) {
                    sendBinaryData(soundBuffer, bytesRead);
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(1)); // Yield to other tasks
    }
}
```

**Key Points:**

- **Non-Blocking Read:** `i2s_read` with `portMAX_DELAY` ensures it waits for data without blocking other tasks.
- **Buffer Management:** Uses `soundBuffer` to store audio samples.
- **Condition Checks:** Ensures data is only processed and sent when recording is active and WebSocket is connected.

#### Buffer Allocation (`utils.cpp`)

Efficient memory allocation is essential for handling audio data.

```cpp
void *audio_malloc(size_t size) {
    // Allocate memory in PSRAM if available, else use regular heap
    void *ptr = psramFound() ? heap_caps_malloc(size, MALLOC_CAP_SPIRAM) : malloc(size);
    if (!ptr) {
        Serial.println("Failed to allocate memory");
    }
    return ptr;
}
```

**Highlights:**

- **PSRAM Usage:** ESP32 has limited RAM. Using external PSRAM helps manage larger buffers.
- **Error Handling:** Checks if allocation is successful.

#### Audio Buffer Class (`audioMemoryBuffer.cpp`)

Manages the circular buffer for audio data.

```cpp
class AudioMemoryBuffer {
public:
    AudioMemoryBuffer() {
        buffer = (int16_t*)malloc(BUFFER_SIZE * sizeof(int16_t));
        if (!buffer) {
            Serial.println("Failed to allocate audio buffer memory");
        }
        clear();
    }

    bool write(const int16_t* data, int length) {
        if (samplesAvailable + length > BUFFER_SIZE) {
            return false; // Buffer overflow
        }
        // Write data to buffer
        // ...
        samplesAvailable += length;
        return true;
    }

    bool read(int16_t* data, int length) {
        if (samplesAvailable < length) {
            return false; // Not enough data
        }
        // Read data from buffer
        // ...
        samplesAvailable -= length;
        return true;
    }

    void clear() {
        samplesAvailable = 0;
        memset(buffer, 0, BUFFER_SIZE * sizeof(int16_t));
    }

private:
    int16_t* buffer;
    int writeIndex = 0;
    int readIndex = 0;
    int samplesAvailable = 0;
};
```

**Usage:**

- **Writing Data:** Called when new audio data is captured.
- **Reading Data:** Used when sending data over WebSocket or playing back.
- **Circular Buffer:** Efficiently manages continuous audio streams.

### Speaker Output Handling (`lib_speaker.cpp`)

Manages playback of received audio data.

```cpp
void speaker_play(uint8_t *payload, uint32_t len) {
    const float volume = 0.2f;
    size_t bytes_written;

    // Convert payload to samples
    int16_t *samples = (int16_t *)payload;
    size_t num_samples = len / sizeof(int16_t);

    // Adjust volume and play
    for (size_t i = 0; i < num_samples; i++) {
        samples[i] = (int16_t)(samples[i] * volume);
    }

    i2s_write(I2S_PORT_SPEAKER, samples, len, &bytes_written, portMAX_DELAY);
}
```

**Key Elements:**

- **Volume Control:** Adjusts playback volume.
- **Playback:** Uses `i2s_write` to send audio data to the speaker.
- **Buffer Management:** Ensures data sent aligns with the speaker's capabilities.

### Configuring I2S for Microphone and Speaker

We need to switch between microphone input and speaker output modes.

```cpp
void InitI2SSpeakerOrMic(AudioMode mode) {
    // Uninstall existing driver
    i2s_driver_uninstall(mode == MODE_MIC ? I2S_PORT_MIC : I2S_PORT_SPEAKER);

    // Configure I2S based on mode
    i2s_config_t i2s_config = {/*...*/};

    // Install I2S driver
    esp_err_t err = i2s_driver_install(port, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("Failed to install I2S driver: %s\n", esp_err_to_name(err));
        return;
    }

    // Set I2S pins
    i2s_pin_config_t pin_config = {/*...*/};
    err = i2s_set_pin(port, &pin_config);
    if (err != ESP_OK) {
        // Handle error
    }

    // Start I2S
    err = i2s_start(port);
    if (err != ESP_OK) {
        // Handle error
    }

    // Update state flags
    if (mode == MODE_MIC) {
        is_mic_installed = true;
        digitalWrite(LED_MIC, HIGH);
    } else {
        is_speaker_installed = true;
        digitalWrite(LED_SPKR, HIGH);
    }
}
```

**Considerations:**

- **Driver Uninstallation:** Clean up before switching modes.
- **Pin Configuration:** Ensures correct pins are used for each mode.
- **State Management:** Keeps track of the current mode.

### Main Program Flow (`main.cpp`)

The `main.cpp` orchestrates the initialization and main loop.

#### Initialization

```cpp
void setup() {
    Serial.begin(115200);
    setupWiFi();
    connectToWebSocket();
    InitI2SSpeakerOrMic(MODE_MIC);
    xTaskCreatePinnedToCore(micTask, "Microphone Task", 4096, NULL, 1, NULL, 0);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}
```

**Components:**

- **Serial Communication:** For debugging.
- **Wi-Fi Setup:** Connects to network.
- **WebSocket Connection:** Establishes communication with the server.
- **Microphone Task:** Runs on Core 0 to handle audio input.
- **Button Setup:** Configured for user input.

#### Main Loop

```cpp
void loop() {
    button.loop();

    if (button.justPressed()) {
        sendButtonState(1);
        setRecording(true);
        i2s_start(I2S_PORT_MIC);
    }

    if (button.justReleased()) {
        sendButtonState(0);
        setRecording(false);
        i2s_stop(I2S_PORT_MIC);
        delay(100);
        i2s_start(I2S_PORT_SPEAKER);
    }

    loopWebsocket();
}
```

**Key Actions:**

- **Button Monitoring:** Starts or stops recording based on button presses.
- **Audio State Management:** Switches between microphone and speaker modes.
- **WebSocket Loop:** Keeps the connection alive and handles incoming messages.
- **Important:** I need to refactor this part as I'm not using the switch function, it caused me some I2S initialization issues.

### Wi-Fi Management (`lib_wifi.cpp`)

Handles Wi-Fi connectivity.

```cpp
void setupWiFi() {
    WiFi.disconnect();
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1500);
    }

    Serial.println("WiFi connected");
}
```

**Notes:**

- **Connection Handling:** Waits until a connection is established.
- **Status Updates:** Provides feedback via serial output.


**Important:** Create a config.cpp file with the following :

```cpp

#include "config.h"

const char* WIFI_SSID = "YOURWIFISSID";
const char* WIFI_PASSWORD = "YOURPASS";
const char* WEBSOCKET_HOST = "YOURWEBSOCKETIP";
```
### Button Handling (`lib_button.cpp`)

Monitors button state changes.

```cpp
class ButtonChecker {
public:
    void loop() {
        lastTickState = thisTickState;
        thisTickState = !digitalRead(BUTTON_PIN); // Active Low
    }

    bool justPressed() {
        return thisTickState && !lastTickState;
    }

    bool justReleased() {
        return !thisTickState && lastTickState;
    }

private:
    bool lastTickState = false;
    bool thisTickState = false;
};
```

**Usage:**

- **Debouncing:** Manages state transitions to avoid false triggers.
- **Integration:** Used in the main loop to respond to user inputs.

### WebSocket Communication (`lib_websocket.cpp`)

Facilitates data exchange with the server.

```cpp
void onMessageCallback(WebsocketsMessage message) {
    if (!message.isBinary()) {
        Serial.println("Received non-binary message: " + message.data());
        return;
    }

    uint8_t *payload = (uint8_t *)message.c_str();
    size_t length = message.length();

    if (length == 0) {
        Serial.println("Received empty audio data");
        return;
    }

    speaker_play(payload, length);
}

void connectToWebSocket() {
    client.onMessage(onMessageCallback);
    client.connect(WEBSOCKET_HOST);
}
```

**Features:**

- **Message Handling:** Processes incoming messages and plays audio data.
- **Connection Management:** Establishes and maintains WebSocket connections.

## Building and Uploading the Project

With PlatformIO, building and flashing the code to the ESP32 is straightforward.

### Step-by-Step Guide

1. **Connect ESP32 to Your Computer:**
   - Use a USB cable to connect your ESP32.

2. **Select the Correct Serial Port:**
   - In VSCode, click on the PlatformIO icon.
   - Go to "Devices" and note the port (e.g., `COM3`, `/dev/ttyUSB0`).

3. **Build the Project:**
   - Click on the checkmark (✓) in the status bar or run `PlatformIO: Build` from the command palette.
   - Resolve any compilation errors.

4. **Upload the Firmware:**
   - Click on the right arrow (→) in the status bar or run `PlatformIO: Upload`.
   - Monitor the output for successful upload messages. You can also run Build & Monitor.

5. **Monitor Serial Output:**
   - Use `PlatformIO: Monitor` to view serial logs.
   - Adjust the baud rate if necessary (configured in `platformio.ini`).

### Common Issues and Resolutions

- **Compilation Errors:**
  - Ensure all dependencies and libraries are included.
  - Check for typos and syntax errors.

- **Upload Failures:**
  - Verify the correct port is selected.
  - Press the boot button on the ESP32 during upload if necessary.

- **Runtime Errors:**
  - Use serial logs to debug.
  - Ensure Wi-Fi credentials are correct in `config.cpp`.

## Testing the Voice Assistant

Once the ESP32 is running, you can start interacting with your voice assistant.

### Steps

1. **Press the Button:**
   - This initiates recording.

2. **Speak Clearly:**
   - The microphone captures your voice.

3. **Release the Button:**
   - Recording stops, and the audio is sent to the server.

4. **Listen to the Response:**
   - The processed response is played through the speaker.

### Troubleshooting Tips

- **No Audio Playback:**
  - Check speaker connections.
  - Ensure the ESP32 is receiving audio data.

- **Poor Audio Quality:**
  - Verify sample rates and buffering.
  - Check for hardware noise or interference.

- **Connection Issues:**
  - Ensure the server is running and accessible.
  - Verify network configurations.

## Conclusion and Next Steps

By integrating the ESP32 with a robust C++ implementation and managing buffer handling efficiently, we've created a capable real-time voice assistant. This project not only demonstrates the potential of embedded systems but also provides a foundation for further enhancements.


### Potential Improvements

- **Optimize Buffer Sizes:** Adjust based on performance and memory usage.
- **Enhance Error Handling:** Make the system more robust against failures.
- **Add Features:** Integrate LEDs for status indication, add more interactive inputs.

### Bridging to the AI Backend

With the hardware and firmware in place, the next phase is to connect our device to an AI backend. In the upcoming section, we'll explore how to integrate a Node.js server powered by **LangChain** and **OpenAI** to interpret voice commands and generate intelligent responses.

*Stay tuned for the final part, where we bring true intelligence to our voice assistant!*


## Ready for Part 2?

Continue to [Part 2: From Hardware to Smartware : Node, OpenAI, Langchain](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-2-node-openai-1og6), where we'll explore how to:

- Build our Websocket server using TypeScript and connect our ESP32
- Integrate LangChain ReAct agent
- Connect OpenAI's Realtime APIs
- Handle real-time audio streaming with WebSockets
- Give to your assistant the total control of your computer (in our 3rd Episode)



---

*If you found this article helpful or have questions, feel free to leave a comment below.*

## Additional Resources

- **PlatformIO Documentation:** [https://docs.platformio.org/](https://docs.platformio.org/)
- **ESP32 Wroom Board Config:** [https://github.com/sivar2311/freenove-esp32-s3-platformio/blob/main/freenove_esp32_s3_wroom.json](https://github.com/sivar2311/freenove-esp32-s3-platformio/blob/main/freenove_esp32_s3_wroom.json)
- **ThatProject:** A huge repo of ESP32 project [https://github.com/0015/ThatProject](https://github.com/0015/ThatProject)

## Community Projects

For those interested in similar projects, check out these related implementations:

### Open Interpreter ESP32 Client

The [Open Interpreter ESP32 Client](https://github.com/OpenInterpreter/01/tree/main/software/source/clients/esp32) provides another approach to building voice assistants with ESP32. It's a much more complete solution, and I'm actually on my way to see how I can integrate it.

Exploring alternative implementations like this can provide valuable insights for improving your own projects.



