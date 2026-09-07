import React, { useState, useEffect } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from './DifficultyBadge';
import { GameSummaryModal } from './GameSummaryModal';
import { Compass, Clock, CheckCircle2, XCircle, RotateCcw, Lightbulb } from 'lucide-react';

interface OrientationQuestion {
  id: string;
  type: 'clock' | 'compass' | 'courtyard';
  title: { en: string; hi: string; as: string; [key: string]: string };
  question: { en: string; hi: string; as: string; [key: string]: string };
  clockTime?: { hours: number; minutes: number; displayLabel: string };
  compassDirection?: 'North' | 'South' | 'East' | 'West';
  correctOption: { en: string; hi: string; as: string; [key: string]: string };
  options: { en: string; hi: string; as: string; [key: string]: string }[];
  hint: { en: string; hi: string; as: string; [key: string]: string };
}

const ORIENTATION_QUESTIONS: OrientationQuestion[] = [
  {
    id: 'oq-1',
    type: 'clock',
    title: { en: 'Evening Tea Time', hi: 'शाम की चाय का समय', as: 'সন্ধিয়াৰ চাহৰ সময়' },
    question: {
      en: 'Observe the clock on the veranda wall. What exact time is it showing?',
      hi: 'दीवार पर लगी घड़ी को ध्यान से देखें। यह किस समय का संकेत कर रही है?',
      as: 'বেৰৰ ঘড়ীটোলৈ মন কৰক। ই কিমান সময় দেখুৱাইছে?',
    },
    clockTime: { hours: 4, minutes: 30, displayLabel: '4:30' },
    correctOption: { en: '4:30 PM (Four Thirty)', hi: '4:30 बजे (साढ़े चार)', as: '৪:৩০ বজাত (চাৰে চাৰি)' },
    options: [
      { en: '4:30 PM (Four Thirty)', hi: '4:30 बजे (साढ़े चार)', as: '৪:৩০ বজাত (চাৰে চাৰি)' },
      { en: '5:00 PM (Five O\'Clock)', hi: '5:00 बजे (पूरे पाँच)', as: '৫:০০ বজাত (পাঁচ বজাত)' },
      { en: '3:30 PM (Three Thirty)', hi: '3:30 बजे (साढ़े तीन)', as: '৩:৩০ বজাত (চাৰে তিনি)' },
      { en: '6:20 PM (Six Twenty)', hi: '6:20 बजे (छह बजकर बीस)', as: '৬:২০ বজাত' },
    ],
    hint: {
      en: 'The small hour hand is between 4 and 5, and the long minute hand points straight down to 6.',
      hi: 'छोटी सुई 4 और 5 के बीच है और बड़ी सुई 6 पर है।',
      as: 'সৰু কাঁটা ৪ আৰু ৫ৰ মাজত, আৰু ডাঙৰ কাঁটা ৬ৰ ওপৰত।',
    },
  },
  {
    id: 'oq-2',
    type: 'compass',
    title: { en: 'Morning Sun & Directions', hi: 'सूर्योदय और दिशा ज्ञान', as: 'সূৰ্যোদয় আৰু দিশ জ্ঞান' },
    question: {
      en: 'In the early morning, you stand facing the rising sun (East / Purva). Which direction is on your left hand side?',
      hi: 'सुबह के समय यदि आप उगते हुए सूरज (पूर्व दिशा) की ओर मुंह करके खड़े हों, तो आपके बाएं हाथ की ओर कौन सी दिशा होगी?',
      as: 'পুৱা যদি আপুনি ওলোৱা সূৰ্য্যৰ (পূব দিশ) ফালে মুখ কৰি থিয় হয়, তেন্তে আপোনাৰ বাওঁফালে কোন দিশ হ\'ব?',
    },
    compassDirection: 'East',
    correctOption: { en: 'North (Uttar)', hi: 'उत्तर दिशा (North)', as: 'উত্তৰ দিশ (North)' },
    options: [
      { en: 'North (Uttar)', hi: 'उत्तर दिशा (North)', as: 'উত্তৰ দিশ (North)' },
      { en: 'South (Dakshin)', hi: 'दक्षिण दिशा (South)', as: 'দক্ষিণ দিশ (South)' },
      { en: 'West (Paschim)', hi: 'पश्चिम दिशा (West)', as: 'পশ্চিম দিশ (West)' },
      { en: 'South-East', hi: 'दक्षिण-पूर्व', as: 'দক্ষিণ-পূব' },
    ],
    hint: {
      en: 'Facing East: Ahead is East, behind is West, right is South, and left is North.',
      hi: 'पूर्व की ओर मुंह करने पर: सामने पूर्व, पीछे पश्चिम, दाएं दक्षिण और बाएं उत्तर होता है।',
      as: 'পূবলৈ মুখ কৰিলে: সন্মুখত পূব, পিচত পশ্চিম, সোঁফালে দক্ষিণ আৰু বাওঁফালে উত্তৰ।',
    },
  },
  {
    id: 'oq-3',
    type: 'clock',
    title: { en: 'Morning Temple Aarti', hi: 'सुबह की मंगला आरती', as: 'পুৱাৰ আৰতিৰ সময়' },
    question: {
      en: 'The temple bell is ringing. Look at the clock hands. What time is it?',
      hi: 'मंदिर के घंटे बज रहे हैं। घड़ी की सुइयों को देखकर सही समय बताएं।',
      as: 'মন্দিৰত ঘণ্টা বাজিছে। ঘড়ীৰ কাঁটা চাই সঠিক সময় কওক।',
    },
    clockTime: { hours: 6, minutes: 15, displayLabel: '6:15' },
    correctOption: { en: '6:15 AM (Quarter past six)', hi: '6:15 बजे (सवा छह)', as: '৬:১৫ বজাত (ছয় পোন্ধৰ)' },
    options: [
      { en: '6:15 AM (Quarter past six)', hi: '6:15 बजे (सवा छह)', as: '৬:১৫ বজাত (ছয় পোন্ধৰ)' },
      { en: '6:45 AM (Quarter to seven)', hi: '6:45 बजे (पौने सात)', as: '৬:৪৫ বজাত (পৌনে সাত)' },
      { en: '3:30 AM (Three Thirty)', hi: '3:30 बजे (साढ़े तीन)', as: '৩:৩০ বজাত' },
      { en: '7:15 AM (Seven Fifteen)', hi: '7:15 बजे (सवा सात)', as: '৭:১৫ বজাত' },
    ],
    hint: {
      en: 'The hour hand is past 6 and the minute hand points directly at 3 (15 minutes).',
      hi: 'छोटी सुई 6 से ज़रा आगे है और बड़ी सुई 3 पर है (15 मिनट)।',
      as: 'সৰু কাঁটা ৬ৰ সামান্য আগত আৰু ডাঙৰ কাঁটা ৩ৰ ওপৰত (১৫ মিনিট)।',
    },
  },
  {
    id: 'oq-4',
    type: 'courtyard',
    title: { en: 'Night Sky Star Navigation', hi: 'ध्रुव तारा और रात का आकाश', as: 'ধ্ৰুৱ তৰা আৰু নিশাৰ আকাশ' },
    question: {
      en: 'The Pole Star (Dhruva Tara) stays fixed in the night sky. In which direction must you look to find it?',
      hi: 'ध्रुव तारा रात में आकाश में सदा स्थिर रहता है। इसे देखने के लिए हमें किस दिशा की ओर देखना होता है?',
      as: 'ধ্ৰুৱ তৰা নিশা আকাশত সদায় স্থিৰ হৈ থাকে। ইয়াক চাবলৈ আমি কোন দিশলৈ চাব লাগিব?',
    },
    correctOption: { en: 'North (Uttar)', hi: 'उत्तर दिशा (North)', as: 'উত্তৰ দিশ (North)' },
    options: [
      { en: 'North (Uttar)', hi: 'उत्तर दिशा (North)', as: 'উত্তৰ দিশ (North)' },
      { en: 'South (Dakshin)', hi: 'दक्षिण दिशा (South)', as: 'দক্ষিণ দিশ (South)' },
      { en: 'East (Purva)', hi: 'पूर्व दिशा (East)', as: 'পূব দিশ (East)' },
      { en: 'West (Paschim)', hi: 'पश्चिम दिशा (West)', as: 'পশ্চিম দিশ (West)' },
    ],
    hint: {
      en: 'The Pole Star points directly to the true celestial North.',
      hi: 'ध्रुव तारा उत्तर दिशा का शाश्वत सूचक है।',
      as: 'ধ্ৰুৱ তৰাই সদায় উত্তৰ দিশ নিৰ্দেশ কৰে।',
    },
  },
];

export const SpatialOrientationGame: React.FC<{ initialDifficulty?: DifficultyTier }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang, t } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);

  const currentQ = ORIENTATION_QUESTIONS[currentIndex % ORIENTATION_QUESTIONS.length];

  useEffect(() => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowHint(false);
  }, [currentIndex]);

  const handleSelectOption = (opt: { en: string; hi: string; as: string; [key: string]: string }) => {
    if (selectedAnswer !== null) return;

    const optText = opt[currentLang] || opt.en;
    const correctText = currentQ.correctOption[currentLang] || currentQ.correctOption.en;
    const isRight = optText === correctText;

    setSelectedAnswer(optText);
    setIsCorrect(isRight);

    if (isRight) {
      soundService.playMatchSuccess();
      setCorrectCount((c) => c + 1);
    } else {
      soundService.playSoftMistake();
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < ORIENTATION_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const durationSeconds = Math.max(15, Math.round((Date.now() - startTime) / 1000));
      const accuracy = Math.round((correctCount / ORIENTATION_QUESTIONS.length) * 100);

      const result = gameService.recordSession({
        gameId: 'disha_sathi',
        durationSeconds,
        accuracy,
        mistakesCount: ORIENTATION_QUESTIONS.length - correctCount,
        hintsUsed: 0,
        difficulty,
      });
      setCompletedSession(result);
    }
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setCorrectCount(0);
    setShowHint(false);
    setCompletedSession(null);
    setStartTime(Date.now());
  };

  // Helper to calculate SVG clock hand angles
  const renderClockFace = (hours: number, minutes: number) => {
    const minuteAngle = minutes * 6; // 360 / 60
    const hourAngle = (hours % 12) * 30 + minutes * 0.5; // 360 / 12 + minutes fraction

    return (
      <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto relative bg-amber-50 rounded-full border-8 border-amber-800 shadow-2xl flex items-center justify-center p-2 mb-6">
        {/* Clock Numbers */}
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => {
          const angle = (num * 30 - 90) * (Math.PI / 180);
          const r = 70; // radius
          const x = 96 + r * Math.cos(angle);
          const y = 96 + r * Math.sin(angle);
          return (
            <span
              key={num}
              className="absolute font-extrabold text-amber-950 text-sm sm:text-base select-none"
              style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }}
            >
              {num}
            </span>
          );
        })}

        {/* Center Pivot */}
        <div className="absolute w-4 h-4 bg-amber-900 rounded-full z-20 shadow-md" />

        {/* Hour Hand */}
        <div
          className="absolute w-2 bg-amber-950 rounded-full origin-bottom z-10"
          style={{
            height: '42px',
            top: 'calc(50% - 42px)',
            left: 'calc(50% - 4px)',
            transform: `rotate(${hourAngle}deg)`,
          }}
        />

        {/* Minute Hand */}
        <div
          className="absolute w-1.5 bg-red-700 rounded-full origin-bottom z-15"
          style={{
            height: '62px',
            top: 'calc(50% - 62px)',
            left: 'calc(50% - 3px)',
            transform: `rotate(${minuteAngle}deg)`,
          }}
        />
      </div>
    );
  };

  // Helper to render Compass
  const renderCompass = () => {
    return (
      <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto relative bg-[#FFF9F2] rounded-full border-8 border-rose-800 shadow-2xl flex items-center justify-center p-2 mb-6">
        <span className="absolute top-2 font-extrabold text-red-700 text-lg">उत्तर (N)</span>
        <span className="absolute right-2 font-extrabold text-gray-800 text-lg">पूर्व (E)</span>
        <span className="absolute bottom-2 font-extrabold text-gray-800 text-lg">दक्षिण (S)</span>
        <span className="absolute left-2 font-extrabold text-gray-800 text-lg">पश्चिम (W)</span>
        <Compass className="w-20 h-20 text-rose-700 animate-pulse-subtle" />
      </div>
    );
  };

  const questionPrompt = currentQ.question[currentLang] || currentQ.question.en;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-rose-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'दिशा साथी (Disha Sathi)' : currentLang === 'as' ? 'দিশা সাৰথি (Disha Sathi)' : 'Disha Sathi (Spatial & Clock)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={questionPrompt} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">
            {currentLang === 'hi' ? 'घड़ी और दिशाओं की पहचान से स्थानिक समझ को निखारें।' : currentLang === 'as' ? 'ঘড়ী আৰু দিশ নিৰ্ণয়ৰ অভ্যাসে স্থানিক জ্ঞান বৃদ্ধি কৰে।' : 'Reinforce visuospatial reasoning and orientation.'}
          </p>
        </div>

        <button
          onClick={restartGame}
          type="button"
          className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer self-start sm:self-auto"
          title="Restart"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Pill */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <span className="text-sm font-bold text-gray-600">
          {currentLang === 'hi' ? 'अभ्यास' : currentLang === 'as' ? 'অনুশীলন' : 'Exercise'} {currentIndex + 1} / {ORIENTATION_QUESTIONS.length}
        </span>
        <div className="flex gap-1.5">
          {ORIENTATION_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`w-4 h-2.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-rose-600 w-8' : i < currentIndex ? 'bg-rose-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-elder border-2 border-rose-100 mb-6 text-center">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
          {currentQ.title[currentLang] || currentQ.title.en}
        </h3>

        {/* Visual representation */}
        {currentQ.type === 'clock' && currentQ.clockTime && renderClockFace(currentQ.clockTime.hours, currentQ.clockTime.minutes)}
        {currentQ.type !== 'clock' && renderCompass()}

        <p className="text-gray-800 text-lg sm:text-xl font-semibold leading-relaxed mb-6 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
          {questionPrompt}
        </p>

        {/* Option choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-left">
          {currentQ.options.map((opt, i) => {
            const optLabel = opt[currentLang] || opt.en;
            const correctLabel = currentQ.correctOption[currentLang] || currentQ.correctOption.en;
            const isSelected = selectedAnswer === optLabel;
            const isTarget = optLabel === correctLabel;

            let btnClass = 'bg-white hover:bg-rose-50 border-2 border-gray-200 text-gray-900';

            if (selectedAnswer !== null) {
              if (isTarget) {
                btnClass = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold';
              } else if (isSelected && !isTarget) {
                btnClass = 'bg-red-50 border-2 border-red-500 text-red-900';
              } else {
                btnClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-60';
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelectOption(opt)}
                disabled={selectedAnswer !== null}
                type="button"
                className={`p-4 sm:p-5 rounded-2xl text-base sm:text-lg font-semibold flex items-center justify-between transition-all duration-150 cursor-pointer shadow-sm ${btnClass}`}
              >
                <span>{optLabel}</span>
                {selectedAnswer !== null && isTarget && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                )}
                {selectedAnswer !== null && isSelected && !isTarget && (
                  <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          {!showHint && selectedAnswer === null ? (
            <button
              onClick={() => setShowHint(true)}
              type="button"
              className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
            >
              <Lightbulb className="w-4 h-4" />
              <span>{currentLang === 'hi' ? 'संकेत देखें (Hint)' : currentLang === 'as' ? 'সংকেত চাওক' : 'Show Hint'}</span>
            </button>
          ) : showHint && selectedAnswer === null ? (
            <div className="text-sm font-medium text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 text-left w-full sm:w-auto">
              💡 {currentQ.hint[currentLang] || currentQ.hint.en}
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-700">
              {isCorrect
                ? (currentLang === 'hi' ? '✅ बहुत सुंदर! बिल्कुल सही दिशा एवं समय।' : currentLang === 'as' ? '✅ বৰ ধুনীয়া! সঠিক উত্তৰ।' : '✅ Well done! Accurate orientation.')
                : (currentLang === 'hi' ? 'गलत विकल्प। सही उत्तर को ध्यान में रखें।' : currentLang === 'as' ? 'ভুল বাছনি। সঠিক উত্তৰ মনত ৰাখক।' : 'Review the clock hands or compass points.')}
            </div>
          )}

          {selectedAnswer !== null && (
            <button
              onClick={handleNext}
              type="button"
              className="w-full sm:w-auto bg-rose-700 hover:bg-rose-800 text-white font-bold py-3.5 px-7 rounded-2xl shadow-tactile cursor-pointer"
            >
              {currentIndex + 1 < ORIENTATION_QUESTIONS.length ? (currentLang === 'hi' ? 'अगला अभ्यास' : currentLang === 'as' ? 'পৰৱৰ্তী অনুশীলন' : 'Next Question') : t.common.finish}
            </button>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {completedSession && (
        <GameSummaryModal
          session={completedSession.session}
          leveledUp={completedSession.leveledUp}
          onPlayAgain={restartGame}
          onContinue={restartGame}
        />
      )}
    </div>
  );
};
