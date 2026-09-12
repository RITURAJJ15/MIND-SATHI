/**
 * src/services/bhashiniVoiceService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend client service for Bhashini Multilingual Speech AI.
 * Communicates ONLY with our internal server endpoints (/api/bhashini/*).
 * Never touches or handles API secrets on the client side.
 */

import { VoiceLanguage, STTResponse, TTSResponse } from '../types/voice';

class BhashiniVoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;

  /**
   * Detects the best browser-supported recording MIME type
   */
  public getSupportedMimeType(): { mimeType: string; format: string } {
    if (typeof MediaRecorder === 'undefined') {
      return { mimeType: 'audio/webm', format: 'webm' };
    }

    const types = [
      { mimeType: 'audio/webm;codecs=opus', format: 'webm' },
      { mimeType: 'audio/webm', format: 'webm' },
      { mimeType: 'audio/mp4', format: 'mp4' },
      { mimeType: 'audio/ogg;codecs=opus', format: 'ogg' },
      { mimeType: 'audio/wav', format: 'wav' },
    ];

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t.mimeType)) {
        return t;
      }
    }

    return { mimeType: '', format: 'wav' };
  }

  /**
   * Requests microphone access and begins recording audio
   */
  public async startRecording(): Promise<void> {
    this.stopPlayback();
    this.cleanupRecording();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MIC_UNAVAILABLE');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('MIC_PERMISSION_DENIED');
      }
      throw new Error('MIC_UNAVAILABLE');
    }

    this.mediaStream = stream;
    this.audioChunks = [];

    const { mimeType } = this.getSupportedMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch {
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Collect in 250ms chunks
  }

  /**
   * Stops recording, releases microphone tracks immediately,
   * and returns the compiled audio as Base64.
   */
  public async stopRecording(): Promise<{ base64: string; format: string; blob: Blob }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        this.cleanupRecording();
        return reject(new Error('NOT_RECORDING'));
      }

      const { format } = this.getSupportedMimeType();

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          this.cleanupRecording();

          if (blob.size < 500) {
            return reject(new Error('NO_SPEECH_DETECTED'));
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
            resolve({ base64, format, blob });
          };
          reader.onerror = () => reject(new Error('AUDIO_CONVERSION_FAILED'));
          reader.readAsDataURL(blob);
        } catch (e) {
          this.cleanupRecording();
          reject(e);
        }
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        this.cleanupRecording();
        reject(new Error('RECORDER_ALREADY_INACTIVE'));
      }
    });
  }

  /**
   * Releases microphone tracks and frees hardware resource
   */
  public cleanupRecording(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Calls internal STT API endpoint
   */
  public async speechToText(base64Audio: string, language: VoiceLanguage, format: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/bhashini/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioContent: base64Audio,
          language,
          audioFormat: format,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: STTResponse = await response.json();
      if (!response.ok || !data.success) {
        if (data.error === 'VOICE_SERVICE_NOT_CONFIGURED') {
          throw new Error('SERVICE_UNAVAILABLE');
        }
        if (data.error === 'NO_SPEECH_RECOGNIZED') {
          throw new Error('NO_SPEECH_DETECTED');
        }
        throw new Error('STT_FAILED');
      }

      if (!data.text || !data.text.trim()) {
        throw new Error('NO_SPEECH_DETECTED');
      }

      return data.text.trim();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('STT_TIMEOUT');
      }
      throw err;
    }
  }

  /**
   * Calls internal TTS API endpoint
   */
  public async textToSpeech(text: string, language: VoiceLanguage, gender: 'female' | 'male' = 'female'): Promise<string> {
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

      const data: TTSResponse = await response.json();
      if (!response.ok || !data.success || !data.audioContent) {
        if (data.error === 'VOICE_SERVICE_NOT_CONFIGURED') {
          throw new Error('SERVICE_UNAVAILABLE');
        }
        throw new Error('TTS_FAILED');
      }

      return data.audioContent;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('TTS_TIMEOUT');
      }
      throw err;
    }
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
  }
}

export const bhashiniVoiceService = new BhashiniVoiceService();
