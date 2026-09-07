import React, { useState, useEffect } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { DifficultyBadge } from './DifficultyBadge';
import { GameSummaryModal } from './GameSummaryModal';
import { BookOpen, Lightbulb, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface WordPuzzle {
  id: string;
  prompt: { en: string; hi: string; as: string; [key: string]: string };
  category: { en: string; hi: string; as: string; [key: string]: string };
  correctOption: { en: string; hi: string; as: string; [key: string]: string };
  distractors: { en: string; hi: string; as: string; [key: string]: string }[];
  hint: { en: string; hi: string; as: string; [key: string]: string };
  explanation: { en: string; hi: string; as: string; [key: string]: string };
}

const WORD_PUZZLES: WordPuzzle[] = [
  {
    id: 'wp-1',
    category: { en: 'Weather & Nature', hi: 'मौसम एवं प्रकृति', as: 'বতৰ আৰু প্ৰকৃতি' },
    prompt: { en: 'Monsoon Rain', hi: 'सावन की बारिश', as: 'বাৰিষাৰ বৰষুণ' },
    correctOption: { en: 'Umbrella (Chhatri)', hi: 'रंग-बिरंगी छतरी', as: 'ৰং-বিৰঙৰ ছাতি' },
    distractors: [
      { en: 'Flying Kite', hi: 'उड़ती पतंग', as: 'উৰি থকা চিলা' },
      { en: 'Campfire', hi: 'अलाव की आग', as: 'জুইৰ ধোঁৱা' },
      { en: 'Desert Sand', hi: 'रेगिस्तान की रेत', as: 'মৰুভূমিৰ বালি' },
    ],
    hint: {
      en: 'What protects you when raindrops fall from the sky?',
      hi: 'आसमान से पानी बरसते समय आप अपने सिर पर क्या तानते हैं?',
      as: 'আকাশৰ পৰা বৰষুণ পৰিলে মূৰৰ ওপৰত কি ধৰে?',
    },
    explanation: {
      en: 'Rain and umbrella are closely linked by protective utility.',
      hi: 'बारिश और छतरी का संबंध वर्षा से बचाव का स्वाभाविक संबंध है।',
      as: 'বৰষুণ আৰু ছাতিৰ সম্পৰ্ক ৰক্ষণা-বেক্ষণৰ সৈতে জড়িত।',
    },
  },
  {
    id: 'wp-2',
    category: { en: 'Traditional Daily Life', hi: 'पारंपरिक दिनचर्या', as: 'পৰম্পৰাগত জীৱন' },
    prompt: { en: 'Earthen Diya (Lamp)', hi: 'मिट्टी का दीया', as: 'মাটিৰ চাকি' },
    correctOption: { en: 'Mustard Oil & Cotton Wick', hi: 'सरसों तेल और रुई की बाती', as: 'মিঠা তেল আৰু কপাহী শলিতা' },
    distractors: [
      { en: 'Cold River Water', hi: 'नदी का ठंडा पानी', as: 'নদীৰ ঠাণ্ডা পানী' },
      { en: 'Writing Notebook', hi: 'लिखने की कॉपी', as: 'লিখা বহী' },
      { en: 'Rubber Eraser', hi: 'मिटाने वाली रबर', as: 'ৰবৰ' },
    ],
    hint: {
      en: 'What feeds the sacred flame so that it shines in darkness?',
      hi: 'दीपक की लौ को जलाने के लिए उसमें क्या डाला जाता है?',
      as: 'চাকিৰ পোহৰ জ্বলাই ৰাখিবলৈ তাত কি দিয়া হয়?',
    },
    explanation: {
      en: 'Oil and wick nourish the sacred flame of the diya.',
      hi: 'तेल और बाती मिलकर दिए को प्रकाशमय बनाते हैं।',
      as: 'তেল আৰু শলিতাই চাকিৰ পোহৰ জ্বলাই ৰাখে।',
    },
  },
  {
    id: 'wp-3',
    category: { en: 'Kitchen & Tastes', hi: 'रसोई और स्वाद', as: 'ৰান্ধনী আৰু সোৱাদ' },
    prompt: { en: 'Hot Morning Chai', hi: 'सुबह की गरमा-गरम चाय', as: 'পুৱাৰ গৰম চাহ' },
    correctOption: { en: 'Crushed Ginger & Cardamom', hi: 'कुटी हुई अदरक और इलायची', as: 'থেতেলিয়াই লোৱা আদা আৰু ইলাচী' },
    distractors: [
      { en: 'Tamarind Chutney', hi: 'इमली की खट्टी चटनी', as: 'তেঁতেলীৰ টেঙা চাটনি' },
      { en: 'Ice Cubes', hi: 'बर्फ के टुकड़े', as: 'বৰফৰ টুকুৰা' },
      { en: 'Sewing Needle', hi: 'सिलाई की सुई', as: 'বেজি' },
    ],
    hint: {
      en: 'Spices that give hot tea its warming aroma and health benefits.',
      hi: 'वे सुगंधित मसाले जो चाय के स्वाद और ताजगी को बढ़ाते हैं।',
      as: 'চাহৰ সুবাস আৰু সোৱাদ বৃদ্ধি কৰা মছলা।',
    },
    explanation: {
      en: 'Ginger and cardamom are the classic heartwarming additions to Indian chai.',
      hi: 'अदरक और इलायची चाय के पारंपरिक साथी हैं जो मन को ताजगी देते हैं।',
      as: 'আদা আৰু ইলাচী চাহৰ চিৰন্তন সংগী।',
    },
  },
  {
    id: 'wp-4',
    category: { en: 'Seasons & Nature', hi: 'ऋतुएं एवं मौसम', as: 'ঋতু আৰু বতৰ' },
    prompt: { en: 'Winter Morning Chill', hi: 'दिसंबर की गुलाबी ठंड', as: 'শীতকালৰ পুৱাৰ জাৰ' },
    correctOption: { en: 'Warm Woolen Shawl', hi: 'पश्मीना ऊनी शॉल', as: 'উমাল পশমী শাল' },
    distractors: [
      { en: 'Ceiling Fan at full speed', hi: 'तेज़ घूमता पंखा', as: 'ঘূৰি থকা ফেন' },
      { en: 'Chilled Coconut Water', hi: 'ठंडा नारियल पानी', as: 'ঠাণ্ডা ডাবৰ পানী' },
      { en: 'Cotton Sleeveless Shirt', hi: 'सूती बनियान', as: 'চুটি চোলা' },
    ],
    hint: {
      en: 'What wraps comfortably around your shoulders on a cold veranda?',
      hi: 'ठंडी हवा से बचने के लिए आप अपने कंधों पर क्या ओढ़ते हैं?',
      as: 'শীতৰ দিনত গাটো উমাল কৰি ৰাখিবলৈ কি গাত লয়?',
    },
    explanation: {
      en: 'Woolen shawls protect against seasonal drops in temperature.',
      hi: 'ऊनी शॉल ठंड के मौसम में गर्माहट और सुकून देती है।',
      as: 'পশমী শালে শীতকালত শৰীৰ উমাল কৰি ৰাখে।',
    },
  },
  {
    id: 'wp-5',
    category: { en: 'Morning Traditions', hi: 'प्रभात बेला', as: 'পুৱাৰ সময়' },
    prompt: { en: 'Sunrise (Surya Uday)', hi: 'प्रातः सूर्योदय', as: 'পুৱাৰ সূৰ্যোদয়' },
    correctOption: { en: 'Golden Sunlight & Fresh Breeze', hi: 'सुनहरी धूप और ठंडी हवा', as: 'সোণালী ৰ\'দ আৰু জুৰ মলয়া' },
    distractors: [
      { en: 'Dark Moon & Midnight Stars', hi: 'आधी रात के तारे', as: 'নিশাৰ তৰা' },
      { en: 'Closed Bed Curtains', hi: 'गहरी नींद के पर्दे', as: 'টোপনিৰ পৰ্দা' },
      { en: 'Thunderstorm Hail', hi: 'ओले और बिजली', as: 'শিলাবৃষ্টি' },
    ],
    hint: {
      en: 'What bathes the courtyard in warm brightness every morning?',
      hi: 'सूरज उगने पर चारों ओर क्या फैल जाता है?',
      as: 'সূৰ্য উঠিলে চাৰিওফালে কি বিয়পি পৰে?',
    },
    explanation: {
      en: 'The rising sun brings natural light, vitamin D, and diurnal awakening.',
      hi: 'सूर्योदय जीवन में नई ऊर्जा और सुनहरी रोशनी लाता है।',
      as: 'সূৰ্যোদয়ে নতুন দিন আৰু সোণালী পোহৰ আনে।',
    },
  },
];

export const WordAssociationGame: React.FC<{ initialDifficulty?: DifficultyTier }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang, t } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<{ text: { en: string; hi: string; as: string; [key: string]: string }; isCorrect: boolean }[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);

  const currentPuzzle = WORD_PUZZLES[currentIndex % WORD_PUZZLES.length];

  // Shuffle options whenever puzzle changes
  useEffect(() => {
    const opts = [
      { text: currentPuzzle.correctOption, isCorrect: true },
      ...currentPuzzle.distractors.map((d) => ({ text: d, isCorrect: false })),
    ];
    setShuffledOptions(opts.sort(() => Math.random() - 0.5));
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowHint(false);
  }, [currentIndex, currentPuzzle]);

  const handleSelectOption = (opt: { text: { en: string; hi: string; as: string; [key: string]: string }; isCorrect: boolean }) => {
    if (selectedAnswer !== null) return; // Prevent multiple clicks

    const answerText = opt.text[currentLang] || opt.text.en;
    setSelectedAnswer(answerText);
    setIsCorrect(opt.isCorrect);

    if (opt.isCorrect) {
      soundService.playMatchSuccess();
      setCorrectCount((prev) => prev + 1);
    } else {
      soundService.playSoftMistake();
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < WORD_PUZZLES.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Game complete
      const durationSeconds = Math.max(15, Math.round((Date.now() - startTime) / 1000));
      const accuracy = Math.round((correctCount / WORD_PUZZLES.length) * 100);
      const result = gameService.recordSession({
        gameId: 'shabda_mala',
        durationSeconds,
        accuracy,
        mistakesCount: WORD_PUZZLES.length - correctCount,
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

  const promptText = currentPuzzle.prompt[currentLang] || currentPuzzle.prompt.en;
  const categoryText = currentPuzzle.category[currentLang] || currentPuzzle.category.en;
  const questionNarration = currentLang === 'hi'
    ? `${categoryText}। शब्द है: ${promptText}। इसका सबसे सही जुड़ा हुआ साथी शब्द चुनें।`
    : currentLang === 'as'
    ? `${categoryText}। শব্দ: ${promptText}। ইয়াৰ উপযুক্ত সংগী শব্দ বাছক।`
    : `${categoryText}. The word is: ${promptText}. Pick the closest natural association.`;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-teal-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'शब्द माला (Shabda Mala)' : currentLang === 'as' ? 'শব্দ মালা (Shabda Mala)' : 'Shabda Mala (Word Association)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={questionNarration} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">
            {currentLang === 'hi' ? 'शब्दों के स्वाभाविक संबंध को पहचानें और सही विकल्प चुनें।' : currentLang === 'as' ? 'শব্দৰ অৰ্থপূৰ্ণ সম্পৰ্ক বিচাৰি সঠিক উত্তৰ দিয়ক।' : 'Identify connected ideas to exercise semantic fluency and vocabulary.'}
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
          {currentLang === 'hi' ? 'प्रश्न' : currentLang === 'as' ? 'প্ৰশ্ন' : 'Question'} {currentIndex + 1} / {WORD_PUZZLES.length}
        </span>
        <div className="flex gap-1.5">
          {WORD_PUZZLES.map((_, i) => (
            <div
              key={i}
              className={`w-4 h-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-teal-600 w-8'
                  : i < currentIndex
                  ? 'bg-teal-300'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Puzzle Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-elder border-2 border-teal-100 mb-6 text-center relative overflow-hidden">
        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 mb-3">
          {categoryText}
        </span>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 tracking-wide">
          {promptText}
        </h2>
        <p className="text-gray-500 text-sm sm:text-base mb-6">
          {currentLang === 'hi' ? 'इससे सबसे गहरा जुड़ा हुआ शब्द कौन सा है?' : currentLang === 'as' ? 'ইয়াৰ সৈতে আটাইতকৈ উপযুক্ত সম্পৰ্কিত শব্দ কোনটো?' : 'Which word naturally pairs with this?'}
        </p>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 text-left">
          {shuffledOptions.map((opt, i) => {
            const optLabel = opt.text[currentLang] || opt.text.en;
            const isSelected = selectedAnswer === optLabel;
            let btnClass = 'bg-white hover:bg-teal-50/60 border-2 border-gray-200 text-gray-800';

            if (selectedAnswer !== null) {
              if (opt.isCorrect) {
                btnClass = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold';
              } else if (isSelected && !opt.isCorrect) {
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
                {selectedAnswer !== null && opt.isCorrect && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                )}
                {selectedAnswer !== null && isSelected && !opt.isCorrect && (
                  <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hint and feedback area */}
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
              <Lightbulb className="w-4 h-4" />
              <span>{currentLang === 'hi' ? 'संकेत देखें (Hint)' : currentLang === 'as' ? 'সংকেত চাওক' : 'Show Hint'}</span>
            </button>
          ) : showHint && selectedAnswer === null ? (
            <div className="text-sm font-medium text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 text-left w-full sm:w-auto">
              💡 {currentPuzzle.hint[currentLang] || currentPuzzle.hint.en}
            </div>
          ) : (
            <div className="text-sm text-gray-600 text-left">
              {currentPuzzle.explanation[currentLang] || currentPuzzle.explanation.en}
            </div>
          )}

          {selectedAnswer !== null && (
            <button
              onClick={handleNext}
              type="button"
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-7 rounded-2xl shadow-tactile cursor-pointer"
            >
              {currentIndex + 1 < WORD_PUZZLES.length ? (currentLang === 'hi' ? 'अगला प्रश्न' : currentLang === 'as' ? 'পৰৱৰ্তী প্ৰশ্ন' : 'Next Question') : t.common.finish}
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
