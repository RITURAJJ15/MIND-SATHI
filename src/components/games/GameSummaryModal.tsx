import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, CheckCircle, RotateCcw, ArrowRight, Zap, Trophy } from 'lucide-react';
import { GameSession } from '../../types/game';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';

interface GameSummaryModalProps {
  session: GameSession;
  leveledUp: boolean;
  onPlayAgain: () => void;
  onContinue: () => void;
}

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
  session,
  leveledUp,
  onPlayAgain,
  onContinue,
}) => {
  const { currentLang, t } = useLanguage();
  const { speakText } = useSpeech();

  useEffect(() => {
    // Launch celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#D26727', '#EAA56D', '#5F8867', '#F2C69E', '#1E3A8A'],
    });

    const congratulatorySpeech: Record<string, string> = {
      en: `Wonderful job! You scored ${session.score} points with ${session.accuracy}% accuracy and earned ${session.xpEarned} Sathi XP!`,
      hi: `बहुत खूब! आपने ${session.score} अंक और ${session.accuracy}% सटीकता के साथ ${session.xpEarned} साथी अंक अर्जित किए हैं!`,
      as: `বৰ ধুনীয়া! আপুনি ${session.score} নম্বৰ আৰু ${session.accuracy}% শুদ্ধতাৰে ${session.xpEarned} সাৰথি পইন্ট পালে!`,
    };
    speakText(congratulatorySpeech[currentLang] || congratulatorySpeech.hi);
  }, []);

  const spokenSummary = currentLang === 'hi' 
    ? `शाबाश! आपने ${session.xpEarned} साथी अंक प्राप्त किए हैं। आपकी सटीकता ${session.accuracy}% रही।`
    : currentLang === 'as'
    ? `বৰ ধুনীয়া! আপুনি ${session.xpEarned} সাৰথি পইন্ট পালে। শুদ্ধতা ${session.accuracy}%।`
    : `Outstanding! You earned ${session.xpEarned} Sathi XP with ${session.accuracy}% accuracy!`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-4 border-amber-300 text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-amber-400 via-sathi-500 to-sage-500" />

        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-amber-200">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {session.accuracy >= 85 ? t.games.outstanding : t.games.wellDone}
          </h2>
          <VoicePromptButton text={spokenSummary} size="sm" />
        </div>

        <p className="text-gray-600 text-base mb-6">
          {session.accuracy >= 75 ? t.games.wellDone : t.games.keepPracticing}
        </p>

        {leveledUp && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500 to-sathi-600 text-white rounded-2xl shadow-md flex items-center justify-center gap-3">
            <Zap className="w-7 h-7 text-yellow-300 animate-bounce" />
            <div className="text-left">
              <div className="text-xs uppercase font-bold tracking-wider text-amber-200">Level Up!</div>
              <div className="text-lg font-extrabold">Congratulations! You advanced to a new tier!</div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <div className="text-xs text-amber-800 font-bold mb-1">{t.common.xp}</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sathi-700">+{session.xpEarned}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <div className="text-xs text-emerald-800 font-bold mb-1">{t.common.accuracy}</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">{session.accuracy}%</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <div className="text-xs text-blue-800 font-bold mb-1">{t.common.time}</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-700">{session.durationSeconds}s</div>
          </div>
        </div>

        {/* Encouraging observation */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-left mb-6 text-sm text-gray-700 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-gray-900">
              {currentLang === 'hi' ? 'मानसिक प्रभाव: ' : currentLang === 'as' ? 'মানসিক প্ৰভাৱ: ' : 'Brain Benefit: '}
            </span>
            {currentLang === 'hi'
              ? 'यह अभ्यास आपकी तंत्रिका कोशिकाओं (न्यूरॉन्स) के बीच संपर्क और याद रखने की क्षमता को सुदृढ़ करता है।'
              : currentLang === 'as'
              ? 'এই অভ্যাসে মগজুৰ স্নায়ুকোষসমূহ সক্ৰিয় কৰি স্মৃতিশক্তি বৃদ্ধি কৰাত সহায় কৰে।'
              : 'This session strengthened visual memory networks and reaction vigilance.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            type="button"
            className="flex-1 py-4 px-5 rounded-2xl border-2 border-gray-300 hover:border-sathi-500 font-bold text-gray-800 hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            <RotateCcw className="w-5 h-5" />
            <span>{t.games.playAgain}</span>
          </button>
          <button
            onClick={onContinue}
            type="button"
            className="flex-1 py-4 px-5 rounded-2xl bg-sathi-600 hover:bg-sathi-700 text-white font-bold shadow-tactile flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            <span>{t.common.continue}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
