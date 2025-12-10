
# [DIY Project] Building a Real-Time AI Voice Assistant on an ESP32 with OpenAI and Langchain 🗣️🤖
Hey everyone!

I've been working on a super exciting project over the past couple of weeks and couldn't wait to share it with this community.

I've built a real-time voice assistant using an ESP32 microcontroller, use as an I/O interface, integrated with a Node Server that uses **LangChain** and **OpenAI**. If you're into IoT, embedded systems, or AI, this might interest you.

**Overall Architecture:**

* A voice assistant that you can interact with in real-time.
* Uses an ESP32 for audio input/output.
* Integrates with a Node.js server powered by LangChain and OpenAI.
* Supports real-time audio streaming via WebSockets.
* You can use it with any Langchain Tools or Agent

**Why I Built It:**

* To explore the possibilities of interaction with an agent from a connected device
* To have a hands-on project that combines hardware and software development.
* Because I thought it would be cool to talk to my own DIY AI assistant anytime by just pressing a button! Actually it is, the interaction is quite fluent, and it doesn't monopolize your computer or smartphone, like an app.

**Can I see it in action ?**

* Yes, you can check the 30-min long video here if you want to dive deeper and see how it works : [https://www.youtube.com/watch?v=1H6FlWNRSYM](https://www.youtube.com/watch?v=1H6FlWNRSYM)
* Or if you're more a reading person, you can check out the [Part 1 : Hardware, PlatformIO and C++](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-1-hardware-43de)
* If you just want to skip to the OpenAI Realtime Integration with Langchain, check out [Part 2 : Node, OpenAI, LangChain](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-2-node-openai-1og6)
* And for course, have a look at the [code repository](https://github.com/FabrikappAgency/esp32-realtime-voice-assistant).

# Project Highlights 

* **Hardware Components:**
   * **ESP32-S3 Development Board:** The brain of the assistant.
   * **I²S Digital Microphone (INMP441):** Capturing voice input.
   * **I²S Amplifier (MAX98357A):** Driving the speaker output.
   * **Small Speaker (3W, 4Ω):** For audio responses.
   * **Push Button & Resistors:** To initiate recordings.
   * **Jumper Wires & Breadboard:** For connections.

* **Software Implementation:**
   * **ESP32 Firmware (C++):** Handles audio capture, buffer management, and WebSocket communication.
   * **Node.js Server (TypeScript):** Manages AI processing using LangChain and OpenAI's APIs.
   * **Real-Time Audio Streaming:** Efficient buffer handling to ensure smooth data flow.

# How It Works 

1. **Voice Capture:** Press the button on the ESP32 to start recording your voice.
2. **Data Transmission:** Audio data is sent via WebSockets to the Node.js server.
3. **AI Processing:** The server uses LangChain and OpenAI to transcribe and understand your speech, then generates a response.
4. **Response Playback:** The audio response is sent back to the ESP32 and played through the speaker.

# Challenges Faced (AKA Hair loss prevention)

* **Buffer Management:** Ensuring smooth real-time audio streaming required efficient buffer handling on both ESP32 and server sides.
* **WebSocket Communication:** Managing bi-directional streaming of audio data over WebSockets between the ESP32 and server.
* **Audio Quality:** Dealt with audio artifacts and latency issues by optimizing sample rates and buffer sizes.

# What If You Want to Build It At Home ? 

I've documented the entire project in a two-part series, including all the code and detailed explanations:

1. **Part 1 - Hardware and C++ Implementation:**
   * Setting up the ESP32 with the microphone and speaker.
   * Configuring the development environment with PlatformIO.
   * Diving deep into buffer handling and speaker output.
   * [Read Here](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-1-hardware-43de)

1. **Part 2 - Building the AI Backend:**
   * Developing the Node.js server with TypeScript.
   * Integrating LangChain for natural language processing.
   * Connecting to OpenAI's APIs for AI-powered responses.
   * Handling real-time audio streaming.
   * [Read Here](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-2-node-openai-1og6)

**GitHub Repository:** [ESP32 Reatime Voice AI Assistant](https://github.com/FabrikappAgency/esp32-realtime-voice-assistant)

You should be able to replicate the project and customize it for your needs.

# Future Improvements 

* **Enhance Audio Processing:** Implement automatic start/stop of discussion, withouth pressing a button, interrupt the assistant, improve output (as far as it's possible to maintain a 44100kbps
* **Expand AI Capabilities:** Add more tools and commands for the assistant.
* **Optimize Performance:** Fine-tune buffer sizes and network handling.

# Feedback and Collaboration 🤝

I'm really looking forward to hearing your thoughts on this project. Whether it's suggestions for improvements, ideas for new features, or any questions you might have—let's discuss!

If anyone's interested in collaborating or contributing, feel free to fork the repository or reach out.

**TL;DR:** I built a DIY real-time voice assistant using an ESP32, integrated with LangChain and OpenAI. It captures voice input, sends it to a Node.js server for AI processing, and plays back the response—all in real-time! Check out the [video ](https://www.youtube.com/watch?v=1H6FlWNRSYM)or the project on [GitHub ](https://github.com/FabrikappAgency/esp32-realtime-voice-assistant)and let me know what you think!

**Cross-posting to:** r/esp32, r/LangChain, r/arduino 

*Excited to hear your feedback!* 😊