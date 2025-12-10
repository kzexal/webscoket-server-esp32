## From Hardware to Smartware: Building the Brain of Our ESP32 Voice Assistant

*Welcome back to part two of our ESP32 voice assistant series! In [part one](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-1-hardware-43de), we laid the hardware foundation by configuring the ESP32 to capture voice input and play back responses. Now, we're diving into the exciting realm of giving our assistant intelligence using a Node.js server powered by **LangChain** and **OpenAI**.*

## The Journey So Far

In the first installment, we got our hands dirty with the hardware side of things—connecting microphones, setting up speakers, and ensuring our ESP32 could handle audio input and output. We managed to make the ESP32 record audio and play it back—an essential first step.

But let's be real, an assistant that only echoes what you say isn't particularly *smart*. So, the next logical step was to infuse it with some intelligence. That's where LangChain and OpenAI come into play.

>If you missed the [part one](https://dev.to/fabrikapp/i-created-a-realtime-voice-assistant-for-my-esp-32-here-is-my-journey-part-1-hardware-43de), here are the relevant medias.

> ## The Ugly Beast
![ESP32 AI Assistant](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/bfoowlhdm2e5dg5d9yfr.jpg)

> ## Video

> {% embed https://youtu.be/1H6FlWNRSYM %}

> ## Source Code

> The complete source code for this project is available on GitHub:
> [ESP32 AI Assistant Repository](https://github.com/FabrikappAgency/esp32-realtime-voice-assistant)

## The Server Challenge

Initially, I thought, *"I've got this—Node.js is my jam!"* However, as I delved deeper, I realized that integrating real-time audio streaming, managing WebSocket connections, and handling AI processing was...quite a ride !

After numerous caffeine-fueled debugging sessions, frantic whiteboard scribbles, and eureka moments in the shower, I developed a robust server architecture that I'm excited to share with you.

## Behind the Scenes: How It All Works

Imagine this workflow:

1. **Voice Capture**: Your voice is captured by the ESP32's microphone.
2. **Data Transmission**: The audio data is sent via WebSocket streams to a Node.js server.
3. **AI Processing**: The server processes the audio in real-time, uses LangChain to orchestrate the agent and maange communication with OpenAI.
4. **Response Playback**: The server sends the response back to your ESP32 for playback—all in a matter of seconds.

Here are the key components that make this system work:

- **WebSocket Server**: The custom WebSocket server handles audio streams smoothly while maintaining stable connections with the ESP32.
- **Audio Processing**: Raw audio gets transformed into OpenAI-compatible formats, with careful buffer management to keep the stream flowing.
- **Playback**: The system ensures audio responses play back smoothly on the ESP32, making conversations feel natural.
- **LangChain Agent**: This is where the intelligence comes in - LangChain helps you manage your IA flow "easily".

Let's look at how these pieces work together, starting with the core intelligence.

## The Brain of the Operation

The heart of the server is the **Agent Management** system (in `lib/agent.ts`). It acts as the command center, processing incoming speech and determining appropriate responses.

### Voice Assistant Server Implementation (Node.js/TypeScript)

#### Core Components

##### 1. Agent Management (`lib/agent.ts`)

The `OpenAIVoiceReactAgent` class encapsulates the core functionality of the voice assistant, including buffer handling from start to finish.
```typescript:esp32-ai-assistant/server_langchain/src/lib/agent.ts
export class OpenAIVoiceReactAgent {
    // Protected properties
    protected connection: OpenAIWebSocketConnection;
    protected instructions?: string;
    protected tools: Tool[];
    protected BUFFER_SIZE = 4800;

    // Public properties
    public buffer = new Uint8Array();
    public audioBuffer: Buffer | undefined;

    // Private properties
    private audioManager: AudioManager;
    private recording: boolean = false;

    constructor(params: OpenAIVoiceReactAgentOptions) {
        this.audioManager = new AudioManager();
        this.connection = new OpenAIWebSocketConnection({
            url: params.url,
            apiKey: params.apiKey,
            model: params.model,
            audioConfig: params.audioConfig,
            audioManager: this.audioManager
        });
        this.instructions = params.instructions;
        this.tools = params.tools ?? [];
    }

    // Starts a new recording session
    public startRecordingSession(): void {
        if (this.recording) {
            this.audioManager.resetRecording();
        }
        this.recording = true;
        this.audioManager.startRecording();
        console.log('Started new recording session');
    }

    // Stops recording and processes the audio
    public async stopRecordingAndProcessAudio(): Promise<void> {
        if (!this.recording) {
            console.log('No active recording to stop');
            return;
        }

        this.recording = false;

        try {
            this.audioManager.closeFile(); // Finalize the audio file
            const buffer = this.audioManager.getCurrentBuffer();
            if (buffer.length === 0) {
                console.log('No audio data captured');
                return;
            }

            const base64 = convertAudioToPCM16(buffer);
            await this.sendAudioEvent(base64);

        } catch (error) {
            console.error('Error processing audio:', error);
        } finally {
            this.audioManager.resetRecording();
            console.log('Recording session ended and cleaned up');
        }
    }

    // Sends the audio event to OpenAI
    private async sendAudioEvent(base64Audio: string): Promise<void> {
        if (!base64Audio) {
            console.log('No audio data to send');
            return;
        }

        const eventAudio = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_audio',
                    audio: base64Audio
                }]
            }
        };

        try {
            this.connection.sendEvent(eventAudio);
            // Wait for the audio event to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.connection.sendEvent({
                type: 'response.create'
            });
        } catch (error) {
            console.error('Error sending audio event:', error);
            throw error;
        }
    }

    // WebSocket Connection Methods
    async connect(
        websocketOrStream: AsyncGenerator<string> | WebSocket,
        sendOutputChunk: (chunk: string) => void | Promise<void>
    ): Promise<void> {
        // ...connection setup and event handling...
    }

    // ...additional methods...
}
```

**Key Features:**

- **Buffer Handling from Start to Finish**:
    - Manages the initiation, recording, processing, and resetting of audio buffers.
    - Ensures that audio data is handled efficiently and accurately throughout the session.
- Manages WebSocket connections.
- Controls audio recording sessions.
- Handles tool execution.
- Processes event streams.

##### 2. Audio Management (`lib/audio.ts`)

The `AudioManager` class is responsible for audio processing and buffering, a critical component in handling the audio data from the ESP32.

```typescript:esp32-ai-assistant/server_langchain/src/lib/audio.ts
export class AudioManager {
    private configHighDef: AudioConfig = {
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16
    };

    private fileWriter: wav.FileWriter | undefined;
    private writeTimeout: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private config = this.configHighDef;
    private audioBuffer: Buffer = Buffer.alloc(0);

    constructor() {
        // Initialization code
    }

    // Resets the recording session
    public resetRecording(): void {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
        
        if (this.fileWriter) {
            this.fileWriter.end();
            this.fileWriter = undefined;
        }
        
        this.audioBuffer = Buffer.alloc(0);
        this.isProcessing = false;
    }

    // Starts a new recording session
    public startRecording() {
        this.resetRecording();
        const randomId = Math.random().toString(36).substring(2, 15);
        const filename = path.join(__dirname, '../../tmp', `recording-${randomId}.wav`);
        this.initializeFileWriter(filename);
        console.log('Started new recording:', filename);
    }

    // Handles incoming audio buffers
    public handleAudioBuffer(buffer: Buffer): void {
        // Buffer management logic
    }

    // Processes and writes buffer to file
    private processAndWriteBuffer(): void {
        // Buffer processing logic
    }

    // Retrieves the current buffer
    public getCurrentBuffer(): Buffer {
        if (!this.fileWriter) {
            console.error('No file writer available');
            return Buffer.alloc(0);
        }

        try {
            const audioFilePath = this.fileWriter.path;
            const fileBuffer = fs.readFileSync(audioFilePath);
            console.log(`Successfully read audio file: ${audioFilePath}`);
            return fileBuffer;
        } catch (error) {
            console.error('Error reading current audio buffer:', error);
            return Buffer.alloc(0);
        }
    }

    // Closes the file writer
    public closeFile(): void {
        console.log('Closing WAV file writer');
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }
        if (this.audioBuffer.length > 0) {
            this.processAndWriteBuffer();
        }
    }

    // ...additional methods...
}
```

**Features:**

- **Buffer Management**:
    - Efficient handling of audio buffers to prevent memory issues.
    - Timely processing and writing of buffers to maintain real-time performance.
- **Audio Processing Pipeline**:
    - Converts raw audio data into formats compatible with OpenAI's APIs.
    - Includes methods to start, stop, and reset recordings.
- **WAV File Operations**:
    - Handles writing audio data to WAV files for processing.
    - Manages file writers and ensures proper closure and cleanup.

##### 3. WebSocket Connection and Buffer Handling (`src/index.ts`)

The `index.ts` file manages the WebSocket connections and orchestrates the flow between the client and the server.

```typescript:esp32-ai-assistant/server_langchain/src/index.ts
import "dotenv/config";
import { WebSocket } from "ws";
// ...additional imports...

const app = new Hono();
const WS_PORT = 8888;
const connectedClients = new Set<WebSocket>();

// ...app setup...

app.get(
  "/device",
  upgradeWebSocket((c) => ({
    onOpen: async (c, ws) => {
      // ...connection setup...

      // Wait 1000ms before connecting to allow WebSocket setup
      await new Promise(resolve => setTimeout(resolve, 1000));
      await agent.connect(rawWs, broadcastToClients);
    },
    onClose: (c, ws) => {
      // ...cleanup...
    },
  }))
);

// ...server setup...
```

**Key Features:**

- **WebSocket Management**:
    - Handles bi-directional communication between the ESP32 and the server.
    - Manages binary data handling for audio streams.
- **Broadcasting to Clients**:
    - Sends AI-generated audio responses back to connected ESP32 devices.
    - Manages chunking of audio data to accommodate ESP32 buffer limitations.

##### 4. Utility Functions (`lib/utils.ts`)

Various utility functions assist in handling buffers and working with audio data.

```typescript:esp32-ai-assistant/server_langchain/src/lib/utils.ts
export function convertAudioToPCM16(
    audioFile: Buffer, 
    sourceRate: number = 44100, 
    targetRate: number = 24000
): string {
    // Convert audio file to PCM16 24kHz mono format from 44.1kHz
    // ...conversion logic...
}
```

**Key Utilities:**

- **Buffer Conversion**:
    - Converts audio files to the appropriate format and sample rate.
    - Handles resampling and encoding to base64 for transmission.

## Buffer Handling: From Start to Finish

One of the most critical aspects of this project is efficient buffer handling. Let's take a journey through how audio data is captured, processed, and transmitted.

### 1. Capturing Audio on the ESP32

The ESP32 captures audio data from the microphone and sends it over a WebSocket connection to our Node.js server. Due to the ESP32's limited resources, we need to ensure that the data is sent in manageable chunks.

### 2. Receiving Data on the Server

On the server side, the `AudioManager` class in `lib/audio.ts` is responsible for handling incoming audio buffers.

```typescript:esp32-ai-assistant/server_langchain/src/lib/audio.ts
public handleAudioBuffer(buffer: Buffer): void {
    try {
        if (this.audioBuffer.length + buffer.length > this.MAX_BUFFER_SIZE) {
            this.processAndWriteBuffer();
        }

        this.audioBuffer = Buffer.concat([this.audioBuffer, buffer]);

        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }

        this.writeTimeout = setTimeout(() => {
            if (this.audioBuffer.length > 0) {
                this.processAndWriteBuffer();
            }
        }, this.WRITE_DELAY);

        if (this.audioBuffer.length >= this.MIN_BUFFER_SIZE && !this.isProcessing) {
            this.processAndWriteBuffer();
        }

    } catch (error) {
        console.error('Error handling audio buffer:', error);
        this.audioBuffer = Buffer.alloc(0);
        this.isProcessing = false;
    }
}
```

**What's Happening Here?**

- **Buffer Accumulation**: As data arrives, we accumulate it into `this.audioBuffer`.
- **Memory Management**: We check if adding the new buffer would exceed our `MAX_BUFFER_SIZE` (to prevent memory overflows). If so, we process and write the buffer to disk.
- **Write Delay**: We use a `writeTimeout` to batch the writing process, allowing for efficient file I/O operations.
- **Processing Triggers**: If the buffer reaches a minimum size before the timeout, we process it immediately to maintain responsiveness.

### 3. Processing and Writing the Buffer

The `processAndWriteBuffer` method handles the actual writing of the audio data to a WAV file.

```typescript:esp32-ai-assistant/server_langchain/src/lib/audio.ts
private processAndWriteBuffer(): void {
    if (!this.fileWriter || this.audioBuffer.length === 0 || this.isProcessing) {
        return;
    }

    try {
        this.isProcessing = true;
        const bufferToWrite = this.audioBuffer;
        this.audioBuffer = Buffer.alloc(0);
        this.fileWriter.write(bufferToWrite);
        console.log(`Successfully wrote ${bufferToWrite.length} bytes of audio data`);
    } catch (error) {
        console.error('Error writing audio buffer:', error);
    } finally {
        this.isProcessing = false;
    }
}
```

**Key Points:**

- **Atomic Operations**: We ensure that writing to the file and resetting the buffer are atomic to prevent data loss.
- **Concurrency Control**: The `isProcessing` flag prevents concurrent writes, which could corrupt the audio file.
- **Error Handling**: Robust error handling ensures that any issues do not crash the application and are properly logged.

### 4. Finalizing the Audio Data

When the recording session is over, we finalize the audio data:

```typescript:esp32-ai-assistant/server_langchain/src/lib/audio.ts
public closeFile(): void {
    console.log('Closing WAV file writer');
    if (this.writeTimeout) {
        clearTimeout(this.writeTimeout);
    }
    if (this.audioBuffer.length > 0) {
        this.processAndWriteBuffer();
    }
}
```

**Why This Matters:**

- **Ensuring Data Integrity**: We process any remaining data before closing the file to ensure we don't lose the tail end of the audio.
- **Cleanup**: Clears any timeouts and resets the state to prepare for the next recording session.

### 5. Sending the Audio to OpenAI

Once we have the processed audio buffer, we need to send it to the OpenAI API for transcription and understanding.

```typescript:esp32-ai-assistant/server_langchain/src/lib/agent.ts
private async sendAudioEvent(base64Audio: string): Promise<void> {
    if (!base64Audio) {
        console.log('No audio data to send');
        return;
    }

    const eventAudio = {
        type: 'conversation.item.create',
        item: {
            type: 'message',
            role: 'user',
            content: [{
                type: 'input_audio',
                audio: base64Audio
            }]
        }
    };

    try {
        this.connection.sendEvent(eventAudio);
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.connection.sendEvent({
            type: 'response.create'
        });
    } catch (error) {
        console.error('Error sending audio event:', error);
        throw error;
    }
}
```

- **Base64 Encoding**: The audio buffer is converted to a base64 string for transmission.
- **Event Dispatching**: We send a `conversation.item.create` event to the OpenAI service, which triggers the AI processing.

## Handling the Speaker Output

An essential part of a voice assistant is being able to *speak back* to the user. This involves receiving audio data from OpenAI and sending it back to the ESP32 for playback.

### 1. Receiving Audio Responses

The server listens for audio data in the event stream from OpenAI.

```typescript:esp32-ai-assistant/server_langchain/src/lib/agent.ts
private async handleSpeakerOutput(
    data: any,
    toolExecutor: VoiceToolExecutor,
    sendOutputChunk: (chunk: string) => void | Promise<void>
): Promise<void> {
    const { type } = data;

    if (type === "response.audio.delta" || type === "response.audio_buffer.speech_started") {
        await sendOutputChunk(JSON.stringify(data));
    } else if (type === "error") {
        console.error("error:", data);
    } else if (!EVENTS_TO_IGNORE.includes(type)) {
        console.log(type);
    }
}
```

- **Streaming Audio Data**: The `response.audio.delta` event contains chunks of audio data that form the AI's spoken response.
- **Sending Chunks to Clients**: We use the `sendOutputChunk` function to send these audio chunks back to the connected clients (our ESP32 devices).

### 2. Broadcasting to ESP32 Clients

In `src/index.ts`, we broadcast the audio data to all connected ESP32 clients, making sure to handle their buffer limitations.

```typescript:esp32-ai-assistant/server_langchain/src/index.ts
const broadcastToClients = (data: string) => {
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === "response.audio.delta" && parsed.delta) {
                    const audioBuffer = Buffer.from(parsed.delta, 'base64');
                    // Send audio data in chunks that ESP32 can handle
                    const CHUNK_SIZE = 1024; // ESP32 friendly chunk size
                    for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
                        const chunk = audioBuffer.slice(i, i + CHUNK_SIZE);
                        client.send(chunk);
                    }
                    return;
                }
            } catch (e) {
                // If parsing fails, send original data
            }
        }
    });
};
```

**Key Considerations:**

- **Chunking the Data**: ESP32 devices have limited buffer sizes, so we split the audio data into chunks that they can handle (`CHUNK_SIZE` of 1024 bytes).
- **Binary Data Transmission**: The audio data is sent in binary format. We ensure the WebSocket connection is set to handle binary data appropriately.

### 3. Playback on the ESP32

On the ESP32 side, the device receives the audio chunks and plays them through its connected speaker. The efficient handling and timely delivery of these chunks ensure that the playback is smooth and without noticeable latency.

## Setting Up the Project

1. **Clone the Repository**

   ```bash
   git clone https://github.com/FabrikappAgency/esp32-realtime-voice-assistant.git
   cd esp32-ai-assistant
   ```

2. **Install Server Dependencies**

   ```bash
   cd server_langchain
   npm install
   ```

3. **Configure Environment Variables**

   - Copy `.env.example` to `.env`
   - Add your OpenAI API key

4. **Start the Server**

   ```bash
   npm run dev
   ```

## Usage

1. **Power Up Your ESP32**

   - Ensure it's connected to the same network as your server.

2. **Interact with the Assistant**

   - Press the designated button to start recording.
   - Speak your query or command.
   - Release the button to stop recording.

3. **Receive Responses**

   - The AI processes your input, and the ESP32 plays back the response.

## Troubleshooting Buffer Issues

- **Audio Quality Problems**
  - Verify microphone wiring and grounding.
  - Ensure sample rates between ESP32 and server match.
  - Check and adjust audio buffer sizes.

- **WebSocket Connection Errors**
  - Confirm network connectivity.
  - Validate the WebSocket server address in the ESP32 code.
  - Use logs to monitor connection status.

- **Playback Stutters**
  - Increase the `CHUNK_SIZE` if the ESP32 can handle larger buffers.
  - Optimize the network to reduce latency.

## Future Improvements
Here are some planned improvements and future directions for the project:

### Enhanced Tool Integration
- **Open Interpreter Integration**
  - Add support for Open Interpreter to enable code execution capabilities
  - Implement sandboxed environment for safe code execution
  - Enable real-time code generation and execution feedback

- **Extended Tool Ecosystem**
  - Implement RAG (Retrieval Augmented Generation) for local knowledge base
  - Add web scraping capabilities for real-time information
  - Create custom function registry for easy tool addition
  - Enable tool chaining for complex multi-step operations

### Hardware Enhancements
- **Camera Integration**
  - Add ESP32-CAM module support for visual input
  - Implement computer vision capabilities using TensorFlow Lite
  - Enable QR code/barcode scanning functionality
  - Add gesture recognition for hands-free control

- **Smart Voice Activation**
  - Implement wake word detection (e.g., "Hey Assistant")
  - Add voice activity detection (VAD) for automatic recording
  - Create noise cancellation algorithms
  - Enable continuous conversation mode

### Performance Optimizations
- **Buffer Management**
  - Implement adaptive buffer sizing based on network conditions
  - Add circular buffer implementation for smoother audio handling
  - Create buffer monitoring and optimization tools
  - Enable compression for reduced bandwidth usage

- **Code Quality**
  - Implement comprehensive error handling
  - Add unit tests and integration tests
  - Create documentation using standardized formats
  - Optimize memory usage and reduce heap fragmentation

### User Experience
- **Feedback Systems**
  - Add LED indicators for system status
  - Implement haptic feedback for button-free operation
  - Create audio cues for different states
  - Display connection quality metrics

- **Configuration Interface**
  - Build web-based configuration portal
  - Enable OTA (Over-The-Air) updates
  - Add customizable voice and personality settings
  - Create user profiles for personalized responses


## Conclusion

This project showcases the potential of integrating embedded systems with advanced AI capabilities. By combining the ESP32's hardware with a sophisticated Node.js server and leveraging LangChain and OpenAI, we've created a responsive and intelligent voice assistant. This platform opens up numerous possibilities for home automation, personal assistance, and educational applications.

Now you can add any tool you need easily, including RAG, scraping, custom functions etc.

Feel free to contribute to the project or adapt it to suit your specific needs. Happy coding!

**Now you can add any tool you need easily, including RAG, scraping, custom functions, etc.**

Feel free to contribute to the project or adapt it to suit your specific needs. The possibilities are endless, and this is just the beginning.

Happy coding!

---

*If you enjoyed this article or have questions, let's continue the conversation in the comments below.*
