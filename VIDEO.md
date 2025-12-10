# Video Script: Building a Real-time Voice Assistant with ESP32 and AI Integration

**Duration:** Approximately 15-20 minutes

---

## Scene 1: Introduction

**Camera:** Front Camera (Presenter)

**[Voiceover]**

Hello everyone! Welcome back to my channel. Today, I'm excited to share a project that's been a labor of love over the past few weeks: building a real-time voice assistant using an ESP32 microcontroller and integrating it with AI technologies like LangChain and OpenAI.

What started off as a quick weekend project turned into a fascinating deep dive into hardware tinkering, C++ programming, and AI integration. In this two-part series, we'll explore how to bring together embedded systems and modern AI to create a responsive and intelligent voice assistant.

---

## Scene 2: Project Overview

**Camera:** Split Screen (Front Camera and Code)

**[Voiceover]**

In the first part of this series, we'll focus on the hardware setup and the ESP32 firmware implementation using C++. We'll cover:

- Setting up the ESP32 microcontroller with a microphone and speaker.
- Configuring the development environment using PlatformIO.
- Diving into the C++ code for audio capture, buffer handling, and WebSocket communication.

In the second part, we'll transition to building the AI backend with Node.js. Here, we'll:

- Develop a robust server using TypeScript and Node.js.
- Integrate LangChain for natural language processing.
- Connect to OpenAI's powerful APIs for speech recognition and response generation.
- Handle real-time audio streaming with WebSockets.

By the end of this video, you'll have a fully functional voice assistant that you can interact with in real-time!

---

## Scene 3: Hardware Components

**Camera:** ESP32 Camera (Close-up on Hardware Components)

**[Voiceover]**

First things first, let's go over the hardware you'll need for this project. The components are relatively inexpensive, and you might already have some of them if you've tinkered with microcontrollers before.

**Required Materials:**

- **ESP32-S3 Development Board:** This will be the brain of our voice assistant.
- **I²S Digital Microphone (e.g., INMP441):** For capturing audio input.
- **I²S Amplifier (e.g., MAX98357A):** To drive the speaker output.
- **Small Speaker (3W, 4Ω):** So we can hear the assistant's responses.
- **Push Button and Resistors:** For initiating recordings.
- **Jumper Wires and Breadboard:** To connect everything together.
- **Soldering Equipment:** For any necessary permanent connections.

---

## Scene 4: Setting Up the Hardware

**Camera:** ESP32 Camera (Focus on Wiring and Assembly)

**[Voiceover]**

Now, let's assemble our hardware.

1. **Microphone Connection:**

   - Connect the INMP441 microphone to the ESP32 using the I²S interface.
   - Ensure proper connections for data, clock, and power lines.

2. **Speaker Connection:**

   - Wire the MAX98357A amplifier to the ESP32.
   - Connect the amplifier output to the speaker.

3. **Button Setup:**

   - Attach the push button to the ESP32 with a pull-up resistor configuration.
   - This button will allow us to start and stop recordings.

Take your time with the wiring. Double-check each connection to prevent any short circuits or component damage.

---

## Scene 5: Setting Up the Development Environment

**Camera:** Split Screen (Front Camera and Code)

**[Voiceover]**

With the hardware ready, let's set up our development environment using PlatformIO.

**Why PlatformIO?**

- **Integrated with VSCode:** Provides code completion, debugging, and a seamless workflow.
- **Library Management:** Simplifies dependency management.
- **Board Support:** Extensive support for microcontrollers like the ESP32.

**Steps:**

1. **Install Visual Studio Code** if you haven't already.

2. **Install the PlatformIO Extension:**

   - Open VSCode.
   - Navigate to the Extensions tab (`Ctrl+Shift+X`).
   - Search for "PlatformIO IDE" and install it.

3. **Create a New Project in PlatformIO:**

   - Name the project `esp32-ai-assistant`.
   - Select your specific ESP32 board.
   - Choose the Arduino framework.

4. **Organize the Project Structure:**

   - Add your `.cpp` and header files to the `src` and `include` folders respectively.

5. **Configure the `platformio.ini` File:**

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

6. **Set Up Wi-Fi Credentials and WebSocket Host:**

   - Create a `config.h` file with your Wi-Fi SSID, password, and WebSocket server address.

---

## Scene 6: Exploring the C++ Code

**Camera:** Code Camera (Focus on Code Segments)

**[Voiceover]**

Let's dive into the C++ implementation. Our ESP32 code handles several critical tasks:

- **Audio Capture:** Reading data from the microphone.
- **Buffer Management:** Efficiently handling audio data to prevent overflows and ensure smooth transmission.
- **WebSocket Communication:** Sending audio data to the server and receiving responses.
- **Speaker Output:** Playing back the AI-generated responses.
- **Button Handling:** Starting and stopping recordings based on user input.

**Key Components:**

1. **Microphone Task (`mic.cpp`):**

   ```cpp
   void micTask(void *parameter) {
       while (true) {
           if (isRecording) {
               size_t bytesRead = 0;
               i2s_read(I2S_PORT_MIC, &soundBuffer, bufferLen, &bytesRead, portMAX_DELAY);
               if (bytesRead > 0) {
                   if (isWebSocketConnected) {
                       sendBinaryData(soundBuffer, bytesRead);
                   }
               }
           }
           vTaskDelay(pdMS_TO_TICKS(1));
       }
   }
   ```

2. **Buffer Allocation (`utils.cpp`):**

   ```cpp
   void *audio_malloc(size_t size) {
       void *ptr = psramFound() ? heap_caps_malloc(size, MALLOC_CAP_SPIRAM) : malloc(size);
       if (!ptr) {
           Serial.println("Failed to allocate memory");
       }
       return ptr;
   }
   ```

3. **Speaker Output Handling (`lib_speaker.cpp`):**

   ```cpp
   void speaker_play(uint8_t *payload, uint32_t len) {
       const float volume = 0.2f;
       size_t bytes_written;
       int16_t *samples = (int16_t *)payload;
       size_t num_samples = len / sizeof(int16_t);
       for (size_t i = 0; i < num_samples; i++) {
           samples[i] = (int16_t)(samples[i] * volume);
       }
       i2s_write(I2S_PORT_SPEAKER, samples, len, &bytes_written, portMAX_DELAY);
   }
   ```

4. **Main Program Flow (`main.cpp`):**

   ```cpp
   void setup() {
       Serial.begin(115200);
       setupWiFi();
       connectToWebSocket();
       xTaskCreatePinnedToCore(micTask, "Microphone Task", 4096, NULL, 1, NULL, 0);
       pinMode(BUTTON_PIN, INPUT_PULLUP);
   }

   void loop() {
       if (digitalRead(BUTTON_PIN) == LOW) {
           sendButtonState(1);
           setRecording(true);
       } else {
           sendButtonState(0);
           setRecording(false);
       }
       loopWebsocket();
   }
   ```

---

## Scene 7: Building and Uploading the Firmware

**Camera:** Split Screen (Front Camera and Code)

**[Voiceover]**

Now that we've reviewed the code, let's build and upload it to our ESP32.

**Steps:**

1. **Connect Your ESP32 to Your Computer.**

2. **Select the Correct Serial Port in PlatformIO.**

3. **Build the Project:**

   - Click the checkmark icon or run `PlatformIO: Build`.
   - Fix any compilation errors that may arise.

4. **Upload the Firmware:**

   - Click the right arrow icon or run `PlatformIO: Upload`.
   - Monitor the output to ensure the upload is successful.

5. **Monitor the Serial Output:**

   - Use `PlatformIO: Monitor` to view real-time logs from the ESP32.

---

## Scene 8: Testing the ESP32 Voice Assistant

**Camera:** ESP32 Camera (Focus on the Device)

**[Voiceover]**

With the firmware uploaded, it's time to test our voice assistant.

1. **Press the Button to Start Recording.**

2. **Speak into the Microphone.**

3. **Release the Button to Stop Recording.**

At this point, the ESP32 is capturing your voice and sending the audio data to the server. Since we haven't set up the server yet, the assistant won't respond just yet.

---

## Scene 9: Setting Up the AI Backend

**Camera:** Split Screen (Front Camera and Code)

**[Voiceover]**

Moving on to the second part of our project—building the AI backend using Node.js, LangChain, and OpenAI.

**Server Overview:**

- **WebSocket Server:** Handles real-time communication with the ESP32.
- **Audio Processing Pipeline:** Converts audio data into a format suitable for OpenAI's APIs.
- **AI Integration:** Uses LangChain and OpenAI to transcribe and understand speech, and generate responses.
- **Audio Playback:** Sends the AI-generated audio back to the ESP32 for playback.

---

## Scene 10: Exploring the Server Code

**Camera:** Code Camera (Focus on Server Code Segments)

**[Voiceover]**

Let's walk through some key parts of our server implementation.

1. **Agent Management (`lib/agent.ts`):**

   ```typescript
   export class OpenAIVoiceReactAgent {
       // Constructor and properties
       public startRecordingSession(): void {
           // Starts recording
       }
       public async stopRecordingAndProcessAudio(): Promise<void> {
           // Stops recording and processes audio
       }
       private async sendAudioEvent(base64Audio: string): Promise<void> {
           // Sends audio to OpenAI
       }
       // Additional methods...
   }
   ```

2. **Audio Management (`lib/audio.ts`):**

   ```typescript
   export class AudioManager {
       public startRecording() {
           // Initializes recording
       }
       public handleAudioBuffer(buffer: Buffer): void {
           // Handles incoming audio data
       }
       public getCurrentBuffer(): Buffer {
           // Retrieves the audio buffer
       }
       public closeFile(): void {
           // Finalizes the audio file
       }
       // Additional methods...
   }
   ```

3. **WebSocket Connection (`src/index.ts`):**

   ```typescript
   app.get(
     "/device",
     upgradeWebSocket((c) => ({
       onOpen: async (c, ws) => {
         // Establish connection with ESP32
         await agent.connect(ws, broadcastToClients);
       },
       onClose: (c, ws) => {
         // Handle disconnection
       },
     }))
   );
   ```

4. **Utility Functions (`lib/utils.ts`):**

   ```typescript
   export function convertAudioToPCM16(
       audioFile: Buffer,
       sourceRate: number = 44100,
       targetRate: number = 24000
   ): string {
       // Converts audio buffer to PCM16 base64 string
   }
   ```

---

## Scene 11: Buffer Handling Deep Dive

**Camera:** Split Screen (Code Camera and ESP32 Camera)

**[Voiceover]**

Efficient buffer handling is crucial for real-time audio processing. Let's see how audio data flows through our system from start to finish.

1. **Capturing Audio on the ESP32:**

   - The ESP32 reads audio data from the microphone and sends it in chunks via WebSockets.

2. **Receiving Data on the Server:**

   - The `AudioManager` accumulates these chunks, ensuring they don't exceed the maximum buffer size to prevent memory issues.

3. **Processing and Writing the Buffer:**

   - Once enough data is collected, the buffer is converted and written to a WAV file.

4. **Finalizing the Audio Data:**

   - When recording stops, any remaining data is processed, and the file is closed properly.

5. **Sending Audio to OpenAI:**

   - The audio file is converted to a base64 string and sent to OpenAI's API for transcription and understanding.

6. **Receiving and Broadcasting Responses:**

   - The AI's response is received as audio data, which is then chunked appropriately and sent back to the ESP32.

---

## Scene 12: Running the Server

**Camera:** Code Camera (Terminal Output)

**[Voiceover]**

Let's set up and run our server.

1. **Install Dependencies:**

   ```bash
   cd server_langchain
   npm install
   ```

2. **Configure Environment Variables:**

   - Create a `.env` file with your OpenAI API key.

3. **Start the Server:**

   ```bash
   npm run dev
   ```

**Monitor the Server Output:**

- Ensure that the server is listening for connections and there are no errors.

---

## Scene 13: Testing the Full System

**Camera:** ESP32 Camera and Front Camera (Split Screen)

**[Voiceover]**

With both the ESP32 firmware and the server running, it's time for the moment of truth!

1. **Press the Button on the ESP32 to Start Recording.**

2. **Ask a Question:**

   - For example, "What's the weather like today?"

3. **Release the Button to Stop Recording.**

4. **Wait for the Response:**

   - The ESP32 should play back the AI's response through the speaker.

**[Live Demonstration]**

- Show the interaction in real-time, highlighting the seamless communication between the ESP32 and the AI backend.

---

## Scene 14: Troubleshooting Common Issues

**Camera:** Front Camera

**[Voiceover]**

If you encounter any issues, here are some common problems and their solutions:

- **No Audio Playback:**

  - Check speaker connections and ensure the amplifier is functioning.

- **Poor Audio Quality:**

  - Verify the microphone wiring.
  - Adjust buffer sizes and sample rates.

- **WebSocket Connection Errors:**

  - Make sure both the ESP32 and server are on the same network.
  - Confirm the WebSocket host address in the ESP32 code.

---

## Scene 15: Enhancements and Next Steps

**Camera:** Front Camera

**[Voiceover]**

Congratulations! You've built a real-time voice assistant using an ESP32 and integrated it with AI technologies.

**Potential Improvements:**

- **Optimize Buffer Sizes:** To improve performance and reduce latency.
- **Enhance Error Handling:** Make the system more robust against unexpected inputs.
- **Add New Features:** Such as additional voice commands, control over IoT devices, or integration with other APIs.

**Future Plans:**

- **Implement Noise Reduction:** To improve audio clarity.
- **Expand the Tool System:** Allowing the assistant to perform more complex tasks.
- **User Experience Enhancements:** Such as adding LEDs to indicate status or voice prompts.

---

## Scene 16: Conclusion

**Camera:** Front Camera

**[Voiceover]**

Thank you for joining me on this journey of building a voice assistant from the ground up. We've explored hardware setups, delved into C++ programming on the ESP32, and harnessed the power of AI with OpenAI and LangChain.

I hope this project inspires you to explore the exciting possibilities at the intersection of embedded systems and artificial intelligence. If you have any questions or suggestions, feel free to leave a comment below.

Don't forget to like this video and subscribe to stay updated on future projects. Until next time, happy coding!

---

## Scene 17: Credits and Additional Resources

**Camera:** Front Camera and Screenshots of Resources

**[Voiceover]**

**Additional Resources:**

- **Project Repository:** [GitHub - ESP32 AI Assistant](https://github.com/FabrikappAgency/esp32-ai-assistant)
- **PlatformIO Documentation:** [https://docs.platformio.org/](https://docs.platformio.org/)
- **OpenAI Documentation:** [OpenAI API](https://beta.openai.com/docs/)
- **LangChain Documentation:** [LangChain](https://langchain.readthedocs.io/)

---

# End of Script

Feel free to adjust the script to match your style and the specific details of your implementation. This script balances technical explanations with practical demonstrations, providing viewers with both the "how" and the "why" behind each step.