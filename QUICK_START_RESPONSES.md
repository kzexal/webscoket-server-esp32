# ⚡ Quick Start - View Saved Responses

## What Gets Saved?

✅ **Text responses** → `responses/<session_id>/text/response_*.txt`  
✅ **Audio responses** → `responses/<session_id>/audio/response_*.mp3`  
✅ **Metadata** → `responses/<session_id>/metadata_*.json`

---

## How to View Responses

### Method 1: Web Interface (Easiest) 🌐

1. Make sure server is running:
```bash
npm run dev
```

2. Open browser:
```
http://localhost:8888/responses
```

3. Click on a session to view responses
4. Click play button to listen to audio
5. Click download buttons to save files

---

### Method 2: File Explorer 📁

**Windows:**
```
C:\Users\<你的用户名>\Downloads\code\esp32-realtime-voice-assistant\responses\
```

**Mac/Linux:**
```
~/Downloads/code/esp32-realtime-voice-assistant/responses/
```

---

### Method 3: PowerShell / Terminal 🖥️

```powershell
# Go to responses folder
cd "C:\Users\<你的用户名>\Downloads\code\esp32-realtime-voice-assistant\responses"

# List all sessions
dir

# View a specific session
cd 2025-12-04_123456

# List all responses in that session
dir audio/
dir text/

# View text content
Get-Content text/response_2025-12-04T12-34-56.txt

# Play audio (Windows)
start audio/response_2025-12-04T12-34-56.mp3
```

---

## File Formats

| Type | Format | Example |
|------|--------|---------|
| **Text Response** | Plain text (UTF-8) | `response_2025-12-04T12-34-56.txt` |
| **Audio Response** | MP3 (compressed) | `response_2025-12-04T12-34-56.mp3` |
| **Metadata** | JSON | `metadata_2025-12-04T12-34-56.json` |

---

## Example Response Files

### Text File (response_2025-12-04T12-34-56.txt)
```
你好，我是智谱清言。有什么我可以帮助你的吗？
```

### Audio File (response_2025-12-04T12-34-56.mp3)
- Compressed MP3 audio
- ~10-30 KB size
- Can be played in any media player

### Metadata File (metadata_2025-12-04T12-34-56.json)
```json
{
  "timestamp": "2025-12-04T12:34:56.789Z",
  "audioPath": "responses/2025-12-04_123456/audio/response_2025-12-04T12-34-56.mp3",
  "textContent": "你好，我是智谱清言。有什么我可以帮助你的吗？",
  "audioSize": 12345,
  "textSize": 45,
  "savedAt": "2025-12-04T12:34:57.000Z"
}
```

---

## Common Tasks

### Download All Text Responses from a Session
1. Open `/responses` in browser
2. Click session name
3. Click "💾 Download TXT" buttons

### Export Responses to Another Computer
```powershell
# Copy entire responses folder
Copy-Item -Recurse "responses" "responses_backup"

# Zip for easy transfer
Compress-Archive -Path "responses" -DestinationPath "responses.zip"
```

### Delete Old Responses
```powershell
# Remove a specific session
Remove-Item -Recurse "responses/2025-12-04_123456"

# Remove all responses
Remove-Item -Recurse "responses"
```

---

## Tips & Tricks

💡 **Audio too large?** Audio is automatically compressed to MP3 (much smaller than WAV)

💡 **Need backup?** Copy the entire `responses/` folder to external drive

💡 **Want to share?** Send the entire session folder to someone else

💡 **Organize by date?** Folders are automatically named with date: `2025-12-04_123456`

💡 **Check storage?** Each MP3 is ~10-30 KB, Text is ~50-500 bytes

---

## Automatic File Saving

Everything is **automatic** - no setup needed!

When you:
1. ✅ Send audio to API
2. ✅ Get text response back
3. ✅ Get audio response back

All files are automatically saved to:
```
responses/<session_id>/
├── text/response_*.txt
├── audio/response_*.mp3
└── metadata_*.json
```

---

## Next Steps

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Send audio via ESP32 or WebSocket**

3. **View responses in web interface:**
   ```
   http://localhost:8888/responses
   ```

4. **Download or listen to files**

---

That's it! 🎉 Responses are automatically saved and organized for you.
