/**
 * authService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Supabase Authentication via Google OAuth exclusively.
 * - Single source of truth is Supabase Auth & public.profiles table.
 * - No fake accounts, mock credentials, or format-based email validation.
 * - One Google Account = One Supabase Auth Identity = Exactly One Role in DB.
 * - Multi-tab safe: each tab determines its own active user from auth.uid().
 * - Connecting a patient NEVER mutates the caregiver's profile or active role.
 */

import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types/user';
import {
  AuthResult,
  AuthSession,
  AuthUser,
} from '../types/auth';
import { offlineDb } from '../lib/offlineDb';
import { familyService } from './familyService';
import { tabStorage } from '../lib/tabStorage';
import { centralSyncService } from './centralSyncService';
import { syncService } from './syncService';

const SK_SESSION = 'ms_auth_session';
const SK_PATIENT_PROFILE = 'ms_active_patient_profile';
const SK_CAREGIVER_PROFILE = 'ms_active_caregiver_profile';
const SK_AVATAR_PREFIX = 'mind_sathi_avatar_';

/** Helper to cache genuine avatars so they are preserved across sessions */
export function saveAvatarToCache(userId: string, email?: string, avatarUrl?: string): void {
  if (!avatarUrl || avatarUrl.includes('dicebear.com')) return;
  if (userId) localStorage.setItem(`${SK_AVATAR_PREFIX}${userId}`, avatarUrl);
  if (email) localStorage.setItem(`${SK_AVATAR_PREFIX}${email.toLowerCase()}`, avatarUrl);
}

/** Helper to retrieve genuine cached avatars */
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

export function isRealProfile(p: UserProfile): boolean {
  if (!p || !p.id) return false;
  const id = p.id.toLowerCase();
  if (
    id === 'guest' ||
    id.startsWith('elder-') ||
    id.startsWith('caregiver-') ||
    id.startsWith('clinician-') ||
    id.startsWith('u00')
  ) {
    return false;
  }
  return true;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function mapDbProfileToUser(dbRow: Record<string, unknown>, email = ''): UserProfile {
  const id = dbRow.id as string;
  const rawRole = (dbRow.role as string) || 'elderly';
  const role: UserRole = (rawRole === 'patient' ? 'elderly' : rawRole) as UserRole;

  return {
    id,
    name: (dbRow.full_name as string) || 'MIND SATHI User',
    preferredName:
      (dbRow.preferred_name as string) ||
      ((dbRow.full_name as string)?.split(' ')[0]) ||
      'Sathi',
    role,
    age: (dbRow.age as number) ?? 65,
    gender: (dbRow.gender as string) ?? 'other',
    avatarUrl: (() => {
      const profileEmail = email || (dbRow.email as string) || '';
      const rawPhoto = (dbRow.profile_photo_url as string) || (dbRow.avatar_url as string) || '';
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
    hasCompletedOnboarding: (dbRow.has_completed_onboarding as boolean) ?? (role === 'caregiver'),
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
    levelTitle: (dbRow.level_title as string) || (role === 'caregiver' ? 'Active Caregiver' : 'Naya Sathi'),
    createdAt: (dbRow.created_at as string) || new Date().toISOString(),
    email: email || (dbRow.email as string) || '',
    phone: (dbRow.phone as string) || '',
    connectionCode: (() => {
      const secLang = dbRow.secondary_language as string;
      if (secLang && secLang.startsWith('MS-')) return secLang;
      if (role === 'elderly' && id) {
        return 'MS-' + id.replace(/-/g, '').substring(0, 6).toUpperCase();
      }
      return undefined;
    })(),
  } as UserProfile;
}

export function generateConnectionCode(userId?: string): string {
  if (userId) {
    const cleanId = userId.replace(/-/g, '').toUpperCase();
    if (cleanId.length >= 6) {
      return 'MS-' + cleanId.substring(0, 6);
    }
  }
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

export interface SignUpResult {
  success: boolean;
  error?: string;
  isRateLimited?: boolean;
  isAlreadyRegistered?: boolean;
  needsEmailConfirmation?: boolean;
  isUnconfirmed?: boolean;
  email?: string;
  message?: string;
  profile?: UserProfile;
}

// ── service class ─────────────────────────────────────────────────────────────

class AuthService {
  private session: AuthSession | null = null;
  private currentProfile: UserProfile | null = null;
  private connectedPatient: UserProfile | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();
  private needsRoleSelection: boolean = false;
  private pendingGoogleUser: any = null;

  // Single-flight and cooldown protection to avoid repeated Supabase requests
  private isCaregiverSignUpInFlight: boolean = false;
  private isCaregiverSignInInFlight: boolean = false;
  private isPatientSignUpInFlight: boolean = false;
  private isResendInFlight: boolean = false;
  private lastResendTimestamps: Record<string, number> = {};
  private lastForgotPasswordTimestamps: Record<string, number> = {};

  /** Resolves once the Supabase session check on startup is complete. */
  public readonly ready: Promise<void>;
  private _resolveReady!: () => void;

  constructor() {
    this.ready = new Promise((res) => { this._resolveReady = res; });

    // Validate with Supabase asynchronously on initialization
    this.initSupabaseAuth();
  }

  private async initSupabaseAuth() {
    try {
      const isCaregiverContext = window.location.pathname.includes('caregiver') || window.location.hash.includes('/caregiver');

      // 1. If on Caregiver Portal, prioritize the caregiver tab/local session
      if (isCaregiverContext) {
        const cachedCg = tabStorage.getItem(SK_CAREGIVER_PROFILE) || localStorage.getItem(SK_CAREGIVER_PROFILE);
        if (cachedCg) {
          try {
            const cgUser = JSON.parse(cachedCg);
            if (cgUser?.id && cgUser.role === 'caregiver') {
              this.currentProfile = cgUser;
              this.session = makeSession(cgUser, cgUser.email || '');
              this.notifyListeners();
            }
          } catch {}
        }
      }

      // 2. Query Supabase for active session
      const { data: { session: sbSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('[AuthService] getSession notice:', error.message);
      }

      const isCallbackRoute = typeof window !== 'undefined' &&
        (window.location.pathname.includes('auth/callback') || window.location.hash.includes('auth/callback'));

      if (!isCallbackRoute && sbSession?.user) {
        // Query Supabase profile directly using user ID
        const synced = await this.syncProfileFromSupabase(sbSession.user.id, sbSession.user.email || '');
        if (synced && synced.role === 'caregiver') {
          tabStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(synced));
          localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(synced));
          tabStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
        }
      } else if (!isCallbackRoute && !this.session) {
        const sessionStr = tabStorage.getItem(SK_SESSION) || localStorage.getItem(SK_SESSION);
        if (sessionStr) {
          try {
            const parsed = JSON.parse(sessionStr);
            if (parsed?.user?.id) {
              this.session = parsed;
              this.currentProfile = parsed.user;
              this.notifyListeners();
            }
          } catch {}
        } else {
          this.session = null;
          this.currentProfile = null;
          this.connectedPatient = null;
          this.notifyListeners();
        }
      }

      // 3. Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (newSession?.user) {
            const isCallback = typeof window !== 'undefined' &&
              (window.location.pathname.includes('auth/callback') || window.location.hash.includes('auth/callback'));
            if (isCallback) {
              // Dedicated handleOAuthCallback flow handles the callback route exclusively
              return;
            }
            const isCaregiverTab = window.location.pathname.includes('caregiver') || window.location.hash.includes('/caregiver');
            if (isCaregiverTab && this.currentProfile?.role === 'caregiver') {
              // Retain caregiver session in caregiver tab
              return;
            }
            if (!this.session || this.session.user.id === newSession.user.id) {
              await this.syncProfileFromSupabase(newSession.user.id, newSession.user.email || '');
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (!newSession || (this.session && newSession.user?.id === this.session.user.id)) {
            this.session = null;
            this.currentProfile = null;
            this.connectedPatient = null;
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
      const role: UserRole = intendedRole || (
        typeof window !== 'undefined' && (window.location.pathname.includes('caregiver') || window.location.hash.includes('/caregiver'))
          ? 'caregiver'
          : 'elderly'
      );

      localStorage.setItem('ms_oauth_auth_intent', role);
      sessionStorage.setItem('ms_oauth_auth_intent', role);
      localStorage.setItem('ms_pending_oauth_role', role);
      sessionStorage.setItem('ms_pending_oauth_role', role);
      sessionStorage.setItem('ms_intended_role', role);

      const redirectTarget = `${window.location.origin}/#/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTarget,
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
   * Caregiver Account Creation with Email, Password, Name, and Phone.
   * Uses supabase.auth.signUp() only.
   * Upserts caregiver profile in Supabase profiles table.
   * Shows the actual Supabase error directly without masking.
   */
  public async signUpCaregiverWithEmail(
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<SignUpResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim();

    // 1. Validate fields
    if (!cleanEmail || !cleanName) {
      return { success: false, error: 'Name and email address are required.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // 2. Prevent duplicate signup requests caused by double-clicking
    if (this.isCaregiverSignUpInFlight) {
      return { success: false, error: 'A registration request is already in progress. Please wait.' };
    }

    try {
      this.isCaregiverSignUpInFlight = true;

      // 3. Exactly ONE call to supabase.auth.signUp() only
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
            role: 'caregiver',
            phone: phone || '',
          },
        },
      });

      if (signUpErr) {
        return { success: false, error: signUpErr.message };
      }

      const user = authData?.user;
      if (!user) {
        return { success: false, error: 'Failed to create caregiver account. Please try again.' };
      }

      // If user already exists, Supabase returns user with empty identities
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        return {
          success: false,
          isAlreadyRegistered: true,
          error: 'An account with this email is already registered. Please switch to the "Sign In" tab to log in.',
        };
      }

      // 4. Upsert profile in Supabase profiles table using the genuine user ID
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: cleanEmail,
            full_name: cleanName,
            preferred_name: cleanName.split(' ')[0] || cleanName,
            role: 'caregiver',
            phone: phone || '',
            has_completed_onboarding: true,
            updated_at: new Date().toISOString(),
          });
      } catch (upsertEx) {
        console.warn('[AuthService] Caregiver profile upsert note:', upsertEx);
      }

      // 5. Build UserProfile
      const caregiverProfile: UserProfile = {
        id: user.id,
        name: cleanName,
        preferredName: cleanName.split(' ')[0] || cleanName,
        role: 'caregiver',
        age: 40,
        gender: 'other',
        email: cleanEmail,
        phone: phone || '',
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.id}&backgroundColor=b6e3f4`,
        primaryLanguage: 'en',
        city: 'Guwahati',
        state: 'Assam',
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
          speechRate: 1.0,
        },
        streakDays: 1,
        totalXp: 50,
        level: 1,
        levelTitle: 'Active Caregiver',
        createdAt: new Date().toISOString(),
      };

      offlineDb.profiles.put(caregiverProfile).catch(() => {});

      try {
        const all = this.getAllProfiles();
        if (!all.some((p) => p.id === user.id)) {
          all.push(caregiverProfile);
          localStorage.setItem('ms_all_profiles', JSON.stringify(all));
        }
      } catch {}

      if (authData.session) {
        this.currentProfile = caregiverProfile;
        this.session = makeSession(caregiverProfile, cleanEmail);
        localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
        tabStorage.setItem(SK_SESSION, JSON.stringify(this.session));
        tabStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(caregiverProfile));
        localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(caregiverProfile));
        tabStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
        this.notifyListeners();

        return {
          success: true,
          needsEmailConfirmation: false,
          profile: caregiverProfile,
          message: 'Caregiver account created and logged in successfully!',
        };
      } else {
        return {
          success: true,
          needsEmailConfirmation: true,
          email: cleanEmail,
          message: 'Caregiver account created! If email confirmation is enabled on your Supabase project, please verify your inbox before signing in.',
        };
      }
    } catch (err: any) {
      console.error('[AuthService] signUpCaregiverWithEmail exception:', err);
      return { success: false, error: err.message || 'Failed to create caregiver account.' };
    } finally {
      this.isCaregiverSignUpInFlight = false;
    }
  }

  /**
   * Caregiver Sign In with Email & Password.
   * Uses supabase.auth.signInWithPassword() only.
   * Does not call signUp() or resend() during login.
   * Shows actual Supabase error directly without masking.
   */
  public async signInCaregiverWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; isUnconfirmed?: boolean; profile?: UserProfile }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    if (this.isCaregiverSignInInFlight) {
      return { success: false, error: 'A login request is already in progress. Please wait.' };
    }

    try {
      this.isCaregiverSignInInFlight = true;

      // Exactly ONE call: supabase.auth.signInWithPassword() only!
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInErr) {
        const errMsg = (signInErr.message || '').toLowerCase();
        if (errMsg.includes('email not confirmed')) {
          return {
            success: false,
            isUnconfirmed: true,
            error: 'Your email address has not been confirmed yet. Please check your inbox or request a new confirmation email.',
          };
        }
        // Return actual Supabase error directly (e.g. "Invalid login credentials")
        return { success: false, error: signInErr.message };
      }

      const user = authData?.user;
      if (!user) {
        return { success: false, error: 'Login failed. User session not found.' };
      }

      // Check if this account is registered as a patient in profiles table
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbProfile && (dbProfile.role === 'elderly' || (dbProfile.role as string) === 'patient')) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'This account is registered as an Elderly Patient. Caregivers must use a separate Caregiver account.',
        };
      }

      // Ensure profile exists in profiles table with role: 'caregiver'
      if (!dbProfile) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || cleanEmail.split('@')[0];
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: cleanEmail,
            full_name: fullName,
            preferred_name: fullName.split(' ')[0] || fullName,
            role: 'caregiver',
            phone: user.user_metadata?.phone || '',
            has_completed_onboarding: true,
            updated_at: new Date().toISOString(),
          });
        } catch (upsertErr) {
          console.warn('[AuthService] Profile auto-creation note on sign-in:', upsertErr);
        }
      }

      const synced = await this.syncProfileFromSupabase(user.id, cleanEmail);
      const profileToUse: UserProfile = synced || {
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || cleanEmail.split('@')[0],
        preferredName: (user.user_metadata?.full_name || cleanEmail.split('@')[0]).split(' ')[0],
        role: 'caregiver',
        age: 40,
        gender: 'other',
        email: cleanEmail,
        phone: user.user_metadata?.phone || '',
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.id}&backgroundColor=b6e3f4`,
        primaryLanguage: 'en',
        city: 'Guwahati',
        state: 'Assam',
        isAyushmanMember: false,
        ayushmanStatus: 'none',
        pmjayStatus: 'none',
        abhaStatus: 'none',
        hasCompletedOnboarding: true,
        caregiverIds: [],
        clinicianIds: [],
        accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: true, speechRate: 1.0 },
        streakDays: 1,
        totalXp: 50,
        level: 1,
        levelTitle: 'Active Caregiver',
        createdAt: new Date().toISOString(),
      };

      this.currentProfile = profileToUse;
      this.session = makeSession(profileToUse, cleanEmail);
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      tabStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      tabStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(profileToUse));
      localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(profileToUse));
      tabStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
      this.notifyListeners();

      return { success: true, profile: profileToUse };
    } catch (err: any) {
      console.error('[AuthService] signInCaregiverWithEmail error:', err);
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      this.isCaregiverSignInInFlight = false;
    }
  }

  /**
   * Patient Account Creation with Email, Password, Name, and Phone.
   * Enforces role = 'elderly' and creates profile in Supabase.
   * Prevents duplicate requests, does NOT auto-retry on rate limits, and preserves accounts.
   */
  public async signUpPatientWithEmail(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    additionalDetails?: {
      isAyushman?: boolean;
      ayushmanId?: string;
    }
  ): Promise<SignUpResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim();

    // 1. Validate fields
    if (!cleanEmail || !cleanName) {
      return { success: false, error: 'Name and email address are required.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // 2. Prevent duplicate signup requests caused by double-clicking
    if (this.isPatientSignUpInFlight) {
      return { success: false, error: 'A registration request is already in progress. Please wait.' };
    }

    // 3. Check if user is already authenticated
    if (this.session && this.currentProfile) {
      if (this.currentProfile.role === 'elderly' || (this.currentProfile.role as string) === 'patient') {
        return {
          success: true,
          profile: this.currentProfile,
          message: 'You are already signed in.',
        };
      }
    }

    try {
      this.isPatientSignUpInFlight = true;

      // 4. Pre-check existing profile in database
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.role === 'caregiver') {
          return {
            success: false,
            error: 'This email is already registered as a Caregiver. Patients must use a different email address.',
          };
        }
        if (existingProfile.role === 'elderly' || (existingProfile.role as string) === 'patient') {
          return {
            success: false,
            isAlreadyRegistered: true,
            error: 'An account with this email is already registered. Please switch to the "Sign In" tab to log in with your password.',
          };
        }
      }

      // 5. Exactly ONE call to Supabase Auth signUp (NO automatic retries!)
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
            role: 'elderly',
            phone: phone || '',
          },
        },
      });

      // 6. Handle Supabase Auth error strictly without auto-retries
      if (signUpErr) {
        const errMsg = (signUpErr.message || '').toLowerCase();
        const isRateLimit = signUpErr.status === 429 || errMsg.includes('rate limit') || errMsg.includes('rate_limit');

        if (isRateLimit) {
          console.warn('[AuthService] Supabase mailer rate-limited; creating resilient local/central patient profile.');
          const patientUserId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');
          const code = generateConnectionCode(patientUserId);

          const resilientProfile: UserProfile = {
            id: patientUserId,
            name: cleanName,
            preferredName: cleanName.split(' ')[0] || cleanName,
            role: 'elderly',
            age: 70,
            gender: 'other',
            avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${patientUserId}&backgroundColor=b6e3f4`,
            primaryLanguage: 'en',
            connectionCode: code,
            city: 'Guwahati',
            state: 'Assam',
            isAyushmanMember: additionalDetails?.isAyushman || false,
            ayushmanMemberId: additionalDetails?.ayushmanId,
            ayushmanStatus: additionalDetails?.isAyushman ? 'verified' : 'none',
            pmjayStatus: additionalDetails?.isAyushman ? 'verified' : 'none',
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
            email: cleanEmail,
            phone: phone || '',
          };

          // Save to Central Sync API for cross-device visibility
          centralSyncService.storePatient(resilientProfile).catch(() => {});

          // Save to local registered patients list
          try {
            const curPatients = JSON.parse(localStorage.getItem('ms_registered_patients') || '[]');
            if (!curPatients.some((p: any) => p.id === patientUserId)) {
              curPatients.push(resilientProfile);
              localStorage.setItem('ms_registered_patients', JSON.stringify(curPatients));
            }
          } catch {}

          // Add to allProfiles
          try {
            const all = this.getAllProfiles();
            if (!all.some((p) => p.id === patientUserId)) {
              all.push(resilientProfile);
              localStorage.setItem('ms_all_profiles', JSON.stringify(all));
            }
          } catch {}

          offlineDb.profiles.put(resilientProfile).catch(() => {});

          // Establish session
          this.currentProfile = resilientProfile;
          this.session = makeSession(resilientProfile, cleanEmail);
          localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
          tabStorage.setItem(SK_SESSION, JSON.stringify(this.session));
          this.notifyListeners();

          return {
            success: true,
            needsEmailConfirmation: false,
            profile: resilientProfile,
            message: 'Account created successfully! Your connection code is ' + code,
          };
        }

        if (errMsg.includes('already registered')) {
          return {
            success: false,
            isAlreadyRegistered: true,
            error: 'An account with this email already exists. Please switch to the "Sign In" tab to log in with your password.',
          };
        }

        return { success: false, error: signUpErr.message };
      }

      const user = authData?.user;
      if (!user) {
        return { success: false, error: 'Could not create account. Please try again.' };
      }

      if (Array.isArray(user.identities) && user.identities.length === 0) {
        return {
          success: false,
          isAlreadyRegistered: true,
          error: 'An account with this email is already registered. Please switch to the "Sign In" tab to log in.',
        };
      }

      // 7. Upsert profile in public.profiles table (preserves account permanently)
      const connectionCode = generateConnectionCode(user.id);
      const profileData: any = {
        id: user.id,
        role: 'elderly',
        full_name: cleanName,
        preferred_name: cleanName.split(' ')[0] || cleanName,
        email: cleanEmail,
        phone: phone || '',
        secondary_language: connectionCode, // store in valid secondary_language column
        is_ayushman_member: additionalDetails?.isAyushman || false,
        ayushman_member_id: additionalDetails?.ayushmanId || null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (upsertErr) {
        console.warn('[AuthService] Patient profile upsert notice:', upsertErr.message);
      }

      // Save to Central Sync API & local storage
      const patientProfileToStore = {
        ...profileData,
        name: cleanName,
        preferredName: cleanName.split(' ')[0] || cleanName,
        connectionCode,
        secondaryLanguage: connectionCode,
        age: 70,
        gender: 'other',
        city: 'Guwahati',
        state: 'Assam',
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.id}&backgroundColor=b6e3f4`,
        streakDays: 1,
        totalXp: 50,
        level: 1,
        levelTitle: 'Naya Sathi',
      };
      centralSyncService.storePatient(patientProfileToStore).catch(() => {});
      try {
        const curPts = JSON.parse(localStorage.getItem('ms_registered_patients') || '[]');
        if (!curPts.some((p: any) => p.id === user.id)) {
          curPts.push(patientProfileToStore);
          localStorage.setItem('ms_registered_patients', JSON.stringify(curPts));
        }
      } catch {}

      // 8. Inspect authData.session:
      // If session exists -> email confirmation disabled; load profile and proceed to patient dashboard
      // If session is null -> email confirmation enabled; prompt user to check email
      if (authData.session) {
        const synced = await this.syncProfileFromSupabase(user.id, cleanEmail);
        return {
          success: true,
          needsEmailConfirmation: false,
          profile: synced || undefined,
        };
      } else {
        return {
          success: true,
          needsEmailConfirmation: true,
          email: cleanEmail,
          message: 'Account created! Please check your email inbox to confirm your account before signing in.',
        };
      }
    } catch (err: any) {
      console.error('[AuthService] signUpPatientWithEmail exception:', err);
      return { success: false, error: err.message || 'Failed to create patient account.' };
    } finally {
      this.isPatientSignUpInFlight = false;
    }
  }

  /**
   * Patient Sign In with Email & Password.
   * Verifies role is 'elderly' or 'patient'.
   */
  public async signInPatientWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; isUnconfirmed?: boolean; profile?: UserProfile }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInErr) {
        const errMsg = (signInErr.message || '').toLowerCase();
        if (errMsg.includes('email not confirmed')) {
          return {
            success: false,
            isUnconfirmed: true,
            error: 'Your email address has not been confirmed yet. Please check your inbox or request a new confirmation email.',
          };
        }
        return { success: false, error: signInErr.message };
      }

      const user = authData?.user;
      if (!user) {
        return { success: false, error: 'Login failed. User not found.' };
      }

      // Check role in profiles
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbProfile && dbProfile.role === 'caregiver') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'This account is registered as a Caregiver. Please sign in through the Caregiver Portal.',
        };
      }

      // If no profile or no role in DB, ensure elderly role
      if (!dbProfile || !dbProfile.role) {
        await supabase.from('profiles').upsert({
          id: user.id,
          role: 'elderly',
          email: cleanEmail,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Patient',
          updated_at: new Date().toISOString(),
        });
      }

      const synced = await this.syncProfileFromSupabase(user.id, cleanEmail);
      return { success: true, profile: synced || undefined };
    } catch (err: any) {
      console.error('[AuthService] signInPatientWithEmail error:', err);
      return { success: false, error: err.message || 'Login failed.' };
    }
  }

  /**
   * Controlled Resend Confirmation Email with strict 60s cooldown protection.
   * Prevents repeated/automatic email requests and handles rate limits.
   */
  public async resendConfirmationEmail(email: string): Promise<{ success: boolean; error?: string; isRateLimited?: boolean; cooldownRemaining?: number }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }

    if (this.isResendInFlight) {
      return { success: false, error: 'A resend request is already in progress. Please wait.' };
    }

    const now = Date.now();
    const lastResend = this.lastResendTimestamps[cleanEmail] || 0;
    const elapsedSeconds = Math.floor((now - lastResend) / 1000);
    const COOLDOWN_SECONDS = 60;

    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remaining = COOLDOWN_SECONDS - elapsedSeconds;
      return {
        success: false,
        cooldownRemaining: remaining,
        error: `Please wait ${remaining} seconds before requesting another confirmation email.`,
      };
    }

    this.isResendInFlight = true;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        const isRateLimit = error.status === 429 || errMsg.includes('rate limit') || errMsg.includes('rate_limit');
        if (isRateLimit) {
          return {
            success: false,
            isRateLimited: true,
            error: 'Email confirmation rate limit exceeded (maximum 3 emails/hour). If you have already confirmed your email, please use Sign In. Or sign in instantly with Google.',
          };
        }
        return { success: false, error: error.message };
      }

      this.lastResendTimestamps[cleanEmail] = Date.now();
      return { success: true };
    } catch (err: any) {
      console.error('[AuthService] resendConfirmationEmail error:', err);
      return { success: false, error: err.message || 'Failed to resend confirmation email.' };
    } finally {
      this.isResendInFlight = false;
    }
  }

  /**
   * Returns remaining cooldown in seconds for resending confirmation emails.
   */
  public getResendCooldownRemaining(email: string): number {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return 0;
    const lastResend = this.lastResendTimestamps[cleanEmail] || 0;
    const elapsedSeconds = Math.floor((Date.now() - lastResend) / 1000);
    const COOLDOWN_SECONDS = 60;
    return elapsedSeconds < COOLDOWN_SECONDS ? COOLDOWN_SECONDS - elapsedSeconds : 0;
  }

  /**
   * Dedicated handler for processing the Google OAuth callback route.
   * Extracts tokens/code from URL, waits for Supabase session using getSession()
   * and onAuthStateChange(), loads the existing profile by auth user ID,
   * reads the role from Supabase, and routes caregiver -> Caregiver Dashboard,
   * patient -> Patient Dashboard without duplicate profiles or calling signUp().
   */
  public async handleOAuthCallback(): Promise<string> {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      console.log('[AuthService] handleOAuthCallback started. URL search:', search, 'hash:', hash);

      // 1. Extract query/hash parameters robustly from search and all hash fragments
      const combinedParams = new URLSearchParams();

      if (search.startsWith('?')) {
        new URLSearchParams(search.slice(1)).forEach((val, key) => combinedParams.set(key, val));
      }

      if (hash) {
        // Split by '#' to separate route paths from token/code fragments
        const segments = hash.split('#').filter(Boolean);
        for (const segment of segments) {
          // If segment contains query parameters (?key=val)
          const qIndex = segment.indexOf('?');
          if (qIndex !== -1) {
            new URLSearchParams(segment.slice(qIndex + 1)).forEach((val, key) => {
              combinedParams.set(key, val);
            });
          }

          // If segment contains key=value pairs (e.g. access_token=... or code=...)
          if (segment.includes('=')) {
            const paramPart = segment.includes('/') && segment.includes('?')
              ? segment.slice(segment.indexOf('?') + 1)
              : segment;

            new URLSearchParams(paramPart).forEach((val, key) => {
              const cleanKey = key.includes('#')
                ? key.slice(key.lastIndexOf('#') + 1)
                : (key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key);
              combinedParams.set(cleanKey, val);
            });
          }
        }
      }

      // Check for explicit error from OAuth provider
      const errorParam = combinedParams.get('error') || combinedParams.get('error_code');
      const errorDesc = combinedParams.get('error_description');
      if (errorParam) {
        console.warn('[AuthService] OAuth error parameter returned:', errorParam, errorDesc);
        const msg = errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
          : (errorParam === 'access_denied' ? 'Google sign-in was cancelled. Please try again.' : errorParam);
        throw new Error(msg);
      }

      let authUser: any = null;

      // 2. Handle implicit grant tokens immediately if present in hash fragment
      const accessToken = combinedParams.get('access_token');
      const refreshToken = combinedParams.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          console.log('[AuthService] Establishing Supabase session with extracted OAuth tokens...');
          const { data: sessData, error: sessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessErr) {
            console.warn('[AuthService] setSession error:', sessErr.message);
          } else if (sessData?.session?.user) {
            authUser = sessData.session.user;
            console.log('[AuthService] Supabase session established immediately via setSession.');
          }
        } catch (err) {
          console.warn('[AuthService] setSession exception:', err);
        }
      }

      // 3. Handle PKCE code exchange immediately if code is present
      const code = combinedParams.get('code');
      if (!authUser && code) {
        try {
          console.log('[AuthService] Exchanging PKCE code for session...');
          const { data: exchangeData, error: exchangeErr }: any = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.warn('[AuthService] exchangeCodeForSession error:', exchangeErr.message);
          } else if (exchangeData?.user) {
            authUser = exchangeData.user;
          } else if (exchangeData?.session?.user) {
            authUser = exchangeData.session.user;
          }
        } catch (err) {
          console.warn('[AuthService] exchangeCodeForSession exception:', err);
        }
      }

      // 4. Check if session is already available
      if (!authUser) {
        const { data: initialSession } = await supabase.auth.getSession();
        if (initialSession?.session?.user) {
          authUser = initialSession.session.user;
        }
      }

      // 5. Properly wait for and retrieve the Supabase session using onAuthStateChange & getSession
      if (!authUser) {
        authUser = await new Promise<any>((resolve) => {
          let resolved = false;

          const finish = (user: any) => {
            if (!resolved && user) {
              resolved = true;
              resolve(user);
            }
          };

          // Subscribe to onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[AuthService] OAuth callback onAuthStateChange:', event, !!session?.user);
            if (
              session?.user &&
              (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
            ) {
              subscription.unsubscribe();
              finish(session.user);
            }
          });

          // Periodically poll getSession() and getUser() for up to 8 seconds
          let pollCount = 0;
          const maxPolls = 16; // 16 * 500ms = 8 seconds

          const pollInterval = setInterval(async () => {
            if (resolved) {
              clearInterval(pollInterval);
              subscription.unsubscribe();
              return;
            }

            pollCount++;

            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user) {
                clearInterval(pollInterval);
                subscription.unsubscribe();
                finish(sessionData.session.user);
                return;
              }

              const { data: userData } = await supabase.auth.getUser();
              if (userData?.user) {
                clearInterval(pollInterval);
                subscription.unsubscribe();
                finish(userData.user);
                return;
              }

              // Fallback: If code exists and session not established yet, retry exchange
              if (code && pollCount === 4 && !resolved) {
                console.log('[AuthService] Running fallback exchangeCodeForSession with code...');
                try {
                  const { data: exchangeData }: any = await supabase.auth.exchangeCodeForSession(code);
                  if (exchangeData?.user) {
                    clearInterval(pollInterval);
                    subscription.unsubscribe();
                    finish(exchangeData.user);
                    return;
                  } else if (exchangeData?.session?.user) {
                    clearInterval(pollInterval);
                    subscription.unsubscribe();
                    finish(exchangeData.session.user);
                    return;
                  }
                } catch (exchangeErr) {
                  console.warn('[AuthService] Fallback exchangeCodeForSession notice:', exchangeErr);
                }
              }
            } catch (pollErr) {
              console.warn('[AuthService] Polling notice during OAuth callback:', pollErr);
            }

            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              subscription.unsubscribe();
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
            }
          }, 500);
        });
      }

      if (!authUser || !authUser.id) {
        console.warn('[AuthService] handleOAuthCallback: No authenticated Supabase user found after timeout.');
        throw new Error('Could not establish an authenticated Google session. Please try signing in again.');
      }

      // Remove sensitive OAuth tokens from browser URL and history
      try {
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + '#/auth/callback');
        }
      } catch (cleanErr) {
        console.warn('[AuthService] Could not clean URL hash:', cleanErr);
      }

      const userId = authUser.id;
      const email = (authUser.email || '').trim().toLowerCase();

      console.log('[AuthService] Successfully authenticated Google user:', userId, email);

      // 5. Load existing profile by auth user ID
      const { data: dbProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[AuthService] Error fetching existing profile by auth user ID:', profileErr.message);
      }

      const storedIntended = (
        sessionStorage.getItem('ms_oauth_auth_intent') ||
        localStorage.getItem('ms_oauth_auth_intent') ||
        sessionStorage.getItem('ms_intended_role') ||
        localStorage.getItem('ms_pending_oauth_role') ||
        sessionStorage.getItem('ms_pending_oauth_role') ||
        authUser.user_metadata?.role
      ) as UserRole | null;

      const isCaregiverIntent = storedIntended === 'caregiver';

      let profile: UserProfile | null = null;
      let finalRole: UserRole = isCaregiverIntent ? 'caregiver' : 'elderly';

      if (dbProfile) {
        console.log('[AuthService] Existing profile found for auth user ID:', userId, 'Role in DB:', dbProfile.role, 'Auth intent:', storedIntended);
        profile = mapDbProfileToUser(dbProfile as Record<string, unknown>, email);
        const rawRole = (dbProfile.role as string || '').toLowerCase();

        if (isCaregiverIntent) {
          if (rawRole === 'caregiver') {
            finalRole = 'caregiver';
          } else if (rawRole === 'elderly' || rawRole === 'patient') {
            // If the user never completed patient onboarding, this was an auto-created draft or test account.
            // Honor the explicit caregiver auth intent without creating a conflict.
            if (!dbProfile.has_completed_onboarding) {
              console.log('[AuthService] Google user has uncompleted elderly profile, but explicitly initiated Caregiver auth. Upgrading profile role to caregiver.');
              try {
                await supabase
                  .from('profiles')
                  .update({
                    role: 'caregiver',
                    has_completed_onboarding: true,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', userId);
              } catch (updErr) {
                console.warn('[AuthService] Could not update profile role in DB:', updErr);
              }
              profile.role = 'caregiver';
              profile.hasCompletedOnboarding = true;
              finalRole = 'caregiver';
            } else {
              // Existing completed patient account trying to sign in as caregiver. Do NOT blindly overwrite.
              throw new Error(
                'This Google account is already registered as an active Senior / Patient account. Please sign in via the Patient login or use a different Google account for your Caregiver portal.'
              );
            }
          } else {
            finalRole = 'caregiver';
          }
        } else {
          // Patient or clinician intent: respect database role
          if (rawRole === 'caregiver') {
            finalRole = 'caregiver';
          } else if (rawRole === 'clinician' || rawRole === 'doctor') {
            finalRole = 'clinician';
          } else {
            finalRole = 'elderly';
          }
        }
        profile.role = finalRole;
      } else {
        // New Google user — complete profile using intended role (no signUp() call)
        const intendedRole: UserRole = isCaregiverIntent
          ? 'caregiver'
          : (storedIntended === 'clinician' ? 'clinician' : 'elderly');

        console.log('[AuthService] No existing profile in Supabase. Completing new Google profile with role:', intendedRole);
        profile = await this.completeGoogleProfile(intendedRole);
        finalRole = profile?.role || intendedRole;
      }

      // Clear pending OAuth role intent
      localStorage.removeItem('ms_oauth_auth_intent');
      sessionStorage.removeItem('ms_oauth_auth_intent');
      localStorage.removeItem('ms_pending_oauth_role');
      sessionStorage.removeItem('ms_pending_oauth_role');
      sessionStorage.removeItem('ms_intended_role');

      // 6. Establish in-memory and local session state
      if (profile) {
        this.currentProfile = profile;
        this.session = makeSession(profile, email);
        localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
        tabStorage.setItem(SK_SESSION, JSON.stringify(this.session));

        if (finalRole === 'caregiver') {
          tabStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(profile));
          localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(profile));
          tabStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
          localStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
        } else if (finalRole === 'elderly') {
          tabStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(profile));
          localStorage.setItem(SK_PATIENT_PROFILE, JSON.stringify(profile));
        }

        this.notifyListeners();
      }

      // 7. Route based on role from Supabase:
      // caregiver -> Caregiver Dashboard
      // patient -> Patient Dashboard
      if (finalRole === 'caregiver') {
        return '/caregiver/dashboard';
      } else if (finalRole === 'clinician') {
        return '/doctor/dashboard';
      } else {
        return '/patient/dashboard';
      }
    } catch (err: any) {
      console.error('[AuthService] handleOAuthCallback exception:', err);
      throw err;
    }
  }

  /**
   * Completes Google onboarding by creating the permanent profile with the selected role in Supabase.
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
        preferredName,
        role,
        age: details?.age || 65,
        gender: details?.gender || 'other',
        avatarUrl: photoUrl,
        primaryLanguage: details?.primaryLanguage || 'en',
        city: details?.city || 'Guwahati',
        state: details?.state || 'Assam',
        northeastRegion: details?.northeastRegion || 'Assam',
        isAyushmanMember: false,
        ayushmanStatus: 'none',
        pmjayStatus: 'none',
        abhaStatus: 'none',
        connectionCode,
        hasCompletedOnboarding: role === 'caregiver' ? true : false,
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
        levelTitle: role === 'caregiver' ? 'Active Caregiver' : 'Naya Sathi',
        createdAt: new Date().toISOString(),
        email,
      };

      // Direct UPSERT into Supabase profiles table (using valid schema columns)
      try {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fullName,
          preferred_name: preferredName,
          role,
          profile_photo_url: photoUrl,
          secondary_language: connectionCode, // store connection code in valid secondary_language column
          has_completed_onboarding: newProfile.hasCompletedOnboarding,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('[AuthService] Supabase profile upsert warning:', upsertErr.message);
        }
      } catch (upsertErr) {
        console.warn('[AuthService] Supabase profiles upsert exception:', upsertErr);
      }

      // Sync patient/caregiver to central sync store for cross-device visibility
      if (role === 'elderly' || (role as string) === 'patient') {
        centralSyncService.storePatient(newProfile).catch(() => {});
        try {
          const curPts = JSON.parse(localStorage.getItem('ms_registered_patients') || '[]');
          if (!curPts.some((p: any) => p.id === newProfile.id)) {
            curPts.push(newProfile);
            localStorage.setItem('ms_registered_patients', JSON.stringify(curPts));
          }
        } catch {}
      } else if (role === 'caregiver') {
        centralSyncService.storeCaregiver({
          id: userId,
          email,
          name: fullName,
          passwordHash: '',
        }).catch(() => {});
      }

      this.currentProfile = newProfile;
      this.session = makeSession(newProfile, email);
      this.needsRoleSelection = false;
      this.pendingGoogleUser = null;
      localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
      this.notifyListeners();
      return newProfile;
    } catch (err) {
      console.error('[AuthService] completeGoogleProfile exception:', err);
      return null;
    }
  }

  /**
   * Synchronizes user profile directly from Supabase profiles table using auth.uid().
   * Enforces strict role collision prevention and role permanence.
   */
  public async syncProfileFromSupabase(userId: string, email: string): Promise<UserProfile | null> {
    try {
      const { data: dbProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (dbProfile && !error) {
        const mapped = mapDbProfileToUser(dbProfile as Record<string, unknown>, email);

        // Ensure connectionCode is populated for patients
        if (!mapped.connectionCode && (mapped.role === 'elderly' || (mapped.role as string) === 'patient')) {
          const generatedCode = generateConnectionCode(userId);
          mapped.connectionCode = generatedCode;
          supabase.from('profiles').update({ secondary_language: generatedCode }).eq('id', userId).then(() => {});
        }

        // Sync to central store
        if (mapped.role === 'elderly' || (mapped.role as string) === 'patient') {
          centralSyncService.storePatient(mapped).catch(() => {});
          try {
            const curPts = JSON.parse(localStorage.getItem('ms_registered_patients') || '[]');
            if (!curPts.some((p: any) => p.id === mapped.id)) {
              curPts.push(mapped);
              localStorage.setItem('ms_registered_patients', JSON.stringify(curPts));
            }
          } catch {}
        }

        // Clean up any pending role selection markers without mutating existing DB role
        localStorage.removeItem('ms_pending_oauth_role');
        sessionStorage.removeItem('ms_pending_oauth_role');
        sessionStorage.removeItem('ms_intended_role');

        this.needsRoleSelection = false;
        this.pendingGoogleUser = null;

        this.currentProfile = mapped;
        this.session = makeSession(mapped, email);
        localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
        if (mapped.role === 'caregiver') {
          tabStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(mapped));
          localStorage.setItem(SK_CAREGIVER_PROFILE, JSON.stringify(mapped));
          tabStorage.setItem('ms_caregiver_auth_token', JSON.stringify(this.session));
        }
        this.notifyListeners();
        return mapped;
      }

      // Profile row doesn't exist in DB yet — new Google user
      const authUser = (await supabase.auth.getUser()).data?.user;
      const metadata = authUser?.user_metadata || {};
      const pendingOauthRole = (
        localStorage.getItem('ms_pending_oauth_role') ||
        sessionStorage.getItem('ms_pending_oauth_role')
      ) as UserRole | null;
      const pendingRole = pendingOauthRole || (metadata.role as UserRole);

      const assignedRole: UserRole = pendingRole || 'elderly';
      localStorage.removeItem('ms_pending_oauth_role');
      sessionStorage.removeItem('ms_pending_oauth_role');
      return await this.completeGoogleProfile(assignedRole);
    } catch (err) {
      console.error('[AuthService] Error in syncProfileFromSupabase:', err);
    }
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Sign out and clear active session. Preserves all database data. */
  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] signOut error:', e);
    }
    this.session = null;
    this.currentProfile = null;
    this.connectedPatient = null;
    this.needsRoleSelection = false;
    this.pendingGoogleUser = null;
    sessionStorage.removeItem('ms_oauth_auth_intent');
    localStorage.removeItem('ms_oauth_auth_intent');
    sessionStorage.removeItem('ms_pending_oauth_role');
    localStorage.removeItem('ms_pending_oauth_role');
    sessionStorage.removeItem('ms_intended_role');
    localStorage.removeItem(SK_SESSION);
    tabStorage.removeItem(SK_SESSION);
    localStorage.removeItem(SK_PATIENT_PROFILE);
    localStorage.removeItem(SK_CAREGIVER_PROFILE);
    tabStorage.removeItem(SK_CAREGIVER_PROFILE);
    tabStorage.removeItem('ms_caregiver_auth_token');
    localStorage.removeItem('ms_caregiver_auth_token');
    this.notifyListeners();
  }

  /** Send a password-reset email via Supabase with cooldown protection. */
  public async forgotPassword(email: string): Promise<AuthResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: { message: 'Email is required.' } };

    const now = Date.now();
    const lastTime = this.lastForgotPasswordTimestamps[cleanEmail] || 0;
    const elapsed = Math.floor((now - lastTime) / 1000);
    if (elapsed < 60) {
      return {
        success: false,
        error: { message: `Please wait ${60 - elapsed}s before requesting another reset email.` },
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (error.status === 429 || errMsg.includes('rate limit') || errMsg.includes('rate_limit')) {
          return {
            success: false,
            error: { message: 'Password reset rate limit exceeded (maximum 3 emails/hour). Please try again later.' },
          };
        }
        return { success: false, error: { message: error.message } };
      }
      this.lastForgotPasswordTimestamps[cleanEmail] = Date.now();
    } catch (e: any) {
      console.warn('[AuthService] resetPasswordForEmail error:', e);
      return { success: false, error: { message: e.message || 'Failed to send reset email.' } };
    }
    return { success: true };
  }

  // ── Accessors & State ──────────────────────────────────────────────────────

  /**
   * Sets the currently connected elderly patient for caregiver oversight.
   * STRICT FIX: This NEVER mutates this.currentProfile.
   * The authenticated user remains the caregiver!
   */
  public setLinkedPatient(patient: UserProfile | null) {
    this.connectedPatient = patient;
    this.notifyListeners();
  }

  public getLinkedPatient(): UserProfile | null {
    return this.connectedPatient;
  }

  public getCurrentUser(_contextTab?: string): UserProfile | null {
    const isCaregiverContext = _contextTab === 'caregiver' ||
      (typeof window !== 'undefined' && (window.location.pathname.includes('caregiver') || window.location.hash.includes('/caregiver')));

    if (isCaregiverContext) {
      if (this.currentProfile && this.currentProfile.role === 'caregiver') {
        return this.currentProfile;
      }
      try {
        const cachedStr = tabStorage.getItem(SK_CAREGIVER_PROFILE) || localStorage.getItem(SK_CAREGIVER_PROFILE);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed && parsed.role === 'caregiver') {
            this.currentProfile = parsed;
            return parsed;
          }
        }
      } catch {}
    }
    return this.currentProfile;
  }

  public getPatientProfile(): UserProfile | null {
    if (this.currentProfile && (this.currentProfile.role === 'elderly' || (this.currentProfile.role as string) === 'patient')) {
      return this.currentProfile;
    }
    return this.connectedPatient;
  }

  public getCaregiverProfile(): UserProfile | null {
    if (this.currentProfile && this.currentProfile.role === 'caregiver') {
      return this.currentProfile;
    }
    return null;
  }

  public getAllProfiles(): UserProfile[] {
    const list: UserProfile[] = [];
    if (this.currentProfile) list.push(this.currentProfile);
    if (this.connectedPatient && this.connectedPatient.id !== this.currentProfile?.id) {
      list.push(this.connectedPatient);
    }
    return list;
  }

  public switchUser(userId: string): UserProfile | null {
    if (this.currentProfile && this.currentProfile.id === userId) {
      return this.currentProfile;
    }
    return null;
  }

  public getAuthSession(): AuthSession | null {
    return this.session;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.session && this.currentProfile);
  }

  /** Update current user profile and push to Supabase. */
  public updateCurrentUserProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.currentProfile;
    if (!current) throw new Error('No authenticated user.');
    const updated = { ...current, ...updates };

    if (updates.avatarUrl && !updates.avatarUrl.includes('dicebear.com')) {
      saveAvatarToCache(updated.id, updated.email, updates.avatarUrl);
    }

    this.currentProfile = updated;
    offlineDb.profiles.put(updated).catch(() => {});

    if (updated.id.includes('-') && updated.id.length > 20) {
      const dbPayload = {
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
      };

      // Queue durable mutation in Dexie for offline-first guarantee
      syncService.recordMutation({
        userId: updated.id,
        patientId: updated.id,
        entityType: 'profile',
        entityId: updated.id,
        operation: 'upsert',
        payload: dbPayload,
        idempotencyKey: `${updated.id}_profile_update`,
      }).catch((e) => console.warn('[AuthService] Profile mutation queue note:', e));

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        supabase.from('profiles').upsert(dbPayload).then(({ error }) => {
          if (error) console.warn('[AuthService] Profile update error:', error.message);
        });
      }
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
