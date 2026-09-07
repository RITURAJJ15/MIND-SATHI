export type ReminderType = 
  | 'medicine' 
  | 'hydration' 
  | 'doctor' 
  | 'game' 
  | 'walk' 
  | 'family_call' 
  | 'personal_event';

export interface Reminder {
  id: string;
  userId: string;
  title: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  } | string;
  time: string; // e.g. "08:00 AM", "01:30 PM", "08:30 PM"
  type: ReminderType;
  dosageOrDetail?: string; // e.g. "After Breakfast - BP Tablet"
  spokenPrompt: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  } | string;
  enabled: boolean;
  days: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  isCompletedToday: boolean;
}
