# Response File Saving - User Guide

## Overview

The Zhipu Voice Assistant automatically saves all audio and text responses to files for easy access and review. No configuration needed - it works automatically!

---

## 📁 File Organization

All responses are organized in the following structure:

```
responses/
├── 2025-12-04_123456/           (Session folder - one per session)
│   ├── audio/                    (Audio files from API responses)
│   │   ├── response_2025-12-04T12-34-56.mp3
│   │   ├── response_2025-12-04T12-35-10.mp3
│   │   └── ...
│   ├── text/                     (Text responses)
│   │   ├── response_2025-12-04T12-34-56.txt
│   │   ├── response_2025-12-04T12-35-10.txt
│   │   └── ...
│   ├── metadata_2025-12-04T12-34-56.json    (Response metadata)
│   ├── metadata_2025-12-04T12-35-10.json
│   ├── session_summary.json      (Session overview)
│   └── index.md                  (Session index file)
└── 2025-12-03_654321/
    └── ...
```

---

## 🎯 File Formats

### Audio Files (MP3)
- **Format:** MP3 (compressed audio)
- **Location:** `responses/<session_id>/audio/`
- **Naming:** `response_<timestamp>.mp3`
- **Size:** ~5-50 KB per response (compressed)
- **Quality:** Voice-optimized
- **Playable in:** All browsers, media players, phones

**Example:**
```
responses/2025-12-04_123456/audio/response_2025-12-04T12-34-56.mp3
```

### Text Files (TXT)
- **Format:** Plain text (UTF-8)
- **Location:** `responses/<session_id>/text/`
- **Naming:** `response_<timestamp>.txt`
- **Content:** Chinese response text from Zhipu API
- **Editable:** Yes, any text editor

**Example:**
```
responses/2025-12-04_123456/text/response_2025-12-04T12-34-56.txt
```

### Metadata (JSON)
- **Format:** JSON format
- **Location:** `responses/<session_id>/`
- **Naming:** `metadata_<timestamp>.json`
- **Content:**
  - Timestamp
  - Audio file path
  - Text content
  - File sizes
  - Session info

**Example:**
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

## 🌐 Web Interface - Response Viewer

### Access the Viewer
Open your browser and go to:
```
http://localhost:8888/responses
```

### Features

#### 1. **View All Sessions**
- Lists all response sessions
- Shows count of audio and text files
- Shows creation date
- Click a session to view its responses

#### 2. **View Session Responses**
- Audio files with built-in player
- Text content in textarea
- Download buttons for each file
- Metadata viewing

#### 3. **Download Files**
- **Download TXT:** Click "💾 Download TXT" button
- **Download Audio:** Click "💾 Download Audio" button
- Files download to your Downloads folder

#### 4. **Play Audio**
- Click play button on audio player
- Adjust volume
- Show progress timeline

---

## 📡 REST API Endpoints

### 1. Get All Sessions
```
GET /api/sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "2025-12-04_123456",
      "audioCount": 5,
      "textCount": 5,
      "createdAt": "2025-12-04"
    }
  ]
}
```

### 2. Get Session Details
```
GET /api/sessions/{sessionId}
```

**Response:**
```json
{
  "sessionId": "2025-12-04_123456",
  "responses": [
    {
      "index": 1,
      "audio": "response_2025-12-04T12-34-56.mp3",
      "text": "response_2025-12-04T12-34-56.txt",
      "metadata": "metadata_2025-12-04T12-34-56.json"
    }
  ],
  "summary": {
    "totalResponses": 5,
    "audioCount": 5,
    "textCount": 5
  }
}
```

### 3. Get Text Content
```
GET /api/responses/text/{sessionId}/{filename}
```

**Response:**
```json
{
  "content": "你好，我是智谱清言。有什么我可以帮助你的吗？"
}
```

### 4. Download Audio File
```
GET /api/responses/audio/{sessionId}/{filename}
```

**Returns:** Binary MP3 audio data

### 5. Get Metadata
```
GET /api/responses/metadata/{sessionId}/{filename}
```

**Response:** JSON metadata object

---

## 💾 How to Use Saved Files

### Option 1: Web Interface (Recommended)
1. Open browser → `http://localhost:8888/responses`
2. Click on a session
3. Play audio or read text
4. Click download buttons to save files

### Option 2: File Explorer
1. Open: `C:\Users\<your-user>\Downloads\code\esp32-realtime-voice-assistant\responses\`
2. Navigate to session folder
3. Go to `audio/` or `text/` folder
4. Open files with any program

### Option 3: Command Line
```bash
# Navigate to responses directory
cd responses/2025-12-04_123456

# List all audio files
ls audio/

# List all text files
ls text/

# View text content
cat text/response_2025-12-04T12-34-56.txt

# Play audio (Windows)
start audio/response_2025-12-04T12-34-56.mp3
```

---

## 🔍 File Details

### Audio File Info
```
File:        response_2025-12-04T12-34-56.mp3
Format:      MP3 (MPEG Layer III)
Size:        ~12-30 KB
Duration:    3-5 seconds (typical)
Channels:    Mono
Sample Rate: 24000 Hz
Bitrate:     ~32-64 kbps
Codec:       MPEG1 Layer 3
```

### Text File Info
```
File:        response_2025-12-04T12-34-56.txt
Encoding:    UTF-8
Language:    Chinese (Chinese response from Zhipu API)
Size:        50-500 bytes
Format:      Plain text
Editable:    Yes
```

---

## 📊 Session Statistics

The system automatically tracks:
- Total responses per session
- Audio count
- Text count
- Total audio size
- Total text size
- Session creation time

Access statistics via API:
```
GET /api/sessions/{sessionId}
```

---

## 🗑️ Cleanup / Delete Responses

### Delete a Single Response
```bash
# Navigate to session folder
cd responses/2025-12-04_123456

# Delete specific response
rm audio/response_2025-12-04T12-34-56.mp3
rm text/response_2025-12-04T12-34-56.txt
rm metadata_2025-12-04T12-34-56.json
```

### Delete Entire Session
```bash
# Delete complete session folder
rm -r responses/2025-12-04_123456
```

### Delete All Sessions
```bash
# CAUTION: This deletes ALL saved responses
rm -r responses/
```

---

## ⚙️ Configuration

The response saving is **automatic** with default settings. To customize:

### Edit Response Directory
In `zhipu_agent.ts`:
```typescript
this.responseSaver = new ResponseSaver('custom-folder');
```

### Save Different Audio Format
In response saving code:
```typescript
// Save as WAV instead of MP3
this.responseSaver.saveAudioResponse(audioData, 'wav');
```

### Disable Response Saving
Comment out in `zhipu_agent.ts`:
```typescript
// this.responseSaver.saveCompleteResponse(responseText, audioData);
```

---

## 🐛 Troubleshooting

### Issue: Files not appearing
**Solution:**
- Restart the server
- Check server logs for errors
- Verify permissions on `responses/` folder

### Issue: Can't access web interface
**Solution:**
- Ensure server is running on port 8888
- Try: `http://localhost:8888/responses`
- Check firewall settings

### Issue: Audio files won't play
**Solution:**
- Use MP3 format (default)
- Check browser supports audio element
- Try different browser
- Verify file is not corrupted

### Issue: Text encoding problems
**Solution:**
- Files are UTF-8 encoded
- Open with: VSCode, Notepad++, or any modern editor
- Don't use old Notepad

---

## 📈 Performance Notes

- **Audio Files:** ~5-30 KB each (MP3 compressed)
- **Text Files:** ~50-500 bytes each
- **Metadata:** ~100-200 bytes each
- **Storage:** ~1 GB can store ~20,000+ responses
- **Speed:** No performance impact on API responses

---

## 🔒 Security

- All files are stored **locally** on your machine
- No data sent to external services
- File permissions inherit from system
- No encryption by default
- API endpoints check file paths for safety

---

## 📝 Examples

### View all responses from today
```bash
cd responses/2025-12-04_*
ls -la
```

### Count total responses
```bash
cd responses/
find . -name "response_*.txt" | wc -l
```

### Export all text responses
```bash
# Combine all text into one file
cat responses/2025-12-04_*/text/*.txt > all_responses.txt
```

### Create backup
```bash
# Backup all responses
cp -r responses responses_backup_$(date +%Y%m%d)
```

---

## 🎯 Summary

✅ **Text responses** → Saved as `.txt` files  
✅ **Audio responses** → Saved as `.mp3` files  
✅ **Metadata** → Saved as `.json` files  
✅ **Web interface** → View at `/responses`  
✅ **API access** → Available at `/api/responses/`  
✅ **Download** → One-click download buttons  
✅ **Organization** → Auto-organized by session and date  
✅ **No configuration** → Works automatically!

Start using it now! Open your browser to `http://localhost:8888/responses` after running the server.
