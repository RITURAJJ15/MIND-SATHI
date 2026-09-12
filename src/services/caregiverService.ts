import { authService } from './authService';
import { gameService } from './gameService';
import { dailyPlanService } from './dailyPlanService';
import { supabase } from '../lib/supabase';
import { offlineDb } from '../lib/offlineDb';
import { UserProfile } from '../types/user';
import { centralSyncService } from './centralSyncService';

export interface MoodLog {
  id: string;
  userId: string;
  mood: 'peaceful' | 'joyful' | 'neutral' | 'tired' | 'anxious';
  energyLevel: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  recordedAt: string;
}

export interface CaregiverAlert {
  id: string;
  elderId: string;
  type: 'inactivity' | 'sos' | 'performance_drop' | 'missed_medication' | 'milestone';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

const STORAGE_KEY_MOODS = 'mind_sathi_mood_logs';
const STORAGE_KEY_ALERTS = 'mind_sathi_alerts';
const STORAGE_KEY_CAREGIVER_PATIENT = 'mind_sathi_caregiver_patient';

class CaregiverService {
  private moods: MoodLog[] = [];
  private alerts: CaregiverAlert[] = [];

  constructor() {
    const savedMoods = localStorage.getItem(STORAGE_KEY_MOODS);
    if (savedMoods) {
      try { this.moods = JSON.parse(savedMoods); } catch { this.moods = []; }
    } else {
      this.moods = [];
    }

    const savedAlerts = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (savedAlerts) {
      try { this.alerts = JSON.parse(savedAlerts); } catch { this.alerts = []; }
    } else {
      this.alerts = [];
    }
  }

  public getMoodsForUser(userId: string): MoodLog[] {
    return this.moods.filter((m) => m.userId === userId);
  }

  public recordMood(userId: string, mood: MoodLog['mood'], energyLevel: MoodLog['energyLevel'], notes?: string): MoodLog {
    const newMood: MoodLog = {
      id: `mood-${Date.now()}`,
      userId,
      mood,
      energyLevel,
      notes,
      recordedAt: new Date().toISOString(),
    };
    this.moods.unshift(newMood);
    localStorage.setItem(STORAGE_KEY_MOODS, JSON.stringify(this.moods));
    return newMood;
  }

  public getAlertsForElder(elderId: string): CaregiverAlert[] {
    return this.alerts.filter((a) => a.elderId === elderId);
  }

  public triggerSosAlert(elderId: string, elderName: string): CaregiverAlert {
    const alert: CaregiverAlert = {
      id: `alert-${Date.now()}`,
      elderId,
      type: 'sos',
      severity: 'urgent',
      title: `SOS Alert: ${elderName} requested immediate assistance`,
      message: `${elderName} pressed the Caregiver Alert button from the MIND SATHI home screen.`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    this.alerts.unshift(alert);
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(this.alerts));
    return alert;
  }

  public acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(this.alerts));
    }
  }

  /**
   * Retrieves accurate cognitive status for the specified patient
   * derived from their real database records.
   */
  public getElderCognitiveStatus(elderId: string) {
    const sessions = gameService.getSessionsForUser(elderId);
    const domainScores = gameService.calculateDomainScores(elderId);
    const today = new Date().toISOString().split('T')[0];
    const playedToday = sessions.some((s) => s.timestamp.startsWith(today));
    const todayPlan = dailyPlanService.getDailyPlan(elderId);

    const completedPlanTasks = todayPlan.tasks.filter((t) => t.completed).length;
    const planProgressPercent = Math.round((completedPlanTasks / Math.max(1, todayPlan.tasks.length)) * 100);

    const avgAccuracy = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length)
      : 0;

    return {
      playedToday,
      totalSessionsCount: sessions.length,
      recentAccuracy: sessions.length > 0 ? sessions[0].accuracy : 0,
      avgAccuracy,
      domainScores,
      todayPlanCompleted: completedPlanTasks,
      todayPlanTotal: todayPlan.tasks.length,
      planProgressPercent,
      lastActive: sessions.length > 0 ? sessions[0].timestamp : null,
    };
  }

  /**
   * Retrieves the connected caregiver for a patient if one is assigned.
   */
  public getCaregiverForUser(patientId: string): UserProfile | null {
    const allProfiles = authService.getAllProfiles();
    const patient = allProfiles.find((p) => p.id === patientId);

    // 1. Check patient's own caregiverIds
    if (patient?.caregiverIds && patient.caregiverIds.length > 0) {
      const directCg = allProfiles.find((p) => p.id === patient.caregiverIds![0] && p.role === 'caregiver');
      if (directCg) return directCg;
    }

    // 2. Check if any caregiver profile points to this patient
    const reverseCg = allProfiles.find(
      (p) => p.role === 'caregiver' && p.caregiverIds && p.caregiverIds.includes(patientId)
    );
    if (reverseCg) return reverseCg;

    return null;
  }

  /**
   * Retrieves the STRICT SINGLE patient assigned to the specified caregiver.
   * Enforces 1-to-1 relationship: One Caregiver ↔ One Patient.
   * Multi-layered resolution:
   *  1. Direct query to Supabase `caregiver_patient` table.
   *  2. Direct query to Supabase `profiles` where `caregiver_ids` contains caregiverId.
   *  3. Check caregiver's own row in Supabase `profiles` for connected patient.
   *  4. Local Storage cache by caregiverId and caregiver email.
   *  5. In-memory & cached profiles via `authService.getAllProfiles()`.
   *  6. IndexedDB Dexie offline storage.
   * Completely normalizes all fields so all UI components receive genuine data.
   */
  public async getAssignedPatients(caregiverId: string): Promise<any[]> {
    if (!caregiverId || caregiverId === 'guest') {
      return [];
    }

    let assignedPatients: any[] = [];

    // Find caregiver profile info if available
    const allProfiles = authService.getAllProfiles();
    const caregiverProfile = allProfiles.find((p) => p.id === caregiverId);
    const caregiverEmail = caregiverProfile?.email?.toLowerCase();

    // ── 1. Check Supabase RPC (Authoritative Database Truth for Caregiver) ───
    const isCgUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caregiverId);
    if (isCgUuid) {
      try {
        const { data: { session: cgSession } } = await supabase.auth.getSession();
        console.log('[CaregiverConnection:Check] Caregiver auth.uid():', cgSession?.user?.id, 'requested caregiverId:', caregiverId);
        console.log('[CaregiverConnection:Check] Invoking get_connected_patient_for_caregiver RPC...');

        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_connected_patient_for_caregiver');
        console.log('[CaregiverConnection:Check] get_connected_patient_for_caregiver result:', { data: rpcData, error: rpcErr });

        if (!rpcErr && rpcData) {
          const rows = Array.isArray(rpcData) ? rpcData : [rpcData];
          if (rows.length > 0 && rows[0] && rows[0].patient_id) {
            const row = rows[0];
            assignedPatients.push({
              id: row.patient_id,
              full_name: row.full_name,
              name: row.full_name,
              preferred_name: row.preferred_name,
              preferredName: row.preferred_name,
              email: row.email,
              phone: row.phone,
              age: row.age,
              gender: row.gender,
              city: row.city,
              state: row.state,
              profile_photo_url: row.profile_photo_url,
              avatarUrl: row.profile_photo_url,
              connectionCode: row.connection_code,
              streak_days: row.streak_days,
              total_xp: row.total_xp,
              caregiverIds: [caregiverId],
            });
            console.log('[CaregiverConnection:Check] Connected patient loaded via RPC:', assignedPatients[0]);
          }
        }
      } catch (e) {
        console.warn('[CaregiverService] get_connected_patient_for_caregiver RPC notice:', e);
      }

      // ── 2. Direct Supabase caregiver_patient query fallback ────────────────
      if (assignedPatients.length === 0) {
        try {
          console.log('[CaregiverConnection:Check] Falling back to direct query on public.caregiver_patient for caregiver_id:', caregiverId);
          const { data: linkRows, error: linkErr } = await supabase
            .from('caregiver_patient')
            .select('patient_id')
            .eq('caregiver_id', caregiverId)
            .limit(1);

          console.log('[CaregiverConnection:Check] Direct caregiver_patient rows:', linkRows, 'error:', linkErr);

          if (!linkErr && linkRows && linkRows.length > 0 && linkRows[0].patient_id) {
            const patientId = linkRows[0].patient_id;
            let ptFound: any = null;

            // A. Try find_patient_for_connection RPC (SECURITY DEFINER - succeeds for caregivers)
            try {
              const { data: rpcPt } = await supabase.rpc('find_patient_for_connection', {
                identifier: patientId,
              });
              if (rpcPt) {
                const rows = Array.isArray(rpcPt) ? rpcPt : [rpcPt];
                if (rows.length > 0 && rows[0]?.id) {
                  ptFound = rows[0];
                }
              }
            } catch {}

            // B. Try profiles query fallback
            if (!ptFound) {
              try {
                const { data: ptData } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', patientId)
                  .maybeSingle();

                if (ptData && !ptData.id.startsWith('elder-')) {
                  ptFound = ptData;
                }
              } catch {}
            }

            // C. Guarantee patient object even if profiles table RLS blocks reading details
            if (ptFound) {
              assignedPatients.push(ptFound);
            } else {
              assignedPatients.push({
                id: patientId,
                name: 'Senior Patient',
                full_name: 'Senior Patient',
                preferred_name: 'Senior',
                role: 'elderly',
                caregiverIds: [caregiverId],
              });
            }
          }
        } catch (err) {
          console.warn('[CaregiverService] Supabase caregiver_patient query note:', err);
        }
      }

      // If this is a real authenticated Supabase user, and Supabase confirms NO link in database:
      // Purge any stale phantom cache from localStorage so cross-browser state is always accurate.
      if (assignedPatients.length === 0) {
        localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`);
        if (caregiverEmail) {
          localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverEmail}`);
        }
        return [];
      }
    }

    // ── 3. Central Sync Engine fallback (only if not a UUID user) ───────────
    if (assignedPatients.length === 0 && !isCgUuid) {
      try {
        const syncPatient = await centralSyncService.getAssignedPatient(caregiverId, caregiverEmail);
        if (syncPatient && !syncPatient.id.startsWith('elder-')) {
          assignedPatients.push(syncPatient);
        }
      } catch (syncErr) {
        console.warn('[CaregiverService] Central sync getAssignedPatient note:', syncErr);
      }
    }

    // ── 4. Local Storage Cache (only if not a UUID user) ────────────────────
    if (assignedPatients.length === 0 && !isCgUuid) {
      try {
        const cachedById = localStorage.getItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`);
        if (cachedById) {
          const parsed = JSON.parse(cachedById);
          if (Array.isArray(parsed) && parsed.length > 0) {
            assignedPatients.push(parsed[0]);
          }
        }
        if (assignedPatients.length === 0 && caregiverEmail) {
          const cachedByEmail = localStorage.getItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverEmail}`);
          if (cachedByEmail) {
            const parsed = JSON.parse(cachedByEmail);
            if (Array.isArray(parsed) && parsed.length > 0) {
              assignedPatients.push(parsed[0]);
            }
          }
        }
      } catch {}
    }

    // ── 5. Check allProfiles in authService (offline/demo fallback) ─────────
    if (assignedPatients.length === 0 && !isCgUuid) {
      const linkedElder = allProfiles.find(
        (p) => (p.role === 'elderly' || (p.role as string) === 'patient') &&
               !p.id.startsWith('elder-') &&
               p.caregiverIds &&
               (p.caregiverIds.includes(caregiverId) || (caregiverEmail && p.caregiverIds.includes(caregiverEmail)))
      );
      if (linkedElder) {
        assignedPatients.push(linkedElder);
      }

      if (assignedPatients.length === 0 && caregiverProfile?.caregiverIds && caregiverProfile.caregiverIds.length > 0) {
        const ptId = caregiverProfile.caregiverIds[0];
        const elderTarget = allProfiles.find((p) => p.id === ptId);
        if (elderTarget && !elderTarget.id.startsWith('elder-')) {
          assignedPatients.push(elderTarget);
        }
      }
    }

    // ── 6. Check Dexie IndexedDB offline storage ─────────────────────
    if (assignedPatients.length === 0) {
      try {
        if (typeof window !== 'undefined') {
          const offlineProfiles = await offlineDb.profiles.toArray();
          const offlinePt = offlineProfiles.find(
            (p: UserProfile) => (p.role === 'elderly' || (p.role as string) === 'patient') &&
                   !p.id.startsWith('elder-') &&
                   p.caregiverIds &&
                   p.caregiverIds.includes(caregiverId)
          );
          if (offlinePt) {
            assignedPatients.push(offlinePt);
          }
        }
      } catch (err) {
        console.warn('[CaregiverService] Dexie offline profiles note:', err);
      }
    }

    // ── STRICT 1-TO-1 NORMALIZATION & ENRICHMENT ──────────────────────
    if (assignedPatients.length === 0) {
      return [];
    }

    // Enforce strictly 1 patient
    const p = assignedPatients[0];
    const matched = allProfiles.find((ap) => ap.id === p.id);

    const connectionCode =
      p.connectionCode ||
      p.secondary_language ||
      matched?.connectionCode ||
      ('MS-' + (p.id || '').replace(/-/g, '').substring(0, 6).toUpperCase());

    const normalizedPatient = {
      ...matched,
      ...p,
      id: p.id || matched?.id,
      full_name: p.full_name || matched?.name || p.name || 'Elderly Patient',
      name: p.name || matched?.name || p.full_name || 'Elderly Patient',
      preferred_name: p.preferred_name || matched?.preferredName || p.preferredName || 'Sathi',
      preferredName: p.preferredName || matched?.preferredName || p.preferred_name || 'Sathi',
      email: p.email || matched?.email || '',
      phone: p.phone || (matched as any)?.phone || '',
      age: p.age || matched?.age || 70,
      gender: p.gender || matched?.gender || 'other',
      city: p.city || matched?.city || 'Guwahati',
      state: p.state || matched?.state || 'Assam',
      profile_photo_url: p.profile_photo_url || p.avatarUrl || matched?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${p.id}&backgroundColor=b6e3f4`,
      avatarUrl: p.profile_photo_url || p.avatarUrl || matched?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${p.id}&backgroundColor=b6e3f4`,
      connectionCode,
      secondary_language: connectionCode,
      abha_id: p.abha_id || p.abhaId || matched?.abhaId || '',
      abhaId: p.abhaId || p.abha_id || matched?.abhaId || '',
      abha_status: p.abha_status || p.abhaStatus || matched?.abhaStatus || 'unlinked',
      abhaStatus: p.abhaStatus || p.abha_status || matched?.abhaStatus || 'unlinked',
      pmjay_id: p.pmjay_id || p.ayushmanMemberId || matched?.ayushmanMemberId || '',
      pmjayId: p.pmjayId || p.ayushmanMemberId || matched?.ayushmanMemberId || '',
      pmjay_status: p.pmjay_status || p.ayushmanStatus || matched?.ayushmanStatus || 'none',
      pmjayStatus: p.pmjayStatus || p.ayushmanStatus || matched?.ayushmanStatus || 'none',
      streak_days: p.streak_days ?? matched?.streakDays ?? 1,
      streakDays: p.streakDays ?? p.streak_days ?? matched?.streakDays ?? 1,
      total_xp: p.total_xp ?? matched?.totalXp ?? 50,
      totalXp: p.totalXp ?? p.total_xp ?? matched?.totalXp ?? 50,
      level: p.level ?? matched?.level ?? 1,
      level_title: p.level_title || matched?.levelTitle || 'Naya Sathi',
      levelTitle: p.levelTitle || matched?.levelTitle || 'Naya Sathi',
      caregiverIds: [caregiverId],
    };

    // Save strictly 1-to-1 in local caches and state
    localStorage.setItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`, JSON.stringify([normalizedPatient]));
    if (caregiverEmail) {
      localStorage.setItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverEmail}`, JSON.stringify([normalizedPatient]));
    }

    // Bidirectionally bind in allProfiles
    let updatedProfiles = false;
    const patientIdx = allProfiles.findIndex((ap) => ap.id === normalizedPatient.id);
    if (patientIdx >= 0) {
      allProfiles[patientIdx] = { ...allProfiles[patientIdx], caregiverIds: [caregiverId], connectionCode };
      updatedProfiles = true;
    }
    const caregiverIdx = allProfiles.findIndex((ap) => ap.id === caregiverId);
    if (caregiverIdx >= 0) {
      allProfiles[caregiverIdx] = { ...allProfiles[caregiverIdx], caregiverIds: [normalizedPatient.id] };
      updatedProfiles = true;
    }
    if (updatedProfiles) {
      localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));
    }

    // Set as active linked patient in authService
    authService.setLinkedPatient(normalizedPatient as any);

    return [normalizedPatient];
  }

  /**
   * Retrieves the assigned caregiver profile for a specific elderly patient.
   * Checks Supabase caregiver_patient, profiles table, and local caches.
   */
  public async getAssignedCaregiverForPatient(patientId: string): Promise<UserProfile | null> {
    if (!patientId || patientId === 'guest') return null;

    // Verify authenticated session
    let effectivePatientId = patientId;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        effectivePatientId = session.user.id;
      }
    } catch (e) {
      console.warn('[CaregiverService] Session check note:', e);
    }

    if (!effectivePatientId || effectivePatientId === 'guest') return null;

    // ── 1. Authoritative Supabase RPC check (Single Roundtrip, SECURITY DEFINER) ──
    try {
      const { data: { session: ptSession } } = await supabase.auth.getSession();
      console.log('[PatientConnection:Check] Patient auth.uid():', ptSession?.user?.id, 'effectivePatientId:', effectivePatientId);
      console.log('[PatientConnection:Check] Invoking get_connected_caregiver_for_patient RPC...');

      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_connected_caregiver_for_patient');
      console.log('[PatientConnection:Check] get_connected_caregiver_for_patient result:', { data: rpcData, error: rpcErr });

      if (!rpcErr && rpcData) {
        const rows = Array.isArray(rpcData) ? rpcData : [rpcData];
        if (rows.length > 0 && rows[0] && rows[0].caregiver_id) {
          const row = rows[0];
          console.log('[PatientConnection:Check] Caregiver connected via RPC:', row);
          const mapped: UserProfile = {
            id: row.caregiver_id,
            name: row.name || row.full_name || 'Family Caregiver',
            preferredName: row.preferred_name || row.name || 'Caregiver',
            role: 'caregiver',
            email: row.email || '',
            phone: row.phone || '',
            age: 40,
            gender: 'other',
            avatarUrl:
              row.avatar_url ||
              `https://api.dicebear.com/9.x/avataaars/svg?seed=${row.caregiver_id}&backgroundColor=b6e3f4`,
            primaryLanguage: 'en',
            city: 'Guwahati',
            state: 'Assam',
            isAyushmanMember: false,
            ayushmanStatus: 'none',
            pmjayStatus: 'none',
            abhaStatus: 'none',
            hasCompletedOnboarding: true,
            caregiverIds: [effectivePatientId],
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
            levelTitle: 'Caregiver',
            createdAt: row.connected_at || new Date().toISOString(),
          };
          return mapped;
        }
      }
    } catch (e) {
      console.warn('[CaregiverService] get_connected_caregiver_for_patient RPC notice:', e);
    }

    // ── 2. Direct Supabase caregiver_patient query fallback ─────────────────────
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectivePatientId)) {
        console.log('[PatientConnection:Check] Falling back to direct query on public.caregiver_patient for patient_id:', effectivePatientId);
        const { data: linkRows, error: linkErr } = await supabase
          .from('caregiver_patient')
          .select('caregiver_id')
          .eq('patient_id', effectivePatientId)
          .limit(1);

        console.log('[PatientConnection:Check] Direct caregiver_patient rows:', linkRows, 'error:', linkErr);

        if (!linkErr && linkRows && linkRows.length > 0 && linkRows[0].caregiver_id) {
          const cgId = linkRows[0].caregiver_id;

          let cgName = 'Family Caregiver';
          let cgPreferred = 'Caregiver';
          let cgEmail = '';
          let cgPhone = '';
          let cgAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${cgId}&backgroundColor=b6e3f4`;
          let cgCreatedAt = new Date().toISOString();

          try {
            const { data: cgData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', cgId)
              .maybeSingle();

            if (cgData) {
              cgName = cgData.full_name || cgData.preferred_name || cgName;
              cgPreferred = cgData.preferred_name || cgName;
              cgEmail = cgData.email || '';
              cgPhone = cgData.phone || '';
              cgAvatar = cgData.profile_photo_url || cgData.avatar_url || cgAvatar;
              cgCreatedAt = cgData.created_at || cgCreatedAt;
            }
          } catch {}

          const mapped: UserProfile = {
            id: cgId,
            name: cgName,
            preferredName: cgPreferred,
            role: 'caregiver',
            email: cgEmail,
            phone: cgPhone,
            age: 40,
            gender: 'other',
            avatarUrl: cgAvatar,
            primaryLanguage: 'en',
            city: 'Guwahati',
            state: 'Assam',
            isAyushmanMember: false,
            ayushmanStatus: 'none',
            pmjayStatus: 'none',
            abhaStatus: 'none',
            hasCompletedOnboarding: true,
            caregiverIds: [effectivePatientId],
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
            levelTitle: 'Caregiver',
            createdAt: cgCreatedAt,
          };
          return mapped;
        }
      }
    } catch (e) {
      console.warn('[CaregiverService] Direct caregiver_patient query note:', e);
    }

    // ── 3. Central Sync Service fallback ──────────────────────────────────────
    try {
      const syncPatient = await centralSyncService.getAssignedPatient(effectivePatientId);
      if (syncPatient && syncPatient.caregiverIds && syncPatient.caregiverIds.length > 0) {
        const allProfiles = authService.getAllProfiles();
        const found = allProfiles.find((p) => syncPatient.caregiverIds.includes(p.id));
        if (found) return found;
      }
    } catch (e) {
      console.warn('[CaregiverService] CentralSync fallback note:', e);
    }

    // ── 4. Local Caches fallback (only if valid UUID) ──────────────────────────
    try {
      const allProfiles = authService.getAllProfiles();
      const patient = allProfiles.find((p) => p.id === effectivePatientId);
      if (patient?.caregiverIds && patient.caregiverIds.length > 0) {
        const cgId = patient.caregiverIds[0];
        const cg = allProfiles.find(
          (p) => (p.id === cgId || (p.email && p.email.toLowerCase() === cgId.toLowerCase())) && p.role === 'caregiver'
        );
        if (cg && !cg.name.includes('Dr. Admin Caregiver')) {
          return cg;
        }
      }
    } catch {}

    return null;
  }

  /**
   * Fetches registered elderly patients who are available to be linked.
   * Merges real profiles from local storage and Supabase, completely filtering out mock data.
   */
  public async getAvailablePatients(): Promise<any[]> {
    const patientsMap = new Map<string, any>();

    // 1. Gather all registered elderly patients from local profiles & credentials
    const localProfiles = authService.getAllProfiles().filter((p) =>
      (p.role === 'elderly' || (p.role as string) === 'patient') &&
      !p.id.startsWith('elder-') &&
      p.id !== 'guest' &&
      !p.name.toLowerCase().includes('shanti devi') &&
      !p.name.toLowerCase().includes('bhupen bora')
    );

    localProfiles.forEach((p) => {
      patientsMap.set(p.id, {
        id: p.id,
        full_name: p.name,
        preferred_name: p.preferredName,
        email: p.email || '',
        phone: (p as any).phone || '',
        age: p.age,
        city: p.city,
        state: p.state,
        profile_photo_url: p.avatarUrl,
        isLinkedToOther: p.caregiverIds && p.caregiverIds.length > 0,
      });
    });

    // 2. Also check credentials in case profile was registered
    try {
      const credsRaw = localStorage.getItem('ms_local_credentials');
      if (credsRaw) {
        const creds = JSON.parse(credsRaw) as any[];
        creds.forEach((c) => {
          if (c.role === 'elderly' && !c.userId.startsWith('elder-') && !patientsMap.has(c.userId)) {
            patientsMap.set(c.userId, {
              id: c.userId,
              full_name: c.email.split('@')[0],
              preferred_name: c.email.split('@')[0],
              email: c.email,
              phone: c.mobile || '',
              age: 70,
              city: 'Guwahati',
              state: 'Assam',
              profile_photo_url: `https://api.dicebear.com/9.x/avataaars/svg?seed=${c.userId}&backgroundColor=b6e3f4`,
              isLinkedToOther: false,
            });
          }
        });
      }
    } catch {
      // Ignore
    }

    // 3. Query Supabase profiles & existing caregiver links
    try {
      const { data: elders } = await supabase
        .from('profiles')
        .select('id, full_name, preferred_name, email, phone, age, city, state, profile_photo_url')
        .eq('role', 'elderly')
        .limit(50);

      const { data: linkedRows } = await supabase
        .from('caregiver_patient')
        .select('patient_id, caregiver_id');

      const linkedIds = new Set((linkedRows || []).map((r) => r.patient_id));

      if (elders) {
        elders.forEach((elder) => {
          if (!elder.id.startsWith('elder-')) {
            const existing = patientsMap.get(elder.id) || {};
            patientsMap.set(elder.id, {
              ...existing,
              ...elder,
              isLinkedToOther: linkedIds.has(elder.id) || existing.isLinkedToOther,
            });
          }
        });
      }
    } catch (err) {
      console.warn('[CaregiverService] Error fetching available patients from Supabase:', err);
    }

    return Array.from(patientsMap.values());
  }

  /**
   * Links an elderly patient to a caregiver in the database and local storage.
   * Enforces STRICT 1-TO-1 RELATIONSHIP:
   * - One Patient ↔ One Caregiver.
   * - If patient is already connected to another caregiver, connection is rejected.
   * - Searches across local profiles, stored credentials, and Supabase database.
   */
  public async linkPatientToCaregiver(
    caregiverId: string,
    patientIdentifier: string
  ): Promise<{ success: boolean; error?: string; patient?: any }> {
    if (!caregiverId || !patientIdentifier.trim()) {
      return { success: false, error: 'Caregiver ID and Patient identifier are required.' };
    }

    const cleanInput = patientIdentifier.trim().toLowerCase();
    const cleanUpper = patientIdentifier.trim().toUpperCase();
    const cleanDigits = cleanInput.replace(/\D/g, '');

    // ── Pre-flight: Verify Supabase authentication state immediately ──
    let session = (await supabase.auth.getSession()).data.session;
    if (!session || !session.user) {
      const refreshRes = await supabase.auth.refreshSession();
      session = refreshRes.data?.session || null;
    }

    if (!session || !session.user) {
      return {
        success: false,
        error: 'Your session has expired or you are not logged in. Please sign in as a caregiver to connect to a patient.',
      };
    }

    const effectiveCaregiverId = session.user.id || caregiverId;

    try {
      let targetPatient: any = null;

      // ── Step 0: Search Central Sync Engine first ─────────────────────
      try {
        const syncResult = await centralSyncService.findPatient(patientIdentifier.trim());
        if (syncResult) {
          targetPatient = syncResult;
        }
      } catch (e) {
        console.warn('[CaregiverService] centralSync findPatient notice:', e);
      }

      // ── Step 1: Search in local profiles ─────────────────────────────
      if (!targetPatient) {
        const localProfiles = authService.getAllProfiles().filter((p) =>
          (p.role === 'elderly' || (p.role as string) === 'patient') &&
          !p.id.startsWith('elder-') &&
          p.id !== 'guest'
        );

        targetPatient = localProfiles.find((p) => {
          if (p.connectionCode && (p.connectionCode.toLowerCase() === cleanInput || p.connectionCode.toUpperCase() === cleanUpper)) return true;
          if (p.id.toLowerCase() === cleanInput) return true;
          if (p.email && p.email.toLowerCase() === cleanInput) return true;
          if ((p as any).phone && (p as any).phone.toLowerCase() === cleanInput) return true;
          if (p.name && p.name.toLowerCase() === cleanInput) return true;
          if (cleanDigits.length >= 10 && (p as any).phone) {
            const pDigits = ((p as any).phone as string).replace(/\D/g, '');
            if (pDigits.endsWith(cleanDigits.slice(-10))) return true;
          }
          const codeWithoutPrefix = (p.connectionCode || '').replace(/^MS-/i, '').toLowerCase();
          if (codeWithoutPrefix && codeWithoutPrefix === cleanInput.replace(/^ms-/i, '')) return true;
          return false;
        });
      }

      // ── Step 2: Search in local registered patients store ─────────────
      if (!targetPatient) {
        try {
          const registeredRaw = localStorage.getItem('ms_registered_patients');
          if (registeredRaw) {
            const list = JSON.parse(registeredRaw) as any[];
            targetPatient = list.find((p) => {
              if (p.email && p.email.toLowerCase() === cleanInput) return true;
              if (p.connectionCode && (p.connectionCode.toLowerCase() === cleanInput || p.connectionCode.toUpperCase() === cleanUpper)) return true;
              if (p.phone && cleanDigits.length >= 10 && p.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-10))) return true;
              if (p.id && p.id.toLowerCase() === cleanInput) return true;
              return false;
            });
          }
        } catch {}
      }

      // ── Step 3: Search in local registered credentials ────────────────
      if (!targetPatient) {
        try {
          const credsRaw = localStorage.getItem('ms_local_credentials');
          if (credsRaw) {
            const creds = JSON.parse(credsRaw) as any[];
            const matchingCred = creds.find((c) => {
              if (c.role !== 'elderly' && c.role !== 'patient') return false;
              if (c.email && c.email.toLowerCase() === cleanInput) return true;
              if (c.userId && c.userId.toLowerCase() === cleanInput) return true;
              if (c.mobile && cleanDigits.length >= 10) {
                const cDigits = (c.mobile as string).replace(/\D/g, '');
                if (cDigits.endsWith(cleanDigits.slice(-10))) return true;
              }
              return false;
            });

            if (matchingCred) {
              targetPatient = {
                id: matchingCred.userId,
                name: matchingCred.name || matchingCred.email.split('@')[0],
                preferredName: matchingCred.email.split('@')[0],
                role: 'elderly',
                email: matchingCred.email,
                phone: matchingCred.mobile || '',
                age: 70,
                city: 'Guwahati',
                state: 'Assam',
                avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${matchingCred.userId}&backgroundColor=b6e3f4`,
                streakDays: 1,
                totalXp: 50,
                level: 1,
                levelTitle: 'Naya Sathi',
                createdAt: matchingCred.createdAt || new Date().toISOString(),
                caregiverIds: [],
              };
            }
          }
        } catch {}
      }

      // ── Step 4: Secure Patient Lookup via RPC ────────────────────────
      if (!targetPatient) {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'find_patient_for_connection',
            { identifier: patientIdentifier.trim() }
          );

          if (rpcErr) {
            console.warn('[CaregiverService] find_patient_for_connection RPC error:', rpcErr);

            // Function-level authentication failure (ERRCODE 28000)
            if (rpcErr.code === '28000' || rpcErr.message?.includes('Authentication required')) {
              return {
                success: false,
                error: 'Authentication required: please sign in as a caregiver to connect to a patient.',
              };
            }

            // Role authorization failure (ERRCODE 42501 with caregiver role message)
            if (
              rpcErr.code === '42501' &&
              (rpcErr.message?.includes('caller must have caregiver role') || rpcErr.message?.includes('Access denied'))
            ) {
              return {
                success: false,
                error: 'Access denied: only registered caregivers can look up and connect to patients.',
              };
            }

            // PostgreSQL permission failure (ERRCODE 42501 permission denied for function)
            if (rpcErr.code === '42501' && rpcErr.message?.includes('permission denied for function')) {
              return {
                success: false,
                error: 'Session expired or unauthenticated request. Please sign in again as a caregiver.',
              };
            }

            // Self-linking failure (ERRCODE 22000)
            if (rpcErr.code === '22000' || rpcErr.message?.includes('Cannot connect to your own account')) {
              return {
                success: false,
                error: 'Cannot connect to your own account as a patient.',
              };
            }

            // Database or other unexpected failure
            return {
              success: false,
              error: rpcErr.message || 'Database error occurred during patient lookup.',
            };
          }

          if (rpcData) {
            const rows = Array.isArray(rpcData) ? rpcData : [rpcData];
            if (rows.length > 0 && rows[0] && rows[0].id) {
              const row = rows[0];
              targetPatient = {
                id: row.id,
                full_name: row.full_name || 'Patient',
                name: row.full_name || 'Patient',
                preferred_name: row.preferred_name || row.full_name || 'Patient',
                preferredName: row.preferred_name || row.full_name || 'Patient',
                role: row.role || 'elderly',
                email: row.email || cleanInput,
                profile_photo_url: row.profile_photo_url,
                avatarUrl: row.profile_photo_url,
                isAlreadyLinked: row.is_already_linked,
                linkedToCaller: row.linked_to_caller,
              };
            }
          }
        } catch (err: any) {
          console.warn('[CaregiverService] Supabase RPC search exception:', err);
          return {
            success: false,
            error: err.message || 'An unexpected error occurred during patient lookup.',
          };
        }
      }

      // ── Step 5: Demo Patient Fallback ─────────────────────────────────
      if (!targetPatient && (cleanInput.includes('ramesh') || cleanUpper === 'MS-RAMESH' || cleanInput === 'ramesh@mindsathi.in')) {
        targetPatient = {
          id: 'd8a2f3e4-5b6c-7d8e-9f0a-1b2c3d4e5f6a',
          name: 'Ramesh Kumar',
          full_name: 'Ramesh Kumar',
          preferred_name: 'Ramesh Ji',
          preferredName: 'Ramesh Ji',
          role: 'elderly',
          email: 'ramesh@mindsathi.in',
          phone: '+91 98765 43210',
          age: 72,
          gender: 'male',
          city: 'Guwahati',
          state: 'Assam',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
          profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
          streakDays: 5,
          totalXp: 340,
          level: 3,
          levelTitle: 'Sathi Pro',
          caregiverIds: [],
        };
      }

      if (!targetPatient || targetPatient.id?.startsWith('elder-')) {
        return {
          success: false,
          error: `No registered patient found with identifier "${patientIdentifier.trim()}". Please verify the patient's registered email.`,
        };
      }

      // ── Step 6: Enforce STRICT 1-to-1 Connection ─────────────────────
      // Check RPC flag for existing caregiver link
      if (targetPatient.isAlreadyLinked && !targetPatient.linkedToCaller) {
        return {
          success: false,
          error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
        };
      }

      // Check Supabase caregiver_patient table directly
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPatient.id)) {
          const { data: existingLink } = await supabase
            .from('caregiver_patient')
            .select('id, caregiver_id')
            .eq('patient_id', targetPatient.id)
            .maybeSingle();

          if (existingLink && existingLink.caregiver_id !== effectiveCaregiverId) {
            return {
              success: false,
              error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
            };
          }
        }
      } catch (err) {
        console.warn('[CaregiverService] Error checking existing Supabase link:', err);
      }

      // Check central sync store
      try {
        const assignedCheck = await centralSyncService.getAssignedPatient(effectiveCaregiverId);
        if (assignedCheck && assignedCheck.id !== targetPatient.id) {
          await centralSyncService.unlinkPatient(effectiveCaregiverId);
        }
      } catch {}

      const allProfiles = authService.getAllProfiles();
      const cgProfile = allProfiles.find((p) => p.id === effectiveCaregiverId);

      // ── Step 7: Save 1-to-1 Link in Central Sync, Database & Local Storage ───────────
      // 1. Central Sync (guarantees cross-device availability)
      await centralSyncService.linkPatient(
        effectiveCaregiverId,
        targetPatient.id,
        cgProfile?.email,
        targetPatient.email || cleanInput
      );

      // 2. Supabase caregiver_patient (Authoritative cloud database persistence)
      const isCgUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveCaregiverId);
      const isPtUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPatient.id);
      
      if (isCgUuid && isPtUuid) {
        let dbSaved = false;
        let dbErrorMsg = '';

        const { data: { session: linkSession } } = await supabase.auth.getSession();
        console.log('[CaregiverConnection:Link] Caregiver auth.uid():', linkSession?.user?.id, 'effectiveCaregiverId:', effectiveCaregiverId, 'targetPatient.id:', targetPatient.id);

        // A. Primary: RPC connect_patient_to_caregiver (SECURITY DEFINER guarantees RLS bypass)
        try {
          console.log('[CaregiverConnection:Link] Invoking connect_patient_to_caregiver RPC with p_patient_id:', targetPatient.id);
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('connect_patient_to_caregiver', {
            p_patient_id: targetPatient.id,
          });
          console.log('[CaregiverConnection:Link] connect_patient_to_caregiver RPC response:', { data: rpcRes, error: rpcErr });

          if (!rpcErr && rpcRes) {
            dbSaved = true;
          } else if (rpcErr) {
            console.warn('[CaregiverService] connect_patient_to_caregiver RPC note:', rpcErr);
            if (rpcErr.code === '23505' || rpcErr.message?.includes('already linked')) {
              return {
                success: false,
                error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
              };
            }
            dbErrorMsg = rpcErr.message;
          }
        } catch (e: any) {
          console.warn('[CaregiverService] connect_patient_to_caregiver RPC exception:', e);
        }

        // B. Secondary fallback: Direct table insert
        if (!dbSaved) {
          try {
            console.log('[CaregiverConnection:Link] Falling back to direct table delete & insert into public.caregiver_patient...');
            await supabase.from('caregiver_patient').delete().eq('caregiver_id', effectiveCaregiverId);
            const { data: insData, error: insertErr } = await supabase.from('caregiver_patient').insert({
              caregiver_id: effectiveCaregiverId,
              patient_id: targetPatient.id,
            }).select();
            console.log('[CaregiverConnection:Link] Direct insert response:', { data: insData, error: insertErr });

            if (!insertErr) {
              dbSaved = true;
            } else {
              if (insertErr.code === '23505') {
                return {
                  success: false,
                  error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
                };
              }
              dbErrorMsg = insertErr.message || dbErrorMsg;
              console.warn('[CaregiverService] Supabase caregiver_patient insert notice:', insertErr.message);
            }
          } catch (e: any) {
            dbErrorMsg = e?.message || dbErrorMsg;
          }
        }

        // C. Database Verification: Check public.caregiver_patient directly
        try {
          const { data: verifyRows, error: verifyErr } = await supabase
            .from('caregiver_patient')
            .select('*')
            .eq('caregiver_id', effectiveCaregiverId)
            .eq('patient_id', targetPatient.id);

          const rowExists = Boolean(verifyRows && verifyRows.length > 0);
          console.log('[CaregiverConnection:Link] Database verification in public.caregiver_patient:', {
            verifyRows,
            verifyErr,
            rowExists,
          });

          if (rowExists) {
            dbSaved = true;
          }
        } catch (vErr) {
          console.warn('[CaregiverConnection:Link] Database verification query notice:', vErr);
        }

        // D. Hard requirement: Do NOT fake a local connection if database rejected it!
        if (!dbSaved) {
          return {
            success: false,
            error: `Failed to store connection in database (${dbErrorMsg || 'RLS policy error'}). Both dashboards require this connection to be stored in the database.`,
          };
        }
      }

      const formattedPatient = {
        ...targetPatient,
        id: targetPatient.id,
        full_name: targetPatient.full_name || targetPatient.name,
        name: targetPatient.full_name || targetPatient.name,
        preferred_name: targetPatient.preferred_name || targetPatient.preferredName || targetPatient.name,
        preferredName: targetPatient.preferred_name || targetPatient.preferredName || targetPatient.name,
        email: targetPatient.email || cleanInput,
        phone: targetPatient.phone || '',
        avatarUrl: targetPatient.profile_photo_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${targetPatient.id}&backgroundColor=b6e3f4`,
        profile_photo_url: targetPatient.profile_photo_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${targetPatient.id}&backgroundColor=b6e3f4`,
        caregiverIds: [effectiveCaregiverId],
      };

      // 4. Update local storage
      const cachedKey = `${STORAGE_KEY_CAREGIVER_PATIENT}_${effectiveCaregiverId}`;
      localStorage.setItem(cachedKey, JSON.stringify([formattedPatient]));

      const existingIdx = allProfiles.findIndex((p) => p.id === targetPatient.id);
      if (existingIdx >= 0) {
        allProfiles[existingIdx] = {
          ...allProfiles[existingIdx],
          caregiverIds: [effectiveCaregiverId],
          connectionCode: targetPatient.connectionCode || '',
        };
      }
      if (cgProfile) {
        cgProfile.caregiverIds = [targetPatient.id];
        if (cgProfile.email) {
          localStorage.setItem(
            `${STORAGE_KEY_CAREGIVER_PATIENT}_${cgProfile.email.toLowerCase()}`,
            JSON.stringify([formattedPatient])
          );
        }
      }
      localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));

      // 5. Update Dexie
      try {
        if (typeof window !== 'undefined') {
          await offlineDb.profiles.put(formattedPatient as any);
        }
      } catch {}

      authService.setLinkedPatient(formattedPatient as any);
      return { success: true, patient: formattedPatient };
    } catch (err: any) {
      console.error('[CaregiverService] linkPatientToCaregiver exception:', err);
      return { success: false, error: err.message || 'Error linking patient.' };
    }
  }

  /**
   * Links a registered elderly patient to the caregiver strictly using the patient's registered email ID or connection code.
   * Enforces STRICT 1-TO-1 RELATIONSHIP:
   * - One Patient ↔ One Caregiver.
   * - Resolves by Central Sync, Registered Email, Connection Code (MS-XXXXXX), or Phone.
   */
  public async linkPatientByEmail(
    caregiverId: string,
    patientEmailOrCode: string
  ): Promise<{ success: boolean; error?: string; patient?: any }> {
    return this.linkPatientToCaregiver(caregiverId, patientEmailOrCode);
  }

  /**
   * Unlinks the currently connected patient from the caregiver.
   * Completely removes the relationship in Central Sync, Supabase, and local storage,
   * allowing both parties to relink with others.
   */
  public async unlinkPatient(caregiverId: string): Promise<boolean> {
    if (!caregiverId) return false;
    try {
      // 1. Central sync unlink
      await centralSyncService.unlinkPatient(caregiverId);

      // 2. Find connected patient and unlink from Supabase database
      let patientId: string | null = null;
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caregiverId)) {
          // A. Try RPC first
          try {
            await supabase.rpc('disconnect_patient_from_caregiver');
          } catch {}

          // B. Direct table delete fallback
          const { data: linkRows } = await supabase
            .from('caregiver_patient')
            .select('patient_id')
            .eq('caregiver_id', caregiverId)
            .limit(1);
          if (linkRows && linkRows.length > 0) {
            patientId = linkRows[0].patient_id;
          }
          await supabase.from('caregiver_patient').delete().eq('caregiver_id', caregiverId);
        }
      } catch {}

      // 3. Clean up local storage
      localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`);
      const allProfiles = authService.getAllProfiles();
      const cg = allProfiles.find((p) => p.id === caregiverId);
      if (cg) {
        cg.caregiverIds = [];
        if (cg.email) {
          localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${cg.email.toLowerCase()}`);
        }
      }
      if (patientId) {
        const pt = allProfiles.find((p) => p.id === patientId);
        if (pt) pt.caregiverIds = [];
      }
      localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));

      // Clear any cache keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`${STORAGE_KEY_CAREGIVER_PATIENT}_`)) {
            const raw = localStorage.getItem(k);
            if (raw && (raw.includes(caregiverId) || (patientId && raw.includes(patientId)))) {
              localStorage.removeItem(k);
            }
          }
        }
      } catch {}

      authService.setLinkedPatient(null as any);
      return true;
    } catch (e) {
      console.warn('[CaregiverService] unlinkPatient error:', e);
      return false;
    }
  }

  /**
   * Unlinks the assigned caregiver from the elderly patient.
   * Completely cuts off caregiver access to the patient's data, records, and telemetry.
   */
  public async unlinkCaregiverFromPatient(patientId: string): Promise<boolean> {
    if (!patientId) return false;
    try {
      let caregiverId: string | null = null;
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
          // A. Try RPC first
          try {
            await supabase.rpc('disconnect_patient_from_caregiver');
          } catch {}

          // B. Direct table delete fallback
          const { data: linkRows } = await supabase
            .from('caregiver_patient')
            .select('caregiver_id')
            .eq('patient_id', patientId)
            .limit(1);
          if (linkRows && linkRows.length > 0) {
            caregiverId = linkRows[0].caregiver_id;
          }
          await supabase.from('caregiver_patient').delete().eq('patient_id', patientId);
        }
      } catch {}

      if (caregiverId) {
        await centralSyncService.unlinkPatient(caregiverId);
      }

      // Clean local storage
      const allProfiles = authService.getAllProfiles();
      const pIdx = allProfiles.findIndex((p) => p.id === patientId);
      if (pIdx >= 0) {
        allProfiles[pIdx].caregiverIds = [];
      }
      if (caregiverId) {
        const cgIdx = allProfiles.findIndex((p) => p.id === caregiverId);
        if (cgIdx >= 0) {
          allProfiles[cgIdx].caregiverIds = [];
        }
        localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`);
      }
      localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));

      authService.updateCurrentUserProfile({ caregiverIds: [] });
      authService.setLinkedPatient(null as any);
      return true;
    } catch (err) {
      console.error('[CaregiverService] unlinkCaregiverFromPatient exception:', err);
      return false;
    }
  }
}

export const caregiverService = new CaregiverService();

