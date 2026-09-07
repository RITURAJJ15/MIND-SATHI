import React from 'react';
import { DailyPlanCard } from '../components/dashboard/DailyPlanCard';
import { useLanguage } from '../hooks/useLanguage';
import { useSpeech } from '../hooks/useSpeech';
import { VoicePromptButton } from '../components/common/VoicePromptButton';
import { CalendarCheck, Sun, Moon, Sunrise, Coffee } from 'lucide-react';

export const DailyPlanPage: React.FC<{ onPlayGame: (gameId: string) => void; onOpenMemories: () => void }> = ({
  onPlayGame,
  onOpenMemories,
}) => {
  const { currentLang, t } = useLanguage();

  const introText = currentLang === 'hi'
    ? 'आपकी व्यक्तिगत दिनचर्या सुबह, दोपहर और शाम के संतुलित कार्यों से मिलकर बनी है। यह आपके मन, स्मृति और शरीर को ऊर्जावान रखती है।'
    : currentLang === 'as'
    ? 'আপোনাৰ দৈনিক ৰুটিন পুৱা, দুপৰীয়া আৰু সন্ধিয়াৰ সুষম কামেৰে গঠিত।'
    : 'Your personalized daily activity plan blends morning cognitive arousal, midday language/memory exercise, and evening calming routines.';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-sathi-600 to-sage-600 text-white p-6 sm:p-8 rounded-3xl shadow-elder">
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="w-7 h-7" />
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t.nav.dailyPlan}</h1>
          <VoicePromptButton text={introText} size="sm" />
        </div>
        <p className="text-amber-100 text-sm sm:text-base max-w-2xl mt-1 leading-relaxed">
          {introText}
        </p>
      </div>

      {/* Routine Breakdown Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 text-center">
          <Sunrise className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h4 className="font-extrabold text-gray-900 text-base">
            {currentLang === 'hi' ? 'प्रातः काल (Morning)' : currentLang === 'as' ? 'পুৱাৰ সময়' : 'Morning Vitality'}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {currentLang === 'hi' ? 'गुनगुना पानी और स्मृति संगम' : currentLang === 'as' ? 'কুহুমীয়া পানী আৰু স্মৃতি খেল' : 'Warm water & Visual Memory'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-teal-200 text-center">
          <Sun className="w-8 h-8 text-teal-600 mx-auto mb-2" />
          <h4 className="font-extrabold text-gray-900 text-base">
            {currentLang === 'hi' ? 'मध्याह्न (Afternoon)' : currentLang === 'as' ? 'দুপৰীয়াৰ সময়' : 'Afternoon Agility'}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {currentLang === 'hi' ? 'शब्द माला व पारिवारिक यादें' : currentLang === 'as' ? 'শব্দ সংযোগ আৰু স্মৃতি' : 'Shabda Mala & Family Memories'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-200 text-center">
          <Moon className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
          <h4 className="font-extrabold text-gray-900 text-base">
            {currentLang === 'hi' ? 'सायं काल (Evening)' : currentLang === 'as' ? 'সন্ধিয়াৰ সময়' : 'Evening Calm'}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {currentLang === 'hi' ? 'रंगोली रेखा व अपनों से बातचीत' : currentLang === 'as' ? 'ৰঙালী ৰেখা আৰু কথা-বতৰা' : 'Rangoli Rekha & Family Connection'}
          </p>
        </div>
      </div>

      {/* Main Checklist Card */}
      <DailyPlanCard onPlayGame={onPlayGame} onOpenMemories={onOpenMemories} />
    </div>
  );
};
