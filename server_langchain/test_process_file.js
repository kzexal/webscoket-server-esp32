/**
 * Test script to process MP3 file from recordings folder
 * Usage: node test_process_file.js [filename]
 */

const http = require('http');

const filename = process.argv[2] || 'test.mp3';
const instructions = process.argv[3] || '你好，请认真听这段音频，然后用中文和我对话。';

const postData = JSON.stringify({
  filename: filename,
  instructions: instructions
});

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/api/process-file',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log(`Processing file: ${filename}`);
console.log(`Instructions: ${instructions}`);
console.log('Sending request to server...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ Success!');
        console.log('\nResponse:');
        console.log(`  Text: ${response.text}`);
        console.log(`  Text Path: ${response.textPath}`);
        console.log(`  Audio Path: ${response.audioPath}`);
        console.log(`  Session ID: ${response.sessionId}`);
        console.log(`  Message: ${response.message}`);
      } else {
        console.log('❌ Error:', response.error || data);
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
  console.error('Make sure the server is running on port 8888');
});

req.write(postData);
req.end();


