import os
import sys
import pyttsx3

# Initialize the engine once
try:
    engine = pyttsx3.init()
except Exception as e:
    print(f"Error initializing pyttsx3: {e}")
    engine = None

def get_available_voices():
    """Helper to print available voices ID"""
    if not engine:
        return []
    voices = engine.getProperty('voices')
    voice_list = []
    for voice in voices:
        print(f"ID: {voice.id} - Name: {voice.name}")
        voice_list.append(voice)
    return voice_list

def text_to_speech(text, output_filename="response_audio.wav"):
    """
    Converts text to speech using offline engine (SAPI5 on Windows).
    Saves to file instead of playing immediately.
    """
    if not engine:
        print("ERROR: pyttsx3 engine not initialized", file=sys.stderr)
        return None
    
    if not text:
        print("ERROR: Text is empty", file=sys.stderr)
        return None

    try:
        print(f"Generating audio for: {text[:30]}...")
        
        # --- CONFIGURATION ---
        # 1. Speed (Rate): Default is 200, lower is slower
        engine.setProperty('rate', 170) 
        
        # 2. Volume: 0.0 to 1.0
        engine.setProperty('volume', 1.0)

        # 3. Voice Selection
        # Windows usually provides Microsoft David (Eng) and Microsoft An (Vietnamese - if installed)
        voices = engine.getProperty('voices')
        
        # Simple logic to select voice based on text content (optional)
        # By default, index 0 is usually English, index 1 might be Vietnamese if installed
        # You can force specific ID from get_available_voices()
        
        # Uncomment to force a specific voice ID (Run get_available_voices first to find ID)
        # engine.setProperty('voice', voices[1].id) 

        # Save to file
        # Note: pyttsx3 on Windows usually saves as .wav
        engine.save_to_file(text, output_filename)
        
        # Must run this to process the command
        engine.runAndWait()
        
        if os.path.exists(output_filename):
            file_size = os.path.getsize(output_filename)
            if file_size > 0:
                print(f"SUCCESS:{output_filename}")
                return output_filename
            else:
                print(f"ERROR: Output file is empty (size: {file_size} bytes)", file=sys.stderr)
                return None
        else:
            print("ERROR: File not created", file=sys.stderr)
            return None

    except Exception as e:
        print(f"ERROR: Error in pyttsx3: {e}", file=sys.stderr)
        return None

# --- MAIN BLOCK ---
if __name__ == "__main__":
    # Đọc text từ stdin nếu có, nếu không thì đọc từ argv
    if not sys.stdin.isatty():
        # Có dữ liệu từ stdin
        try:
            text = sys.stdin.buffer.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f"ERROR: Failed to read stdin: {e}", file=sys.stderr)
            sys.exit(1)
            
        if len(sys.argv) < 2:
            print("Usage: python tts_local.py <output_file> < text.txt", file=sys.stderr)
            sys.exit(1)
        output_file = sys.argv[1]
    else:
        # Đọc từ command line arguments (backward compatibility)
        if len(sys.argv) < 3:
            print("Usage: python tts_local.py <text> <output_file>", file=sys.stderr)
            print("   or: python tts_local.py <output_file> < text.txt", file=sys.stderr)
            sys.exit(1)
        text = sys.argv[1]
        output_file = sys.argv[2]
    
    # Clean text - remove null bytes và các ký tự không hợp lệ
    text = text.replace('\x00', '').strip()
    
    # Chạy TTS
    result = text_to_speech(text, output_file)
    sys.exit(0 if result else 1)