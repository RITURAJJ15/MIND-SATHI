import React, { useState } from 'react';
import { Reminder } from '../../types/reminder';
import { reminderService } from '../../services/reminderService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { Bell, CheckCircle2, Circle, Clock, Pill, Droplet, Dumbbell, Volume2, Plus } from 'lucide-react';

export const ReminderList: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang } = useLanguage();
  const [reminders, setReminders] = useState<Reminder[]>(() => reminderService.getRemindersForUser(currentUser.id));

  React.useEffect(() => {
    if (currentUser?.id) {
      reminderService.syncRemindersFromDb(currentUser.id).then((synced) => {
        if (synced) setReminders(synced);
      }).catch(() => {
        setReminders(reminderService.getRemindersForUser(currentUser.id));
      });
    }
  }, [currentUser?.id]);

  const refreshReminders = () => {
    setReminders(reminderService.getRemindersForUser(currentUser.id));
  };

  const handleToggleComplete = (id: string) => {
    reminderService.markCompletedToday(id);
    refreshReminders();
  };

  const handleSpeak = (r: Reminder) => {
    reminderService.speakReminder(r);
  };

  const renderIcon = (type: Reminder['type']) => {
    switch (type) {
      case 'medicine':
        return <Pill className="w-5 h-5 text-red-600" />;
      case 'hydration':
        return <Droplet className="w-5 h-5 text-blue-500" />;
      case 'walk':
        return <Dumbbell className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <span>{currentLang === 'hi' ? 'दवा एवं दिनचर्या अनुस्मारक' : currentLang === 'as' ? 'ঔষধ আৰু দিনলিপি' : 'Medication & Routine Reminders'}</span>
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {currentLang === 'hi' ? 'समय पर दवा और जलपान की सूचना' : currentLang === 'as' ? 'সময়মতে ঔষধ আৰু পানী খোৱাৰ বাৰ্তা' : 'Timely prompts for medications and hydration'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {reminders.map((r) => {
          const title = typeof r.title === 'string'
            ? r.title
            : ((r.title as Record<string, string>)[currentLang] || (r.title as Record<string, string>).en || '');

          return (
            <div
              key={r.id}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${
                r.isCompletedToday
                  ? 'bg-emerald-50/40 border-emerald-200 opacity-75'
                  : 'bg-white hover:bg-amber-50/40 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  onClick={() => handleToggleComplete(r.id)}
                  type="button"
                  className="shrink-0 text-gray-400 hover:text-emerald-600 cursor-pointer"
                  aria-label="Toggle completed"
                >
                  {r.isCompletedToday ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-7 h-7 hover:border-gray-400" />
                  )}
                </button>

                <div className="p-2.5 bg-gray-100 rounded-xl shrink-0">
                  {renderIcon(r.type)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      {r.time}
                    </span>
                    <h4 className={`text-base font-bold truncate ${r.isCompletedToday ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {title}
                    </h4>
                  </div>
                  {r.dosageOrDetail && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{r.dosageOrDetail}</p>
                  )}
                </div>
              </div>

              {/* Speak button */}
              <button
                onClick={() => handleSpeak(r)}
                type="button"
                className="p-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 shrink-0 cursor-pointer transition-all"
                title="Speak Reminder"
                aria-label="Speak reminder aloud"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
