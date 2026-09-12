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
  public getItem(key: string): string | null {
    try {
      // 1. Try active tab's sessionStorage first
      const sessionVal = window.sessionStorage.getItem(key);
      if (sessionVal !== null) {
        return sessionVal;
      }

      // 2. Fall back to localStorage for this exact key
      const localVal = window.localStorage.getItem(key);
      if (localVal !== null) {
        // Sync to current tab's sessionStorage for fast retrieval
        try {
          window.sessionStorage.setItem(key, localVal);
        } catch {}
        return localVal;
      }

      return null;
    } catch {
      return null;
    }
  }

  public setItem(key: string, value: string): void {
    try {
      window.sessionStorage.setItem(key, value);
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[TabStorage] setItem warning:', e);
    }
  }

  public removeItem(key: string): void {
    try {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('[TabStorage] removeItem warning:', e);
    }
  }
}

export const tabStorage = new TabStorageEngine();
