#ifndef LIB_SPEAKER_H
#define LIB_SPEAKER_H

#include <Audio.h>
#include <Arduino.h>
// #include "audioBuffer.h"
enum AudioMode {
  MODE_MIC,
  MODE_SPK
};
void InitI2SSpeakerOrMic(AudioMode mode);
esp_err_t setupSpeakerI2S();
void loopAudio();
void setupAudio();
void generateTone(int16_t *buffer, size_t samples);
void writeToAudioBuffer(int16_t *buffer, size_t samples);
void playBuffer(int16_t *buffer, size_t samples);
void handleSpeaker();
void playBufferWithOffset(uint8_t *payload, size_t length);
void speaker_play(uint8_t *payload, uint32_t len);

extern unsigned long lastMicActivity;
extern unsigned long lastSpkrActivity; 
extern unsigned long lastToneTime;
extern bool isPlayingTone;
extern unsigned long toneStartTime;

#endif
