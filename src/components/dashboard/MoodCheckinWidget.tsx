import React, { useState } from 'react';
import { caregiverService, MoodLog } from '../../services/caregiverService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { Heart, Smile, Sparkles, Coffee } from 'lucide-react';

export const MoodCheckinWidget: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();
  const [selectedMood, setSelectedMood] = useState<MoodLog['mood'] | null>(null);

  const moods: { id: MoodLog['mood']; emoji: string; label: { en: string; hi: string; as: string; [key: string]: string }; color: string }[] = [
    { id: 'peaceful', emoji: '🕊️', label: { en: 'Peaceful', hi: 'शांत व प्रसन्न', as: 'প্ৰশান্ত' }, color: 'hover:bg-emerald-50 border-emerald-200' },
    { id: 'joyful', emoji: '😊', label: { en: 'Joyful', hi: 'आनंदित', as: 'আনন্দিত' }, color: 'hover:bg-amber-50 border-amber-200' },
    { id: 'neutral', emoji: '🌿', label: { en: 'Normal', hi: 'सामान्य', as: 'স্বাভাৱিক' }, color: 'hover:bg-blue-50 border-blue-200' },
    { id: 'tired', emoji: '☕', label: { en: 'Tired', hi: 'थकान', as: 'ভাগৰুৱা' }, color: 'hover:bg-purple-50 border-purple-200' },
  ];

  const handleMoodSelect = (mood: MoodLog['mood']) => {
    setSelectedMood(mood);
    caregiverService.recordMood(currentUser.id, mood, 4);

    const voiceFeedback: Record<MoodLog['mood'], { en: string; hi: string; as: string; [key: string]: string }> = {
      peaceful: {
        en: 'It is beautiful to feel peaceful. May your day continue in calm contentment.',
        hi: 'यह जानकर बहुत खुशी हुई कि आपका मन शांत और प्रसन्न है। आपका दिन मंगलमय हो।',
        as: 'মনটো শান্ত থকা দেখি বৰ ভাল লাগিল। আপোনাৰ দিনটো শুভ হওক।',
      },
      joyful: {
        en: 'Your happiness brings joy to the whole family! Keep smiling.',
        hi: 'आपकी मुस्कान पूरे परिवार को खुशियां देती है! ऐसे ही प्रसन्न रहें।',
        as: 'আপোনাৰ সন্তুষ্টিয়ে পৰিয়াললৈ আনন্দ আনে! সদায় হাঁহি থাকক।',
      },
      neutral: {
        en: 'A steady day is a good day. Enjoy a light brain game or memory today.',
        hi: 'एक संतुलित दिन उत्तम दिन होता है। आइए एक छोटा खेल खेलकर मन तरोताज़ा करें।',
        as: 'এটা সন্তুলিত দিন সদায় ভাল। এটা সুন্দৰ খেল খেলি মন সতেজ কৰক।',
      },
      tired: {
        en: 'Please rest comfortably and sip some warm water. We are here with you.',
        hi: 'कृपया आराम करें और थोड़ा गुनगुना पानी पिएं। परिवार आपके साथ है।',
        as: 'অলপ জিৰণি লওক আৰু কুহুমীয়া গৰম পানী খাওক।',
      },
      anxious: {
        en: 'Take three slow deep breaths. Priya has been notified.',
        hi: 'गहरी सांस लें। प्रिया को सूचना भेज दी गई है।',
        as: 'দীঘল উশাহ লওক। পৰিয়াললৈ খবৰ দিয়া হৈছে।',
      },
    };

    const msg = voiceFeedback[mood][currentLang] || voiceFeedback[mood].hi;
    speakText(msg);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-100" />
          <span>{currentLang === 'hi' ? 'आज मन कैसा है?' : currentLang === 'as' ? 'আজি মনটো কেনে?' : 'How Are You Feeling Today?'}</span>
        </h3>
        <span className="text-xs font-semibold text-gray-500">
          {currentLang === 'hi' ? 'दैनिक अनुभव' : currentLang === 'as' ? 'দৈনিক অনুভৱ' : 'Daily Check-in'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {currentLang === 'hi' ? 'अपने मन की स्थिति चुनें, ताकि आपकी देखभालकर्ता को आपकी स्थिति का पता रहे।' : currentLang === 'as' ? 'মনৰ অৱস্থা বাছক যাতে যত্নকাৰীয়ে আপোনাৰ খবৰ পাই থাকে।' : 'Select how you feel; your caregiver can check in to support you.'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {moods.map((m) => {
          const isSelected = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleMoodSelect(m.id)}
              type="button"
              className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-100 border-amber-500 scale-105 shadow-md font-bold'
                  : `bg-gray-50 ${m.color} text-gray-800`
              }`}
            >
              <span className="text-3xl mb-1">{m.emoji}</span>
              <span className="text-xs sm:text-sm font-semibold text-center">
                {m.label[currentLang] || m.label.en}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
