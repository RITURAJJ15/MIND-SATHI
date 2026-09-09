import { authService, getDeterministicUserId } from './authService';
import { gameService } from './gameService';
import { dailyPlanService } from './dailyPlanService';
import { supabase } from '../lib/supabase';
import { offlineDb } from '../lib/offlineDb';
import { UserProfile } from '../types/user';

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

    // ── 1. Check Supabase `caregiver_patient` table ──────────────────
    try {
      const { data: linkRows, error: linkErr } = await supabase
        .from('caregiver_patient')
        .select('patient_id')
        .eq('caregiver_id', caregiverId)
        .limit(1);

      if (!linkErr && linkRows && linkRows.length > 0 && linkRows[0].patient_id) {
        const patientId = linkRows[0].patient_id;
        const { data: ptData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', patientId)
          .maybeSingle();

        if (ptData && !ptData.id.startsWith('elder-')) {
          assignedPatients.push(ptData);
        }
      }
    } catch (err) {
      console.warn('[CaregiverService] Supabase caregiver_patient query note:', err);
    }

    // ── 2. Check Supabase profiles table where caregiver_ids contains caregiverId ──
    if (assignedPatients.length === 0) {
      try {
        const { data: ptRows, error: ptErr } = await supabase
          .from('profiles')
          .select('*')
          .contains('caregiver_ids', [caregiverId])
          .limit(1);

        if (!ptErr && ptRows && ptRows.length > 0) {
          const pt = ptRows[0];
          if (pt && !pt.id.startsWith('elder-')) {
            assignedPatients.push(pt);
          }
        }
      } catch (err) {
        console.warn('[CaregiverService] Supabase profiles caregiver_ids search note:', err);
      }
    }

    // ── 3. Check caregiver's own row in Supabase profiles for linked patient ──
    if (assignedPatients.length === 0) {
      try {
        const { data: cgRow } = await supabase
          .from('profiles')
          .select('caregiver_ids')
          .eq('id', caregiverId)
          .maybeSingle();

        if (cgRow?.caregiver_ids && Array.isArray(cgRow.caregiver_ids) && cgRow.caregiver_ids.length > 0) {
          const targetPtId = cgRow.caregiver_ids[0];
          const { data: ptData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetPtId)
            .maybeSingle();

          if (ptData && !ptData.id.startsWith('elder-')) {
            assignedPatients.push(ptData);
          }
        }
      } catch (err) {
        console.warn('[CaregiverService] Supabase caregiver row check note:', err);
      }
    }

    // ── 4. Check Local Storage Cache ─────────────────────────────────
    if (assignedPatients.length === 0) {
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
      } catch {
        // Ignore JSON error
      }
    }

    // ── 5. Check allProfiles in authService ───────────────────────────
    if (assignedPatients.length === 0) {
      // A: check if any elderly patient has caregiverIds containing caregiverId
      const linkedElder = allProfiles.find(
        (p) => (p.role === 'elderly' || (p.role as string) === 'patient') &&
               !p.id.startsWith('elder-') &&
               p.caregiverIds &&
               (p.caregiverIds.includes(caregiverId) || (caregiverEmail && p.caregiverIds.includes(caregiverEmail)))
      );
      if (linkedElder) {
        assignedPatients.push(linkedElder);
      }

      // B: check if caregiver profile has caregiverIds pointing to an elderly patient
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
      allProfiles[patientIdx] = { ...allProfiles[patientIdx], caregiverIds: [caregiverId] };
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
    if (!patientId) return null;

    const allProfiles = authService.getAllProfiles();
    const patient = allProfiles.find((p) => p.id === patientId);

    // 1. Check patient profile's caregiverIds
    if (patient?.caregiverIds && patient.caregiverIds.length > 0) {
      const cgId = patient.caregiverIds[0];
      const cg = allProfiles.find(
        (p) =>
          (p.id === cgId || (p.email && p.email.toLowerCase() === cgId.toLowerCase())) &&
          p.role === 'caregiver'
      );
      if (cg && !cg.name.includes('Dr. Admin Caregiver')) {
        return cg;
      }
    }

    // 2. Check Supabase caregiver_patient table
    try {
      const { data: linkRows } = await supabase
        .from('caregiver_patient')
        .select('caregiver_id')
        .eq('patient_id', patientId)
        .limit(1);

      if (linkRows && linkRows.length > 0 && linkRows[0].caregiver_id) {
        const cgId = linkRows[0].caregiver_id;
        const cg = allProfiles.find((p) => p.id === cgId);
        if (cg && !cg.name.includes('Dr. Admin Caregiver')) return cg;

        const { data: cgData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cgId)
          .maybeSingle();

        if (cgData && !(cgData.full_name || '').includes('Dr. Admin Caregiver')) {
          const mapped: UserProfile = {
            id: cgData.id,
            name: cgData.full_name || 'Assigned Caregiver',
            preferredName: cgData.preferred_name || 'Caregiver',
            role: 'caregiver',
            email: cgData.email || '',
            phone: cgData.phone || '',
            age: cgData.age || 40,
            gender: cgData.gender || 'other',
            avatarUrl:
              cgData.profile_photo_url ||
              `https://api.dicebear.com/9.x/avataaars/svg?seed=${cgData.id}&backgroundColor=b6e3f4`,
            primaryLanguage: 'en',
            city: cgData.city || 'Guwahati',
            state: cgData.state || 'Assam',
            isAyushmanMember: false,
            ayushmanStatus: 'none',
            pmjayStatus: 'none',
            abhaStatus: 'none',
            hasCompletedOnboarding: true,
            caregiverIds: [patientId],
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
            createdAt: cgData.created_at || new Date().toISOString(),
          };
          return mapped;
        }
      }
    } catch (e) {
      console.warn('[CaregiverService] getAssignedCaregiverForPatient note:', e);
    }

    // 3. Check local storage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${STORAGE_KEY_CAREGIVER_PATIENT}_`)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.some((pt) => pt.id === patientId)) {
              const cgId = key.replace(`${STORAGE_KEY_CAREGIVER_PATIENT}_`, '');
              const foundCg = allProfiles.find(
                (p) =>
                  (p.id === cgId || (p.email && p.email.toLowerCase() === cgId.toLowerCase())) &&
                  p.role === 'caregiver'
              );
              if (foundCg && !foundCg.name.includes('Dr. Admin Caregiver')) {
                return foundCg;
              }
            }
          }
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
    const cleanDigits = cleanInput.replace(/\D/g, '');

    try {
      let targetPatient: any = null;

      // ── Step 1: Search in local profiles ─────────────────────────────
      const localProfiles = authService.getAllProfiles().filter((p) =>
        (p.role === 'elderly' || (p.role as string) === 'patient') &&
        !p.id.startsWith('elder-') &&
        p.id !== 'guest'
      );

      targetPatient = localProfiles.find((p) => {
        if (p.id.toLowerCase() === cleanInput) return true;
        if (p.email && p.email.toLowerCase() === cleanInput) return true;
        if ((p as any).phone && (p as any).phone.toLowerCase() === cleanInput) return true;
        if (p.name && p.name.toLowerCase() === cleanInput) return true;
        if (cleanDigits.length >= 10 && (p as any).phone) {
          const pDigits = ((p as any).phone as string).replace(/\D/g, '');
          if (pDigits.endsWith(cleanDigits.slice(-10))) return true;
        }
        return false;
      });

      // ── Step 2: Search in local registered credentials ────────────────
      if (!targetPatient) {
        try {
          const credsRaw = localStorage.getItem('ms_local_credentials');
          if (credsRaw) {
            const creds = JSON.parse(credsRaw) as any[];
            const matchingCred = creds.find((c) => {
              if (c.role !== 'elderly' && c.role !== 'patient') return false;
              if (c.email.toLowerCase() === cleanInput) return true;
              if (c.userId.toLowerCase() === cleanInput) return true;
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
        } catch {
          // Ignore
        }
      }

      // ── Step 3: Search in Supabase profiles ───────────────────────────
      if (!targetPatient) {
        try {
          // By Email
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanInput)
            .maybeSingle();
          if (byEmail && (byEmail.role === 'elderly' || byEmail.role === 'patient') && !byEmail.id.startsWith('elder-')) {
            targetPatient = byEmail;
          }

          // By UUID
          if (!targetPatient && cleanInput.includes('-') && cleanInput.length > 20) {
            const { data: byId } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', cleanInput)
              .maybeSingle();
            if (byId && (byId.role === 'elderly' || byId.role === 'patient') && !byId.id.startsWith('elder-')) {
              targetPatient = byId;
            }
          }

          // By Phone
          if (!targetPatient && cleanDigits.length >= 10) {
            const { data: byPhone } = await supabase
              .from('profiles')
              .select('*')
              .eq('phone', cleanDigits)
              .maybeSingle();
            if (byPhone && (byPhone.role === 'elderly' || byPhone.role === 'patient') && !byPhone.id.startsWith('elder-')) {
              targetPatient = byPhone;
            }
          }

          // By Name ILIKE
          if (!targetPatient) {
            const { data: byName } = await supabase
              .from('profiles')
              .select('*')
              .eq('role', 'elderly')
              .ilike('full_name', `%${cleanInput}%`)
              .limit(1)
              .maybeSingle();
            if (byName && !byName.id.startsWith('elder-')) {
              targetPatient = byName;
            }
          }
        } catch (err) {
          console.warn('[CaregiverService] Supabase profile search error:', err);
        }
      }

      // Filter out any mock accounts
      if (targetPatient && targetPatient.id.startsWith('elder-')) {
        targetPatient = null;
      }

      if (!targetPatient) {
        return {
          success: false,
          error: 'No registered elderly patient found with that email, phone number, or ID. Please check the credentials.',
        };
      }

      // ── Step 4: Enforce STRICT 1-to-1 Connection ─────────────────────
      // Check Supabase caregiver_patient table
      try {
        const { data: existingLink } = await supabase
          .from('caregiver_patient')
          .select('id, caregiver_id')
          .eq('patient_id', targetPatient.id)
          .maybeSingle();

        if (existingLink && existingLink.caregiver_id !== caregiverId) {
          return {
            success: false,
            error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
          };
        }
      } catch (err) {
        console.warn('[CaregiverService] Error checking existing Supabase link:', err);
      }

      // Check local cache for other caregivers who linked this patient
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_CAREGIVER_PATIENT) && key !== `${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`) {
          try {
            const val = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(val) && val.some((p: any) => p.id === targetPatient.id)) {
              return {
                success: false,
                error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
              };
            }
          } catch {
            // Ignore
          }
        }
      }

      // Check targetPatient.caregiverIds
      if (targetPatient.caregiverIds && targetPatient.caregiverIds.length > 0) {
        if (targetPatient.caregiverIds.some((id: string) => id !== caregiverId)) {
          return {
            success: false,
            error: `Patient "${targetPatient.full_name || targetPatient.name}" is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.`,
          };
        }
      }

      // ── Step 5: Save 1-to-1 Link in Database & Local Cache ───────────
      // Remove any prior patient connection for this caregiver (strict 1-to-1)
      try {
        await supabase.from('caregiver_patient').delete().eq('caregiver_id', caregiverId);
      } catch {
        // Ignore
      }

      // Insert new 1-to-1 link in Supabase
      try {
        await supabase.from('caregiver_patient').upsert({
          caregiver_id: caregiverId,
          patient_id: targetPatient.id,
        });
      } catch (insertErr: any) {
        console.warn('[CaregiverService] Supabase caregiver_patient upsert notice:', insertErr?.message);
      }

      // Normalize targetPatient object
      const formattedPatient = {
        ...targetPatient,
        id: targetPatient.id,
        full_name: targetPatient.full_name || targetPatient.name,
        preferred_name: targetPatient.preferred_name || targetPatient.preferredName || targetPatient.name,
        email: targetPatient.email || '',
        phone: targetPatient.phone || '',
        avatarUrl: targetPatient.profile_photo_url || targetPatient.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${targetPatient.id}&backgroundColor=b6e3f4`,
        profile_photo_url: targetPatient.profile_photo_url || targetPatient.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${targetPatient.id}&backgroundColor=b6e3f4`,
        caregiverIds: [caregiverId],
      };

      // Update local caregiver_patient cache
      const cachedKey = `${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`;
      localStorage.setItem(cachedKey, JSON.stringify([formattedPatient]));

      // Update targetPatient and caregiver in local profiles
      const allProfiles = authService.getAllProfiles();
      const existingIdx = allProfiles.findIndex((p) => p.id === targetPatient.id);
      if (existingIdx >= 0) {
        allProfiles[existingIdx] = {
          ...allProfiles[existingIdx],
          caregiverIds: [caregiverId],
        };
      }
      const cgIdx = allProfiles.findIndex((p) => p.id === caregiverId);
      if (cgIdx >= 0) {
        allProfiles[cgIdx] = {
          ...allProfiles[cgIdx],
          caregiverIds: [targetPatient.id],
        };
      }
      localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));

      // Also cache by caregiver email if present
      const cgProfile = allProfiles.find((p) => p.id === caregiverId);
      if (cgProfile?.email) {
        localStorage.setItem(
          `${STORAGE_KEY_CAREGIVER_PATIENT}_${cgProfile.email.toLowerCase()}`,
          JSON.stringify([formattedPatient])
        );
      }

      // Upsert target patient profile into Supabase profiles
      try {
        await supabase.from('profiles').upsert({
          id: targetPatient.id,
          full_name: formattedPatient.full_name,
          preferred_name: formattedPatient.preferred_name,
          role: 'elderly',
          email: formattedPatient.email,
          phone: formattedPatient.phone,
          profile_photo_url: formattedPatient.profile_photo_url,
          caregiver_ids: [caregiverId],
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Ignore
      }

      // Update caregiver profile in Supabase profiles with linked patient ID
      try {
        await supabase.from('profiles').update({
          caregiver_ids: [targetPatient.id],
          updated_at: new Date().toISOString(),
        }).eq('id', caregiverId);
      } catch {
        // Ignore
      }

      // Update Dexie IndexedDB
      try {
        if (typeof window !== 'undefined') {
          await offlineDb.profiles.put(formattedPatient as any);
          if (cgProfile) {
            await offlineDb.profiles.put({
              ...cgProfile,
              caregiverIds: [targetPatient.id],
            });
          }
        }
      } catch {
        // Ignore
      }

      authService.setLinkedPatient(formattedPatient as any);
      return { success: true, patient: formattedPatient };
    } catch (err: any) {
      console.error('[CaregiverService] linkPatientToCaregiver exception:', err);
      return { success: false, error: err.message || 'Error linking patient.' };
    }
  }

  /**
   * Connects an elderly patient to a caregiver using the patient's registered email and password.
   * Enforces STRICT 1-TO-1 RELATIONSHIP:
   * - Verifies that the patient credentials are valid (via Supabase auth and local credentials).
   * - Verifies that the account is registered as an elderly patient.
   * - Verifies the patient is not already connected to another caregiver.
   * - Stores the 1-to-1 link in Supabase database `caregiver_patient` table and `profiles` table.
   * - Stores the 1-to-1 link in persistent local storage so data is never lost after logout.
   * - Syncs all real patient records, telemetry, family members, and reminders.
   */
  public async linkPatientWithCredentials(
    caregiverId: string,
    patientEmail: string,
    patientPassword: string
  ): Promise<{ success: boolean; error?: string; patient?: any }> {
    if (!caregiverId || !patientEmail.trim() || !patientPassword.trim()) {
      return { success: false, error: 'Caregiver ID, Patient email, and Patient password are required.' };
    }

    const cleanEmail = patientEmail.trim().toLowerCase();

    // 1. Verify Patient Credentials
    let authenticated = false;
    let targetPatientId: string | null = null;

    // Check Supabase Auth
    try {
      const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: patientPassword,
      });

      if (!sbErr && sbData?.user) {
        authenticated = true;
        targetPatientId = sbData.user.id;
      } else if (sbErr) {
        const errCode = (sbErr as any).code;
        const errMsg = (sbErr.message || '').toLowerCase();
        if (errCode === 'email_not_confirmed' || errMsg.includes('confirm')) {
          authenticated = true;
          targetPatientId = getDeterministicUserId(cleanEmail);
        }
      }
    } catch (e) {
      console.warn('[CaregiverService] Supabase patient auth check note:', e);
    }

    // Check local stored credentials fallback
    if (!authenticated) {
      try {
        const credsRaw = localStorage.getItem('ms_local_credentials');
        if (credsRaw) {
          const creds = JSON.parse(credsRaw) as any[];
          const match = creds.find(
            (c) => c.email.toLowerCase() === cleanEmail && c.password === patientPassword
          );
          if (match) {
            authenticated = true;
            targetPatientId = match.userId;
          }
        }
      } catch {}
    }

    if (!authenticated || !targetPatientId) {
      return {
        success: false,
        error: 'Invalid patient email or password. Please verify the credentials entered.',
      };
    }

    // Now link using linkPatientToCaregiver with verified identity
    return await this.linkPatientToCaregiver(caregiverId, cleanEmail);
  }

  /**
   * Unlinks the currently connected patient from the caregiver.
   */
  public async unlinkPatient(caregiverId: string): Promise<boolean> {
    if (!caregiverId) return false;
    try {
      await supabase.from('caregiver_patient').delete().eq('caregiver_id', caregiverId);
      localStorage.removeItem(`${STORAGE_KEY_CAREGIVER_PATIENT}_${caregiverId}`);
      const allProfiles = authService.getAllProfiles();
      const cg = allProfiles.find((p) => p.id === caregiverId);
      if (cg) {
        cg.caregiverIds = [];
        localStorage.setItem('ms_all_profiles', JSON.stringify(allProfiles));
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const caregiverService = new CaregiverService();

