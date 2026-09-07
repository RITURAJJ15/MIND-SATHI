import { useState, useEffect, useCallback } from 'react';
import { speechService } from '../services/speechService';
import { useLanguage } from './useLanguage';
import { authService } from '../services/authService';
import { SupportedLanguage } from '../types/user';

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(speechService.isSpeaking());
  const [isPaused, setIsPaused] = useState<boolean>(speechService.isPaused());
  const [volume, setVolumeState] = useState<number>(1.0);
  const [rate, setRateState] = useState<number>(0.85);
  const { currentLang } = useLanguage();

  useEffect(() => {
    const unsub = speechService.subscribe((speaking, paused) => {
      setIsSpeaking(speaking);
      setIsPaused(paused);
    });
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  const speakText = useCallback((text: string, customLang?: SupportedLanguage) => {
    const user = authService.getCurrentUser();
    const lang = customLang || currentLang;
    const speechRate = user?.accessibility?.speechRate || rate || 0.85;
    speechService.speak(text, lang, speechRate);
  }, [currentLang, rate]);

  const pauseSpeaking = useCallback(() => {
    speechService.pause();
  }, []);

  const resumeSpeaking = useCallback(() => {
    speechService.resume();
  }, []);

  const stopSpeaking = useCallback(() => {
    speechService.stop();
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    speechService.setVolume(val);
  }, []);

  const setSpeechRate = useCallback((val: number) => {
    setRateState(val);
    speechService.setRate(val);
  }, []);

  return {
    isSpeaking,
    isPaused,
    volume,
    rate,
    speakText,
    // Aliases used across the codebase
    speak: speakText,
    cancel: stopSpeaking,
    stop: stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    setVolume,
    setSpeechRate,
    isSupported: speechService.isSupported(),
  };
}
