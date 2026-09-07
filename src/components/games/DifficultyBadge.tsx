import React from 'react';
import { DifficultyTier } from '../../types/game';
import { useLanguage } from '../../hooks/useLanguage';

interface DifficultyBadgeProps {
  difficulty: DifficultyTier;
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty, className = '' }) => {
  const { currentLang } = useLanguage();

  const config: Record<
    DifficultyTier,
    { label: { en: string; hi: string; as: string; [key: string]: string }; color: string; border: string }
  > = {
    saral: {
      label: { en: 'Saral (Easy)', hi: 'सरल', as: 'সহজ' },
      color: 'bg-emerald-100 text-emerald-900',
      border: 'border-emerald-300',
    },
    madhyam: {
      label: { en: 'Madhyam (Medium)', hi: 'मध्यम', as: 'মধ্যম' },
      color: 'bg-amber-100 text-amber-900',
      border: 'border-amber-300',
    },
    nipun: {
      label: { en: 'Nipun (Advanced)', hi: 'निपुण', as: 'নিপুণ' },
      color: 'bg-purple-100 text-purple-900',
      border: 'border-purple-300',
    },
  };

  const item = config[difficulty];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-bold border ${item.color} ${item.border} ${className}`}
    >
      {item.label[currentLang] || item.label.en}
    </span>
  );
};
