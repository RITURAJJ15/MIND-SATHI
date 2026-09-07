import React, { useState } from 'react';
import { useSpeech } from '../../hooks/useSpeech';
import { useLanguage } from '../../hooks/useLanguage';
import { Volume2, VolumeX, Play, Pause, Square, Gauge, Sliders } from 'lucide-react';

interface TTSControlsProps {
  currentText?: string;
  className?: string;
  variant?: 'floating' | 'banner' | 'compact';
}

export const TTSControls: React.FC<TTSControlsProps> = ({
  currentText,
  className = '',
  variant = 'compact',
}) => {
  const { isSpeaking, isPaused, rate, speakText, pauseSpeaking, resumeSpeaking, stopSpeaking, setSpeechRate } = useSpeech();
  const { currentLang } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);

  const handleTogglePlay = () => {
    if (isSpeaking) {
      if (isPaused) {
        resumeSpeaking();
      } else {
        pauseSpeaking();
      }
    } else if (currentText) {
      speakText(currentText, currentLang);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-2xl shadow-xs ${className}`}>
        <button
          onClick={handleTogglePlay}
          type="button"
          aria-label={isSpeaking && !isPaused ? 'Pause voice' : 'Play voice'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
            isSpeaking && !isPaused
              ? 'bg-amber-600 text-white animate-pulse'
              : 'bg-white text-amber-900 hover:bg-amber-50'
          }`}
          title="Voice Assistance (Text-to-Speech)"
        >
          {isSpeaking && !isPaused ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Voice</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Read Aloud</span>
            </>
          )}
        </button>

        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            type="button"
            className="p-1 rounded-lg text-amber-800 hover:bg-amber-200/80 cursor-pointer"
            title="Stop Speech"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        )}
      </div>
    );
  }

  // Floating or full banner variant
  return (
    <aside aria-label="Audio Reader" className={`bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 p-4 rounded-2xl shadow-tactile ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-black text-amber-950">Voice Read Aloud / কণ্ঠ সহায়ক</div>
            <div className="text-xs text-amber-800 font-medium">
              {isSpeaking ? (isPaused ? 'Paused' : 'Speaking gently for easy listening...') : 'Tap Play to listen to this page'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlay}
            type="button"
            className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              isSpeaking && !isPaused
                ? 'bg-amber-600 text-white shadow-md scale-105'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {isSpeaking && !isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isSpeaking && !isPaused ? 'Pause' : 'Listen'}</span>
          </button>

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              type="button"
              className="p-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer"
              title="Stop"
            >
              <Square className="w-4 h-4 fill-gray-700" />
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            type="button"
            className="p-2 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
            title="Speech Speed"
          >
            <Gauge className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mt-3 pt-3 border-t border-amber-200/80 flex items-center gap-4 text-xs font-bold text-amber-950">
          <span>Speed:</span>
          {[
            { label: '0.7x (Very Slow)', val: 0.7 },
            { label: '0.85x (Clear / Elder Friendly)', val: 0.85 },
            { label: '1.0x (Normal)', val: 1.0 },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setSpeechRate(item.val)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                Math.abs(rate - item.val) < 0.05
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-amber-200 text-gray-700 hover:bg-amber-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
};
