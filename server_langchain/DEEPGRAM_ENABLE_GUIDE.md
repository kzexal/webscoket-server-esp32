# Hướng dẫn Bật Lại Deepgram STT

## Trạng thái hiện tại
Deepgram STT đã được **TẮT TẠM THỜI** để tránh lỗi kết nối. Hệ thống hiện đang sử dụng placeholder text thay vì chuyển đổi audio thành text.

## Cách Bật Lại Deepgram STT

### Bước 1: Mở file `src/lib/zhipu_agent.ts`

Tìm đoạn code này (khoảng dòng 241-259):

```typescript
// ============================================
// DEEPGRAM STT ĐÃ TẮT TẠM THỜI
// Để bật lại, xem file: DEEPGRAM_ENABLE_GUIDE.md
// ============================================

// Chuyển audio thành text sử dụng Deepgram STT
// console.log(`🎙️  Converting audio to text using Deepgram STT...`);
// let sttResult: { transcript: string; language: string };
// 
// try {
//     sttResult = await audioToText(audioBuffer, audioFormat);
//     console.log(`✅ User said: ${sttResult.transcript}`);
//     console.log(`🌐 Detected language: ${sttResult.language}`);
// } catch (sttError: any) {
//     console.error('❌ Error converting audio to text:', sttError.message);
//     broadcastToClients(JSON.stringify({
//         type: 'error',
//         message: `STT failed: ${sttError.message}`
//     }));
//     return;
// }
// 
// const userText = sttResult.transcript;
// const detectedLanguage = sttResult.language;

// FALLBACK: Sử dụng placeholder text khi Deepgram STT tắt
console.log(`⚠️  Deepgram STT is disabled. Using placeholder text.`);
console.log(`💡 To enable Deepgram STT, see: DEEPGRAM_ENABLE_GUIDE.md`);
const userText = "Hello, please respond to this audio message.";
const detectedLanguage = 'en';
```

**Thay thế bằng:**

```typescript
// Chuyển audio thành text sử dụng Deepgram STT
console.log(`🎙️  Converting audio to text using Deepgram STT...`);
let sttResult: { transcript: string; language: string };

try {
    sttResult = await audioToText(audioBuffer, audioFormat);
    console.log(`✅ User said: ${sttResult.transcript}`);
    console.log(`🌐 Detected language: ${sttResult.language}`);
} catch (sttError: any) {
    console.error('❌ Error converting audio to text:', sttError.message);
    broadcastToClients(JSON.stringify({
        type: 'error',
        message: `STT failed: ${sttError.message}`
    }));
    return;
}

const userText = sttResult.transcript;
const detectedLanguage = sttResult.language;
```

### Bước 2: Mở file `src/index.ts`

Tìm đoạn code tương tự (khoảng dòng 241-257) và thay thế giống như Bước 1.

### Bước 3: Bỏ comment import statement

Trong file `src/lib/zhipu_agent.ts`, tìm dòng:

```typescript
// import { audioToText } from "./deepgram_stt"; // DEEPGRAM STT ĐÃ TẮT - Xem DEEPGRAM_ENABLE_GUIDE.md
```

**Thay bằng:**

```typescript
import { audioToText } from "./deepgram_stt";
```

Trong file `src/index.ts`, tìm dòng:

```typescript
// import { audioToText } from "./lib/deepgram_stt"; // DEEPGRAM STT ĐÃ TẮT - Xem DEEPGRAM_ENABLE_GUIDE.md
```

**Thay bằng:**

```typescript
import { audioToText } from "./lib/deepgram_stt";
```

### Bước 4: Kiểm tra cài đặt Deepgram

Đảm bảo Deepgram package đã được cài đặt:

```bash
# Windows
py -3 -m pip install deepgram

# Linux/Mac
pip3 install deepgram
```

### Bước 5: Kiểm tra API Key

Mở file `recordings/stt_deepgram.py` và kiểm tra API key:

```python
DEEPGRAM_API_KEY = "your_api_key_here"
```

Nếu cần, cập nhật API key của bạn.

### Bước 6: Khởi động lại server

```bash
npm run dev
```

## Kiểm tra

Sau khi bật lại, bạn sẽ thấy log:
```
🎙️  Converting audio to text using Deepgram STT...
✅ User said: [transcript text]
🌐 Detected language: [language code]
```

## Lưu ý

- Nếu gặp lỗi `ECONNRESET` hoặc kết nối không ổn định, có thể tắt lại Deepgram STT bằng cách làm ngược lại các bước trên.
- Khi Deepgram STT tắt, hệ thống sẽ sử dụng placeholder text, vì vậy AI response có thể không chính xác.

## Troubleshooting

### Lỗi "ModuleNotFoundError: No module named 'deepgram'"
→ Chạy: `py -3 -m pip install deepgram`

### Lỗi "Deepgram STT script not found"
→ Kiểm tra file `recordings/stt_deepgram.py` có tồn tại không

### Lỗi "ECONNRESET" hoặc kết nối bị reset
→ Có thể do mạng không ổn định hoặc Deepgram API tạm thời gặp vấn đề. Thử lại sau hoặc tắt Deepgram STT tạm thời.


