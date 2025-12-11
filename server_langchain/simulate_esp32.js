/**
 * Script để mô phỏng ESP32 gửi audio qua WebSocket
 * Giống như ESP32 thực tế: gửi binary chunks, nhận response
 * 
 * Usage: node simulate_esp32.js [filename]
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const filename = process.argv[2] || 'test.mp3';
const WS_URL = 'ws://localhost:8888/device';

// Đọc file MP3
const recordingsDir = path.join(__dirname, 'recordings');
const filePath = path.join(recordingsDir, filename);

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

console.log(`📁 Reading file: ${filename}`);
console.log(`📊 File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB`);
console.log(`🔌 Connecting to: ${WS_URL}\n`);

const audioData = fs.readFileSync(filePath);
const CHUNK_SIZE = 1024; // Giống ESP32 gửi chunks 1024 bytes

// Kết nối WebSocket
const ws = new WebSocket(WS_URL);

let audioChunksReceived = 0;
let textResponse = null;
let audioResponseSize = 0;

ws.on('open', () => {
  console.log('✅ WebSocket connected!\n');
  console.log('📤 Sending start_recording message...');
  
  // Gửi start_recording message
  ws.send(JSON.stringify({
    type: 'start_recording',
    timestamp: Date.now()
  }));
  
  // Đợi một chút rồi bắt đầu gửi audio chunks
  setTimeout(() => {
    console.log('📤 Sending audio data in chunks...\n');
    
    // Gửi audio data thành chunks (giống ESP32)
    let offset = 0;
    const sendChunk = () => {
      if (offset < audioData.length) {
        const chunk = audioData.slice(offset, offset + CHUNK_SIZE);
        ws.send(chunk);
        
        process.stdout.write(`\r📤 Sent: ${((offset + chunk.length) / 1024).toFixed(2)} KB / ${(audioData.length / 1024).toFixed(2)} KB`);
        
        offset += CHUNK_SIZE;
        
        // Gửi chunk tiếp theo sau 10ms (giống ESP32 streaming)
        setTimeout(sendChunk, 10);
      } else {
        // Đã gửi hết audio, gửi stop_recording
        console.log('\n\n📤 Sending stop_recording message...');
        ws.send(JSON.stringify({
          type: 'stop_recording',
          timestamp: Date.now()
        }));
        console.log('⏳ Waiting for AI response...\n');
      }
    };
    
    sendChunk();
  }, 500);
});

ws.on('message', (data) => {
  // Kiểm tra xem là binary hay text
  if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    // Binary audio data từ server
    const size = Buffer.isBuffer(data) ? data.length : data.byteLength;
    audioChunksReceived++;
    audioResponseSize += size;
    
    process.stdout.write(`\rReceived audio chunk #${audioChunksReceived}: ${size} bytes (Total: ${(audioResponseSize / 1024).toFixed(2)} KB)`);
  } else if (typeof data === 'string') {
    // Text message từ server
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'text_response') {
        textResponse = message.content;
        console.log('\nAI Text Response:');
        console.log('─'.repeat(60));
        console.log(textResponse);
        console.log('─'.repeat(60));
      } else if (message.type === 'audio_response_complete') {
        console.log('\nAudio response complete!');
        console.log(`Total audio received: ${(audioResponseSize / 1024).toFixed(2)} KB`);
        console.log(`Total chunks: ${audioChunksReceived}`);
      } else if (message.type === 'error') {
        console.error('\nError:', message.message);
      } else if (message.type === 'info') {
        console.log('\nℹInfo:', message.message);
      } else {
        console.log('\nMessage:', message);
      }
    } catch (e) {
      // Không phải JSON, in ra trực tiếp
      console.log('\nRaw message:', data.toString());
    }
  }
});

ws.on('error', (error) => {
  console.error('\nWebSocket error:', error.message);
  console.error('Make sure server is running on port 8888');
});

ws.on('close', () => {
  console.log('\n\n🔌 WebSocket closed');
  console.log('\nSummary:');
  console.log(`  - Audio chunks sent: ${Math.ceil(audioData.length / CHUNK_SIZE)}`);
  console.log(`  - Audio chunks received: ${audioChunksReceived}`);
  console.log(`  - Audio response size: ${(audioResponseSize / 1024).toFixed(2)} KB`);
  console.log('\nCheck responses/ folder for saved files\n');
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\nInterrupted by user');
  ws.close();
  process.exit(0);
});

