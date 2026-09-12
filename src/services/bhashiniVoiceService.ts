/**
 * src/services/bhashiniVoiceService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side Voice Service for MIND SATHI.
 * Records genuine 16000Hz 16-bit Linear PCM WAV audio directly in the browser
 * to guarantee 100% compliance with Bhashini/AI4Bharat Speech ASR models.
 * Never handles or exposes API keys on the client.
 */

import { VoiceLanguage, STTResponse, TTSResponse, NMTResponse, VoiceErrorCode, VOICE_ERROR_MESSAGES } from '../types/voice';
import { speechService } from './speechService';

class BhashiniVoiceService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private isRecordingActive: boolean = false;

  /**
   * Requests microphone permission and begins streaming 16kHz PCM audio
   */
  public async startRecording(_language: VoiceLanguage = 'as'): Promise<void> {
    this.stopPlayback();
    this.cleanupRecording();

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MIC_PERMISSION_DENIED');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('MIC_PERMISSION_DENIED');
      }
      throw new Error('MIC_PERMISSION_DENIED');
    }

    this.mediaStream = stream;
    this.pcmChunks = [];
    this.isRecordingActive = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      // 4096 buffer size provides smooth collection without frame drops
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor = processor;

      processor.onaudioprocess = (e) => {
        if (!this.isRecordingActive) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Clone the float buffer
        this.pcmChunks.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (e) {
      console.warn('[BhashiniVoiceService] AudioContext setup notice:', e);
    }
  }

  /**
   * Stops recording, frees hardware mic tracks immediately, downsamples to 16000Hz,
   * and encodes pure 16-bit mono PCM WAV.
   */
  public async stopRecording(): Promise<{ base64: string; format: string; sizeBytes: number }> {
    this.isRecordingActive = false;

    // Release microphone tracks immediately
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    const inputSampleRate = this.audioContext?.sampleRate || 44100;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // Ignored
      }
      this.audioContext = null;
    }

    if (this.pcmChunks.length === 0) {
      throw new Error('EMPTY_RECORDING');
    }

    // Combine all Float32 chunks
    let totalLength = 0;
    for (const chunk of this.pcmChunks) {
      totalLength += chunk.length;
    }

    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];

    // Check for minimum audio volume and duration (minimum 0.25 seconds)
    if (totalLength < inputSampleRate * 0.25) {
      throw new Error('EMPTY_RECORDING');
    }

    let maxAmp = 0;
    for (let i = 0; i < mergedSamples.length; i++) {
      const abs = Math.abs(mergedSamples[i]);
      if (abs > maxAmp) maxAmp = abs;
    }

    if (maxAmp < 0.005) {
      // Audio is pure silence
      throw new Error('EMPTY_RECORDING');
    }

    // Resample from inputSampleRate (e.g. 48000Hz / 44100Hz) to target 16000Hz
    const targetSampleRate = 16000;
    const resampled = this.resampleAudio(mergedSamples, inputSampleRate, targetSampleRate);

    // Encode standard 16-bit Mono Linear PCM WAV
    const wavBuffer = this.encodeWAV(resampled, targetSampleRate);
    const base64 = this.arrayBufferToBase64(wavBuffer);

    return {
      base64,
      format: 'wav',
      sizeBytes: wavBuffer.byteLength,
    };
  }

  /**
   * Resamples Float32 audio samples using linear interpolation
   */
  private resampleAudio(samples: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (inputRate === outputRate) return samples;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originIndex = i * ratio;
      const indexPrev = Math.floor(originIndex);
      const indexNext = Math.min(indexPrev + 1, samples.length - 1);
      const frac = originIndex - indexPrev;
      result[i] = samples[indexPrev] * (1 - frac) + samples[indexNext] * frac;
    }

    return result;
  }

  /**
   * Encoders Float32 samples into standard RIFF WAVE PCM 16-bit mono buffer
   */
  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (1 = raw linear PCM) */
    view.setUint16(20, 1, true);
    /* channel count (1 = mono) */
    view.setUint16(22, 1, true);
    /* sample rate (16000) */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write 16-bit PCM samples (little-endian)
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Cleans up mic tracks and audio hardware
   */
  public cleanupRecording(): void {
    this.isRecordingActive = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Ignored
      }
      this.audioContext = null;
    }
    this.pcmChunks = [];
  }

  /**
   * Calls internal STT API endpoint
   */
  public async speechToText(
    base64Audio: string,
    language: VoiceLanguage
  ): Promise<{ text: string; isEmpty: boolean }> {
    if (!base64Audio || base64Audio.length < 500) {
      return { text: '', isEmpty: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/bhashini/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioContent: base64Audio,
          language,
          audioFormat: 'wav',
          samplingRate: 16000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data: STTResponse | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Non-JSON response from server (e.g. 500 HTML/text gateway error)
        const err = new Error(
          !response.ok
            ? 'Voice recognition service is temporarily unavailable. Please try again.'
            : VOICE_ERROR_MESSAGES.BHASHINI_ASR_ERROR
        ) as any;
        err.code = 'BHASHINI_ASR_ERROR';
        throw err;
      }

      if (!response.ok || !data || !data.success) {
        const errCode = (data?.error as VoiceErrorCode) || 'BHASHINI_ASR_ERROR';
        const errMessage =
          data?.safeMessage ||
          VOICE_ERROR_MESSAGES[errCode] ||
          VOICE_ERROR_MESSAGES.BHASHINI_ASR_ERROR;
        const error = new Error(errMessage) as any;
        error.code = errCode;
        throw error;
      }

      if (data.isEmpty || !data.text || !data.text.trim()) {
        return { text: '', isEmpty: true };
      }

      return { text: data.text.trim(), isEmpty: false };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(VOICE_ERROR_MESSAGES.TIMEOUT) as any;
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      if (err.message && err.code) {
        throw err;
      }
      const networkErr = new Error(VOICE_ERROR_MESSAGES.NETWORK_ERROR) as any;
      networkErr.code = 'NETWORK_ERROR';
      throw networkErr;
    }
  }

  /**
   * Calls internal Bhashini NMT endpoint (/api/bhashini/translate)
   */
  public async translateWithBhashini(
    text: string,
    sourceLanguage: VoiceLanguage,
    targetLanguage: VoiceLanguage
  ): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }

    if (sourceLanguage === targetLanguage) {
      return text.trim();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/bhashini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sourceLanguage,
          targetLanguage,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data: NMTResponse | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        const err = new Error(VOICE_ERROR_MESSAGES.BHASHINI_NMT_OUTPUT_ERROR) as any;
        err.code = 'BHASHINI_NMT_OUTPUT_ERROR';
        throw err;
      }

      if (!response.ok || !data || !data.success || !data.translatedText) {
        const errCode = (data?.error as VoiceErrorCode) || 'BHASHINI_NMT_OUTPUT_ERROR';
        const errMessage =
          data?.safeMessage ||
          VOICE_ERROR_MESSAGES[errCode] ||
          VOICE_ERROR_MESSAGES.BHASHINI_NMT_OUTPUT_ERROR;
        const error = new Error(errMessage) as any;
        error.code = errCode;
        throw error;
      }

      return data.translatedText.trim();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(VOICE_ERROR_MESSAGES.TIMEOUT) as any;
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      if (err.message && err.code) {
        throw err;
      }
      const networkErr = new Error(VOICE_ERROR_MESSAGES.BHASHINI_NMT_NETWORK_ERROR) as any;
      networkErr.code = 'BHASHINI_NMT_NETWORK_ERROR';
      throw networkErr;
    }
  }

  /**
   * Calls internal TTS API endpoint
   */
  public async textToSpeech(
    text: string,
    language: VoiceLanguage,
    gender: 'female' | 'male' = 'female'
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/bhashini/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          gender,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawText = await response.text();
        try {
          const data: TTSResponse = JSON.parse(rawText);
          if (data && data.success && data.audioContent) {
            return data.audioContent;
          }
        } catch {
          // Ignored non-json
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }

    return null;
  }

  /**
   * Speaks text using Bhashini synthesized audio if available,
   * otherwise seamlessly uses the browser speech synthesis so the patient always hears audio.
   */
  public async speakText(
    text: string,
    language: VoiceLanguage,
    audioBase64?: string | null
  ): Promise<void> {
    this.stopPlayback();

    if (audioBase64) {
      try {
        await this.playAudioBase64(audioBase64);
        return;
      } catch (e) {
        console.warn('[BhashiniVoiceService] AudioElement playback notice, falling back to speechService:', e);
      }
    }

    // Fallback: Browser Web Speech API
    await speechService.speak(text, language, 0.85);
  }

  /**
   * Plays the synthesized audio in the browser
   */
  public async playAudioBase64(audioBase64: string): Promise<void> {
    this.stopPlayback();

    return new Promise((resolve, reject) => {
      try {
        const audioSrc = audioBase64.startsWith('data:')
          ? audioBase64
          : `data:audio/wav;base64,${audioBase64}`;

        const audio = new Audio(audioSrc);
        this.currentAudioElement = audio;

        audio.onended = () => {
          this.currentAudioElement = null;
          resolve();
        };

        audio.onerror = () => {
          this.currentAudioElement = null;
          reject(new Error('AUDIO_PLAYBACK_FAILED'));
        };

        audio.play().catch((playErr) => {
          this.currentAudioElement = null;
          reject(playErr);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stops any currently playing audio
   */
  public stopPlayback(): void {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // Ignored
      }
      this.currentAudioElement = null;
    }
    speechService.stop();
  }
}

export const bhashiniVoiceService = new BhashiniVoiceService();
