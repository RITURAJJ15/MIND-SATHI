// ─── Auth-specific types ─────────────────────────────────────────────────────

export type AuthRole = 'elderly' | 'caregiver' | 'clinician' | 'admin';

export interface AuthCredentials {
  email: string;
  password: string;
  name?: string;
  role?: AuthRole;
  avatarUrl?: string;
  rememberMe?: boolean;
  ayushmanMemberId?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  role: AuthRole;
  avatarUrl?: string;
  isAyushmanMember?: boolean;
  ayushmanMemberId?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: AuthRole;
  /** ISO timestamp */
  createdAt: string;
  /** Linked UserProfile id (for elderly/caregiver/clinician) */
  profileId?: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string; // mock JWT-style token
  expiresAt: string;
}

export type AuthScreen = 'login' | 'register' | 'forgot-password' | 'select-role';

export interface AuthError {
  field?: string;
  message: string;
}

export interface AuthResult<T = void> {
  success: boolean;
  data?: T;
  error?: AuthError;
}

// Validation helpers ──────────────────────────────────────────────────────────

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email address is required.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export function validateMobile(mobile: string): string | null {
  if (!mobile.trim()) return 'Mobile number is required.';
  const cleaned = mobile.replace(/\s/g, '');
  if (!/^[6-9]\d{9}$/.test(cleaned)) return 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).';
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Full name is required.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  if (name.trim().length > 100) return 'Name must be less than 100 characters.';
  return null;
}
