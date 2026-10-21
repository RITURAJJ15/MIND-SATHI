import { UserProfile } from '../types/user';
import { resolveApiUrl } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

class CentralSyncService {
  private getBaseUrl(): string {
    return resolveApiUrl('').replace(/\/+$/, '');
  }

  private async getAuthHeaders(includeJson = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[CentralSyncService] Session token retrieval note:', e);
    }
    return headers;
  }

  public async findPatient(identifier: string): Promise<any | null> {
    if (!identifier || !identifier.trim()) return null;
    const clean = identifier.trim();

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.getBaseUrl()}/api/sync/find-patient?q=${encodeURIComponent(clean)}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.patient) {
          return data.patient;
        }
      }
    } catch (err) {
      console.warn('[CentralSyncService] findPatient network note:', err);
    }
    return null;
  }

  public async storePatient(patient: Partial<UserProfile> & { id: string }): Promise<boolean> {
    if (!patient || !patient.id) return false;

    try {
      const headers = await this.getAuthHeaders(true);
      const res = await fetch(`${this.getBaseUrl()}/api/sync/store-patient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ patient }),
      });
      return res.ok;
    } catch (err) {
      console.warn('[CentralSyncService] storePatient network note:', err);
      return false;
    }
  }

  public async storeCaregiver(caregiver: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    passwordHash: string;
  }): Promise<boolean> {
    if (!caregiver || !caregiver.email) return false;

    try {
      const headers = await this.getAuthHeaders(true);
      const res = await fetch(`${this.getBaseUrl()}/api/sync/store-caregiver`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ caregiver }),
      });
      return res.ok;
    } catch (err) {
      console.warn('[CentralSyncService] storeCaregiver network note:', err);
      return false;
    }
  }

  public async getCaregiver(email: string): Promise<any | null> {
    if (!email || !email.trim()) return null;
    const cleanEmail = email.trim().toLowerCase();

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.getBaseUrl()}/api/sync/get-caregiver?email=${encodeURIComponent(cleanEmail)}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.caregiver) {
          return data.caregiver;
        }
      }
    } catch (err) {
      console.warn('[CentralSyncService] getCaregiver network note:', err);
    }
    return null;
  }

  public async linkPatient(
    caregiverId: string,
    patientId: string,
    caregiverEmail?: string,
    patientEmail?: string,
    connectionCode?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!caregiverId || !patientId) {
      return { success: false, error: 'Missing caregiver or patient ID' };
    }

    try {
      const headers = await this.getAuthHeaders(true);
      const res = await fetch(`${this.getBaseUrl()}/api/sync/link-patient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ caregiverId, patientId, caregiverEmail, patientEmail, connectionCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        return { success: true };
      }
      return { success: false, error: data?.error || 'Could not link patient.' };
    } catch (err: any) {
      console.warn('[CentralSyncService] linkPatient network note:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async unlinkPatient(caregiverId: string, patientId?: string): Promise<boolean> {
    if (!caregiverId) return false;

    try {
      const headers = await this.getAuthHeaders(true);
      const res = await fetch(`${this.getBaseUrl()}/api/sync/unlink-patient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ caregiverId, patientId }),
      });
      return res.ok;
    } catch (err) {
      console.warn('[CentralSyncService] unlinkPatient network note:', err);
      return false;
    }
  }

  public async getAssignedPatient(caregiverId: string, caregiverEmail?: string): Promise<any | null> {
    if (!caregiverId && !caregiverEmail) return null;

    try {
      const q = new URLSearchParams();
      if (caregiverId) q.set('caregiverId', caregiverId);
      if (caregiverEmail) q.set('caregiverEmail', caregiverEmail);

      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.getBaseUrl()}/api/sync/get-assigned-patient?${q.toString()}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.success && data.patient) {
          return data.patient;
        }
      }
    } catch (err) {
      console.warn('[CentralSyncService] getAssignedPatient network note:', err);
    }
    return null;
  }
}

export const centralSyncService = new CentralSyncService();
