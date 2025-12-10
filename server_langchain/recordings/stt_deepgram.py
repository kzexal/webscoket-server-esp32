import os
import sys
import time
from deepgram import Deepgram

# Ensure UTF-8 output for console
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

DEEPGRAM_API_KEY = "6ab4105de223f75cd42053f01b31dee07e4c396e"

def transcribe_audio(file_path):
    if not os.path.exists(file_path):
        return f"Error: File '{file_path}' not found."

    try:
        dg_client = Deepgram(DEEPGRAM_API_KEY)

        with open(file_path, 'rb') as audio:
            source = {'buffer': audio, 'mimetype': 'audio/mp3'}
            
            response = dg_client.transcription.sync_prerecorded(source, {
                'punctuate': True,
                'detect_language': True,
                'model': 'nova-2',
                'smart_format': True,
                'keywords': ['Huy:2', 'Khánh:2', 'Dũng:2', 'ESP32:2', 'OpenAI:2']
            })

            if 'results' in response:
                transcript = response['results']['channels'][0]['alternatives'][0]['transcript']
                detected_lang = response['results']['channels'][0]['detected_language']
                # Trả về cả transcript và detected language dưới dạng JSON
                import json
                return json.dumps({
                    'transcript': transcript,
                    'language': detected_lang
                }, ensure_ascii=False)
            else:
                return f"Error: {response}"

    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = "tieng viet.mp3"
    
    start_time = time.time()
    result = transcribe_audio(filename)
    
    # Output format để dễ parse từ Node.js
    if result.startswith("Error:"):
        print(result, file=sys.stderr)
        sys.exit(1)
    else:
        # In JSON với transcript và language
        print(result.strip())
        # Time info vào stderr để không làm nhiễu stdout
        print(f"Time: {time.time() - start_time:.2f}s", file=sys.stderr)