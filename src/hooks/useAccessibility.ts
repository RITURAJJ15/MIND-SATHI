import { useState, useEffect } from 'react';
import { AccessibilitySettings } from '../types/user';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { soundService } from '../services/soundService';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: 'normal',
  highContrast: false,
  textToSpeechAuto: false,
  soundEffects: true,
  speechRate: 1.0,
};

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    return authService.getCurrentUser()?.accessibility ?? DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const unsub = authService.subscribe((session) => {
      const user = session ? authService.getCurrentUser() : null;
      setSettings(user?.accessibility ?? DEFAULT_SETTINGS);
    });
    return unsub;
  }, []);

  // Update HTML body classes for global typography scaling and contrast
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-normal', 'font-large', 'font-extralarge', 'high-contrast');

    if (settings.fontSize === 'large') {
      root.classList.add('font-large');
    } else if (settings.fontSize === 'extralarge') {
      root.classList.add('font-extralarge');
    } else {
      root.classList.add('font-normal');
    }

    if (settings.highContrast) {
      root.classList.add('high-contrast');
    }

    soundService.setSoundEnabled(settings.soundEffects);
  }, [settings]);

  const setFontSize = (fontSize: AccessibilitySettings['fontSize']) => {
    const updated = profileService.updateAccessibility({ fontSize });
    setSettings(updated.accessibility);
  };

  const toggleHighContrast = () => {
    const updated = profileService.updateAccessibility({ highContrast: !settings.highContrast });
    setSettings(updated.accessibility);
  };

  const toggleSound = () => {
    const updated = profileService.updateAccessibility({ soundEffects: !settings.soundEffects });
    setSettings(updated.accessibility);
  };

  return {
    settings,
    setFontSize,
    toggleHighContrast,
    toggleSound,
  };
}
