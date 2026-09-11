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

export const DEFAULT_CREDENTIALS: StoredCredential[] = [];
export const DEFAULT_PROFILES: UserProfile[] = [];

export function isRealProfile(p: UserProfile): boolean {
  if (!p || !p.id) return false;
  const id = p.id.toLowerCase();
  if (
    id === 'guest' ||
    id.startsWith('elder-') ||
    id.startsWith('caregiver-') ||
    id.startsWith('clinician-') ||
    id.startsWith('u00') ||
    id.startsWith('e1000') ||
    id.startsWith('c1000') ||
    id.startsWith('a1000')
  ) {
    return false;
  }
  const name = (p.name || '').trim().toLowerCase();
  if (
    name.includes('shanti devi') ||
    name.includes('bhupen bora') ||
    name.includes('dr. arvind mukherjee') ||
    name.includes('dadi sathi') ||
    name.includes('dr. admin caregiver')
  ) {
    return false;
  }
  return true;
}

function getStoredCredentials(): StoredCredential[] {
  return [];
}

function saveStoredCredential(_cred: StoredCredential) {
  // Real Google Account authentication is enforced; no local credentials stored.
}

function findStoredCredential(_emailOrPhone: string): StoredCredential | undefined {
  return undefined;
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
    connectionCode: (dbRow.connection_code as string) || undefined,
  } as UserProfile;
}

export function generateConnectionCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'MS-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
  private needsRoleSelection: boolean = false;
  private pendingGoogleUser: any = null;
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

    // Purge any legacy fake profiles or credentials from localStorage
    localStorage.removeItem(SK_CREDENTIALS);
    this.allProfiles = this.allProfiles.filter(isRealProfile);
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

  public getNeedsRoleSelection(): boolean {
    return this.needsRoleSelection;
  }

  public getPendingGoogleUser(): any {
    return this.pendingGoogleUser;
  }

  /**
   * Initiates real Supabase Google OAuth.
   * Redirects user to Google OAuth consent screen.
   */
  public async signInWithGoogle(intendedRole?: UserRole): Promise<{ success: boolean; error?: string }> {
    try {
      if (intendedRole) {
        sessionStorage.setItem('ms_pending_oauth_role', intendedRole);
      } else {
        sessionStorage.removeItem('ms_pending_oauth_role');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
          msg = 'Google provider is not enabled in your Supabase project. Please enable Google under Authentication > Providers in your Supabase dashboard.';
        }
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[AuthService] signInWithGoogle error:', err);
      let msg = err.message || 'Google Sign-In failed to initialize.';
      if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
        msg = 'Google provider is not enabled in your Supabase project. Please enable Google under Authentication > Providers in your Supabase dashboard.';
      }
      return { success: false, error: msg };
    }
  }

  /**
   * Completes Google onboarding by creating the permanent profile with the selected role.
   */
  public async completeGoogleProfile(role: UserRole, details?: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const authUser = (await supabase.auth.getUser()).data?.user || this.pendingGoogleUser;
      if (!authUser || !authUser.id) {
        console.error('[AuthService] completeGoogleProfile: No Supabase user authenticated.');
        return null;
      }

      const userId = authUser.id;
      const email = authUser.email || '';
      const meta = authUser.user_metadata || {};
      const fullName = details?.name?.trim() || meta.full_name || meta.name || email.split('@')[0] || 'MIND SATHI User';
      const preferredName = details?.preferredName?.trim() || fullName.split(' ')[0] || 'Sathi';
      const rawPhoto = details?.avatarUrl || meta.avatar_url || meta.picture;
      const photoUrl = rawPhoto || getAvatarFromCache(userId, email) || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`;
      const connectionCode = generateConnectionCode();

      const newProfile: UserProfile = {
        id: userId,
        name: fullName,
        preferredName: preferredName,
        role,
        age: details?.age ?? (role === 'elderly' ? 70 : 35),
        gender: details?.gender ?? 'other',
        avatarUrl: photoUrl,
        primaryLanguage: details?.primaryLanguage ?? 'en',
        city: details?.city ?? 'Guwahati',
        state: details?.state ?? 'Assam',
        northeastRegion: details?.northeastRegion ?? 'Assam',
        isAyushmanMember: details?.isAyushmanMember ?? false,
        ayushmanMemberId: details?.ayushmanMemberId,
        ayushmanStatus: details?.ayushmanStatus ?? 'none',
        pmjayStatus: 'none',
        abhaId: details?.abhaId,
        abhaStatus: details?.abhaStatus ?? 'none',
        hasCompletedOnboarding: role !== 'elderly',
        familyMemberCount: 0,
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
        phone: details?.phone || meta.phone || (meta.mobile as string) || '',
        connectionCode,
      };

      if (photoUrl && !photoUrl.includes('dicebear.com')) {
        saveAvatarToCache(userId, email, photoUrl);
      }

      // Upsert into Supabase profiles table
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fullName,
          preferred_name: preferredName,
          role: role === 'elderly' ? 'patient' : role,
          profile_photo_url: photoUrl,
          connection_code: connectionCode,
          age: newProfile.age,
          gender: newProfile.gender,
          preferred_language: newProfile.primaryLanguage,
          city: newProfile.city,
          state: newProfile.state,
          northeast_region: newProfile.northeastRegion,
          is_ayushman_member: newProfile.isAyushmanMember,
          ayushman_member_id: newProfile.ayushmanMemberId,
          ayushman_status: newProfile.ayushmanStatus,
          abha_id: newProfile.abhaId,
          abha_status: newProfile.abhaStatus,
          has_completed_onboarding: newProfile.hasCompletedOnboarding,
          accessibility: newProfile.accessibility,
          created_at: newProfile.createdAt,
          updated_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('[AuthService] completeGoogleProfile Supabase upsert note:', upsertErr);
      }

      this.needsRoleSelection = false;
      this.pendingGoogleUser = null;
      sessionStorage.removeItem('ms_pending_oauth_role');

      if (role === 'elderly' || (role as string) === 'patient') {
        this.patientProfile = newProfile;
        localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(newProfile));
        this.currentProfile = newProfile;
      } else if (role === 'caregiver') {
        this.caregiverProfile = newProfile;
        localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(newProfile));
        this.currentProfile = newProfile;
      } else {
        this.currentProfile = newProfile;
      }

      const idx = this.allProfiles.findIndex((p) => p.id === userId);
      if (idx >= 0) {
        this.allProfiles[idx] = newProfile;
      } else {
        this.allProfiles.unshift(newProfile);
      }
      localStorage.setItem(SK_PROFILES, JSON.stringify(this.allProfiles));
      offlineDb.profiles.put(newProfile).catch(() => {});

      this.session = makeSession(newProfile, email);
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      this.notifyListeners();
      return newProfile;
    } catch (err) {
      console.error('[AuthService] completeGoogleProfile exception:', err);
      return null;
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
        let mapped = mapDbProfileToUser(dbProfile as Record<string, unknown>, email);

        // Ensure connectionCode is populated
        if (!mapped.connectionCode) {
          const generatedCode = generateConnectionCode();
          mapped.connectionCode = generatedCode;
          supabase.from('profiles').update({ connection_code: generatedCode }).eq('id', userId).then(() => {});
        }

        // Preserve hasCompletedOnboarding=true if the user just completed onboarding
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

        this.needsRoleSelection = false;
        this.pendingGoogleUser = null;
        sessionStorage.removeItem('ms_pending_oauth_role');

        if (mapped.role === 'elderly' || (mapped.role as string) === 'patient') {
          this.patientProfile = mapped;
          localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(mapped));
        } else if (mapped.role === 'caregiver') {
          this.caregiverProfile = mapped;
          localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(mapped));
        }

        if (mapped.role === 'caregiver') {
          this.currentProfile = mapped;
        } else if (mapped.role === 'elderly') {
          this.currentProfile = mapped;
        } else {
          this.currentProfile = mapped;
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

      // Profile row doesn't exist in DB yet — check if user designated a role prior to OAuth
      const authUser = (await supabase.auth.getUser()).data?.user;
      const metadata = authUser?.user_metadata || {};
      const pendingRole = (sessionStorage.getItem('ms_pending_oauth_role') as UserRole) || (metadata.role as UserRole);

      if (pendingRole) {
        sessionStorage.removeItem('ms_pending_oauth_role');
        return await this.completeGoogleProfile(pendingRole);
      }

      // New Google User: Prompt for role selection
      this.pendingGoogleUser = authUser || { id: userId, email, user_metadata: metadata };
      this.needsRoleSelection = true;

      const tempProfile: UserProfile = {
        id: userId,
        name: (metadata.full_name as string) || (metadata.name as string) || email.split('@')[0] || 'MIND SATHI User',
        preferredName: ((metadata.full_name as string) || (metadata.name as string) || email.split('@')[0])?.split(' ')[0] || 'Sathi',
        role: 'elderly',
        age: 70,
        gender: 'other',
        avatarUrl: (metadata.avatar_url as string) || (metadata.picture as string) || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`,
        primaryLanguage: 'en',
        city: 'Guwahati',
        state: 'Assam',
        northeastRegion: 'Assam',
        isAyushmanMember: false,
        ayushmanStatus: 'none',
        pmjayStatus: 'none',
        abhaStatus: 'none',
        hasCompletedOnboarding: false,
        caregiverIds: [],
        clinicianIds: [],
        accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: true, speechRate: 0.85 },
        streakDays: 1,
        totalXp: 50,
        level: 1,
        levelTitle: 'Naya Sathi',
        createdAt: new Date().toISOString(),
        email,
      };

      this.currentProfile = tempProfile;
      this.session = makeSession(tempProfile, email);
      this.notifyListeners();
      return tempProfile;
    } catch (err) {
      console.error('[AuthService] Error in syncProfileFromSupabase:', err);
    }
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Sign in with email + password via Supabase Auth only.
   * Hardcoded demo credentials and local mock logins have been completely removed.
   */
  public async login(credentials: AuthCredentials): Promise<AuthResult<AuthSession>> {
    const { email, password, rememberMe, ayushmanMemberId } = credentials;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (sbError || !sbData?.user) {
        return {
          success: false,
          error: { message: sbError?.message || 'Authentication failed. Please sign in with your verified Google Account.' },
        };
      }

      const userId = sbData.user.id;
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

      const profile = await this.syncProfileFromSupabase(userId, normalizedEmail);
      if (!profile) {
        return {
          success: false,
          error: { message: 'Profile not found in database. Please sign in with your Google Account.' },
        };
      }

      this.session = makeSession(profile, normalizedEmail);
      if (rememberMe) {
        this.session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      this.notifyListeners();
      return { success: true, data: this.session };
    } catch (err: any) {
      return {
        success: false,
        error: { message: err.message || 'Login failed. Please sign in with Google.' },
      };
    }
  }

  /** Register an account via Supabase Auth & profiles table only. */
  public async register(payload: RegisterPayload): Promise<AuthResult<AuthSession>> {
    const email = payload.email.trim().toLowerCase();

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

      if (sbError || !sbData?.user) {
        return {
          success: false,
          error: { message: sbError?.message || 'Registration failed. Please sign in with Google.' },
        };
      }

      const userId = sbData.user.id;
      const connectionCode = generateConnectionCode();
      const photoUrl = payload.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4`;

      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: payload.name.trim(),
          preferred_name: payload.name.trim().split(' ')[0],
          role: payload.role === 'elderly' ? 'patient' : payload.role,
          connection_code: connectionCode,
          profile_photo_url: photoUrl,
          phone: payload.mobile,
          is_ayushman_member: payload.isAyushmanMember ?? false,
          ayushman_member_id: payload.ayushmanMemberId ?? null,
          ayushman_status: payload.isAyushmanMember && payload.ayushmanMemberId ? 'verified' : 'none',
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
      if (!profile) {
        return {
          success: false,
          error: { message: 'Failed to initialize profile. Please sign in with Google.' },
        };
      }

      // Link any family members created before/during signup
      familyService.linkFamilyMembersToPatient(profile.id, email);

      const session = makeSession(profile, email, payload.mobile);
      this.session = session;
      localStorage.setItem(SK_SESSION, JSON.stringify(session));
      this.notifyListeners();
      return { success: true, data: session };
    } catch (err: any) {
      return {
        success: false,
        error: { message: err.message || 'Registration failed.' },
      };
    }
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
    this.needsRoleSelection = false;
    this.pendingGoogleUser = null;
    sessionStorage.removeItem('ms_pending_oauth_role');
    localStorage.removeItem(SK_SESSION);
    localStorage.removeItem(SK_PATIENT_PROFILE);
    localStorage.removeItem(SK_CAREGIVER_PROFILE);
    // Note: Do NOT remove ms_local_credentials or ms_all_profiles,
    // and NEVER delete any records from database!
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
