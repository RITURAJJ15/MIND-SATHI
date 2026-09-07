import { CognitiveDomain } from './game';

export interface DomainPerformance {
  domain: CognitiveDomain;
  label: {
    en: string;
    hi: string;
    as: string;
  };
  score: number; // 0-100
  previousScore: number;
  status: 'optimal' | 'stable' | 'needs_practice';
  description: {
    en: string;
    hi: string;
    as: string;
  };
}

export interface CognitiveTrendPoint {
  date: string; // "YYYY-MM-DD"
  formattedDate: string; // "1 Sep"
  memory: number;
  language: number;
  working_memory: number;
  executive: number;
  attention: number;
  visuospatial: number;
  overallScore: number;
  minutesPlayed: number;
}

export interface MocaMmseMapping {
  domain: CognitiveDomain;
  clinicalDomain: string; // e.g. "Delayed Recall", "Visuoconstructional Skills"
  mocaWeight: number; // Max points
  userEstimatedPoints: number;
  riskClassification: 'normal' | 'mild_variance' | 'requires_clinical_review';
  clinicalObservation: string;
}

export interface AchievementBadge {
  id: string;
  code: string;
  title: {
    en: string;
    hi: string;
    as: string;
  };
  description: {
    en: string;
    hi: string;
    as: string;
  };
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'streak' | 'accuracy' | 'mastery' | 'family';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  anonymousName: string; // e.g. "Dadi K. (Varanasi)" or "Sadhak 402"
  region: string;
  weeklyXp: number;
  streakDays: number;
  favoriteGame: string;
  isCurrentUser: boolean;
}
