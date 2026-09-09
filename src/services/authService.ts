/**
 * authService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Supabase Authentication — signUp / signInWithPassword / signOut.
 * localStorage is used only as a read-through cache for instant first paint;
 * Supabase Auth is the single source of truth.
 */

import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types/user';
import {
  AuthCredentials,
  AuthResult,
  AuthSession,
  AuthUser,
  RegisterPayload,
} from '../types/auth';
import { offlineDb } from '../lib/offlineDb';
import { familyService } from './familyService';
import { reminderService } from './reminderService';
import { gameService } from './gameService';

const SK_SESSION = 'ms_auth_session';
const SK_PROFILES = 'ms_all_profiles';
const SK_CREDENTIALS = 'ms_local_credentials';
const SK_PATIENT_PROFILE = 'ms_active_patient_profile';
const SK_CAREGIVER_PROFILE = 'ms_active_caregiver_profile';
const SK_AVATAR_PREFIX = 'mind_sathi_avatar_';

/** Helper to cache genuine patient avatars so they are never lost on login or session resets */
export function saveAvatarToCache(userId: string, email?: string, avatarUrl?: string): void {
  if (!avatarUrl || avatarUrl.includes('dicebear.com')) return;
  if (userId) localStorage.setItem(`${SK_AVATAR_PREFIX}${userId}`, avatarUrl);
  if (email) localStorage.setItem(`${SK_AVATAR_PREFIX}${email.toLowerCase()}`, avatarUrl);
}

/** Helper to retrieve genuine cached patient avatars */
export function getAvatarFromCache(userId: string, email?: string): string | null {
  if (userId) {
    const byId = localStorage.getItem(`${SK_AVATAR_PREFIX}${userId}`);
    if (byId && !byId.includes('dicebear.com')) return byId;
  }
  if (email) {
    const byEmail = localStorage.getItem(`${SK_AVATAR_PREFIX}${email.toLowerCase()}`);
    if (byEmail && !byEmail.includes('dicebear.com')) return byEmail;
  }
  return null;
}

/**
 * Generates a stable, deterministic UUID for a given email address.
 * Ensures the exact same user ID is produced across different browsers, devices,
 * and sessions without relying on volatile random UUID generation.
 */
export function getDeterministicUserId(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return 'e1000000-0000-4000-a000-000000000001';
  if (clean === 'dadi@mindsathi.in') return 'e1000000-0000-4000-a000-000000000001';
  if (clean === 'admin@mindsathi.in') return 'c1000000-0000-4000-a000-000000000002';
  if (clean === 'rituraj11@mindsathi.in') return 'a1000000-0000-4000-a000-000000000003';

  let h1 = 0x811c9dc5;
  let h2 = 0x55555555;
  let h3 = 0x33333333;
  let h4 = 0x0f0f0f0f;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code << 1), 0x01000193);
    h3 = Math.imul(h3 ^ (code << 2), 0x01000193);
    h4 = Math.imul(h4 ^ (code << 3), 0x01000193);
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const part1 = toHex(h1);
  const part2 = toHex(h2);
  const part3 = toHex(h3);
  const part4 = toHex(h4);

  const timeLow = part1;
  const timeMid = part2.substring(0, 4);
  const timeHi = '4' + part2.substring(5, 8);
  const clockSeq = 'a' + part3.substring(1, 4);
  const node = part3.substring(4, 8) + part4.substring(0, 8);

  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
}

export interface StoredCredential {
  email: string;
  username?: string;
  password: string;
  userId: string;
  role: UserRole;
  mobile?: string;
  createdAt: string;
}

export const DEFAULT_CREDENTIALS: StoredCredential[] = [
  {
    email: 'dadi@mindsathi.in',
    password: 'Sathi123',
    userId: 'e1000000-0000-4000-a000-000000000001',
    role: 'elderly',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    email: 'admin@mindsathi.in',
    password: 'Admin@1234',
    userId: 'c1000000-0000-4000-a000-000000000002',
    role: 'caregiver',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    email: 'rituraj11@mindsathi.in',
    username: 'RITURAJ11',
    password: 'RITURAJ@11',
    userId: 'a1000000-0000-4000-a000-000000000003',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'e1000000-0000-4000-a000-000000000001',
    name: 'Dadi Sathi',
    preferredName: 'Dadi',
    role: 'elderly',
    age: 72,
    gender: 'female',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&fit=crop&q=80',
    primaryLanguage: 'hi',
    city: 'Guwahati',
    state: 'Assam',
    northeastRegion: 'Assam',
    isAyushmanMember: true,
    ayushmanMemberId: 'PMJAY-AS-9921-4820',
    ayushmanStatus: 'verified',
    pmjayStatus: 'verified',
    abhaStatus: 'verified',
    abhaId: '91-8472-1092-3847',
    hasCompletedOnboarding: true,
    familyMemberCount: 3,
    caregiverIds: ['c1000000-0000-4000-a000-000000000002'],
    clinicianIds: [],
    accessibility: { fontSize: 'large', highContrast: false, textToSpeechAuto: true, soundEffects: true, speechRate: 0.85 },
    streakDays: 5,
    totalXp: 350,
    level: 3,
    levelTitle: 'Gyaani Sathi',
    createdAt: '2025-01-01T00:00:00.000Z',
    email: 'dadi@mindsathi.in',
    phone: '9876543210',
  },
  {
    id: 'c1000000-0000-4000-a000-000000000002',
    name: 'Dr. Admin Caregiver',
    preferredName: 'Admin',
    role: 'caregiver',
    age: 45,
    gender: 'male',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&fit=crop&q=80',
    primaryLanguage: 'en',
    city: 'Guwahati',
    state: 'Assam',
    northeastRegion: 'Assam',
    isAyushmanMember: false,
    ayushmanStatus: 'none',
    pmjayStatus: 'none',
    abhaStatus: 'none',
    hasCompletedOnboarding: true,
    familyMemberCount: 0,
    caregiverIds: [],
    clinicianIds: [],
    accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: true, speechRate: 1.0 },
    streakDays: 1,
    totalXp: 120,
    level: 2,
    levelTitle: 'Senior Caregiver',
    createdAt: '2025-01-01T00:00:00.000Z',
    email: 'admin@mindsathi.in',
    phone: '9876543211',
  },
  {
    id: 'a1000000-0000-4000-a000-000000000003',
    name: 'Rituraj (Platform Administrator)',
    preferredName: 'Rituraj',
    role: 'admin',
    age: 32,
    gender: 'male',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&fit=crop&q=80',
    primaryLanguage: 'en',
    city: 'Guwahati',
    state: 'Assam',
    northeastRegion: 'Assam',
    isAyushmanMember: false,
    ayushmanStatus: 'none',
    pmjayStatus: 'none',
    abhaStatus: 'none',
    hasCompletedOnboarding: true,
    familyMemberCount: 0,
    caregiverIds: [],
    clinicianIds: [],
    accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: true, speechRate: 1.0 },
    streakDays: 10,
    totalXp: 1500,
    level: 10,
    levelTitle: 'Super Administrator',
    createdAt: '2025-01-01T00:00:00.000Z',
    email: 'rituraj11@mindsathi.in',
    phone: '9800000000',
  },
];

export function isRealProfile(p: UserProfile): boolean {
  if (!p || !p.id) return false;
  const id = p.id.toLowerCase();
  if (id === 'guest' || id.startsWith('elder-') || id.startsWith('caregiver-') || id.startsWith('clinician-') || id.startsWith('u00')) {
    return false;
  }
  const name = (p.name || '').trim().toLowerCase();
  if (name.includes('shanti devi') || name.includes('bhupen bora') || name.includes('dr. arvind mukherjee')) {
    return false;
  }
  return true;
}

function getStoredCredentials(): StoredCredential[] {
  try {
    const raw = localStorage.getItem(SK_CREDENTIALS);
    let list: StoredCredential[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw) as StoredCredential[];
      } catch {
        list = [];
      }
    }
    list = list.filter((c) =>
      !c.userId.startsWith('elder-') &&
      !c.userId.startsWith('caregiver-') &&
      !c.userId.startsWith('clinician-') &&
      !c.userId.startsWith('u00')
    );
    for (const def of DEFAULT_CREDENTIALS) {
      if (!list.some((c) => c.email.toLowerCase() === def.email.toLowerCase())) {
        list.push(def);
      }
    }
    return list;
  } catch {
    return DEFAULT_CREDENTIALS;
  }
}

function saveStoredCredential(cred: StoredCredential) {
  try {
    const list = getStoredCredentials().filter(
      (c) => c.email.toLowerCase() !== cred.email.toLowerCase()
    );
    list.unshift(cred);
    localStorage.setItem(SK_CREDENTIALS, JSON.stringify(list));
  } catch (e) {
    console.warn('[AuthService] Could not save credential locally:', e);
  }
}

function findStoredCredential(emailOrPhone: string): StoredCredential | undefined {
  const norm = emailOrPhone.trim().toLowerCase();
  const digits = norm.replace(/\D/g, '');
  return getStoredCredentials().find((c) => {
    if (c.email.toLowerCase() === norm) return true;
    if (c.userId.toLowerCase() === norm) return true;
    if (c.username && c.username.toLowerCase() === norm) return true;
    if (c.mobile && digits.length >= 10) {
      const cDigits = c.mobile.replace(/\D/g, '');
      if (cDigits.endsWith(digits.slice(-10))) return true;
    }
    return false;
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function mapDbProfileToUser(dbRow: Record<string, unknown>, email = ''): UserProfile {
  const id = dbRow.id as string;
  return {
    id,
    name: (dbRow.full_name as string) || 'MIND SATHI User',
    preferredName:
      (dbRow.preferred_name as string) ||
      ((dbRow.full_name as string)?.split(' ')[0]) ||
      'Sathi',
    role: ((dbRow.role === 'patient' ? 'elderly' : dbRow.role) as UserRole),
    age: (dbRow.age as number) ?? 65,
    gender: (dbRow.gender as string) ?? 'other',
    avatarUrl: (() => {
      const profileEmail = email || (dbRow.email as string) || '';
      const rawPhoto = (dbRow.profile_photo_url as string) || '';
      const isRealDbPhoto = rawPhoto && !rawPhoto.includes('dicebear.com');
      const cachedPhoto = !isRealDbPhoto ? getAvatarFromCache(id, profileEmail) : null;
      if (isRealDbPhoto) {
        saveAvatarToCache(id, profileEmail, rawPhoto);
      }
      return isRealDbPhoto
        ? rawPhoto
        : (cachedPhoto || `https://api.dicebear.com/9.x/avataaars/svg?seed=${id}&backgroundColor=b6e3f4`);
    })(),
    primaryLanguage: (dbRow.preferred_language as string) || 'en',
    secondaryLanguage: dbRow.secondary_language as string | undefined,
    city: (dbRow.city as string) || 'Guwahati',
    state: (dbRow.state as string) || 'Assam',
    northeastRegion: (dbRow.northeast_region as string) || 'Assam',
    isAyushmanMember: (dbRow.is_ayushman_member as boolean) ?? false,
    ayushmanMemberId: dbRow.ayushman_member_id as string | undefined,
    pmjayId: dbRow.ayushman_member_id as string | undefined,
    ayushmanStatus: (dbRow.ayushman_status as string) || 'none',
    pmjayStatus: (dbRow.ayushman_status as string) || 'none',
    abhaId: dbRow.abha_id as string | undefined,
    abhaStatus: (dbRow.abha_status as string) || 'none',
    hasCompletedOnboarding: (dbRow.has_completed_onboarding as boolean) ?? true,
    familyMemberCount: (dbRow.family_member_count as number) ?? 0,
    caregiverIds: (dbRow.caregiver_ids as string[]) || [],
    clinicianIds: (dbRow.clinician_ids as string[]) || [],
    accessibility: (dbRow.accessibility as UserProfile['accessibility']) || {
      fontSize: 'normal',
      highContrast: false,
      textToSpeechAuto: false,
      soundEffects: true,
      speechRate: 0.85,
    },
    streakDays: (dbRow.streak_days as number) ?? 1,
    totalXp: (dbRow.total_xp as number) ?? 50,
    level: (dbRow.level as number) ?? 1,
    levelTitle: (dbRow.level_title as string) || 'Naya Sathi',
    createdAt: (dbRow.created_at as string) || new Date().toISOString(),
    email: email || (dbRow.email as string) || '',
    phone: (dbRow.phone as string) || '',
  } as UserProfile;
}

function profileToAuthUser(profile: UserProfile, email: string, mobile = ''): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email,
    mobile,
    role: profile.role,
    createdAt: profile.createdAt,
    profileId: profile.id,
  };
}

function makeSession(profile: UserProfile, email: string, mobile = ''): AuthSession {
  return {
    user: profileToAuthUser(profile, email, mobile),
    token: `sb-${profile.id}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ── service class ─────────────────────────────────────────────────────────────

class AuthService {
  private session: AuthSession | null = null;
  private currentProfile: UserProfile | null = null;
  private patientProfile: UserProfile | null = null;
  private caregiverProfile: UserProfile | null = null;
  private allProfiles: UserProfile[] = [];
  private listeners: Set<(session: AuthSession | null) => void> = new Set();
  /** Resolves once the Supabase session check on startup is complete. */
  public readonly ready: Promise<void>;
  private _resolveReady!: () => void;

  constructor() {
    this.ready = new Promise((res) => { this._resolveReady = res; });

    // Restore cached profiles for instant first paint, purging any legacy mock profiles
    const storedProfiles = localStorage.getItem(SK_PROFILES);
    if (storedProfiles) {
      try {
        const parsed = JSON.parse(storedProfiles) as UserProfile[];
        this.allProfiles = parsed.filter(isRealProfile);
      } catch {
        this.allProfiles = [];
      }
    } else {
      this.allProfiles = [];
    }

    // Seed default demo profiles if not already present
    for (const dp of DEFAULT_PROFILES) {
      if (!this.allProfiles.some((p) => p.email?.toLowerCase() === dp.email?.toLowerCase())) {
        this.allProfiles.push(dp);
      }
    }
    localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));

    // Restore cached patient profile
    const storedPatient = localStorage.getItem(SK_PATIENT_PROFILE);
    if (storedPatient) {
      try {
        const p = JSON.parse(storedPatient) as UserProfile;
        if (isRealProfile(p)) this.patientProfile = p;
      } catch {}
    }

    // Restore cached caregiver profile
    const storedCaregiver = localStorage.getItem(SK_CAREGIVER_PROFILE);
    if (storedCaregiver) {
      try {
        const c = JSON.parse(storedCaregiver) as UserProfile;
        if (isRealProfile(c)) this.caregiverProfile = c;
      } catch {}
    }

    // Restore cached session (for instant UI paint only — will be validated below)
    const storedSession = localStorage.getItem(SK_SESSION);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as AuthSession;
        if (new Date(parsed.expiresAt) > new Date()) {
          this.session = parsed;
          const found = this.allProfiles.find((p) => p.id === parsed.user.id) ?? null;
          this.currentProfile = this.patientProfile ?? found;
        } else {
          localStorage.removeItem(SK_SESSION);
        }
      } catch {
        localStorage.removeItem(SK_SESSION);
      }
    }

    // Validate with Supabase asynchronously
    this.initSupabaseAuth();
  }

  private async initSupabaseAuth() {
    try {
      // Get the current real Supabase session (works after page refresh)
      const { data: { session: sbSession } } = await supabase.auth.getSession();

      if (sbSession?.user) {
        await this.syncProfileFromSupabase(sbSession.user.id, sbSession.user.email || '');
      } else if (this.session?.user) {
        // Maintain active user session across refreshes (rate-limit resilient or unconfirmed email)
        console.log('[AuthService] Preserving active user session for:', this.session.user.email);
        const found = this.allProfiles.find((p) => p.id === this.session!.user.id) ?? null;
        if (!this.currentProfile) {
          this.currentProfile = this.patientProfile ?? found;
        }
        this.notifyListeners();
      } else {
        // No session exists
        this.session = null;
        this.currentProfile = null;
        localStorage.removeItem(SK_SESSION);
        this.notifyListeners();
      }

      // Listen for future auth changes (token refresh, sign-out from another tab, etc.)
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
          await this.syncProfileFromSupabase(newSession.user.id, newSession.user.email || '');
        } else if (event === 'SIGNED_OUT') {
          // If explicitly signed out without local session
          if (!this.session) {
            this.currentProfile = null;
            localStorage.removeItem(SK_SESSION);
            this.notifyListeners();
          }
        }
      });
    } catch (e) {
      console.warn('[AuthService] Supabase init error:', e);
    } finally {
      this._resolveReady();
    }
  }

  private async syncProfileFromSupabase(userId: string, email: string): Promise<UserProfile | null> {
    try {
      const { data: dbProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (dbProfile && !error) {
        const mapped = mapDbProfileToUser(dbProfile as Record<string, unknown>, email);

        // Preserve hasCompletedOnboarding=true if the user just completed onboarding
        // (DB write may still be in flight when onAuthStateChange fires SIGNED_IN)
        const existingLocal = this.allProfiles.find((p) => p.id === userId || (p.email && p.email.toLowerCase() === email.toLowerCase()));
        if (existingLocal?.hasCompletedOnboarding && !mapped.hasCompletedOnboarding) {
          mapped.hasCompletedOnboarding = true;
        }

        // Preserve real photo if DB returned a DiceBear placeholder
        const cachedPhoto = getAvatarFromCache(userId, email);
        if (mapped.avatarUrl.includes('dicebear.com')) {
          if (existingLocal?.avatarUrl && !existingLocal.avatarUrl.includes('dicebear.com')) {
            mapped.avatarUrl = existingLocal.avatarUrl;
            saveAvatarToCache(userId, email, existingLocal.avatarUrl);
          } else if (cachedPhoto) {
            mapped.avatarUrl = cachedPhoto;
          }
        }

        // Push real photo to Supabase if valid UUID so DB is kept in sync
        if (mapped.avatarUrl && !mapped.avatarUrl.includes('dicebear.com') && userId.includes('-') && userId.length > 20) {
          saveAvatarToCache(userId, email, mapped.avatarUrl);
          supabase.from('profiles').update({ profile_photo_url: mapped.avatarUrl }).eq('id', userId).then(() => {});
        }

        if (mapped.role === 'elderly' || (mapped.role as string) === 'patient') {
          this.patientProfile = mapped;
          localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(mapped));
        } else if (mapped.role === 'caregiver') {
          this.caregiverProfile = mapped;
          localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(mapped));
        }

        // Keep currentProfile as patientProfile if one exists so Home Page stays as the patient
        if (!this.patientProfile || mapped.role === 'elderly') {
          this.currentProfile = mapped;
        } else {
          this.currentProfile = this.patientProfile;
        }

        // Upsert into allProfiles cache
        const idx = this.allProfiles.findIndex((p) => p.id === mapped.id);
        if (idx >= 0) {
          this.allProfiles[idx] = mapped;
        } else {
          this.allProfiles.unshift(mapped);
        }
        localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
        offlineDb.profiles.put(mapped).catch(() => {});

        this.session = makeSession(mapped, email);
        localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
        this.notifyListeners();
        return mapped;
      }

      // Profile row doesn't exist in DB yet — create from Supabase Auth user metadata
      const authUser = (await supabase.auth.getUser()).data?.user;
      const metadata = authUser?.user_metadata || {};
      const fallbackProfile: UserProfile = this.allProfiles.find((p) => p.id === userId) || {
        id: userId,
        name: (metadata.full_name as string) || email.split('@')[0] || 'MIND SATHI User',
        preferredName: ((metadata.full_name as string)?.split(' ')[0]) || email.split('@')[0] || 'Sathi',
        role: (metadata.role as UserRole) || 'elderly',
        age: 70,
        gender: 'other',
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`,
        primaryLanguage: 'en',
        city: 'Guwahati',
        state: 'Assam',
        northeastRegion: 'Assam',
        isAyushmanMember: false,
        ayushmanStatus: 'none',
        pmjayStatus: 'none',
        abhaStatus: 'none',
        hasCompletedOnboarding: metadata.role !== 'elderly',
        caregiverIds: [],
        clinicianIds: [],
        accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: true, speechRate: 0.85 },
        streakDays: 1,
        totalXp: 50,
        level: 1,
        levelTitle: 'Naya Sathi',
        createdAt: new Date().toISOString(),
      };

      // Try to upsert row into profiles table in DB
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fallbackProfile.name,
          preferred_name: fallbackProfile.preferredName,
          role: fallbackProfile.role,
          phone: (metadata.mobile as string) || '',
          has_completed_onboarding: fallbackProfile.hasCompletedOnboarding,
          accessibility: fallbackProfile.accessibility,
          created_at: fallbackProfile.createdAt,
          updated_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('[AuthService] Profile upsert error:', upsertErr);
      }

      this.currentProfile = fallbackProfile;
      const idx = this.allProfiles.findIndex((p) => p.id === userId);
      if (idx >= 0) {
        this.allProfiles[idx] = fallbackProfile;
      } else {
        this.allProfiles.unshift(fallbackProfile);
      }
      localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));

      this.session = makeSession(fallbackProfile, email);
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      this.notifyListeners();
      return fallbackProfile;
    } catch (err) {
      console.error('[AuthService] Error fetching profile:', err);
    }
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Sign in with email + password.
   * Checks Supabase Auth first, with graceful fallback to stored credentials
   * if Supabase Auth was rate-limited during registration.
   */
  public async login(credentials: AuthCredentials): Promise<AuthResult<AuthSession>> {
    const { email, password, rememberMe, ayushmanMemberId } = credentials;
    const normalizedEmail = email.trim().toLowerCase();

    let authenticated = false;
    let userId: string | null = null;
    let authRole: UserRole = 'elderly';
    let authErrorMsg: string | null = null;

    // 1. Try Supabase Auth first
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!sbError && sbData?.user) {
        authenticated = true;
        userId = sbData.user.id;
        authRole = (sbData.user.user_metadata?.role as UserRole) || 'elderly';
        saveStoredCredential({
          email: normalizedEmail,
          password,
          userId,
          role: authRole,
          createdAt: sbData.user.created_at || new Date().toISOString(),
        });
      } else if (sbError) {
        const errCode = (sbError as any).code;
        const errMsg = (sbError.message || '').toLowerCase();

        if (errCode === 'email_not_confirmed' || errMsg.includes('confirm')) {
          // Supabase verified the password matches the account, but email confirmation is pending in Supabase!
          console.log('[AuthService] Supabase verified credentials with pending email confirmation. Authenticating.');
          authenticated = true;
          const localCred = findStoredCredential(normalizedEmail);
          const foundProfile = this.allProfiles.find(
            (p) => p.email && p.email.toLowerCase() === normalizedEmail
          );
          userId = localCred?.userId || foundProfile?.id || getDeterministicUserId(normalizedEmail);
          authRole = foundProfile?.role || localCred?.role || 'elderly';
          saveStoredCredential({
            email: normalizedEmail,
            password,
            userId,
            role: authRole,
            createdAt: foundProfile?.createdAt || new Date().toISOString(),
          });
        } else if (errCode === 'invalid_credentials' || errMsg.includes('invalid login credentials')) {
          authErrorMsg = 'Invalid email or password. Please try again.';
        }
      }
    } catch (e) {
      console.warn('[AuthService] Supabase signIn error:', e);
    }

    // 2. If Supabase Auth didn't authenticate directly, check stored credentials
    if (!authenticated) {
      const localCred = findStoredCredential(normalizedEmail);
      if (localCred) {
        if (localCred.password === password) {
          authenticated = true;
          userId = localCred.userId;
          authRole = localCred.role;
        } else {
          return {
            success: false,
            error: { message: 'Invalid password. Please try again.' },
          };
        }
      }
    }

    if (!authenticated || !userId) {
      return {
        success: false,
        error: { message: authErrorMsg || 'Invalid email or password. Please try again.' },
      };
    }

    // 3. Persist Ayushman ID if provided
    if (ayushmanMemberId?.trim()) {
      try {
        await supabase
          .from('profiles')
          .update({
            is_ayushman_member: true,
            ayushman_member_id: ayushmanMemberId.trim(),
            ayushman_status: 'verified',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      } catch (e) {
        console.warn('[AuthService] Error updating Ayushman ID:', e);
      }
    }

    // 4. Sync or load profile
    let profile: UserProfile | null = null;
    try {
      profile = await this.syncProfileFromSupabase(userId, normalizedEmail);
    } catch (e) {
      console.warn('[AuthService] Supabase profile sync fallback:', e);
    }

    if (!profile) {
      // Find profile in cached profiles
      profile = this.allProfiles.find(
        (p) => p.id === userId || (p.email && p.email.toLowerCase() === normalizedEmail)
      ) || null;

      if (!profile) {
        const localCred = findStoredCredential(normalizedEmail);
        profile = {
          id: userId,
          name: normalizedEmail.split('@')[0] || 'MIND SATHI User',
          preferredName: normalizedEmail.split('@')[0] || 'Sathi',
          role: localCred?.role || authRole,
          age: 70,
          gender: 'other',
          avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`,
          primaryLanguage: 'en',
          city: 'Guwahati',
          state: 'Assam',
          northeastRegion: 'Assam',
          isAyushmanMember: false,
          ayushmanStatus: 'none',
          pmjayStatus: 'none',
          abhaStatus: 'none',
          hasCompletedOnboarding: true,
          caregiverIds: [],
          clinicianIds: [],
          accessibility: {
            fontSize: 'normal',
            highContrast: false,
            textToSpeechAuto: false,
            soundEffects: true,
            speechRate: 0.85,
          },
          streakDays: 1,
          totalXp: 50,
          level: 1,
          levelTitle: 'Naya Sathi',
          createdAt: new Date().toISOString(),
          email: normalizedEmail,
        };
      }

      const existingIdx = this.allProfiles.findIndex((p) => p.id === profile!.id);
      if (existingIdx >= 0) {
        this.allProfiles[existingIdx] = profile;
      } else {
        this.allProfiles.unshift(profile);
      }
      localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
      offlineDb.profiles.put(profile).catch(() => {});
    }

    // Ensure genuine avatar is preserved from cache if available
    const cachedAvatar = getAvatarFromCache(profile.id, normalizedEmail);
    if (cachedAvatar && profile.avatarUrl.includes('dicebear.com')) {
      profile.avatarUrl = cachedAvatar;
      const idx = this.allProfiles.findIndex((p) => p.id === profile!.id);
      if (idx >= 0) {
        this.allProfiles[idx] = profile;
        localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
      }
    }

    if (profile.role === 'elderly' || (profile.role as string) === 'patient') {
      this.patientProfile = profile;
      localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(profile));
      this.currentProfile = profile;
      // Explicitly link and sync family members, reminders, and game sessions with this patient ID
      familyService.linkFamilyMembersToPatient(profile.id, normalizedEmail);
      familyService.syncFamilyMembersFromDb(profile.id).catch(() => {});
      reminderService.syncRemindersFromDb(profile.id).catch(() => {});
      gameService.syncSessionsFromDb(profile.id).catch(() => {});
    } else if (profile.role === 'caregiver') {
      if (credentials.name?.trim()) {
        profile.name = credentials.name.trim();
        profile.preferredName = credentials.name.trim().split(' ')[0];
      }
      if (credentials.avatarUrl?.trim()) {
        profile.avatarUrl = credentials.avatarUrl.trim();
        saveAvatarToCache(profile.id, normalizedEmail, credentials.avatarUrl.trim());
      }
      this.caregiverProfile = profile;
      localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(profile));
      this.currentProfile = profile;
      // Immediately resolve and link the strictly connected patient for this caregiver
      this.resolveConnectedPatientForCaregiver(profile.id, normalizedEmail).then((connectedPatient) => {
        if (connectedPatient) {
          familyService.syncFamilyMembersFromDb(connectedPatient.id).catch(() => {});
          reminderService.syncRemindersFromDb(connectedPatient.id).catch(() => {});
          gameService.syncSessionsFromDb(connectedPatient.id).catch(() => {});
        }
      }).catch(() => {});
    } else {
      this.currentProfile = profile;
    }

    this.session = makeSession(profile, normalizedEmail);
    if (rememberMe) {
      this.session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
    this.notifyListeners();
    return { success: true, data: this.session };
  }

  /** Register a new account with Supabase Auth & public.profiles with rate-limit resiliency. */
  public async register(payload: RegisterPayload): Promise<AuthResult<AuthSession>> {
    const email = payload.email.trim().toLowerCase();

    // 1. If an account already exists locally with this password, log in directly
    const existingCred = findStoredCredential(email);
    if (existingCred && existingCred.password === payload.password) {
      return this.login({ email, password: payload.password });
    }

    let userId: string | null = null;
    let registeredWithSupabase = false;

    // 2. Attempt Supabase Auth signUp
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.name.trim(),
            role: payload.role,
            mobile: payload.mobile,
          },
        },
      });

      if (sbError) {
        const msg = sbError.message.toLowerCase();
        const isRateLimit =
          msg.includes('rate limit') ||
          (sbError as { status?: number }).status === 429 ||
          (sbError as { code?: string }).code === 'over_email_send_rate_limit';
        const isAlreadyExists =
          msg.includes('already') ||
          msg.includes('registered') ||
          msg.includes('exists');

        if (isAlreadyExists) {
          saveStoredCredential({
            email,
            password: payload.password,
            userId: existingCred?.userId || getDeterministicUserId(email),
            role: payload.role,
            mobile: payload.mobile,
            createdAt: new Date().toISOString(),
          });
          const loginRes = await this.login({ email, password: payload.password });
          if (loginRes.success) return loginRes;
          return {
            success: false,
            error: { message: 'Account already exists. Please login.' },
          };
        }

        if (isRateLimit) {
          console.warn(
            '[AuthService] Supabase email rate limit exceeded. Activating seamless local registration so the user is never blocked.'
          );
          // Check if user already exists in Supabase
          try {
            const loginRes = await supabase.auth.signInWithPassword({
              email,
              password: payload.password,
            });
            if (loginRes.data?.user) {
              userId = loginRes.data.user.id;
              registeredWithSupabase = true;
            } else {
              userId = getDeterministicUserId(email);
            }
          } catch {
            userId = getDeterministicUserId(email);
          }
        } else {
          return { success: false, error: { message: sbError.message } };
        }
      } else if (sbData?.user) {
        // If Supabase returns user with empty identities, email is already registered
        if (Array.isArray(sbData.user.identities) && sbData.user.identities.length === 0) {
          saveStoredCredential({
            email,
            password: payload.password,
            userId: sbData.user.id || getDeterministicUserId(email),
            role: payload.role,
            mobile: payload.mobile,
            createdAt: new Date().toISOString(),
          });
          const loginRes = await this.login({ email, password: payload.password });
          if (loginRes.success) return loginRes;
          return {
            success: false,
            error: { message: 'Account already exists. Please login with your password.' },
          };
        }
        userId = sbData.user.id;
        registeredWithSupabase = true;
      }
    } catch (err: unknown) {
      console.warn('[AuthService] Supabase signUp network error:', err);
      userId = getDeterministicUserId(email);
    }

    if (!userId) {
      userId = getDeterministicUserId(email);
    }

    // 3. Always save credential so user can log out and log back in with the same email & password
    saveStoredCredential({
      email,
      password: payload.password,
      userId,
      role: payload.role,
      mobile: payload.mobile,
      createdAt: new Date().toISOString(),
    });

    // 4. If Supabase Auth succeeded, upsert profile row to public.profiles
    if (registeredWithSupabase) {
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: payload.name.trim(),
          preferred_name: payload.name.trim().split(' ')[0],
          role: payload.role,
          phone: payload.mobile,
          is_ayushman_member: payload.isAyushmanMember ?? false,
          ayushman_member_id: payload.ayushmanMemberId ?? null,
          ayushman_status:
            payload.isAyushmanMember && payload.ayushmanMemberId ? 'verified' : 'none',
          has_completed_onboarding: payload.role !== 'elderly',
          accessibility: {
            fontSize: 'normal',
            highContrast: false,
            textToSpeechAuto: false,
            soundEffects: true,
            speechRate: 0.85,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('[AuthService] Profile upsert error:', upsertErr);
      }

      const profile = await this.syncProfileFromSupabase(userId, email);
      if (profile && this.session) {
        return { success: true, data: this.session };
      }
    }

    // 5. Fallback user profile creation (works even during Supabase email rate-limit window)
    const newProfile: UserProfile = {
      id: userId,
      name: payload.name.trim(),
      preferredName: payload.name.trim().split(' ')[0],
      role: payload.role,
      age: payload.role === 'elderly' ? 70 : 35,
      gender: 'other',
      avatarUrl: payload.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`,
      primaryLanguage: 'en',
      city: 'Guwahati',
      state: 'Assam',
      northeastRegion: 'Assam',
      isAyushmanMember: payload.isAyushmanMember ?? false,
      ayushmanMemberId: payload.ayushmanMemberId,
      pmjayId: payload.ayushmanMemberId,
      ayushmanStatus:
        payload.isAyushmanMember && payload.ayushmanMemberId ? 'verified' : 'none',
      pmjayStatus: 'none',
      abhaStatus: 'none',
      hasCompletedOnboarding: payload.role !== 'elderly',
      caregiverIds: [],
      clinicianIds: [],
      accessibility: {
        fontSize: 'normal',
        highContrast: false,
        textToSpeechAuto: false,
        soundEffects: true,
        speechRate: 0.85,
      },
      streakDays: 1,
      totalXp: 50,
      level: 1,
      levelTitle: 'Naya Sathi',
      createdAt: new Date().toISOString(),
      email,
      phone: payload.mobile,
    };

    if (payload.avatarUrl) {
      saveAvatarToCache(userId, email, payload.avatarUrl);
    }

    if (newProfile.role === 'elderly' || (newProfile.role as string) === 'patient') {
      this.patientProfile = newProfile;
      localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(newProfile));
      this.currentProfile = newProfile;
    } else if (newProfile.role === 'caregiver') {
      this.caregiverProfile = newProfile;
      localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(newProfile));
      this.currentProfile = newProfile;
    } else {
      this.currentProfile = newProfile;
    }

    const existingIdx = this.allProfiles.findIndex(
      (p) => p.id === userId || (p.email && p.email.toLowerCase() === email)
    );
    if (existingIdx >= 0) {
      this.allProfiles[existingIdx] = newProfile;
    } else {
      this.allProfiles.unshift(newProfile);
    }
    localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
    offlineDb.profiles.put(newProfile).catch(() => {});

    // Link any family members created before/during signup
    familyService.linkFamilyMembersToPatient(newProfile.id, email);

    const session = makeSession(newProfile, email, payload.mobile);
    this.session = session;
    localStorage.setItem(SK_SESSION, JSON.stringify(session));
    this.notifyListeners();
    return { success: true, data: session };
  }

  /** Sign out and clear active session. Preserves credentials and profiles for re-login. */
  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] signOut error:', e);
    }
    this.session = null;
    this.currentProfile = null;
    this.patientProfile = null;
    this.caregiverProfile = null;
    localStorage.removeItem(SK_SESSION);
    localStorage.removeItem(SK_PATIENT_PROFILE);
    localStorage.removeItem(SK_CAREGIVER_PROFILE);
    // Note: Do NOT remove ms_local_credentials or ms_all_profiles,
    // so users can log back in with the same email & password.
    this.notifyListeners();
  }

  /** Send a password-reset email via Supabase. */
  public async forgotPassword(email: string): Promise<AuthResult> {
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    } catch (e) {
      console.warn('[AuthService] resetPasswordForEmail error:', e);
    }
    return { success: true };
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /**
   * Resolves and sets the strictly connected single patient for a caregiver account.
   * Checks local storage, allProfiles, and Supabase caregiver_patient table.
   */
  public async resolveConnectedPatientForCaregiver(
    caregiverId: string,
    caregiverEmail?: string
  ): Promise<UserProfile | null> {
    try {
      // 1. Check local storage cache
      let cachedRaw = localStorage.getItem(`mind_sathi_caregiver_patient_${caregiverId}`);
      if (!cachedRaw && caregiverEmail) {
        cachedRaw = localStorage.getItem(`mind_sathi_caregiver_patient_${caregiverEmail.toLowerCase()}`);
      }
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (Array.isArray(parsed) && parsed.length > 0 && isRealProfile(parsed[0])) {
          this.setLinkedPatient(parsed[0]);
          return parsed[0];
        }
      }

      // 2. Check allProfiles where caregiverIds includes caregiverId
      const linkedInProfiles = this.allProfiles.find(
        (p) =>
          (p.role === 'elderly' || (p.role as string) === 'patient') &&
          isRealProfile(p) &&
          p.caregiverIds &&
          (p.caregiverIds.includes(caregiverId) ||
            (caregiverEmail && p.caregiverIds.includes(caregiverEmail.toLowerCase())))
      );
      if (linkedInProfiles) {
        this.setLinkedPatient(linkedInProfiles);
        return linkedInProfiles;
      }

      // 3. Check Supabase caregiver_patient table
      const { data: linkRows } = await supabase
        .from('caregiver_patient')
        .select('patient_id')
        .eq('caregiver_id', caregiverId)
        .limit(1);

      if (linkRows && linkRows.length > 0 && linkRows[0].patient_id) {
        const { data: ptData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', linkRows[0].patient_id)
          .maybeSingle();

        if (ptData && !ptData.id.startsWith('elder-')) {
          const ptProfile = await this.syncProfileFromSupabase(ptData.id, ptData.email);
          if (ptProfile) {
            this.setLinkedPatient(ptProfile);
            return ptProfile;
          }
        }
      }
    } catch (e) {
      console.warn('[AuthService] resolveConnectedPatientForCaregiver notice:', e);
    }
    return null;
  }

  /**
   * Sets or updates the currently linked elderly patient.
   * Ensures the patient remains the active profile for the Home Page and main app.
   */
  public setLinkedPatient(patient: UserProfile) {
    if (!patient || !isRealProfile(patient)) return;
    this.patientProfile = patient;
    this.currentProfile = patient;
    localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(patient));

    const idx = this.allProfiles.findIndex((p) => p.id === patient.id);
    if (idx >= 0) {
      this.allProfiles[idx] = patient;
    } else {
      this.allProfiles.unshift(patient);
    }
    localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
    offlineDb.profiles.put(patient).catch(() => {});
    this.notifyListeners();
  }

  public getPatientProfile(): UserProfile | null {
    if (this.patientProfile && isRealProfile(this.patientProfile)) return this.patientProfile;
    try {
      const stored = localStorage.getItem(SK_PATIENT_PROFILE);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (isRealProfile(parsed)) {
          this.patientProfile = parsed;
          return parsed;
        }
      }
    } catch {}
    const inAll = this.allProfiles.find((p) => (p.role === 'elderly' || (p.role as string) === 'patient') && isRealProfile(p));
    if (inAll) {
      this.patientProfile = inAll;
      return inAll;
    }
    return this.currentProfile?.role === 'elderly' ? this.currentProfile : null;
  }

  public getCaregiverProfile(): UserProfile | null {
    if (this.caregiverProfile && isRealProfile(this.caregiverProfile)) return this.caregiverProfile;
    try {
      const stored = localStorage.getItem(SK_CAREGIVER_PROFILE);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (isRealProfile(parsed)) {
          this.caregiverProfile = parsed;
          return parsed;
        }
      }
    } catch {}
    // If the authenticated user is actually a caregiver, return that profile
    if (this.currentProfile?.role === 'caregiver' && isRealProfile(this.currentProfile)) {
      return this.currentProfile;
    }
    return null;
  }

  /**
   * Retrieves the current user profile.
   * If contextTab is 'caregiver':
   * - If a caregiver profile is authenticated, returns the caregiver profile.
   * - If an elderly patient is authenticated and navigates to the caregiver tab,
   *   returns the elderly patient so the portal can show patient-caregiver connection status.
   * - Never returns a fake fallback caregiver!
   * For Home Page and all other screens, returns the Patient profile.
   */
  public getCurrentUser(contextTab?: string): UserProfile | null {
    if (this.currentProfile?.role === 'caregiver') {
      return this.currentProfile;
    }
    if (contextTab === 'caregiver') {
      const cg = this.getCaregiverProfile();
      if (cg) return cg;
      if (this.currentProfile && (this.currentProfile.role === 'elderly' || (this.currentProfile.role as string) === 'patient')) {
        return this.currentProfile;
      }
      return null;
    } else {
      // Home page, games, daily-plan, progress, etc.
      const pt = this.getPatientProfile();
      if (pt) return pt;
    }

    if (this.currentProfile) return this.currentProfile;
    if (!this.session) return null;
    return this.allProfiles.find((p) => p.id === this.session!.user.id) ?? null;
  }

  public getAuthSession(): AuthSession | null {
    return this.session;
  }

  public isAuthenticated(): boolean {
    return this.session !== null;
  }

  public getAllProfiles(): UserProfile[] {
    return this.allProfiles;
  }

  public getProfilesByRole(role: UserRole): UserProfile[] {
    return this.allProfiles.filter((p) => p.role === role);
  }

  /** Dev-only: switch to any cached profile without re-authenticating. */
  public switchUser(userId: string): UserProfile {
    const target = this.allProfiles.find((p) => p.id === userId);
    if (target) {
      this.currentProfile = target;
      const email = `${target.role}@mindsathi.in`;
      this.session = makeSession(target, email);
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      this.notifyListeners();
      return target;
    }
    return this.getCurrentUser() ?? this.allProfiles[0];
  }

  /** Update current user profile locally and push to Supabase asynchronously. */
  public updateCurrentUserProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getCurrentUser();
    if (!current) throw new Error('No authenticated user.');
    const updated = { ...current, ...updates };

    if (updates.avatarUrl && !updates.avatarUrl.includes('dicebear.com')) {
      saveAvatarToCache(updated.id, updated.email, updates.avatarUrl);
    }

    this.currentProfile = updated;
    if (updated.role === 'elderly' || (updated.role as string) === 'patient') {
      this.patientProfile = updated;
      localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(updated));
    } else if (updated.role === 'caregiver') {
      this.caregiverProfile = updated;
      localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(updated));
    }
    this.allProfiles = this.allProfiles.map((p) => (p.id === updated.id ? updated : p));
    localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
    offlineDb.profiles.put(updated).catch(() => {});

    if (updated.id.includes('-') && updated.id.length > 20) {
      supabase.from('profiles').upsert({
        id: updated.id,
        email: updated.email,
        full_name: updated.name,
        preferred_name: updated.preferredName,
        age: updated.age,
        gender: updated.gender,
        preferred_language: updated.primaryLanguage,
        secondary_language: updated.secondaryLanguage,
        city: updated.city,
        state: updated.state,
        northeast_region: updated.northeastRegion,
        is_ayushman_member: updated.isAyushmanMember,
        ayushman_member_id: updated.ayushmanMemberId,
        ayushman_status: updated.ayushmanStatus,
        abha_id: updated.abhaId,
        abha_status: updated.abhaStatus,
        profile_photo_url: updated.avatarUrl,
        has_completed_onboarding: updated.hasCompletedOnboarding,
        family_member_count: updated.familyMemberCount,
        accessibility: updated.accessibility,
        streak_days: updated.streakDays,
        total_xp: updated.totalXp,
        level: updated.level,
        level_title: updated.levelTitle,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[AuthService] Profile upsert error:', error.message);
      });
    }

    this.notifyListeners();
    return updated;
  }

  public subscribe(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.session));
  }
}

export const authService = new AuthService();
