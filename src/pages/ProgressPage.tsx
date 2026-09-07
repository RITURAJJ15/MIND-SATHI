import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clinicalService } from '../services/clinicalService';
import { gameService } from '../services/gameService';
import { familyService } from '../services/familyService';
import { dailyPlanService } from '../services/dailyPlanService';
import { milestoneService, MilestoneBadge } from '../services/milestoneService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { CognitiveRadarChart } from '../components/dashboard/CognitiveRadarChart';
import { StreakXPWidget } from '../components/dashboard/StreakXPWidget';
import { LineChart as ChartIcon, Award, Trophy, CheckCircle, Sparkles, Brain, ArrowUpRight, Lock } from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();

  const [sessions, setSessions] = useState(() => gameService.getSessionsForUser(currentUser.id));
  const [familyMembers, setFamilyMembers] = useState(() => familyService.getFamilyMembersForUser(currentUser.id));
  const [todayPlan, setTodayPlan] = useState(() => dailyPlanService.getDailyPlan(currentUser.id));

  // Sync real records from database
  useEffect(() => {
    if (!currentUser?.id) return;
    const isRealUser = currentUser.id.includes('-') && currentUser.id.length > 20;

    if (isRealUser) {
      Promise.all([
        gameService.syncSessionsFromDb(currentUser.id),
        familyService.syncFamilyMembersFromDb(currentUser.id),
        dailyPlanService.syncDailyPlanFromDb(currentUser.id),
      ]).then(([syncedSessions, syncedFamily, syncedPlan]) => {
        setSessions(syncedSessions);
        setFamilyMembers(syncedFamily);
        setTodayPlan(syncedPlan);
      });
    } else {
      setSessions(gameService.getSessionsForUser(currentUser.id));
      setFamilyMembers(familyService.getFamilyMembersForUser(currentUser.id));
      setTodayPlan(dailyPlanService.getDailyPlan(currentUser.id));
    }
  }, [currentUser?.id]);

  const trendData = clinicalService.getClinicalTrendData(currentUser.id);
  const growth = clinicalService.getGrowthRate(currentUser.id);
  const badges = milestoneService.evaluateBadges(currentUser, sessions, familyMembers, todayPlan);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <ChartIcon className="w-8 h-8 text-sathi-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{t.nav.progress}</h1>
        </div>
        <p className="text-gray-600 text-sm sm:text-base">
          {currentLang === 'hi'
            ? 'आपकी दैनिक मानसिक प्रगति, स्मरण शक्ति का विकास और अर्जित उपलब्धियां।'
            : currentLang === 'as'
            ? 'আপোনাৰ দৈনিক উন্নতি, স্মৃতি আৰু অৰ্জিত পুৰস্কাৰ।'
            : 'Track your cognitive stability, longitudinal performance improvements, and real earned badges.'}
        </p>
      </div>

      {/* Top Grid: Streak/XP and Cognitive Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StreakXPWidget />
        <CognitiveRadarChart />
      </div>

      {/* Longitudinal Trend Chart (Recharts) */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">
              {currentLang === 'hi'
                ? 'दैनिक संज्ञानात्मक स्थिरता ग्राफ (Cognitive Index)'
                : currentLang === 'as'
                ? 'মানসিক স্থিৰতাৰ লেখ'
                : 'Cognitive Vitality Trend Curve'}
            </h3>
            <p className="text-xs text-gray-500">
              {currentLang === 'hi'
                ? 'वास्तविक खेलों के आधार पर मानसिक एकाग्रता एवं स्मृति का स्तर'
                : currentLang === 'as'
                ? 'প্ৰকৃত খেলৰ ফলাফলৰ ভিত্তিত স্মৃতি আৰু মনোযোগৰ লেখ'
                : 'Longitudinal vitality tracking derived from your recorded game sessions'}
            </p>
          </div>

          {trendData.length > 0 && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto flex items-center gap-1 ${
                growth.isPositive ? 'text-emerald-800 bg-emerald-100' : 'text-amber-800 bg-amber-100'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                {growth.isPositive ? '+' : '-'}
                {growth.growthPercent}% Performance Trend
              </span>
            </span>
          )}
        </div>

        {trendData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="formattedDate" tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                <YAxis domain={[40, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderRadius: '16px',
                    border: '1px solid #E5E7EB',
                    fontWeight: 700,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overallScore"
                  name="Cognitive Score"
                  stroke="#D26727"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#D26727' }}
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  name="Memory Index"
                  stroke="#0F766E"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 px-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-center flex flex-col items-center justify-center">
            <Brain className="w-12 h-12 text-amber-600 mb-3" />
            <h4 className="text-base font-extrabold text-gray-900">
              {currentLang === 'hi'
                ? 'अभी तक कोई खेल सत्र दर्ज नहीं हुआ'
                : currentLang === 'as'
                ? 'এতিয়ালৈকে কোনো খেল খেলা নাই'
                : 'No Cognitive Game Sessions Yet'}
            </h4>
            <p className="text-xs text-gray-600 max-w-md mt-1 mb-4">
              {currentLang === 'hi'
                ? 'स्मृति संगम, शब्द माला या बाज़ार हिसाब खेलकर अपना पहला संज्ञानात्मक स्थिरता ग्राफ शुरू करें।'
                : currentLang === 'as'
                ? 'স্মৃতি সংগম বা শব্দ মালা খেলি আপোনাৰ প্ৰথম মানসিক সুস্থতাৰ লেখ আৰম্ভ কৰক।'
                : 'Play Smriti Sangam, Shabda Mala, or Bazaar Hisaab to start mapping your personal cognitive vitality curve.'}
            </p>
          </div>
        )}
      </div>

      {/* Badges & Achievements Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">
              {currentLang === 'hi'
                ? 'अर्जित सम्मान एवं पदक (Achievements)'
                : currentLang === 'as'
                ? 'অৰ্জিত সন্মান'
                : 'Earned Badges & Milestones'}
            </h3>
          </div>
          <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
            {unlockedCount} / {badges.length} {currentLang === 'hi' ? 'अर्जित' : currentLang === 'as' ? 'অৰ্জিত' : 'Unlocked'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`p-5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                b.unlocked
                  ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                  : 'bg-gray-50/80 border-gray-200 opacity-75'
              }`}
            >
              <div className="flex items-start gap-3.5 mb-3">
                <div
                  className={`text-3xl p-3 rounded-2xl shadow-xs border shrink-0 ${
                    b.unlocked
                      ? 'bg-white border-amber-200'
                      : 'bg-gray-100 border-gray-200 grayscale'
                  }`}
                >
                  {b.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-gray-900 text-base truncate">
                      {b.title[currentLang] || b.title.en}
                    </h4>
                    {b.unlocked ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {b.desc[currentLang] || b.desc.en}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="pt-2 border-t border-gray-200/80">
                <div className="flex justify-between items-center text-[11px] font-bold mb-1">
                  <span className={b.unlocked ? 'text-amber-900' : 'text-gray-500'}>
                    {b.progress.fractionText}
                  </span>
                  <span className={b.unlocked ? 'text-emerald-700 font-extrabold' : 'text-gray-400'}>
                    {b.unlocked ? '✓ Unlocked' : `${b.progress.percent}%`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      b.unlocked ? 'bg-amber-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${b.progress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
