import React, { useState, useEffect, useRef } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from './DifficultyBadge';
import { GameSummaryModal } from './GameSummaryModal';
import { Eye, RotateCcw, Zap, Sparkles } from 'lucide-react';

interface FocusSymbol {
  id: string;
  emoji: string;
  name: { en: string; hi: string; as: string; [key: string]: string };
  isTarget: boolean;
}

const SYMBOLS: FocusSymbol[] = [
  { id: 'target', emoji: '🪔', name: { en: 'Golden Diya (Target)', hi: 'सुनहरा दीया (लक्ष्य)', as: 'সোণালী চাকি (লক্ষ্য)' }, isTarget: true },
  { id: 'distractor-1', emoji: '🍃', name: { en: 'Green Leaf', hi: 'हरी पत्ती', as: 'সেউজীয়া পাত' }, isTarget: false },
  { id: 'distractor-2', emoji: '🪨', name: { en: 'River Pebble', hi: 'नदी का पत्थर', as: 'নদীৰ শিল' }, isTarget: false },
  { id: 'distractor-3', emoji: '💧', name: { en: 'Water Droplet', hi: 'जल की बूंद', as: 'পানীৰ টোপাল' }, isTarget: false },
  { id: 'distractor-4', emoji: '🌸', name: { en: 'Pink Flower', hi: 'गुलाबी पंखुड़ी', as: 'গোলাপী ফুল' }, isTarget: false },
];

export const FocusVigilanceGame: React.FC<{ initialDifficulty?: DifficultyTier }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang, t } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [gameState, setGameState] = useState<'idle' | 'running' | 'ended'>('idle');
  const [currentSymbol, setCurrentSymbol] = useState<FocusSymbol | null>(null);
  const [feedback, setFeedback] = useState<'hit' | 'false_alarm' | 'miss' | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetAppearedTime, setTargetAppearedTime] = useState<number | null>(null);
  const [trialsDone, setTrialsDone] = useState<number>(0);
  const [correctHits, setCorrectHits] = useState<number>(0);
  const [falseAlarms, setFalseAlarms] = useState<number>(0);
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);

  const totalTrials = difficulty === 'saral' ? 8 : difficulty === 'madhyam' ? 12 : 16;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSession = () => {
    setGameState('running');
    setTrialsDone(0);
    setCorrectHits(0);
    setFalseAlarms(0);
    setReactionTimes([]);
    setFeedback(null);
    setCompletedSession(null);
    nextTrial(0);
  };

  const nextTrial = (trialCount: number) => {
    if (trialCount >= totalTrials) {
      endSession();
      return;
    }

    setFeedback(null);
    setCurrentSymbol(null);
    setTargetAppearedTime(null);

    // Random pause between symbols (1200ms - 2200ms) for natural vigilance
    const delay = 1200 + Math.random() * 1000;

    timeoutRef.current = setTimeout(() => {
      // 40% probability of target symbol
      const isTarget = Math.random() < 0.45;
      let symbol: FocusSymbol;

      if (isTarget) {
        symbol = SYMBOLS[0];
      } else {
        const distractors = SYMBOLS.slice(1);
        symbol = distractors[Math.floor(Math.random() * distractors.length)];
      }

      setCurrentSymbol(symbol);
      const now = Date.now();
      if (symbol.isTarget) {
        setTargetAppearedTime(now);
      }

      // Display duration (how long symbol stays on screen)
      const displayDuration = difficulty === 'saral' ? 2400 : difficulty === 'madhyam' ? 1800 : 1300;

      timeoutRef.current = setTimeout(() => {
        // If it was a target and user didn't tap -> Miss
        if (symbol.isTarget && targetAppearedTime === null) {
          // (Handled if not tapped)
        }
        setCurrentSymbol(null);
        setTrialsDone(trialCount + 1);
        nextTrial(trialCount + 1);
      }, displayDuration);
    }, delay);
  };

  const handleTap = () => {
    if (!currentSymbol || gameState !== 'running') return;

    if (currentSymbol.isTarget) {
      // Correct HIT!
      soundService.playTempleBell();
      const reactionTime = targetAppearedTime ? Date.now() - targetAppearedTime : 850;
      setReactionTimes((prev) => [...prev, reactionTime]);
      setCorrectHits((h) => h + 1);
      setFeedback('hit');
      setCurrentSymbol(null);
    } else {
      // False Alarm!
      soundService.playSoftMistake();
      setFalseAlarms((f) => f + 1);
      setFeedback('false_alarm');
      setCurrentSymbol(null);
    }
  };

  const endSession = () => {
    setGameState('ended');
    const avgReactionTime = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 1200;

    // Accuracy: proportion of correct choices (hits on targets, no taps on distractors)
    const accuracy = Math.min(100, Math.max(50, Math.round(((correctHits + Math.max(0, totalTrials - correctHits - falseAlarms)) / totalTrials) * 100)));

    const result = gameService.recordSession({
      gameId: 'dhyan_kendra',
      durationSeconds: 45,
      accuracy,
      mistakesCount: falseAlarms,
      hintsUsed: 0,
      difficulty,
      reactionTimeMs: avgReactionTime,
    });
    setCompletedSession(result);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const instructions = currentLang === 'hi'
    ? 'जब भी स्क्रीन पर सुनहरा दीया (🪔) आए, तुरंत नीचे दिए गए बड़े हरे बटन पर टैप करें। अन्य चित्रों पर टैप न करें।'
    : currentLang === 'as'
    ? 'যেতিয়াই পৰ্দাত সোণালী চাকি (🪔) দেখিব, তৎক্ষণাৎ সেউজীয়া বুটামটোত স্পৰ্শ কৰক। অন্য চিহ্নত নকৰিব।'
    : 'Whenever the Golden Diya (🪔) appears, tap the green button immediately! Do not tap on other symbols.';

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-emerald-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'ध्यान केंद्र (Dhyan Kendra)' : currentLang === 'as' ? 'ধ্যান কেন্দ্ৰ (Dhyan Kendra)' : 'Dhyan Kendra (Focus & Vigilance)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={instructions} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">{instructions}</p>
        </div>

        <button
          onClick={startSession}
          type="button"
          className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer self-start sm:self-auto"
          title="Restart"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Target Reminder Banner */}
      <div className="flex items-center justify-between bg-amber-50 px-5 py-3 rounded-2xl border border-amber-200 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🪔</span>
          <span className="text-sm font-extrabold text-amber-950">
            {currentLang === 'hi' ? 'लक्ष्य चित्र: सुनहरा दीया' : currentLang === 'as' ? 'লক্ষ্য চিহ্ন: সোণালী চাকি' : 'Target Symbol: Golden Diya'}
          </span>
        </div>
        <div className="text-xs sm:text-sm font-bold text-gray-600">
          {trialsDone} / {totalTrials}
        </div>
      </div>

      {/* Calming Focus Pond Area */}
      <div className="h-72 sm:h-80 bg-gradient-to-b from-[#EBF5EE] to-[#D5EADB] rounded-3xl p-6 shadow-elder border-4 border-emerald-300 flex flex-col items-center justify-center relative overflow-hidden mb-6">
        {/* Soft water wave reflections */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#5F8867_1px,transparent_1px)] [background-size:16px_16px]" />

        {gameState === 'idle' ? (
          <div className="text-center z-10">
            <span className="text-6xl mb-3 block">🪷</span>
            <p className="text-lg font-bold text-emerald-950 mb-4">
              {currentLang === 'hi' ? 'शांत बैठें और अभ्यास के लिए तैयार हों' : currentLang === 'as' ? 'শান্ত হৈ বহক আৰু সাজু হওক' : 'Sit comfortably and prepare to focus'}
            </p>
            <button
              onClick={startSession}
              type="button"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-8 py-4 rounded-2xl shadow-tactile text-xl cursor-pointer"
            >
              {currentLang === 'hi' ? 'ध्यान सत्र शुरू करें' : currentLang === 'as' ? 'ধ্যান আৰম্ভ কৰক' : 'Start Focus Session'}
            </button>
          </div>
        ) : currentSymbol ? (
          <div className="text-center z-10 animate-bounce">
            <span className="text-7xl sm:text-8xl filter drop-shadow-xl select-none block">
              {currentSymbol.emoji}
            </span>
            <span className="text-sm font-bold text-emerald-900 mt-2 block bg-white/80 px-3 py-1 rounded-full shadow-sm">
              {currentSymbol.name[currentLang] || currentSymbol.name.en}
            </span>
          </div>
        ) : (
          <div className="text-center z-10 text-emerald-800 font-medium animate-pulse">
            <Eye className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <span>{currentLang === 'hi' ? 'ध्यान से देखते रहें...' : currentLang === 'as' ? 'মন দি চাই থাকক...' : 'Keep watching the pond...'}</span>
          </div>
        )}

        {/* Feedback flash */}
        {feedback === 'hit' && (
          <div className="absolute top-4 right-4 bg-emerald-500 text-white font-extrabold px-4 py-1.5 rounded-full text-sm shadow-md animate-fade-in flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>{currentLang === 'hi' ? 'शाबाश! सही टैप!' : currentLang === 'as' ? 'বৰ ধুনীয়া!' : 'Great Hit!'}</span>
          </div>
        )}
        {feedback === 'false_alarm' && (
          <div className="absolute top-4 right-4 bg-red-500 text-white font-extrabold px-4 py-1.5 rounded-full text-sm shadow-md animate-fade-in">
            <span>{currentLang === 'hi' ? 'यह दीया नहीं था' : currentLang === 'as' ? 'এইটো চাকি নাছিল' : 'Not the target'}</span>
          </div>
        )}
      </div>

      {/* Large Tactile Tap Trigger Button */}
      {gameState === 'running' && (
        <button
          onClick={handleTap}
          type="button"
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-2xl py-6 rounded-3xl shadow-tactile border-4 border-emerald-800 cursor-pointer flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
        >
          <Sparkles className="w-8 h-8 text-yellow-300" />
          <span>{currentLang === 'hi' ? 'दीया दिखा! तुरंत दबाएं!' : currentLang === 'as' ? 'চাকি দেখিলে স্পৰ্শ কৰক!' : 'TAP NOW (Target Spotted!)'}</span>
        </button>
      )}

      {/* Completion Modal */}
      {completedSession && (
        <GameSummaryModal
          session={completedSession.session}
          leveledUp={completedSession.leveledUp}
          onPlayAgain={startSession}
          onContinue={startSession}
        />
      )}
    </div>
  );
};
