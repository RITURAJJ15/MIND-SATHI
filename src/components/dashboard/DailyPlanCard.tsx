import React, { useState, useEffect } from 'react';
import { DailyActivityTask, DailyPlan } from '../../types/plan';
import { dailyPlanService } from '../../services/dailyPlanService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { CheckCircle2, Circle, Play, Award, Sparkles, Heart, Droplet, BookOpen, PhoneCall } from 'lucide-react';

interface DailyPlanCardProps {
  onPlayGame?: (gameId: string) => void;
  onOpenMemories?: () => void;
}

export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({ onPlayGame, onOpenMemories }) => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const userId = currentUser?.id || 'guest';

  const [plan, setPlan] = useState<DailyPlan>(() => dailyPlanService.getDailyPlan(userId));

  useEffect(() => {
    // Initial load
    setPlan(dailyPlanService.getDailyPlan(userId));

    // Sync from Supabase DB for real user
    dailyPlanService.syncDailyPlanFromDb(userId).then((synced) => {
      setPlan(synced);
    });

    // Real-time listener for updates (e.g. from game completions or other tabs)
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
  const progressPercent = Math.round((completedTasks / plan.tasks.length) * 100);

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
      default:
        return <BookOpen className="w-5 h-5 text-teal-600" />;
    }
  };

  const planNarration = currentLang === 'hi'
    ? `आज की दिनचर्या में ${plan.tasks.length} में से ${completedTasks} कार्य पूरे हो चुके हैं। कुल ${plan.earnedXpToday} साथी अंक प्राप्त हुए।`
    : currentLang === 'as'
    ? `আজিৰ দিনলিপিত ${plan.tasks.length} টাৰ ভিতৰত ${completedTasks} টা কাম সম্পূৰ্ণ হ\'ল।`
    : `Today's plan has ${completedTasks} of ${plan.tasks.length} tasks completed, with ${plan.earnedXpToday} XP earned.`;

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'आज की दिनचर्या (Daily Plan)' : currentLang === 'as' ? 'আজিৰ দিনলিপি (Daily Plan)' : 'Today’s Personalized Activity Plan'}
            </h3>
            <VoicePromptButton text={planNarration} size="sm" />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {currentLang === 'hi' ? 'संतुलित मानसिक व शारीरिक स्वास्थ्य के दैनिक कदम' : currentLang === 'as' ? 'স্বাস্থ্য আৰু মানসিক সতেজতাৰ দৈনিক অভ্যাস' : 'Balanced daily steps for cognitive vitality and social connection'}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-bold uppercase text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
            +{plan.earnedXpToday} / {plan.totalXpPossible} XP
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
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

      {/* Task List */}
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
