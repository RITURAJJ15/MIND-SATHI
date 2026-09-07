import React from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { Flame, Award, Zap, Trophy } from 'lucide-react';

export const StreakXPWidget: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();

  const nextLevelXp = currentUser.level === 1 ? 400 : currentUser.level === 2 ? 1000 : currentUser.level === 3 ? 1800 : 3000;
  const prevLevelXp = currentUser.level === 1 ? 0 : currentUser.level === 2 ? 400 : currentUser.level === 3 ? 1000 : 1800;
  const progressInLevel = Math.min(100, Math.max(0, Math.round(((currentUser.totalXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100)));

  return (
    <div className="bg-white p-6 rounded-3xl shadow-elder border border-amber-200 flex flex-col justify-between">
      {/* Top badges */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Streak Counter */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-200">
            <Flame className="w-7 h-7 fill-orange-500 animate-bounce" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {currentUser.streakDays} {t.common.days}
            </div>
            <div className="text-xs font-bold text-orange-700 uppercase tracking-wider">
              {currentLang === 'hi' ? 'लगातार साधना (Streak)' : currentLang === 'as' ? 'ধাৰাবাহিক খেল' : 'Daily Practice Streak'}
            </div>
          </div>
        </div>

        {/* Level Emblem */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 px-3 py-1 rounded-xl font-extrabold text-xs sm:text-sm border border-amber-300">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>{t.common.level} {currentUser.level}</span>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-1">{currentUser.levelTitle}</p>
        </div>
      </div>

      {/* XP & Progress */}
      <div>
        <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{currentUser.totalXp} {t.common.xp}</span>
          </span>
          <span>{currentLang === 'hi' ? `अगला स्तर: ${nextLevelXp} XP` : currentLang === 'as' ? `পৰৱৰ্তী স্তৰ: ${nextLevelXp} XP` : `Next Level: ${nextLevelXp} XP`}</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-sathi-600 rounded-full transition-all duration-500"
            style={{ width: `${progressInLevel}%` }}
          />
        </div>
      </div>
    </div>
  );
};
