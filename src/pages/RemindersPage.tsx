import React, { useState } from 'react';
import { ReminderList } from '../components/reminders/ReminderList';
import { reminderService } from '../services/reminderService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { Bell, Plus, X, Pill, Clock } from 'lucide-react';

export const RemindersPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [type, setType] = useState<'medicine' | 'hydration' | 'walk' | 'game'>('medicine');
  const [detail, setDetail] = useState('');

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    reminderService.addReminder({
      userId: currentUser.id,
      title: { en: title, hi: title, as: title },
      time,
      type,
      dosageOrDetail: detail,
      spokenPrompt: {
        en: `Reminder for ${title}. ${detail}`,
        hi: `${title} का समय हो गया है। ${detail}`,
        as: `${title} ৰ সময় হ\'ল। ${detail}`,
      },
      enabled: true,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    });

    setShowAddModal(false);
    setTitle('');
    setDetail('');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-7 h-7 text-amber-600" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{t.nav.reminders}</h1>
          </div>
          <p className="text-gray-600 text-sm sm:text-base">
            {currentLang === 'hi'
              ? 'समय पर रक्तचाप, थायराइड, जलपान और शाम की सैर के लिए आवाज़ वाले अलार्म।'
              : currentLang === 'as'
              ? 'নিয়মীয়াকৈ ঔষধ আৰু পানী খোৱাৰ বাবে কণ্ঠ বাৰ্তা।'
              : 'Voice-assisted reminders for medications, hydration, and gentle activity.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          type="button"
          className="bg-sathi-600 hover:bg-sathi-700 text-white font-extrabold px-5 py-3.5 rounded-2xl shadow-tactile flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>{currentLang === 'hi' ? 'नया अलार्म जोड़ें' : currentLang === 'as' ? 'নতুন এলাৰ্ম যোগ' : 'Add Reminder'}</span>
        </button>
      </div>

      {/* Reminders List Component */}
      <ReminderList />

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-amber-200 relative">
            <button
              onClick={() => setShowAddModal(false)}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-4">
              {currentLang === 'hi' ? 'नया अनुस्मारक जोड़ें' : currentLang === 'as' ? 'নতুন বাৰ্তা যোগ' : 'Create Routine Reminder'}
            </h3>

            <form onSubmit={handleAddReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  {currentLang === 'hi' ? 'दवा या कार्य का नाम' : currentLang === 'as' ? 'ঔষধ বা কামৰ নাম' : 'Title / Medication Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Thyroid Medication"
                  className="w-full p-3.5 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    {currentLang === 'hi' ? 'समय' : currentLang === 'as' ? 'সময়' : 'Time'}
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    {currentLang === 'hi' ? 'श्रेणी' : currentLang === 'as' ? 'শ্ৰেণী' : 'Type'}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm font-semibold cursor-pointer"
                  >
                    <option value="medicine">Medicine (दवा)</option>
                    <option value="hydration">Hydration (जलपान)</option>
                    <option value="walk">Exercise/Walk (सैर)</option>
                    <option value="game">Brain Game (खेल)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  {currentLang === 'hi' ? 'खुराक या निर्देश' : currentLang === 'as' ? 'নিৰ্দেশনা' : 'Dosage / Special Instructions'}
                </label>
                <input
                  type="text"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="e.g. 1 tablet on empty stomach with warm water"
                  className="w-full p-3 rounded-2xl border-2 border-gray-300 focus:border-sathi-500 outline-none text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 rounded-2xl border-2 border-gray-300 font-bold text-gray-700 cursor-pointer"
                >
                  {currentLang === 'hi' ? 'रद्द करें' : currentLang === 'as' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-sathi-600 hover:bg-sathi-700 text-white font-bold shadow-tactile cursor-pointer"
                >
                  {currentLang === 'hi' ? 'सहेजें' : currentLang === 'as' ? 'সংৰক্ষণ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
