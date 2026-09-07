import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';

interface VoicePromptButtonProps {
  text: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const VoicePromptButton: React.FC<VoicePromptButtonProps> = ({
  text,
  label,
  className = '',
  size = 'md',
}) => {
  const { isSpeaking, speakText, stopSpeaking, isSupported } = useSpeech();

  if (!isSupported) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(text);
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs gap-1.5 min-h-[36px]',
    md: 'p-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'p-3 text-base gap-2.5 min-h-[50px]',
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-200 cursor-pointer ${
        isSpeaking
          ? 'bg-amber-500 text-white shadow-md animate-pulse'
          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
      } ${sizeClasses[size]} ${className}`}
      title={isSpeaking ? 'Stop voice narration' : 'Listen to instructions'}
      aria-label="Read prompt aloud"
    >
      {isSpeaking ? (
        <VolumeX className="w-5 h-5 shrink-0" />
      ) : (
        <Volume2 className="w-5 h-5 shrink-0" />
      )}
      {label && <span className="font-semibold">{label}</span>}
    </button>
  );
};
