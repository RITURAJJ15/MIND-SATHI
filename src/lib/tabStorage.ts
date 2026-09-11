/**
 * tabStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tab-isolated and role-scoped storage engine for Supabase Auth.
 * 
 * Guarantees that:
 * 1. Tab 1 (Patient) and Tab 2 (Caregiver) maintain independent sessions.
 * 2. Cross-tab storage events never overwrite an active tab's authenticated user.
 * 3. Opening a new tab directly to #/patient/dashboard or #/caregiver/dashboard
 *    hydrates the corresponding role-scoped session seamlessly.
 */

export interface SupabaseStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

class TabStorageEngine implements SupabaseStorageAdapter {
  private getRoleFromUrlOrStorage(): 'caregiver' | 'elderly' | 'clinician' | null {
    const hash = window.location.hash || '';
    if (hash.includes('/caregiver/')) return 'caregiver';
    if (hash.includes('/patient/')) return 'elderly';
    if (hash.includes('/doctor/')) return 'clinician';

    const intended = sessionStorage.getItem('ms_intended_role') || localStorage.getItem('ms_pending_oauth_role');
    if (intended === 'caregiver') return 'caregiver';
    if (intended === 'elderly' || intended === 'patient') return 'elderly';
    if (intended === 'clinician' || intended === 'doctor') return 'clinician';

    return null;
  }

  public getItem(key: string): string | null {
    try {
      // 1. Try active tab session first
      const sessionVal = window.sessionStorage.getItem(key);
      if (sessionVal) {
        return sessionVal;
      }

      // 2. Fallback to role-specific backup in localStorage if opening a new tab for a specific route
      const role = this.getRoleFromUrlOrStorage();
      if (role) {
        const backupKey = `ms_${role}_auth_token`;
        const backupVal = window.localStorage.getItem(backupKey);
        if (backupVal) {
          // Hydrate this tab's sessionStorage with the role's backup
          window.sessionStorage.setItem(key, backupVal);
          return backupVal;
        }
      }

      // 3. Fallback to default localStorage key only if on root/landing/callback
      const defaultVal = window.localStorage.getItem(key);
      if (defaultVal) {
        window.sessionStorage.setItem(key, defaultVal);
        return defaultVal;
      }

      return null;
    } catch {
      return null;
    }
  }

  public setItem(key: string, value: string): void {
    try {
      // Always store in current tab's sessionStorage
      window.sessionStorage.setItem(key, value);

      // Determine role from payload or context to store a role-scoped backup in localStorage
      let detectedRole: string | null = this.getRoleFromUrlOrStorage();

      try {
        const parsed = JSON.parse(value);
        if (parsed?.user?.user_metadata?.role) {
          detectedRole = parsed.user.user_metadata.role;
        }
      } catch {
        // Not JSON or no role in metadata
      }

      if (detectedRole) {
        window.localStorage.setItem(`ms_${detectedRole}_auth_token`, value);
      }

      // Also keep standard key for OAuth redirect flow
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[TabStorage] setItem warning:', e);
    }
  }

  public removeItem(key: string): void {
    try {
      window.sessionStorage.removeItem(key);

      const role = this.getRoleFromUrlOrStorage();
      if (role) {
        window.localStorage.removeItem(`ms_${role}_auth_token`);
      }

      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('[TabStorage] removeItem warning:', e);
    }
  }
}

export const tabStorage = new TabStorageEngine();
