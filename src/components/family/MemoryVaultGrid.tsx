import React, { useState } from 'react';
import { MemoryVaultItem } from '../../types/family';
import { familyService } from '../../services/familyService';
import { profileService } from '../../services/profileService';
import { soundService } from '../../services/soundService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { Heart, Sparkles, MapPin, Calendar, CheckCircle } from 'lucide-react';

interface MemoryVaultGridProps {
  memories: MemoryVaultItem[];
  onMemoryUpdated?: () => void;
}

export const MemoryVaultGrid: React.FC<MemoryVaultGridProps> = ({ memories, onMemoryUpdated }) => {
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();
  const [recalledIds, setRecalledIds] = useState<Set<string>>(new Set());

  const handleRecallMemory = (item: MemoryVaultItem) => {
    familyService.recordMemoryRecalled(item.id);
    setRecalledIds((prev) => new Set(prev).add(item.id));
    soundService.playMatchSuccess();
    profileService.addXpToCurrentUser(25);

    const q = item.reminiscenceQuestion[currentLang] || item.reminiscenceQuestion.en;
    speakText(q);

    if (onMemoryUpdated) onMemoryUpdated();
  };

  const handleToggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    familyService.toggleFavorite(id);
    if (onMemoryUpdated) onMemoryUpdated();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {memories.map((mem) => {
        const questionText = mem.reminiscenceQuestion[currentLang] || mem.reminiscenceQuestion.en;
        const isRecalled = recalledIds.has(mem.id);

        return (
          <div
            key={mem.id}
            className="bg-white rounded-3xl overflow-hidden shadow-elder border border-amber-200/80 flex flex-col justify-between hover:shadow-elder-hover transition-all"
          >
            <div>
              {/* Photo Frame */}
              <div className="relative h-48 sm:h-56 overflow-hidden bg-amber-50">
                <img
                  src={mem.photoUrl}
                  alt={mem.title}
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                />
                <button
                  onClick={(e) => handleToggleFav(e, mem.id)}
                  type="button"
                  className="absolute top-3 right-3 p-2.5 rounded-full bg-white/80 hover:bg-white backdrop-blur-md text-rose-500 shadow-md cursor-pointer transition-all"
                  aria-label="Toggle favorite"
                >
                  <Heart className={`w-5 h-5 ${mem.isFavorite ? 'fill-rose-500' : ''}`} />
                </button>

                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{mem.dateOrEra}</span>
                </div>
              </div>

              {/* Memory Details */}
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-1.5 text-xs text-sathi-700 font-bold uppercase mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{mem.location}</span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2 leading-snug">
                  {mem.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">
                  {mem.description}
                </p>

                {/* Reminiscence Prompt Box */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 rounded-2xl border border-amber-200">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-extrabold text-sathi-800 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-sathi-600" />
                      <span>{currentLang === 'hi' ? 'यादों की बात' : currentLang === 'as' ? 'স্মৃতিৰ কথা' : 'Reminiscence Question'}</span>
                    </span>
                    <VoicePromptButton text={questionText} size="sm" />
                  </div>
                  <p className="text-sm font-semibold text-amber-950 leading-relaxed">
                    "{questionText}"
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-5 pt-0">
              <button
                onClick={() => handleRecallMemory(mem)}
                type="button"
                className={`w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                  isRecalled
                    ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-400'
                    : 'bg-sathi-600 hover:bg-sathi-700 text-white shadow-tactile'
                }`}
              >
                {isRecalled ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>{currentLang === 'hi' ? 'यादें ताज़ा हुईं (+25 XP)' : currentLang === 'as' ? 'স্মৃতি সতেজ হ\'ল (+25 XP)' : 'Cherished Memory (+25 XP)'}</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    <span>{currentLang === 'hi' ? 'याद साझा करें (Reminisce)' : currentLang === 'as' ? 'স্মৃতি ভাগ-বতৰা কৰক' : 'Reflect on this Memory'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
