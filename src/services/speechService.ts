import { SupportedLanguage } from '../types/user';

class SpeechService {
  private isSpeakingState: boolean = false;
  private isPausedState: boolean = false;
  private currentVolume: number = 1.0;
  private currentRate: number = 0.85;
  private listeners: Set<(isSpeaking: boolean, isPaused: boolean) => void> = new Set();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public subscribe(callback: (isSpeaking: boolean, isPaused: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.isSpeakingState, this.isPausedState));
  }

  public stop() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    this.isSpeakingState = false;
    this.isPausedState = false;
    this.notify();
  }

  public pause() {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
    this.isPausedState = true;
    this.notify();
  }

  public resume() {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
    this.isPausedState = false;
    this.notify();
  }

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
  }

  public setRate(rate: number) {
    this.currentRate = Math.max(0.5, Math.min(1.5, rate));
  }

  public speak(text: string, lang: SupportedLanguage = 'en', rate?: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isSupported() || !text) {
        resolve();
        return;
      }

      this.stop();

      const cleanText = text.replace(/[*_~#]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = rate || this.currentRate;
      utterance.volume = this.currentVolume;
      utterance.pitch = 1.0;

      // Map application language to BCP 47 language tag
      let langTag = 'en-IN';
      switch (lang) {
        case 'hi':  langTag = 'hi-IN'; break;
        case 'as':  langTag = 'as-IN'; break;
        case 'bn':  langTag = 'bn-IN'; break;
        case 'mni': langTag = 'mni-IN'; break;
        case 'lus': langTag = 'en-IN'; break; // Mizo tone fallback
        case 'kha': langTag = 'en-IN'; break; // Khasi tone fallback
        case 'grt': langTag = 'en-IN'; break; // Garo tone fallback
        case 'brx': langTag = 'hi-IN'; break; // Bodo Devanagari script voice
        default:    langTag = 'en-IN'; break;
      }

      utterance.lang = langTag;

      // Attempt to find natural Indian voices
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const matchingVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(langTag.toLowerCase()) ||
            (lang === 'hi' && v.lang.includes('hi')) ||
            (lang === 'bn' && v.lang.includes('bn')) ||
            (lang === 'as' && (v.lang.includes('as') || v.lang.includes('bn'))) ||
            v.lang.includes('en-IN')
        );
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onstart = () => {
        this.isSpeakingState = true;
        this.isPausedState = false;
        this.notify();
      };

      utterance.onend = () => {
        this.isSpeakingState = false;
        this.isPausedState = false;
        this.notify();
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeakingState = false;
        this.isPausedState = false;
        this.notify();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }
}

export const speechService = new SpeechService();
