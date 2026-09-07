import React, { useState, useEffect } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from './DifficultyBadge';
import { GameSummaryModal } from './GameSummaryModal';
import { ShoppingBag, Coins, CheckCircle2, XCircle, RotateCcw, HelpCircle } from 'lucide-react';

interface MarketScenario {
  id: string;
  stallName: { en: string; hi: string; as: string; [key: string]: string };
  emoji: string;
  question: { en: string; hi: string; as: string; [key: string]: string };
  itemsList: { name: { en: string; hi: string; as: string; [key: string]: string }; price: number; quantity: string }[];
  noteGiven?: number; // e.g. 100 or 500
  correctAnswer: number;
  options: number[];
  hint: { en: string; hi: string; as: string; [key: string]: string };
}

const MARKET_SCENARIOS: MarketScenario[] = [
  {
    id: 'scen-1',
    stallName: { en: 'Fruit Stall', hi: 'ताज़ा फल की दुकान', as: 'ফলৰ দোকান' },
    emoji: '🍎',
    question: {
      en: 'You buy 2 kg sweet Apples at ₹40 per kg. You hand a ₹100 note to the shopkeeper. How much change will you receive?',
      hi: 'आपने ₹40 प्रति किलो के भाव से 2 किलो मीठे सेब खरीदे। आपने दुकानदार को ₹100 का नोट दिया। आपको कितने रुपये वापस मिलेंगे?',
      as: 'আপুনি ৪০ টকা দৰত ২ কেজি মিঠা আপেল কিনিলে। দোকানীজনক ১০০ টকাৰ নোট এখন দিলে। কিমান টকা উভতি পাব?',
    },
    itemsList: [{ name: { en: 'Apples', hi: 'ताज़ा सेब', as: 'আপেল' }, price: 40, quantity: '2 kg' }],
    noteGiven: 100,
    correctAnswer: 20,
    options: [20, 30, 10, 25],
    hint: {
      en: '2 kg apples cost 2 × 40 = ₹80. Subtract 80 from 100.',
      hi: '2 किलो सेब = 2 × 40 = ₹80 हुए। ₹100 में से ₹80 घटाइए।',
      as: '২ কেজি আপেল = ২ × ৪০ = ৮০ টকা। ১০০ টকাৰ পৰা ৮০ বিয়োগ কৰক।',
    },
  },
  {
    id: 'scen-2',
    stallName: { en: 'Dairy & Milk Booth', hi: 'दूध व डेयरी केंद्र', as: 'গাখীৰৰ দোকান' },
    emoji: '🥛',
    question: {
      en: 'You buy 1 liter of fresh cow milk for ₹60 and 250 grams of fresh paneer for ₹80. What is your total bill?',
      hi: 'आपने ₹60 का एक लीटर गाय का दूध और ₹80 का ताज़ा पनीर खरीदा। कुल कितना बिल बना?',
      as: 'আপুনি ৬০ টকাৰ ১ লিটাৰ গাখীৰ আৰু ৮০ টকাৰ সতেজ পনীৰ কিনিলে। মুঠ কিমান টকা হ\'ল?',
    },
    itemsList: [
      { name: { en: 'Cow Milk', hi: 'गाय का दूध (1L)', as: 'গাখীৰ (১ লিটাৰ)' }, price: 60, quantity: '1 Liter' },
      { name: { en: 'Fresh Paneer', hi: 'ताज़ा पनीर (250g)', as: 'পনীৰ (২৫০ গ্ৰাম)' }, price: 80, quantity: '250g' },
    ],
    correctAnswer: 140,
    options: [140, 130, 150, 120],
    hint: {
      en: 'Add ₹60 for milk and ₹80 for paneer: 60 + 80 = ?',
      hi: 'दूध के ₹60 और पनीर के ₹80 जोड़ें: 60 + 80 = ?',
      as: 'গাখীৰৰ ৬০ আৰু পনীৰৰ ৮০ যোগ কৰক: ৬০ + ৮০ = ?',
    },
  },
  {
    id: 'scen-3',
    stallName: { en: 'Green Vegetable Cart', hi: 'हरी सब्ज़ी की रेहड़ी', as: 'শাক-পাচলিৰ দোকান' },
    emoji: '🥬',
    question: {
      en: 'You buy Palak (Spinach) for ₹25, Tomatoes for ₹35, and fresh Coriander for ₹10. What is the total cost?',
      hi: 'आपने ₹25 की पालक, ₹35 के टमाटर और ₹10 का ताज़ा हरा धनिया लिया। कुल कितने रुपये हुए?',
      as: 'আপুনি ২৫ টকাৰ পালেং, ৩৫ টকাৰ বিলাহী আৰু ১০ টকাৰ ধনিয়া কিনিলে। মুঠ কিমান হ\'ল?',
    },
    itemsList: [
      { name: { en: 'Spinach', hi: 'पालक की गड्डी', as: 'পালেং শাক' }, price: 25, quantity: '1 bunch' },
      { name: { en: 'Tomatoes', hi: 'देसी टमाटर', as: 'বিলাহী' }, price: 35, quantity: '1 kg' },
      { name: { en: 'Coriander', hi: 'हरा धनिया', as: 'ধনিয়া' }, price: 10, quantity: '1 bunch' },
    ],
    correctAnswer: 70,
    options: [70, 60, 75, 80],
    hint: {
      en: 'Add 25 + 35 = 60, then add 10 for coriander: 60 + 10 = ?',
      hi: 'पहले 25 और 35 जोड़ें (60), फिर धनिया के 10 जोड़ें: 60 + 10 = ?',
      as: 'প্ৰথমে ২৫ আৰু ৩৫ যোগ কৰক (৬০), তাৰ পিছত ১০ যোগ কৰক: ৬০ + ১০ = ?',
    },
  },
  {
    id: 'scen-4',
    stallName: { en: 'Grandmother’s Purse', hi: 'दादी का बटुआ', as: 'আইতাৰ মোনা' },
    emoji: '👛',
    question: {
      en: 'Inside your purse, you have one ₹50 note and two ₹20 notes. How much total money do you have?',
      hi: 'आपके बटुए में ₹50 का एक नोट और ₹20 के दो नोट हैं। आपके पास कुल कितने रुपये हैं?',
      as: 'আপোনাৰ মোনাত ৫০ টকাৰ এখন আৰু ২০ টকাৰ দুখন নোট আছে। মুঠ কিমান টকা আছে?',
    },
    itemsList: [
      { name: { en: '₹50 Note', hi: '₹50 का नोट', as: '৫০ টকাৰ নোট' }, price: 50, quantity: '1' },
      { name: { en: '₹20 Notes', hi: '₹20 के 2 नोट', as: '২০ টকাৰ ২ খন নোট' }, price: 40, quantity: '2' },
    ],
    correctAnswer: 90,
    options: [90, 80, 100, 70],
    hint: {
      en: 'One ₹50 note + two ₹20 notes (₹40) = 50 + 40 = ?',
      hi: 'एक ₹50 का नोट + दो ₹20 के नोट (₹40) = 50 + 40 = ?',
      as: 'এখন ৫০ টকাৰ নোট + দুখন ২০ টকাৰ নোট (৪০) = ৫০ + ৪০ = ?',
    },
  },
];

export const MarketMathGame: React.FC<{ initialDifficulty?: DifficultyTier }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang, t } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);

  const scenario = MARKET_SCENARIOS[currentIndex % MARKET_SCENARIOS.length];

  useEffect(() => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowHint(false);
  }, [currentIndex]);

  const handleSelectOption = (val: number) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(val);
    const correct = val === scenario.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      soundService.playMatchSuccess();
      setCorrectCount((prev) => prev + 1);
    } else {
      soundService.playSoftMistake();
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < MARKET_SCENARIOS.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const durationSeconds = Math.max(15, Math.round((Date.now() - startTime) / 1000));
      const accuracy = Math.round((correctCount / MARKET_SCENARIOS.length) * 100);

      const result = gameService.recordSession({
        gameId: 'bazaar_hisaab',
        durationSeconds,
        accuracy,
        mistakesCount: MARKET_SCENARIOS.length - correctCount,
        hintsUsed: hintsUsedCount,
        difficulty,
      });
      setCompletedSession(result);
    }
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setCorrectCount(0);
    setHintsUsedCount(0);
    setCompletedSession(null);
    setStartTime(Date.now());
  };

  const stallTitle = scenario.stallName[currentLang] || scenario.stallName.en;
  const questionText = scenario.question[currentLang] || scenario.question.en;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-blue-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'बाज़ार हिसाब (Bazaar Hisaab)' : currentLang === 'as' ? 'বজাৰ হিচাপ (Bazaar Hisaab)' : 'Bazaar Hisaab (Daily Market Math)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={questionText} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">
            {currentLang === 'hi' ? 'दैनिक बाज़ार खरीदारी और सही पैसों का हिसाब लगाएं।' : currentLang === 'as' ? 'দৈনন্দিন বজাৰ আৰু টকা-পইচাৰ সঠিক হিচাপ কৰক।' : 'Everyday grocery math for practical calculation and executive function.'}
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
          {currentLang === 'hi' ? 'दुकान' : currentLang === 'as' ? 'দোকান' : 'Stall'} {currentIndex + 1} / {MARKET_SCENARIOS.length}
        </span>
        <div className="flex gap-1.5">
          {MARKET_SCENARIOS.map((_, i) => (
            <div
              key={i}
              className={`w-4 h-2.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-blue-600 w-8' : i < currentIndex ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Market Stall Scenario Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-elder border-2 border-blue-100 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl p-3 bg-blue-50 rounded-2xl border border-blue-200">{scenario.emoji}</span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
              {stallTitle}
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
              {currentLang === 'hi' ? 'खरीदारी का हिसाब' : currentLang === 'as' ? 'বজাৰৰ হিচাপ' : 'Market Bill'}
            </h3>
          </div>
        </div>

        {/* Question Paragraph */}
        <p className="text-gray-800 text-lg sm:text-xl font-semibold leading-relaxed mb-6 bg-[#F8FAFC] p-4 rounded-2xl border border-blue-100">
          {questionText}
        </p>

        {/* Items Breakdown Table */}
        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 mb-6">
          <div className="text-xs font-bold uppercase text-amber-900 tracking-wider mb-2 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" />
            <span>{currentLang === 'hi' ? 'खरीदी गई सामग्री' : currentLang === 'as' ? 'কিনা সামগ্ৰী' : 'Items in Basket'}</span>
          </div>
          <div className="divide-y divide-amber-200/60">
            {scenario.itemsList.map((item, idx) => (
              <div key={idx} className="py-2 flex justify-between items-center text-sm sm:text-base">
                <span className="font-semibold text-gray-800">
                  {item.name[currentLang] || item.name.en} ({item.quantity})
                </span>
                <span className="font-extrabold text-blue-900">₹{item.price}</span>
              </div>
            ))}
            {scenario.noteGiven && (
              <div className="py-2 flex justify-between items-center text-sm sm:text-base text-gray-600">
                <span>{currentLang === 'hi' ? 'दिया गया नोट' : currentLang === 'as' ? 'দিয়া নোট' : 'Note Paid'}</span>
                <span className="font-bold text-emerald-800">₹{scenario.noteGiven}</span>
              </div>
            )}
          </div>
        </div>

        {/* Numerical Options Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          {scenario.options.map((opt, i) => {
            const isSelected = selectedAnswer === opt;
            const isTarget = opt === scenario.correctAnswer;
            let btnClass = 'bg-white hover:bg-blue-50 border-2 border-gray-200 text-gray-900';

            if (selectedAnswer !== null) {
              if (isTarget) {
                btnClass = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-extrabold';
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
                className={`py-5 px-4 rounded-2xl text-2xl sm:text-3xl font-extrabold flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shadow-sm ${btnClass}`}
              >
                <span>₹{opt}</span>
                {selectedAnswer !== null && isTarget && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1" />
                )}
                {selectedAnswer !== null && isSelected && !isTarget && (
                  <XCircle className="w-5 h-5 text-red-600 mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer controls: Hint & Next */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          {!showHint && selectedAnswer === null ? (
            <button
              onClick={() => {
                setShowHint(true);
                setHintsUsedCount((c) => c + 1);
              }}
              type="button"
              className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{currentLang === 'hi' ? 'संकेत देखें (Hint)' : currentLang === 'as' ? 'সংকেত চাওক' : 'Show Calculation Hint'}</span>
            </button>
          ) : showHint && selectedAnswer === null ? (
            <div className="text-sm font-medium text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 text-left w-full sm:w-auto">
              💡 {scenario.hint[currentLang] || scenario.hint.en}
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-700">
              {isCorrect
                ? (currentLang === 'hi' ? '✅ शाबाश! बिल्कुल सही हिसाब।' : currentLang === 'as' ? '✅ বৰ ধুনীয়া! সঠিক হিচাপ।' : '✅ Correct calculation!')
                : (currentLang === 'hi' ? `सही उत्तर ₹${scenario.correctAnswer} है।` : currentLang === 'as' ? `সঠিক উত্তৰ ₹${scenario.correctAnswer}।` : `Correct answer was ₹${scenario.correctAnswer}.`)}
            </div>
          )}

          {selectedAnswer !== null && (
            <button
              onClick={handleNext}
              type="button"
              className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-bold py-3.5 px-7 rounded-2xl shadow-tactile cursor-pointer"
            >
              {currentIndex + 1 < MARKET_SCENARIOS.length ? (currentLang === 'hi' ? 'अगला बाज़ार' : currentLang === 'as' ? 'পৰৱৰ্তী বজাৰ' : 'Next Scenario') : t.common.finish}
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
