import React, { useState, useEffect } from 'react';
import { DailyActivityTask, DailyPlan, DayOfWeek } from '../../types/plan';
import { dailyPlanService } from '../../services/dailyPlanService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { VoicePromptButton } from '../common/VoicePromptButton';
import {
  CheckCircle2,
  Circle,
  Play,
  Sparkles,
  Heart,
  Droplet,
  BookOpen,
  PhoneCall,
  Calendar,
  Clock,
  Zap,
  Activity,
  Award,
} from 'lucide-react';

interface DailyPlanCardProps {
  onPlayGame?: (gameId: string) => void;
  onOpenMemories?: () => void;
}

const DAY_LABELS: Record<DayOfWeek, { hi: string; as: string }> = {
  Monday: { hi: 'सोमवार', as: 'সোমবাৰ' },
  Tuesday: { hi: 'मंगलवार', as: 'মঙলবাৰ' },
  Wednesday: { hi: 'बुधवार', as: 'বুধবাৰ' },
  Thursday: { hi: 'गुरुवार', as: 'বৃহস্পতিবাৰ' },
  Friday: { hi: 'शुक्रवार', as: 'শুক্ৰবাৰ' },
  Saturday: { hi: 'शनिवार', as: 'শনিবাৰ' },
  Sunday: { hi: 'रविवार', as: 'দেওবাৰ' },
};

export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({ onPlayGame, onOpenMemories }) => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const userId = currentUser?.id || 'guest';

  const [plan, setPlan] = useState<DailyPlan>(() => dailyPlanService.getDailyPlan(userId));

  useEffect(() => {
    // Initial load from synchronous cache
    setPlan(dailyPlanService.getDailyPlan(userId));

    // Sync & personalize from Supabase DB for real user
    dailyPlanService.syncDailyPlanFromDb(userId).then((synced) => {
      setPlan(synced);
    });

    // Real-time listener for updates (e.g. from game completions or date rollover)
    const unsubscribe = dailyPlanService.subscribe((updated) => {
      if (updated.userId === userId) {
        setPlan(updated);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const toggleTask = (taskId: string) => {
    dailyPlanService.toggleTask(userId, taskId);
  };

  const completedTasks = plan.tasks.filter((t) => t.completed).length;
  const progressPercent = plan.tasks.length > 0 ? Math.round((completedTasks / plan.tasks.length) * 100) : 0;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'cognitive_game':
        return <Sparkles className="w-5 h-5 text-sathi-600" />;
      case 'hydration':
        return <Droplet className="w-5 h-5 text-blue-500" />;
      case 'family_reminiscence':
        return <Heart className="w-5 h-5 text-rose-500" />;
      case 'family_call':
        return <PhoneCall className="w-5 h-5 text-emerald-600" />;
      case 'gentle_stretch':
        return <Activity className="w-5 h-5 text-indigo-600" />;
      default:
        return <BookOpen className="w-5 h-5 text-teal-600" />;
    }
  };

  const dayNameLocalized = currentLang === 'hi'
    ? DAY_LABELS[plan.dayOfWeek]?.hi || plan.dayOfWeek
    : currentLang === 'as'
    ? DAY_LABELS[plan.dayOfWeek]?.as || plan.dayOfWeek
    : plan.dayOfWeek;

  const difficultyLabel = plan.difficulty === 'saral'
    ? (currentLang === 'hi' ? 'सरल (Gentle)' : currentLang === 'as' ? 'সহজ (Gentle)' : 'Saral (Gentle)')
    : plan.difficulty === 'madhyam'
    ? (currentLang === 'hi' ? 'मध्यम (Balanced)' : currentLang === 'as' ? 'মধ্যম (Balanced)' : 'Madhyam (Balanced)')
    : (currentLang === 'hi' ? 'निपुण (Advanced)' : currentLang === 'as' ? 'নিপুণ (Advanced)' : 'Nipun (Advanced)');

  const planNarration = currentLang === 'hi'
    ? `आज ${dayNameLocalized} की दिनचर्या में ${plan.tasks.length} में से ${completedTasks} कार्य पूरे हो चुके हैं। फोकस क्षेत्र है: ${plan.focusArea}। कुल ${plan.earnedXpToday} साथी अंक प्राप्त हुए।`
    : currentLang === 'as'
    ? `আজি ${dayNameLocalized}ৰ দিনলিপিত ${plan.tasks.length} টাৰ ভিতৰত ${completedTasks} টা কাম সম্পূৰ্ণ হ\'ল। মুঠ ${plan.earnedXpToday} পইণ্ট পোৱা গ\'ল।`
    : `Today is ${plan.dayOfWeek}. ${completedTasks} of ${plan.tasks.length} tasks completed with focus on ${plan.focusArea}. ${plan.earnedXpToday} XP earned.`;

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200 text-left">
      {/* 7-DAY ROTATING HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>{dayNameLocalized}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
              <Zap className="w-3 h-3 text-purple-600" />
              <span>{difficultyLabel}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>~{plan.estimatedDuration} min</span>
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900">
              {currentLang === 'hi' ? 'आज की वैयक्तिक दिनचर्या' : currentLang === 'as' ? 'আজিৰ ব্যক্তিগত দিনলিপি' : 'Today’s Personalized Daily Plan'}
            </h3>
            <VoicePromptButton text={planNarration} size="sm" />
          </div>

          <p className="text-gray-600 text-xs sm:text-sm font-semibold mt-0.5 flex items-center gap-1.5">
            <span className="text-sathi-600">🎯</span>
            <span>{plan.focusArea}</span>
          </p>
        </div>

        <div className="text-right shrink-0 self-start sm:self-auto">
          <span className="text-xs font-black uppercase text-amber-900 bg-amber-100 px-3.5 py-1.5 rounded-2xl border border-amber-300 shadow-xs inline-flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-700" />
            <span>+{plan.earnedXpToday} / {plan.totalXpPossible} XP</span>
          </span>
        </div>
      </div>

      {/* AI PERSONALIZATION NOTE BOX */}
      {plan.aiReason && (
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200/80 shadow-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-purple-100 text-purple-700 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                <span>Adaptive Recommendation</span>
                {plan.source === 'gemini' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-200/80 text-purple-900">
                    Gemini AI
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-950 font-medium leading-relaxed mt-0.5">
                "{plan.aiReason}"
              </p>
            </div>
          </div>
          <VoicePromptButton text={plan.aiReason} size="sm" />
        </div>
      )}

      {/* PROGRESS BAR */}
      <div className="mb-5">
        <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
          <span>{progressPercent}% {t.common.completed}</span>
          <span>{completedTasks} / {plan.tasks.length} {currentLang === 'hi' ? 'कार्य' : currentLang === 'as' ? 'কাম' : 'tasks'}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-sathi-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* TASK LIST */}
      <div className="space-y-3">
        {plan.tasks.map((task) => {
          const taskTitle = task.title[currentLang] || task.title.en;
          const taskSub = task.subtitle[currentLang] || task.subtitle.en;

          return (
            <div
              key={task.id}
              className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col xs:flex-row xs:items-center justify-between gap-3 sm:gap-4 ${
                task.completed
                  ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                  : 'bg-white hover:bg-gray-50/80 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 xs:gap-3.5 min-w-0">
                <button
                  onClick={() => toggleTask(task.id)}
                  type="button"
                  className="shrink-0 text-gray-400 hover:text-emerald-600 cursor-pointer"
                  aria-label="Toggle task completion"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-6 h-6 sm:w-7 sm:h-7 hover:border-gray-400" />
                  )}
                </button>

                <div className="p-1.5 xs:p-2 bg-gray-100 rounded-xl shrink-0">
                  {renderIcon(task.type)}
                </div>

                <div className="min-w-0">
                  <h4 className={`text-sm xs:text-base sm:text-lg font-bold truncate ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {taskTitle}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{taskSub}</p>
                </div>
              </div>

              {/* Action Button if Game or Memory */}
              <div className="flex items-center gap-2 shrink-0 self-end xs:self-auto">
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hidden sm:inline">
                  +{task.rewardXp} XP
                </span>

                {task.gameId && !task.completed && onPlayGame && (
                  <button
                    onClick={() => onPlayGame(task.gameId!)}
                    type="button"
                    className="bg-sathi-600 hover:bg-sathi-700 text-white text-xs sm:text-sm font-bold px-3 py-1.5 xs:px-3.5 xs:py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t.common.play}</span>
                  </button>
                )}

                {task.type === 'family_reminiscence' && !task.completed && onOpenMemories && (
                  <button
                    onClick={onOpenMemories}
                    type="button"
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold px-3 py-1.5 xs:px-3.5 xs:py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>{currentLang === 'hi' ? 'यादें देखें' : currentLang === 'as' ? 'স্মৃতি চাওক' : 'View Memory'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
