import { useState, useEffect } from 'react';
import { SupportedLanguage } from '../types/user';
import { TRANSLATIONS } from '../data/translations';
import { authService } from '../services/authService';

export function useLanguage() {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => {
    return authService.getCurrentUser()?.primaryLanguage || 'hi';
  });

  useEffect(() => {
    const unsub = authService.subscribe((session) => {
      const user = session ? authService.getCurrentUser() : null;
      if (user?.primaryLanguage) {
        setCurrentLang(user.primaryLanguage);
      }
    });
    return unsub;
  }, []);

  const changeLanguage = (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    try {
      authService.updateCurrentUserProfile({ primaryLanguage: lang });
    } catch {
      // Ignored if not authenticated
    }
  };

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  return {
    currentLang,
    changeLanguage,
    t,
  };
}
