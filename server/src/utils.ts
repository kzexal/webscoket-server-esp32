/**
 * Audio conversion utilities for handling PCM and base64 encoding
 */

/**
 * Converts Float32Array audio data to 16-bit PCM ArrayBuffer
 */
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  
  for (let i = 0; i < float32Array.length; i++) {
    const offset = i * 2;
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  
  return buffer;
}

/**
 * Converts Float32Array audio data to base64-encoded PCM16
 */
export function base64EncodeAudio(float32Array: Float32Array): string {
  const arrayBuffer = floatTo16BitPCM(float32Array);
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  
  // Process in 32KB chunks to avoid call stack size limits
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

interface ConversationItem {
  type: 'conversation.item.create';
  item: {
    type: 'message';
    role: 'user';
    content: Array<{
      type: 'input_audio' | 'input_text';
      audio?: string;
      text?: string;
    }>;
  };
}

/**
 * Converts audio buffer to conversation item create event
 */
export async function audioToItemCreateEvent(audioBuffer: Buffer): Promise<ConversationItem> {
  const base64AudioData = audioBuffer.toString('base64');
  
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_audio',
        audio: base64AudioData
      }]
    }
  };
}

/**
 * Converts text to conversation item create event
 */
export function textToItemCreateEvent(text: string): ConversationItem {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user', 
      content: [{
        type: 'input_text',
        text
      }]
    }
  };
}
