import React, { useState } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { LeaderboardEntry } from '../types/analytics';
import { Users, Trophy, ShieldCheck, Flame, HeartHandshake, Eye, EyeOff } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const [privacyOptIn, setPrivacyOptIn] = useState(true);

  const leaderboardData: LeaderboardEntry[] = [
    { rank: 1, userId: 'u-101', anonymousName: 'Kamala Dadi (Varanasi)', region: 'Uttar Pradesh', weeklyXp: 720, streakDays: 18, favoriteGame: 'Smriti Sangam', isCurrentUser: false },
    { rank: 2, userId: 'u-102', anonymousName: 'Bhupen Da (Guwahati)', region: 'Assam', weeklyXp: 680, streakDays: 14, favoriteGame: 'Shabda Mala', isCurrentUser: false },
    { rank: 3, userId: currentUser.id, anonymousName: `${currentUser.preferredName || currentUser.name} (You)`, region: currentUser.state, weeklyXp: 640, streakDays: currentUser.streakDays, favoriteGame: 'Smriti Sangam', isCurrentUser: true },
    { rank: 4, userId: 'u-103', anonymousName: 'Sharma Ji (Jaipur)', region: 'Rajasthan', weeklyXp: 580, streakDays: 9, favoriteGame: 'Bazaar Hisaab', isCurrentUser: false },
    { rank: 5, userId: 'u-104', anonymousName: 'Prof. Mukherjee (Kolkata)', region: 'West Bengal', weeklyXp: 540, streakDays: 11, favoriteGame: 'Rangoli Rekha', isCurrentUser: false },
    { rank: 6, userId: 'u-105', anonymousName: 'Anandi Bai (Pune)', region: 'Maharashtra', weeklyXp: 490, streakDays: 7, favoriteGame: 'Dhyan Kendra', isCurrentUser: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-7 h-7 text-amber-500" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{t.nav.leaderboard}</h1>
            </div>
            <p className="text-gray-600 text-sm sm:text-base max-w-2xl">
              {currentLang === 'hi'
                ? 'वरिष्ठ समाज का सम्मान मंच। यहाँ कोई प्रतिस्पर्धा नहीं, बल्कि एक-दूसरे के निरंतर अभ्यास और मानसिक स्फूर्ति का सम्मान है।'
                : currentLang === 'as'
                ? 'জ্যেষ্ঠ সমাজৰ সন্মান মঞ্চ। ইয়াত কোনো প্ৰতিযোগিতা নাই, কেৱল সুস্থ মনৰ উদযাপন।'
                : 'A gentle, privacy-safe community league celebrating consistency, mental agility, and mutual inspiration.'}
            </p>
          </div>

          {/* Privacy Toggle */}
          <button
            onClick={() => setPrivacyOptIn(!privacyOptIn)}
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs sm:text-sm cursor-pointer self-start sm:self-auto transition-all"
          >
            {privacyOptIn ? <Eye className="w-4 h-4 text-amber-700" /> : <EyeOff className="w-4 h-4 text-gray-500" />}
            <span>{privacyOptIn ? (currentLang === 'hi' ? 'गोपनीयता: सुरक्षित प्रदर्शित' : 'Privacy: Visible') : (currentLang === 'hi' ? 'गोपनीयता: छुपाया गया' : 'Privacy: Hidden')}</span>
          </button>
        </div>
      </div>

      {/* Community Values Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center gap-3 text-xs sm:text-sm text-amber-950 font-semibold">
        <HeartHandshake className="w-6 h-6 text-sathi-600 shrink-0" />
        <span>
          {currentLang === 'hi'
            ? 'गोपनीयता सुरक्षा: वरिष्ठ नागरिकों के व्यक्तिगत विवरण कभी भी सार्वजनिक नहीं किए जाते। केवल उपनाम और राज्य प्रदर्शित होता है।'
            : currentLang === 'as'
            ? 'গোপনীয়তা সুৰক্ষিত: জ্যেষ্ঠ নাগৰিকৰ ব্যক্তিগত তথ্য কেতিয়াও প্ৰকাশ কৰা নহয়।'
            : 'Privacy Guarantee: Personal contact info is never displayed. Only respectful nicknames and states are shown.'}
        </span>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-3xl shadow-elder border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {leaderboardData.map((entry) => {
            const isMe = entry.isCurrentUser;
            return (
              <div
                key={entry.userId}
                className={`p-4 sm:p-5 flex items-center justify-between gap-3 transition-colors ${
                  isMe
                    ? 'bg-amber-100/50 border-l-4 border-l-sathi-600 font-bold'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Rank Emblem */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                      entry.rank === 1
                        ? 'bg-amber-400 text-white shadow-sm'
                        : entry.rank === 2
                        ? 'bg-gray-300 text-gray-800'
                        : entry.rank === 3
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    #{entry.rank}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                      {entry.anonymousName}
                    </h4>
                    <p className="text-xs text-gray-500 truncate">
                      {entry.region} • {currentLang === 'hi' ? 'प्रिय खेल:' : currentLang === 'as' ? 'প্ৰিয় খেল:' : 'Favorite:'} {entry.favoriteGame}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div className="hidden sm:block">
                    <span className="text-xs text-orange-700 font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-orange-500" />
                      <span>{entry.streakDays} {t.common.days}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-lg sm:text-xl font-extrabold text-sathi-700 block">
                      {entry.weeklyXp} XP
                    </span>
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      {currentLang === 'hi' ? 'साप्ताहिक' : currentLang === 'as' ? 'সাপ্তাহিক' : 'Weekly'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
