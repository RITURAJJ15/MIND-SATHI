import { Reminder } from '../types/reminder';
import { MOCK_REMINDERS } from '../data/mockReminders';
import { speechService } from './speechService';
import { authService } from './authService';
import { supabase } from '../lib/supabase';
import { offlineDb } from '../lib/offlineDb';

const STORAGE_KEY_REMINDERS = 'mind_sathi_reminders';

class ReminderService {
  private reminders: Reminder[];

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY_REMINDERS);
    if (saved) {
      try {
        this.reminders = JSON.parse(saved);
      } catch {
        this.reminders = MOCK_REMINDERS;
      }
    } else {
      this.reminders = MOCK_REMINDERS;
      localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));
    }
  }

  /** Synchronize reminders from Supabase reminders table. */
  public async syncRemindersFromDb(userId: string): Promise<Reminder[]> {
    if (userId && userId.includes('-') && userId.length > 20) {
      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('patient_id', userId)
          .order('created_at', { ascending: false });

        if (data && !error && data.length > 0) {
          const dbReminders: Reminder[] = data.map((d) => ({
            id: d.id,
            userId: d.patient_id,
            title: d.title,
            time: d.reminder_time,
            type: (d.reminder_type || 'medicine') as any,
            dosageOrDetail: d.description,
            spokenPrompt: d.title,
            enabled: !d.is_completed,
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            isCompletedToday: d.is_completed ?? false,
          }));

          // Merge into state
          this.reminders = [
            ...this.reminders.filter((r) => r.userId !== userId),
            ...dbReminders,
          ];
          localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));

          // Cache in Dexie for offline use
          dbReminders.forEach((r) => {
            offlineDb.reminders.put({ ...r, syncStatus: 'synced' }).catch(() => {});
          });

          return dbReminders;
        }
      } catch (err) {
        console.warn('[ReminderService] Error syncing from Supabase:', err);
      }
    }

    // Offline fallback: check Dexie IndexedDB
    try {
      const cached = await offlineDb.reminders.where('userId').equals(userId).toArray();
      if (cached && cached.length > 0) {
        this.reminders = [
          ...this.reminders.filter((r) => r.userId !== userId),
          ...cached,
        ];
        return cached;
      }
    } catch (dexieErr) {
      console.warn('[ReminderService] Dexie reminders read notice:', dexieErr);
    }

    return this.getRemindersForUser(userId);
  }

  public getRemindersForUser(userId: string): Reminder[] {
    const userRems = this.reminders.filter((r) => r.userId === userId);
    if (userRems.length > 0) return userRems;
    // Only return mock reminders for demo accounts
    if (userId === 'elder-1' || userId === 'dadi-sathi-001') {
      return this.reminders.filter((r) => r.userId === 'elder-1');
    }
    return [];
  }

  public toggleReminder(id: string): boolean {
    const r = this.reminders.find((item) => item.id === id);
    if (r) {
      r.enabled = !r.enabled;
      localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));

      if (id.includes('-') && id.length > 20) {
        supabase
          .from('reminders')
          .update({ is_completed: !r.enabled, updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('[ReminderService] Supabase toggle error:', error.message);
          });
      }
      return r.enabled;
    }
    return false;
  }

  public markCompletedToday(id: string): boolean {
    const r = this.reminders.find((item) => item.id === id);
    if (r) {
      r.isCompletedToday = !r.isCompletedToday;
      localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));

      if (id.includes('-') && id.length > 20) {
        supabase
          .from('reminders')
          .update({ is_completed: r.isCompletedToday, updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('[ReminderService] Supabase markCompleted error:', error.message);
          });
      }
      return r.isCompletedToday;
    }
    return false;
  }

  public deleteReminder(id: string): boolean {
    const initLen = this.reminders.length;
    this.reminders = this.reminders.filter((r) => r.id !== id);
    if (this.reminders.length !== initLen) {
      localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));

      if (id.includes('-') && id.length > 20) {
        supabase
          .from('reminders')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('[ReminderService] Supabase delete error:', error.message);
          });
      }
      return true;
    }
    return false;
  }

  public speakReminder(reminder: Reminder) {
    const user = authService.getCurrentUser();
    if (!user) return;
    const prompt = typeof reminder.spokenPrompt === 'string'
      ? reminder.spokenPrompt
      : ((reminder.spokenPrompt as Record<string, string>)[user.primaryLanguage] || (reminder.spokenPrompt as Record<string, string>).hi || (reminder.spokenPrompt as Record<string, string>).en || '');
    speechService.speak(prompt, user.primaryLanguage, user.accessibility.speechRate);
  }

  public addReminder(newRem: Omit<Reminder, 'id' | 'isCompletedToday'>): Reminder {
    const reminder: Reminder = {
      ...newRem,
      id: `rem-${Date.now()}`,
      isCompletedToday: false,
    };
    this.reminders.push(reminder);
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));

    // Save to Supabase if valid patient UUID
    if (reminder.userId && reminder.userId.includes('-') && reminder.userId.length > 20) {
      supabase
        .from('reminders')
        .insert({
          patient_id: reminder.userId,
          title: reminder.title,
          description: reminder.dosageOrDetail,
          reminder_type: reminder.type,
          reminder_time: reminder.time,
          repeat_type: 'daily',
          is_completed: false,
        })
        .select('id')
        .single()
        .then(({ data }) => {
          if (data?.id) {
            reminder.id = data.id;
            localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(this.reminders));
          }
        }, (err: unknown) => console.warn('[ReminderService] Supabase insert error:', err));
    }

    return reminder;
  }
}

export const reminderService = new ReminderService();
