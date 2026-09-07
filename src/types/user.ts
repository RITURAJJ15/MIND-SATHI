export type UserRole = 'elderly' | 'caregiver' | 'clinician' | 'admin';

export type SupportedLanguage = 
  | 'en'   // English
  | 'hi'   // Hindi
  | 'as'   // Assamese (অসমীয়া)
  | 'bn'   // Bengali (বাংলা)
  | 'mni'  // Manipuri / Meitei (মৈতৈলোন্)
  | 'lus'  // Mizo (Mizo ṭawng)
  | 'kha'  // Khasi (Ka Ktien Khasi)
  | 'grt'  // Garo (A·chik)
  | 'brx'; // Bodo (बर')

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface AccessibilitySettings {
  fontSize: 'normal' | 'large' | 'extralarge';
  highContrast: boolean;
  textToSpeechAuto: boolean;
  soundEffects: boolean;
  speechRate: number; // e.g. 0.85 for clear speech
  volume?: number;
  daily_plans?: Record<string, any>;
  earned_badges?: string[];
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  name: string;
  preferredName: string; // e.g., "Dadi Ji", "Nanaji", "Bora Da", "Aji"
  role: UserRole;
  age: number;
  gender: 'female' | 'male' | 'other';
  avatarUrl: string;
  primaryLanguage: SupportedLanguage;
  secondaryLanguage?: SupportedLanguage;
  city: string;
  state: string;
  northeastRegion?: string;
  
  // Ayushman Bharat PM-JAY (Strictly separated from ABHA)
  isAyushmanMember?: boolean;
  ayushmanMemberId?: string; // PM-JAY beneficiary ID
  pmjayId?: string;          // Alias for backward compatibility
  ayushmanStatus?: 'verified' | 'unverified' | 'unable' | 'none';
  pmjayStatus?: 'verified' | 'unverified' | 'unable' | 'none';

  // ABHA (Optional health records ID)
  abhaId?: string;
  abhaStatus?: 'verified' | 'unverified' | 'unable' | 'none';

  // Onboarding & Family Info
  hasCompletedOnboarding?: boolean;
  familyMemberCount?: number;
  emergencyContact?: EmergencyContact;
  caregiverIds: string[];
  clinicianIds: string[];

  // Accessibility & Gamification
  accessibility: AccessibilitySettings;
  streakDays: number;
  totalXp: number;
  level: number;
  levelTitle: string;
  createdAt: string;
  email?: string;
  phone?: string;
}

// AuthSession is defined in types/auth.ts — do not redefine here.
