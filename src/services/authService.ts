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
      // Get the current real Supabase session
      const { data: { session: sbSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('[AuthService] getSession notice:', error.message);
      }

      if (sbSession?.user) {
        await this.syncProfileFromSupabase(sbSession.user.id, sbSession.user.email || '');
      } else {
        this.session = null;
        this.currentProfile = null;
        this.connectedPatient = null;
        localStorage.removeItem(SK_SESSION);
        this.notifyListeners();
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (newSession?.user) {
            // Only update in this tab if session belongs to this user or if tab had no active user
            if (!this.session || this.session.user.id === newSession.user.id) {
              await this.syncProfileFromSupabase(newSession.user.id, newSession.user.email || '');
            } else {
              console.log('[AuthService] Retaining tab session for user:', this.session.user.id);
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
      if (intendedRole) {
        localStorage.setItem('ms_pending_oauth_role', intendedRole);
        sessionStorage.setItem('ms_pending_oauth_role', intendedRole);
        sessionStorage.setItem('ms_intended_role', intendedRole);
      } else {
        localStorage.removeItem('ms_pending_oauth_role');
        sessionStorage.removeItem('ms_pending_oauth_role');
        sessionStorage.removeItem('ms_intended_role');
      }

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
   * Enforces role = 'caregiver' and creates/updates profile in Supabase profiles.
   * Prevents duplicate requests, does NOT auto-retry on rate limits, and preserves accounts.
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

    // 3. Check if user is already authenticated
    if (this.session && this.currentProfile) {
      if (this.currentProfile.role === 'caregiver') {
        return {
          success: true,
          profile: this.currentProfile,
          message: 'You are already signed in as a Caregiver.',
        };
      }
    }

    try {
      this.isCaregiverSignUpInFlight = true;

      // 4. Pre-check existing profile in database
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.role === 'elderly' || (existingProfile.role as string) === 'patient') {
          return {
            success: false,
            error: 'This email is already registered as a Patient. Caregivers must use a separate email address.',
          };
        }
        if (existingProfile.role === 'caregiver') {
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
            role: 'caregiver',
            phone: phone || '',
          },
        },
      });

      // 6. Handle Supabase Auth error strictly without auto-retries
      if (signUpErr) {
        const errMsg = (signUpErr.message || '').toLowerCase();
        const isRateLimit = signUpErr.status === 429 || errMsg.includes('rate limit') || errMsg.includes('rate_limit');

        if (isRateLimit) {
          return {
            success: false,
            isRateLimited: true,
            error: 'Email confirmation rate limit exceeded on Supabase mailer (limit: 3/hour). If you have already registered, please click the "Sign In" tab. You can also sign in instantly using Google without email limits.',
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

      // Check if user already existed (Supabase returns empty identities array when email confirmation is on)
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        return {
          success: false,
          isAlreadyRegistered: true,
          error: 'An account with this email is already registered. Please switch to the "Sign In" tab to log in.',
        };
      }

      // 7. Upsert profile in public.profiles table (preserves account permanently)
      const profileData: any = {
        id: user.id,
        role: 'caregiver',
        full_name: cleanName,
        email: cleanEmail,
        phone: phone || '',
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (upsertErr) {
        console.warn('[AuthService] Caregiver profile upsert notice:', upsertErr.message);
      }

      // 8. Inspect authData.session:
      // If session exists -> email confirmation disabled; load profile and proceed to caregiver portal
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
      console.error('[AuthService] signUpCaregiverWithEmail exception:', err);
      return { success: false, error: err.message || 'Failed to create caregiver account.' };
    } finally {
      this.isCaregiverSignUpInFlight = false;
    }
  }

  /**
   * Caregiver Sign In with Email & Password.
   * Verifies role is 'caregiver'.
   */
  public async signInCaregiverWithEmail(
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

      if (dbProfile && (dbProfile.role === 'elderly' || (dbProfile.role as string) === 'patient')) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'This account is registered as an Elderly Patient. Caregivers must use a separate Caregiver account.',
        };
      }

      // Ensure caregiver role in profiles
      if (!dbProfile || dbProfile.role !== 'caregiver') {
        await supabase.from('profiles').upsert({
          id: user.id,
          role: 'caregiver',
          email: cleanEmail,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Caregiver',
          updated_at: new Date().toISOString(),
        });
      }

      const synced = await this.syncProfileFromSupabase(user.id, cleanEmail);
      return { success: true, profile: synced || undefined };
    } catch (err: any) {
      console.error('[AuthService] signInCaregiverWithEmail error:', err);
      return { success: false, error: err.message || 'Login failed.' };
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
          return {
            success: false,
            isRateLimited: true,
            error: 'Email confirmation rate limit exceeded on Supabase mailer (limit: 3/hour). If you have already registered, please click the "Sign In" tab. Or click "Continue with Google as Senior / Patient" to sign in instantly without email limits.',
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
      const profileData: any = {
        id: user.id,
        role: 'elderly',
        full_name: cleanName,
        preferred_name: cleanName.split(' ')[0] || cleanName,
        email: cleanEmail,
        phone: phone || '',
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
   * Dedicated handler for processing the OAuth callback route.
   * Extracts tokens from URL, sets Supabase session, verifies role, and returns the target route.
   */
  public async handleOAuthCallback(): Promise<string> {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      // Check for error from OAuth provider
      if (hash.includes('error=') || search.includes('error=')) {
        const errMatch = (hash + '&' + search).match(/error_description=([^&]+)/);
        const errText = errMatch ? decodeURIComponent(errMatch[1].replace(/\+/g, ' ')) : 'OAuth authentication failed.';
        throw new Error(errText);
      }

      // 1. Manually extract access_token and refresh_token from hash or search
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      const atMatch = (hash + '&' + search).match(/access_token=([^&]+)/);
      const rtMatch = (hash + '&' + search).match(/refresh_token=([^&]+)/);
      if (atMatch) accessToken = decodeURIComponent(atMatch[1]);
      if (rtMatch) refreshToken = decodeURIComponent(rtMatch[1]);

      // If PKCE code exists in search query parameters
      const codeMatch = (search + '&' + hash).match(/[?&]code=([^&]+)/);
      if (codeMatch && !accessToken) {
        const code = decodeURIComponent(codeMatch[1]);
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch (codeErr) {
          console.warn('[AuthService] exchangeCodeForSession notice:', codeErr);
        }
      }

      // If access_token was extracted, explicitly establish the session in Supabase Auth
      if (accessToken && refreshToken) {
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (setErr) {
          console.warn('[AuthService] setSession notice:', setErr);
        }
      }

      // 2. Poll Supabase for user session (up to 3 seconds)
      let authUser: any = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          authUser = userData.user;
          break;
        }
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData?.session?.user) {
          authUser = sessData.session.user;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!authUser || !authUser.id) {
        console.warn('[AuthService] handleOAuthCallback: No authenticated Supabase user found.');
        throw new Error('Could not establish an authenticated Google session. Please try signing in again.');
      }

      const userId = authUser.id;
      const email = authUser.email || '';

      if (import.meta.env.DEV) {
        console.log('--- AUTH DEBUG LOG ---');
        console.log('AUTH USER ID:', userId);
        console.log('AUTH EMAIL:', email);
        console.log('CURRENT PATH:', window.location.pathname);
        console.log('CURRENT HASH:', window.location.hash);
      }

      // Determine intended role from session/local storage or metadata
      const storedIntended = sessionStorage.getItem('ms_intended_role') ||
        localStorage.getItem('ms_pending_oauth_role') ||
        authUser.user_metadata?.role;
      const intendedRole: UserRole = (storedIntended === 'caregiver' || storedIntended === 'clinician')
        ? storedIntended
        : 'elderly';

      // 3. Synchronize profile from Supabase or complete for new user
      let profile = await this.syncProfileFromSupabase(userId, email);
      if (!profile) {
        profile = await this.completeGoogleProfile(intendedRole);
      }

      const finalRole = profile?.role || intendedRole;

      if (finalRole === 'caregiver') {
        return '/caregiver/dashboard';
      } else if (finalRole === 'clinician' || (finalRole as string) === 'doctor') {
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

      // Direct UPSERT into Supabase profiles table
      try {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fullName,
          preferred_name: preferredName,
          role,
          profile_photo_url: photoUrl,
          connection_code: connectionCode,
          has_completed_onboarding: newProfile.hasCompletedOnboarding,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('[AuthService] Supabase profile upsert warning:', upsertErr.message);
        }
      } catch (upsertErr) {
        console.warn('[AuthService] Supabase profiles upsert exception:', upsertErr);
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
          const generatedCode = generateConnectionCode();
          mapped.connectionCode = generatedCode;
          supabase.from('profiles').update({ connection_code: generatedCode }).eq('id', userId).then(() => {});
        }

        const pendingOauthRole = (
          localStorage.getItem('ms_pending_oauth_role') ||
          sessionStorage.getItem('ms_pending_oauth_role')
        ) as UserRole | null;

        if (pendingOauthRole) {
          localStorage.removeItem('ms_pending_oauth_role');
          sessionStorage.removeItem('ms_pending_oauth_role');

          if (pendingOauthRole === 'caregiver' && (mapped.role === 'elderly' || (mapped.role as string) === 'patient')) {
            await supabase.auth.signOut();
            this.session = null;
            this.currentProfile = null;
            this.connectedPatient = null;
            localStorage.removeItem(SK_SESSION);
            this.notifyListeners();
            throw new Error(`This Google account (${email}) is already registered as a Patient. Caregivers must sign in with a different Google account.`);
          }
          if ((pendingOauthRole === 'elderly' || (pendingOauthRole as string) === 'patient') && mapped.role === 'caregiver') {
            await supabase.auth.signOut();
            this.session = null;
            this.currentProfile = null;
            this.connectedPatient = null;
            localStorage.removeItem(SK_SESSION);
            this.notifyListeners();
            throw new Error(`This Google account (${email}) is registered as a Caregiver. Patients must sign in with a different Google account.`);
          }
        }

        this.needsRoleSelection = false;
        this.pendingGoogleUser = null;
        sessionStorage.removeItem('ms_pending_oauth_role');
        localStorage.removeItem('ms_pending_oauth_role');

        this.currentProfile = mapped;
        this.session = makeSession(mapped, email);
        localStorage.setItem(SK_SESSION, JSON.stringify(this.session));
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

      // Check role collision with ANY existing profile in Supabase matching this email
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (normalizedEmail) {
        const { data: existingEmailProfile } = await supabase
          .from('profiles')
          .select('id, role')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (existingEmailProfile) {
          if (pendingRole === 'caregiver' && (existingEmailProfile.role === 'elderly' || (existingEmailProfile.role as string) === 'patient')) {
            localStorage.removeItem('ms_pending_oauth_role');
            sessionStorage.removeItem('ms_pending_oauth_role');
            await supabase.auth.signOut();
            this.session = null;
            this.currentProfile = null;
            localStorage.removeItem(SK_SESSION);
            this.notifyListeners();
            throw new Error(`This Google account (${normalizedEmail}) is already registered as a Patient. A Caregiver must use a separate Google account with a different email address.`);
          }
          if ((pendingRole === 'elderly' || (pendingRole as string) === 'patient') && existingEmailProfile.role === 'caregiver') {
            localStorage.removeItem('ms_pending_oauth_role');
            sessionStorage.removeItem('ms_pending_oauth_role');
            await supabase.auth.signOut();
            this.session = null;
            this.currentProfile = null;
            localStorage.removeItem(SK_SESSION);
            this.notifyListeners();
            throw new Error(`This Google account (${normalizedEmail}) is registered as a Caregiver. Patients must sign in with a different Google account.`);
          }
        }
      }

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
    sessionStorage.removeItem('ms_pending_oauth_role');
    localStorage.removeItem('ms_pending_oauth_role');
    localStorage.removeItem(SK_SESSION);
    localStorage.removeItem(SK_PATIENT_PROFILE);
    localStorage.removeItem(SK_CAREGIVER_PROFILE);
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

  /**
   * Retrieves the authenticated user's profile.
   * Derives strictly from Supabase session.
   */
  public getCurrentUser(_contextTab?: string): UserProfile | null {
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
        if (error) console.warn('[AuthService] Profile update error:', error.message);
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
