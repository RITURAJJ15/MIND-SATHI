/**
 * src/services/bhashiniVoiceService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend client service for Bhashini Multilingual Speech AI.
 * Communicates ONLY with internal server endpoints (/api/bhashini/*).
 * Includes seamless browser Web Speech API fallbacks (SpeechRecognition & SpeechSynthesis)
 * to guarantee that speech interaction ALWAYS succeeds without throwing breaking error notices.
 */

import { VoiceLanguage, STTResponse, TTSResponse } from '../types/voice';
import { speechService } from './speechService';

class BhashiniVoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private browserRecognition: any = null;
  private browserTranscript: string = '';

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
   * Requests microphone access and begins recording audio.
   * Also spins up browser speech recognition as a resilient fallback.
   */
  public async startRecording(language: VoiceLanguage = 'as'): Promise<void> {
    this.stopPlayback();
    this.cleanupRecording();
    this.browserTranscript = '';

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

    this.mediaRecorder.start(250);

    // Optional parallel browser SpeechRecognition fallback
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        let langCode = 'en-IN';
        if (language === 'hi') langCode = 'hi-IN';
        else if (language === 'bn') langCode = 'bn-IN';
        else if (language === 'as') langCode = 'as-IN';
        recognition.lang = langCode;

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          this.browserTranscript = current;
        };

        recognition.onerror = () => {
          // Non-blocking fallback
        };

        recognition.start();
        this.browserRecognition = recognition;
      }
    } catch {
      // Ignored non-blocking
    }
  }

  /**
   * Stops recording, releases microphone tracks immediately,
   * and returns the compiled audio as Base64.
   */
  public async stopRecording(): Promise<{ base64: string; format: string; blob: Blob }> {
    return new Promise((resolve, reject) => {
      // Stop browser recognition if active
      if (this.browserRecognition) {
        try {
          this.browserRecognition.stop();
        } catch {
          // Ignored
        }
      }

      if (!this.mediaRecorder) {
        this.cleanupRecording();
        return reject(new Error('NOT_RECORDING'));
      }

      const { format } = this.getSupportedMimeType();

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.cleanupRecording();

          if (blob.size < 500 && !this.browserTranscript) {
            return reject(new Error('NO_SPEECH_DETECTED'));
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
            resolve({ base64, format, blob });
          };
          reader.onerror = () => {
            if (this.browserTranscript) {
              resolve({ base64: '', format, blob });
            } else {
              reject(new Error('AUDIO_CONVERSION_FAILED'));
            }
          };
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
        if (this.browserTranscript) {
          resolve({ base64: '', format, blob: new Blob() });
        } else {
          reject(new Error('RECORDER_ALREADY_INACTIVE'));
        }
      }
    });
  }

  /**
   * Releases microphone tracks and frees hardware resource
   */
  public cleanupRecording(): void {
    if (this.browserRecognition) {
      try {
        this.browserRecognition.stop();
      } catch {
        // Ignored
      }
      this.browserRecognition = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Calls internal STT API endpoint with automatic browser SpeechRecognition fallback
   */
  public async speechToText(
    base64Audio: string,
    language: VoiceLanguage,
    format: string
  ): Promise<string> {
    // 1. Try Bhashini ASR endpoint first if base64 audio is present
    if (base64Audio) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

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

        if (response.ok) {
          const data: STTResponse = await response.json();
          if (data.success && data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch {
        clearTimeout(timeoutId);
        // Fall through to browser transcript fallback
      }
    }

    // 2. Browser SpeechRecognition Fallback
    if (this.browserTranscript && this.browserTranscript.trim()) {
      return this.browserTranscript.trim();
    }

    throw new Error('NO_SPEECH_DETECTED');
  }

  /**
   * Calls internal TTS API endpoint. If Bhashini TTS is unconfigured or fails,
   * returns null so the UI can seamlessly speak via browser SpeechSynthesis.
   */
  public async textToSpeech(
    text: string,
    language: VoiceLanguage,
    gender: 'female' | 'male' = 'female'
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        const data: TTSResponse = await response.json();
        if (data.success && data.audioContent) {
          return data.audioContent;
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }

    // Graceful fallback: return null so caller falls back to native Web Speech
    return null;
  }

  /**
   * Speaks text using Bhashini synthesized audio if available,
   * otherwise seamlessly uses the browser speech synthesis.
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
        console.warn('[BhashiniVoiceService] Audio element playback notice, falling back to speechService:', e);
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
   * Stops any currently playing audio (HTMLAudioElement or Web Speech)
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
