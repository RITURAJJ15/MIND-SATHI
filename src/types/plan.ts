import { GameId } from './game';

export type TaskType = 
  | 'cognitive_game' 
  | 'family_reminiscence' 
  | 'gentle_stretch' 
  | 'hydration' 
  | 'family_call'
  | 'mindful_breathing';

export interface DailyActivityTask {
  id: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  title: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  subtitle: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  type: TaskType;
  gameId?: GameId;
  durationMinutes: number;
  completed: boolean;
  completedAt?: string;
  rewardXp: number;
  iconName: string;
  instructions: {
    en: string;
    hi: string;
    as: string;
  };
}

export interface DailyPlan {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  tasks: DailyActivityTask[];
  totalXpPossible: number;
  earnedXpToday: number;
  isAllCompleted: boolean;
}
