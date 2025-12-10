"use strict";
/**
 * Audio conversion utilities for handling PCM and base64 encoding
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.floatTo16BitPCM = floatTo16BitPCM;
exports.base64EncodeAudio = base64EncodeAudio;
exports.audioToItemCreateEvent = audioToItemCreateEvent;
exports.textToItemCreateEvent = textToItemCreateEvent;
/**
 * Converts Float32Array audio data to 16-bit PCM ArrayBuffer
 */
function floatTo16BitPCM(float32Array) {
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
function base64EncodeAudio(float32Array) {
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
/**
 * Converts audio buffer to conversation item create event
 */
function audioToItemCreateEvent(audioBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
/**
 * Converts text to conversation item create event
 */
function textToItemCreateEvent(text) {
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
