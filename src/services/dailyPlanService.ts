import { DailyActivityTask, DailyPlan } from '../types/plan';
import { AccessibilitySettings } from '../types/user';
import { MOCK_DAILY_PLAN } from '../data/mockPlan';
import { supabase } from '../lib/supabase';
import { authService } from './authService';
import { profileService } from './profileService';
import { soundService } from './soundService';

const STORAGE_KEY_PLANS = 'mind_sathi_daily_plans';

export interface StoredPlanData {
  completedTaskIds: string[];
  earnedXp: number;
  isAllCompleted: boolean;
  lastUpdated: string;
}

class DailyPlanService {
  private listeners: Set<(plan: DailyPlan) => void> = new Set();

  /** Get today's ISO date string in YYYY-MM-DD */
  public getTodayDateStr(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Read all stored user plans from localStorage */
  private getAllStoredPlans(): Record<string, Record<string, StoredPlanData>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLANS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** Write all stored user plans to localStorage */
  private saveAllStoredPlans(data: Record<string, Record<string, StoredPlanData>>): void {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(data));
  }

  /** Get stored plan data for a specific user and date */
  public getStoredPlanData(userId: string, dateStr: string): StoredPlanData | null {
    const all = this.getAllStoredPlans();
    return all[userId]?.[dateStr] || null;
  }

  /**
   * Builds the current DailyPlan for a user and date.
   * All tasks default to incomplete (0% completed) unless completed in DB or localStorage.
   */
  public getDailyPlan(userId: string, dateStr = this.getTodayDateStr()): DailyPlan {
    const stored = this.getStoredPlanData(userId, dateStr);
    const completedSet = new Set(stored?.completedTaskIds || []);

    const tasks: DailyActivityTask[] = MOCK_DAILY_PLAN.tasks.map((template) => {
      const isCompleted = completedSet.has(template.id);
      return {
        ...template,
        completed: isCompleted,
        completedAt: isCompleted ? stored?.lastUpdated : undefined,
      };
    });

    const completedTasks = tasks.filter((t) => t.completed);
    const earnedXpToday = completedTasks.reduce((sum, t) => sum + t.rewardXp, 0);
    const isAllCompleted = tasks.length > 0 && completedTasks.length === tasks.length;

    return {
      id: `plan-${userId}-${dateStr}`,
      userId,
      date: dateStr,
      tasks,
      totalXpPossible: tasks.reduce((sum, t) => sum + t.rewardXp, 0),
      earnedXpToday,
      isAllCompleted,
    };
  }

  /**
   * Synchronizes today's daily plan from Supabase for real users.
   */
  public async syncDailyPlanFromDb(userId: string, dateStr = this.getTodayDateStr()): Promise<DailyPlan> {
    if (!userId || userId === 'guest') {
      return this.getDailyPlan(userId, dateStr);
    }

    const isRealUser = userId.includes('-') && userId.length > 20;
    if (isRealUser) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('accessibility')
          .eq('id', userId)
          .single();

        if (data && !error && data.accessibility) {
          const acc = data.accessibility as Record<string, any>;
          const dbPlans = acc.daily_plans as Record<string, StoredPlanData> | undefined;
          if (dbPlans && dbPlans[dateStr]) {
            const all = this.getAllStoredPlans();
            if (!all[userId]) all[userId] = {};
            // Merge with local (union of completed task IDs to never lose offline progress)
            const localCompleted = all[userId][dateStr]?.completedTaskIds || [];
            const dbCompleted = dbPlans[dateStr].completedTaskIds || [];
            const merged = Array.from(new Set([...localCompleted, ...dbCompleted]));

            all[userId][dateStr] = {
              ...dbPlans[dateStr],
              completedTaskIds: merged,
            };
            this.saveAllStoredPlans(all);
          }
        }
      } catch (err) {
        console.warn('[DailyPlanService] Error syncing plan from Supabase:', err);
      }
    }

    const plan = this.getDailyPlan(userId, dateStr);
    this.notify(plan);
    return plan;
  }

  /**
   * Toggles task completion state.
   * Persists immediately to localStorage and Supabase.
   */
  public async toggleTask(userId: string, taskId: string, forceState?: boolean): Promise<DailyPlan> {
    const dateStr = this.getTodayDateStr();
    const currentPlan = this.getDailyPlan(userId, dateStr);
    const targetTask = currentPlan.tasks.find((t) => t.id === taskId);
    if (!targetTask) return currentPlan;

    const nextState = forceState !== undefined ? forceState : !targetTask.completed;
    const all = this.getAllStoredPlans();
    if (!all[userId]) all[userId] = {};
    const existing = all[userId][dateStr] || {
      completedTaskIds: [],
      earnedXp: 0,
      isAllCompleted: false,
      lastUpdated: new Date().toISOString(),
    };

    let updatedIds = [...existing.completedTaskIds];
    if (nextState) {
      if (!updatedIds.includes(taskId)) updatedIds.push(taskId);
      soundService.playMatchSuccess();
      profileService.addXpToCurrentUser(targetTask.rewardXp);
    } else {
      updatedIds = updatedIds.filter((id) => id !== taskId);
    }

    const earnedXp = currentPlan.tasks
      .filter((t) => updatedIds.includes(t.id))
      .reduce((sum, t) => sum + t.rewardXp, 0);
    const isAllCompleted = currentPlan.tasks.length > 0 && updatedIds.length === currentPlan.tasks.length;

    const storedData: StoredPlanData = {
      completedTaskIds: updatedIds,
      earnedXp,
      isAllCompleted,
      lastUpdated: new Date().toISOString(),
    };

    all[userId][dateStr] = storedData;
    this.saveAllStoredPlans(all);

    // Save to Supabase
    const isRealUser = userId.includes('-') && userId.length > 20;
    if (isRealUser) {
      try {
        const currentUser = authService.getCurrentUser();
        const defaultAcc: AccessibilitySettings = {
          fontSize: 'normal',
          highContrast: false,
          textToSpeechAuto: false,
          soundEffects: true,
          speechRate: 0.85,
        };
        const currentAccessibility = currentUser?.accessibility || defaultAcc;
        const currentDailyPlans = currentAccessibility.daily_plans || {};

        const updatedAccessibility = {
          ...defaultAcc,
          ...currentAccessibility,
          daily_plans: {
            ...currentDailyPlans,
            [dateStr]: storedData,
          },
        };

        // Update profile accessibility in DB
        await supabase
          .from('profiles')
          .update({
            accessibility: updatedAccessibility,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        // Update local authService profile so session keeps in sync
        authService.updateCurrentUserProfile({
          accessibility: updatedAccessibility,
        });

        // Insert task completion log in game_sessions table
        if (nextState) {
          await supabase.from('game_sessions').insert({
            patient_id: userId,
            game_id: `daily_task_${targetTask.type}`,
            score: 100,
            accuracy: 100,
            duration_seconds: (targetTask.durationMinutes || 5) * 60,
            metadata: {
              taskId: targetTask.id,
              taskTitle: targetTask.title.en,
              rewardXp: targetTask.rewardXp,
              completedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.warn('[DailyPlanService] Supabase task persistence error:', err);
      }
    }

    const updatedPlan = this.getDailyPlan(userId, dateStr);
    this.notify(updatedPlan);
    return updatedPlan;
  }

  /**
   * Called whenever a cognitive game is finished.
   * Auto-completes any matching uncompleted task in today's daily plan.
   */
  public async onGameCompleted(userId: string, gameId: string): Promise<void> {
    const dateStr = this.getTodayDateStr();
    const plan = this.getDailyPlan(userId, dateStr);
    const matchingTask = plan.tasks.find((t) => t.gameId === gameId && !t.completed);
    if (matchingTask) {
      await this.toggleTask(userId, matchingTask.id, true);
    }
  }

  /** Subscribe to real-time plan changes */
  public subscribe(listener: (plan: DailyPlan) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(plan: DailyPlan) {
    this.listeners.forEach((l) => l(plan));
  }
}

export const dailyPlanService = new DailyPlanService();
