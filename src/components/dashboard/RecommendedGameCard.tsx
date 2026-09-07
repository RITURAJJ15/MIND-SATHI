import React, { useState, useEffect } from 'react';
import { recommendationService } from '../../services/recommendationService';
import { COGNITIVE_GAMES } from '../../data/mockGames';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from '../games/DifficultyBadge';
import { Sparkles, Play, ArrowRight, Brain, RefreshCw } from 'lucide-react';
import { GameRecommendation } from '../../types/game';

interface RecommendedGameCardProps {
  onPlayGame: (gameId: string) => void;
}

export const RecommendedGameCard: React.FC<RecommendedGameCardProps> = ({ onPlayGame }) => {
  const { currentLang, t } = useLanguage();
  const [rec, setRec] = useState<GameRecommendation>(() => recommendationService.getNextGameRecommendation());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadAiRecommendation = async () => {
    setIsLoading(true);
    try {
      const updated = await recommendationService.fetchAiRecommendation(currentLang as 'en' | 'hi' | 'as');
      setRec(updated);
    } catch (e) {
      console.warn('AI recommendation load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAiRecommendation();
  }, [currentLang]);

  const gameMeta = COGNITIVE_GAMES.find((g) => g.id === rec.gameId) || COGNITIVE_GAMES[0];

  const title = gameMeta.title[currentLang] || gameMeta.title.en;
  const reasonText = rec.reason[currentLang] || rec.reason.en;
  const domainText = gameMeta.domainLabel[currentLang] || gameMeta.domainLabel.en;

  const narration = currentLang === 'hi'
    ? `आज आपके लिए विशेष सुझाव है: ${title}। कारण: ${reasonText}`
    : currentLang === 'as'
    ? `আজি আপোনাৰ বাবে বিশেষ পৰামৰ্শ: ${title}। কাৰণ: ${reasonText}`
    : `Today's recommendation for you: ${title}. ${reasonText}`;

  return (
    <div className="bg-gradient-to-br from-[#FFF7ED] via-[#FFFBF5] to-[#FDF4E7] p-6 sm:p-7 rounded-3xl shadow-elder border-2 border-amber-300 relative overflow-hidden">
      {/* Decorative background watermark */}
      <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none select-none">
        <Brain className="w-56 h-56 text-sathi-800" />
      </div>

      <div className="relative z-10">
        {/* Top Tag & Voice Button */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-sathi-600 text-white text-xs sm:text-sm font-extrabold px-3.5 py-1 rounded-full shadow-sm">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span>{t.games.recommendedForYou}</span>
            </div>
            <span className="text-[11px] font-bold text-amber-900/70 bg-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>🤖 Gemini AI</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAiRecommendation}
              disabled={isLoading}
              type="button"
              title="Refresh AI recommendation"
              className="p-1.5 rounded-xl bg-amber-100/70 hover:bg-amber-200 text-amber-900 cursor-pointer transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <VoicePromptButton text={narration} size="sm" />
          </div>
        </div>

        {/* Game Title & Domain */}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 mb-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-sathi-800 bg-sathi-100 px-2.5 py-0.5 rounded-md border border-sathi-200">
              {domainText}
            </span>
            <DifficultyBadge difficulty={rec.suggestedDifficulty} />
          </div>
        </div>

        {/* Personalized Rationale */}
        <p className="text-gray-700 text-base sm:text-lg mb-6 leading-relaxed max-w-2xl font-medium">
          {reasonText}
        </p>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => onPlayGame(rec.gameId)}
            type="button"
            className="bg-sathi-600 hover:bg-sathi-700 text-white font-extrabold text-lg px-8 py-4 rounded-2xl shadow-tactile flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{currentLang === 'hi' ? 'सुझाया गया खेल खेलें' : currentLang === 'as' ? 'পৰামৰ্শ দিয়া খেল খেলক' : 'Play Recommended Game'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-gray-500">
            ⏱️ ~{gameMeta.durationMinutes} {currentLang === 'hi' ? 'मिनट' : currentLang === 'as' ? 'মিনিট' : 'minutes'}
          </span>
        </div>
      </div>
    </div>
  );
};

