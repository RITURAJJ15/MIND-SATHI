import React, { useState, useEffect, useRef } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from './DifficultyBadge';
import { GameSummaryModal } from './GameSummaryModal';
import { Palette, Play, RotateCcw } from 'lucide-react';

interface PetalConfig {
  id: number;
  name: { en: string; hi: string; as: string };
  color: string;
  activeColor: string;
  border: string;
  glow: string;
}

const PETALS: PetalConfig[] = [
  {
    id: 0,
    name: { en: 'Saffron Diya', hi: 'केसरिया दीया', as: 'গেৰুৱা বন্তি' },
    color: 'bg-orange-500',
    activeColor: 'bg-orange-300 scale-105 ring-8 ring-orange-200',
    border: 'border-orange-600',
    glow: 'shadow-[0_0_25px_rgba(249,115,22,0.8)]',
  },
  {
    id: 1,
    name: { en: 'Sage Lotus', hi: 'हरी दूब', as: 'সেউজীয়া পদুম' },
    color: 'bg-emerald-600',
    activeColor: 'bg-emerald-300 scale-105 ring-8 ring-emerald-200',
    border: 'border-emerald-700',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.8)]',
  },
  {
    id: 2,
    name: { en: 'Marigold Yellow', hi: 'गेंदा पीला', as: 'হালধীয়া ফুল' },
    color: 'bg-amber-400',
    activeColor: 'bg-amber-200 scale-105 ring-8 ring-amber-100',
    border: 'border-amber-500',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.8)]',
  },
  {
    id: 3,
    name: { en: 'Krishna Indigo', hi: 'गहरा नीला', as: 'কৃষ্ণ নীল' },
    color: 'bg-indigo-600',
    activeColor: 'bg-indigo-300 scale-105 ring-8 ring-indigo-200',
    border: 'border-indigo-700',
    glow: 'shadow-[0_0_25px_rgba(79,70,229,0.8)]',
  },
];

export const PatternSequenceGame: React.FC<{ initialDifficulty?: DifficultyTier }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState<number>(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);
  const [activePetal, setActivePetal] = useState<number | null>(null);
  const [round, setRound] = useState<number>(1);
  const [mistakes, setMistakes] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);
  const maxRounds = difficulty === 'saral' ? 4 : difficulty === 'madhyam' ? 6 : 8;

  // Start initial sequence
  const startNewGame = () => {
    setMistakes(0);
    setRound(1);
    setUserStep(0);
    setCompletedSession(null);
    setStartTime(Date.now());

    // Generate initial sequence of 2 steps
    const firstTwo = [
      Math.floor(Math.random() * PETALS.length),
      Math.floor(Math.random() * PETALS.length),
    ];
    setSequence(firstTwo);
    playSequence(firstTwo);
  };

  useEffect(() => {
    startNewGame();
  }, [difficulty]);

  // Play the sequence with lights and audio
  const playSequence = (seqToPlay: number[]) => {
    setIsPlayingSequence(true);
    setUserStep(0);

    seqToPlay.forEach((petalIdx, i) => {
      setTimeout(() => {
        setActivePetal(petalIdx);
        soundService.playRangoliTone(petalIdx);

        setTimeout(() => {
          setActivePetal(null);
          if (i === seqToPlay.length - 1) {
            setIsPlayingSequence(false);
          }
        }, 500);
      }, (i + 1) * 750);
    });
  };

  const handlePetalClick = (petalId: number) => {
    if (isPlayingSequence) return;

    // Flash tapped petal & play tone
    setActivePetal(petalId);
    soundService.playRangoliTone(petalId);
    setTimeout(() => setActivePetal(null), 250);

    // Check if user input matches current step of sequence
    if (petalId === sequence[userStep]) {
      const nextStep = userStep + 1;
      if (nextStep === sequence.length) {
        // Round completed successfully!
        soundService.playMatchSuccess();
        if (round >= maxRounds) {
          // Game Completed
          finishGame();
        } else {
          // Advance round: append 1 new step
          const newStep = Math.floor(Math.random() * PETALS.length);
          const nextSeq = [...sequence, newStep];
          setSequence(nextSeq);
          setRound((r) => r + 1);
          setTimeout(() => {
            playSequence(nextSeq);
          }, 1000);
        }
      } else {
        setUserStep(nextStep);
      }
    } else {
      // Mistake made
      soundService.playSoftMistake();
      setMistakes((m) => m + 1);

      // Replay current sequence to guide user gently
      setTimeout(() => {
        playSequence(sequence);
      }, 900);
    }
  };

  const finishGame = () => {
    const durationSeconds = Math.max(10, Math.round((Date.now() - startTime) / 1000));
    const accuracy = Math.min(100, Math.max(50, 100 - mistakes * 12));

    const result = gameService.recordSession({
      gameId: 'rangoli_rekha',
      durationSeconds,
      accuracy,
      mistakesCount: mistakes,
      hintsUsed: 0,
      difficulty,
    });
    setCompletedSession(result);
  };

  const instructions = currentLang === 'hi'
    ? 'रंगोली के चमकते रंगों और संगीत को ध्यान से देखें व सुनें। इसके बाद उसी क्रम में रंगों को छूएं।'
    : currentLang === 'as'
    ? 'ৰঙালীৰ পাহি জ্বলা আৰু সুৰ মন দি শুনক। তাৰ পিছত একে ক্ৰমত স্পৰ্শ কৰক।'
    : 'Watch the Rangoli petals light up with gentle tones, then tap them in the exact same order.';

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-amber-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'रंगोली रेखा (Rangoli Rekha)' : currentLang === 'as' ? 'ৰঙালী ৰেখা (Rangoli Rekha)' : 'Rangoli Rekha (Pattern Sequence)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={instructions} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">{instructions}</p>
        </div>

        <button
          onClick={startNewGame}
          type="button"
          className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer self-start sm:self-auto"
          title="Restart"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Round & Status Indicator */}
      <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <div className="text-sm font-bold text-gray-700">
          {currentLang === 'hi' ? 'चरण' : currentLang === 'as' ? 'স্তৰ' : 'Round'} {round} / {maxRounds}
        </div>
        <div className="text-sm font-semibold">
          {isPlayingSequence ? (
            <span className="text-amber-700 font-bold animate-pulse flex items-center gap-1.5">
              👀 {currentLang === 'hi' ? 'ध्यान से देखें और सुनें...' : currentLang === 'as' ? 'মন দি চাওক আৰু শুনক...' : 'Watch & Listen closely...'}
            </span>
          ) : (
            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
              👉 {currentLang === 'hi' ? 'अब आपकी बारी (दबाएं)' : currentLang === 'as' ? 'এতিয়া আপোনাৰ পাল' : 'Your Turn (Tap petals)'}
            </span>
          )}
        </div>
      </div>

      {/* Glowing Rangoli Center Circle */}
      <div className="bg-gradient-to-br from-[#FFF8F0] to-[#FDF3E5] p-6 sm:p-10 rounded-3xl shadow-elder border-2 border-amber-200 flex flex-col items-center justify-center relative">
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
          {/* Rangoli center core */}
          <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-100 border-4 border-amber-300 shadow-inner flex flex-col items-center justify-center z-10 text-center">
            <span className="text-3xl">🪷</span>
            <span className="text-[10px] sm:text-xs font-extrabold text-amber-900 mt-1 uppercase tracking-wider">
              {currentLang === 'hi' ? 'रंगोली' : currentLang === 'as' ? 'ৰঙালী' : 'Rangoli'}
            </span>
          </div>

          {/* 4 Petals arranged in circular cross */}
          {/* Top Petal - Saffron Diya */}
          <button
            onClick={() => handlePetalClick(0)}
            disabled={isPlayingSequence}
            type="button"
            className={`absolute top-0 w-28 h-28 sm:w-36 sm:h-36 rounded-t-full rounded-b-2xl border-4 ${PETALS[0].border} transition-all duration-150 cursor-pointer shadow-lg ${
              activePetal === 0 ? `${PETALS[0].activeColor} ${PETALS[0].glow}` : PETALS[0].color
            }`}
            aria-label={PETALS[0].name.en}
          />

          {/* Right Petal - Sage Lotus */}
          <button
            onClick={() => handlePetalClick(1)}
            disabled={isPlayingSequence}
            type="button"
            className={`absolute right-0 w-28 h-28 sm:w-36 sm:h-36 rounded-r-full rounded-l-2xl border-4 ${PETALS[1].border} transition-all duration-150 cursor-pointer shadow-lg ${
              activePetal === 1 ? `${PETALS[1].activeColor} ${PETALS[1].glow}` : PETALS[1].color
            }`}
            aria-label={PETALS[1].name.en}
          />

          {/* Bottom Petal - Marigold Yellow */}
          <button
            onClick={() => handlePetalClick(2)}
            disabled={isPlayingSequence}
            type="button"
            className={`absolute bottom-0 w-28 h-28 sm:w-36 sm:h-36 rounded-b-full rounded-t-2xl border-4 ${PETALS[2].border} transition-all duration-150 cursor-pointer shadow-lg ${
              activePetal === 2 ? `${PETALS[2].activeColor} ${PETALS[2].glow}` : PETALS[2].color
            }`}
            aria-label={PETALS[2].name.en}
          />

          {/* Left Petal - Krishna Indigo */}
          <button
            onClick={() => handlePetalClick(3)}
            disabled={isPlayingSequence}
            type="button"
            className={`absolute left-0 w-28 h-28 sm:w-36 sm:h-36 rounded-l-full rounded-r-2xl border-4 ${PETALS[3].border} transition-all duration-150 cursor-pointer shadow-lg ${
              activePetal === 3 ? `${PETALS[3].activeColor} ${PETALS[3].glow}` : PETALS[3].color
            }`}
            aria-label={PETALS[3].name.en}
          />
        </div>

        {/* Replay Sequence Button */}
        <div className="mt-8">
          <button
            onClick={() => playSequence(sequence)}
            disabled={isPlayingSequence}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white hover:bg-amber-50 text-amber-900 border-2 border-amber-300 font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 text-sm"
          >
            <Play className="w-4 h-4 text-amber-700" />
            <span>{currentLang === 'hi' ? 'क्रम दोबारा सुनें (Replay)' : currentLang === 'as' ? 'ক্ৰম পুনৰ শুনক' : 'Replay Sequence'}</span>
          </button>
        </div>
      </div>

      {/* Completion Modal */}
      {completedSession && (
        <GameSummaryModal
          session={completedSession.session}
          leveledUp={completedSession.leveledUp}
          onPlayAgain={startNewGame}
          onContinue={startNewGame}
        />
      )}
    </div>
  );
};
