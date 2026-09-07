import { FamilyMember, MemoryVaultItem, CallSession, ChatMessage } from '../types/family';
import { MOCK_FAMILY_MEMBERS, MOCK_MEMORIES } from '../data/mockFamily';
import { supabase } from '../lib/supabase';
import { offlineDb } from '../lib/offlineDb';

const STORAGE_KEY_MEMORIES = 'mind_sathi_memories';
const STORAGE_KEY_FAMILY = 'mind_sathi_family';
const STORAGE_KEY_FAMILY_PREFIX = 'mind_sathi_family_';
const STORAGE_KEY_CALLS = 'mind_sathi_calls';
const STORAGE_KEY_MESSAGES = 'mind_sathi_messages';

const MOCK_MEMBER_IDS = new Set(['fam-1', 'fam-2', 'fam-3', 'fam-4']);

class FamilyService {
  private memories: MemoryVaultItem[];
  private members: FamilyMember[];
  private calls: CallSession[];
  private messages: ChatMessage[];

  constructor() {
    const savedMems = localStorage.getItem(STORAGE_KEY_MEMORIES);
    if (savedMems) {
      try {
        this.memories = JSON.parse(savedMems);
      } catch {
        this.memories = MOCK_MEMORIES;
      }
    } else {
      this.memories = MOCK_MEMORIES;
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.memories));
    }

    // Load family members from global storage
    const loadedMembers: FamilyMember[] = [];
    const savedFams = localStorage.getItem(STORAGE_KEY_FAMILY);
    if (savedFams) {
      try {
        const parsed = JSON.parse(savedFams) as FamilyMember[];
        // Filter out static mock demo members that belong to 'elder-1', but KEEP all user-created members!
        parsed.forEach((m) => {
          if (m && m.userId !== 'elder-1' && !MOCK_MEMBER_IDS.has(m.id)) {
            loadedMembers.push(m);
          }
        });
      } catch {
        // ignore parse error
      }
    }

    // Also scan dedicated per-patient keys in localStorage so no patient's family is ever lost
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_KEY_FAMILY_PREFIX)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const perPatientMembers = JSON.parse(raw) as FamilyMember[];
                if (Array.isArray(perPatientMembers)) {
                  perPatientMembers.forEach((pm) => {
                    if (pm && !loadedMembers.some((existing) => existing.id === pm.id)) {
                      loadedMembers.push(pm);
                    }
                  });
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch (scanErr) {
      console.warn('[FamilyService] LocalStorage scan note:', scanErr);
    }

    this.members = loadedMembers;

    const savedCalls = localStorage.getItem(STORAGE_KEY_CALLS);
    this.calls = savedCalls ? JSON.parse(savedCalls) : [];

    const savedMsgs = localStorage.getItem(STORAGE_KEY_MESSAGES);
    this.messages = savedMsgs ? JSON.parse(savedMsgs) : [
      {
        id: 'msg-1',
        senderId: 'fam-1',
        senderName: 'Priyobrata (Son)',
        text: 'Deuta, how are you feeling today? Did you take your morning BP medicine?',
        timestamp: '10:30 AM',
        isFromElderly: false,
      },
      {
        id: 'msg-2',
        senderId: 'current',
        senderName: 'Me',
        text: 'Yes boba, I had warm water and played the Bihu festival game!',
        timestamp: '10:45 AM',
        isFromElderly: true,
      },
      {
        id: 'msg-3',
        senderId: 'fam-1',
        senderName: 'Priyobrata (Son)',
        text: 'Wonderful! I will call you after work around 7 PM.',
        timestamp: '11:00 AM',
        isFromElderly: false,
      }
    ];
  }

  /**
   * Links unassociated or onboarding family members to a specific authenticated patient ID.
   * Called during login and registration.
   */
  public linkFamilyMembersToPatient(patientId: string, email?: string): void {
    if (!patientId) return;

    let modified = false;

    // 1. Check in-memory members with temporary userIds
    this.members.forEach((m) => {
      if (m.userId === 'current' || m.userId === 'patient-onboarding' || (email && m.userId === email.toLowerCase())) {
        m.userId = patientId;
        modified = true;
      }
    });

    // 2. Check temporary per-patient keys
    const tempKeys = ['current', 'patient-onboarding', email?.toLowerCase()].filter(Boolean) as string[];
    tempKeys.forEach((key) => {
      const raw = localStorage.getItem(`${STORAGE_KEY_FAMILY_PREFIX}${key}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as FamilyMember[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((m) => {
              m.userId = patientId;
              if (!this.members.some((ex) => ex.id === m.id)) {
                this.members.push(m);
              }
            });
            modified = true;
          }
        } catch {
          // ignore
        }
      }
    });

    if (modified) {
      const patientMembers = this.members.filter((m) => m.userId === patientId);
      localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${patientId}`, JSON.stringify(patientMembers));
      localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));

      // Persist to Dexie
      patientMembers.forEach((m) => {
        offlineDb.familyMembers.put({ ...m, userId: patientId, syncStatus: 'synced' }).catch(() => {});
      });

      // Sync to Supabase if patientId is a UUID
      if (patientId.includes('-') && patientId.length > 20) {
        this.pushMembersToSupabase(patientId, patientMembers);
      }
    }
  }

  /** Helper to push members to Supabase with proper conflict resolution */
  private async pushMembersToSupabase(patientId: string, members: FamilyMember[]): Promise<void> {
    if (!patientId || !patientId.includes('-') || patientId.length <= 20) return;

    for (const m of members) {
      try {
        const isUuid = m.id && m.id.length >= 32 && m.id.includes('-');
        const payload = {
          ...(isUuid ? { id: m.id } : {}),
          patient_id: patientId,
          name: m.name,
          relationship: typeof m.relationship === 'string' ? m.relationship : (m.relationship?.en || m.relationType || 'Family'),
          phone: m.phone || '',
          photo_url: m.photoUrl || '',
          is_favorite: Boolean(m.isFavorite),
          updated_at: new Date().toISOString(),
        };

        if (isUuid) {
          await supabase.from('family_members').upsert(payload);
        } else {
          const { data } = await supabase.from('family_members').insert(payload).select('id').single();
          if (data?.id) {
            m.id = data.id;
          }
        }
      } catch (err) {
        console.warn('[FamilyService] Push to Supabase note:', err);
      }
    }
    // Update local storage after assigning IDs
    localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${patientId}`, JSON.stringify(members));
    localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));
  }

  /** Fetch family members from Supabase with resilient multi-tier local and offline cache. */
  public async syncFamilyMembersFromDb(userId: string): Promise<FamilyMember[]> {
    if (!userId) return [];

    let dbMembers: FamilyMember[] = [];

    // 1. Try fetching from Supabase if UUID
    if (userId.includes('-') && userId.length > 20) {
      try {
        const { data, error } = await supabase
          .from('family_members')
          .select('*')
          .eq('patient_id', userId)
          .order('created_at', { ascending: true });

        if (data && !error && data.length > 0) {
          // Get local versions to preserve any high-res base64 photo data
          const localMap = new Map(this.getFamilyMembersForUser(userId).map((m) => [m.id, m]));

          dbMembers = data.map((d) => {
            const local = localMap.get(d.id);
            return {
              id: d.id,
              userId: d.patient_id,
              name: d.name,
              relationship: local?.relationship || (d.relationship as any),
              relationType: local?.relationType || d.relationship,
              // Prefer local photoUrl if it exists and has uploaded data URL
              photoUrl: local?.photoUrl && local.photoUrl.startsWith('data:')
                ? local.photoUrl
                : (d.photo_url || local?.photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'),
              phone: d.phone || local?.phone || '',
              city: local?.city || '',
              isEmergencyContact: local?.isEmergencyContact || false,
              isFavorite: d.is_favorite ?? local?.isFavorite ?? false,
              isOnline: local?.isOnline ?? true,
            };
          });

          this.setFamilyMembersForUser(userId, dbMembers);

          // Cache in Dexie for offline resilience
          dbMembers.forEach((m) => {
            offlineDb.familyMembers.put({ ...m, userId, syncStatus: 'synced' }).catch(() => {});
          });

          return dbMembers;
        }
      } catch (err) {
        console.warn('[FamilyService] Error syncing members from Supabase:', err);
      }
    }

    // 2. Offline fallback: check Dexie IndexedDB
    try {
      const cached = await offlineDb.familyMembers.where('userId').equals(userId).toArray();
      if (cached && cached.length > 0) {
        this.setFamilyMembersForUser(userId, cached);
        // If online now, try pushing these cached members to Supabase in background
        if (userId.includes('-') && userId.length > 20) {
          this.pushMembersToSupabase(userId, cached);
        }
        return cached;
      }
    } catch (dexieErr) {
      console.warn('[FamilyService] Dexie member read notice:', dexieErr);
    }

    // 3. Fallback: check dedicated patient key and in-memory cache
    const existing = this.getFamilyMembersForUser(userId);
    if (existing.length > 0 && userId.includes('-') && userId.length > 20) {
      // Sync local members up to Supabase so they are never lost
      this.pushMembersToSupabase(userId, existing);
    }

    return existing;
  }

  public getMemoriesForUser(userId: string): MemoryVaultItem[] {
    return this.memories.filter((m) => m.userId === userId || m.userId === 'user-elderly-1');
  }

  /**
   * Retrieves all family members belonging to a specific patient.
   * Multi-tiered retrieval: in-memory -> dedicated patient key -> fallback keys.
   */
  public getFamilyMembersForUser(userId: string): FamilyMember[] {
    if (!userId) return [];

    let userMembers = this.members.filter((f) => f.userId === userId);

    // If not found in memory, check dedicated localStorage key for this patient
    if (userMembers.length === 0) {
      const savedPatientFamily = localStorage.getItem(`${STORAGE_KEY_FAMILY_PREFIX}${userId}`);
      if (savedPatientFamily) {
        try {
          const parsed = JSON.parse(savedPatientFamily) as FamilyMember[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            userMembers = parsed.map((m) => ({ ...m, userId }));
            // Merge into in-memory array
            this.members = [
              ...this.members.filter((m) => m.userId !== userId),
              ...userMembers,
            ];
            localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));
          }
        } catch {
          // ignore
        }
      }
    }

    // Also check if any members exist under 'current' or 'patient-onboarding'
    if (userMembers.length === 0) {
      const altKeys = ['current', 'patient-onboarding'];
      for (const altKey of altKeys) {
        const raw = localStorage.getItem(`${STORAGE_KEY_FAMILY_PREFIX}${altKey}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as FamilyMember[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              userMembers = parsed.map((m) => ({ ...m, userId }));
              this.members = [
                ...this.members.filter((m) => m.userId !== userId),
                ...userMembers,
              ];
              localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${userId}`, JSON.stringify(userMembers));
              localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));
              break;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    return userMembers;
  }

  /**
   * Sets and persists family members for a patient.
   * Saves to in-memory, dedicated localStorage key, global key, Dexie, and Supabase.
   */
  public setFamilyMembersForUser(userId: string, newMembers: FamilyMember[]): void {
    if (!userId) return;

    const validatedMembers: FamilyMember[] = newMembers.map((m) => ({
      ...m,
      id: m.id || crypto.randomUUID(),
      userId,
    }));

    // 1. Update in-memory
    this.members = [
      ...this.members.filter((m) => m.userId !== userId && m.userId !== 'elder-1'),
      ...validatedMembers,
    ];

    // 2. Update global localStorage
    localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));

    // 3. Update dedicated per-patient localStorage key
    localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${userId}`, JSON.stringify(validatedMembers));

    // 4. Update Dexie IndexedDB
    validatedMembers.forEach((m) => {
      offlineDb.familyMembers.put({ ...m, userId, syncStatus: 'synced' }).catch(() => {});
    });

    // 5. Persist to Supabase if valid UUID
    if (userId.includes('-') && userId.length > 20) {
      this.pushMembersToSupabase(userId, validatedMembers);
    }
  }

  /**
   * Adds a single family member linked directly to the patient's ID.
   */
  public addFamilyMember(newMember: Omit<FamilyMember, 'id'>): FamilyMember {
    const memberId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `fam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const member: FamilyMember = {
      ...newMember,
      id: memberId,
    };

    this.members.push(member);
    localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));

    // Dedicated patient storage
    if (member.userId) {
      const patientMembers = this.getFamilyMembersForUser(member.userId);
      localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${member.userId}`, JSON.stringify(patientMembers));

      // Save to Dexie
      offlineDb.familyMembers.put({ ...member, syncStatus: 'synced' }).catch(() => {});

      // Save to Supabase if valid UUID
      if (member.userId.includes('-') && member.userId.length > 20) {
        supabase
          .from('family_members')
          .insert({
            id: member.id.includes('-') && member.id.length >= 32 ? member.id : undefined,
            patient_id: member.userId,
            name: member.name,
            relationship: typeof member.relationship === 'string' ? member.relationship : (member.relationship?.en || member.relationType || 'Family'),
            phone: member.phone || '',
            photo_url: member.photoUrl || '',
            is_favorite: Boolean(member.isFavorite),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()
          .then(
            ({ data }) => {
              if (data?.id) {
                member.id = data.id;
                const updatedPatientMembers = this.getFamilyMembersForUser(member.userId);
                localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${member.userId}`, JSON.stringify(updatedPatientMembers));
                localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));
              }
            },
            (e: unknown) => console.warn('[FamilyService] Insert member error:', e)
          );
      }
    }

    return member;
  }

  public updateFamilyMember(id: string, updates: Partial<FamilyMember>): FamilyMember | null {
    const index = this.members.findIndex((m) => m.id === id);
    if (index === -1) return null;

    this.members[index] = { ...this.members[index], ...updates };
    const updated = this.members[index];

    localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));

    if (updated.userId) {
      const patientMembers = this.getFamilyMembersForUser(updated.userId);
      localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${updated.userId}`, JSON.stringify(patientMembers));
      offlineDb.familyMembers.put({ ...updated, syncStatus: 'synced' }).catch(() => {});

      // Update in Supabase if UUID
      if (id.includes('-') && id.length > 20) {
        supabase
          .from('family_members')
          .update({
            name: updates.name,
            relationship: typeof updates.relationship === 'string' ? updates.relationship : (updates.relationship?.en || updates.relationType),
            phone: updates.phone,
            photo_url: updates.photoUrl,
            is_favorite: updates.isFavorite,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('[FamilyService] Update member error:', error.message);
          });
      }
    }

    return updated;
  }

  public deleteFamilyMember(id: string): boolean {
    const target = this.members.find((m) => m.id === id);
    if (!target) return false;

    const patientId = target.userId;
    this.members = this.members.filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY_FAMILY, JSON.stringify(this.members));

    if (patientId) {
      const patientMembers = this.getFamilyMembersForUser(patientId);
      localStorage.setItem(`${STORAGE_KEY_FAMILY_PREFIX}${patientId}`, JSON.stringify(patientMembers));
      offlineDb.familyMembers.delete(id).catch(() => {});

      if (id.includes('-') && id.length > 20) {
        supabase
          .from('family_members')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('[FamilyService] Delete member error:', error.message);
          });
      }
    }

    return true;
  }

  public getMemoryById(id: string): MemoryVaultItem | undefined {
    return this.memories.find((m) => m.id === id);
  }

  public recordMemoryRecalled(memoryId: string) {
    const mem = this.memories.find((m) => m.id === memoryId);
    if (mem) {
      mem.timesRecalled = (mem.timesRecalled || 0) + 1;
      mem.lastRecalledAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.memories));
    }
  }

  public toggleFavorite(memoryId: string): boolean {
    const mem = this.memories.find((m) => m.id === memoryId);
    if (mem) {
      mem.isFavorite = !mem.isFavorite;
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.memories));
      return mem.isFavorite;
    }
    return false;
  }

  public addMemory(
    newMem: Omit<MemoryVaultItem, 'id' | 'timesRecalled' | 'createdAt'> & {
      timesRecalled?: number;
      createdAt?: string;
    }
  ): MemoryVaultItem {
    const item: MemoryVaultItem = {
      timesRecalled: 0,
      createdAt: new Date().toISOString(),
      ...newMem,
      id: `mem-${Date.now()}`,
    };
    this.memories.unshift(item);
    localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.memories));
    return item;
  }

  public getCalls(): CallSession[] {
    return this.calls;
  }

  public recordCall(call: CallSession): CallSession {
    this.calls.unshift(call);
    localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(this.calls));
    return call;
  }

  public logCall(call: Omit<CallSession, 'id'>): CallSession {
    const newCall: CallSession = {
      ...call,
      id: `call-${Date.now()}`,
    };
    this.calls.unshift(newCall);
    localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(this.calls));
    return newCall;
  }

  public getMessages(familyMemberId?: string): ChatMessage[] {
    if (!familyMemberId) return this.messages;
    return this.messages.filter(
      (m) => m.senderId === familyMemberId || (m.isFromElderly && m.senderId === 'current')
    );
  }

  public sendMessage(
    text: string,
    isFromElderlyOrMemberId: boolean | string = true,
    senderName: string = 'Me'
  ): ChatMessage {
    const isFromElderly = typeof isFromElderlyOrMemberId === 'boolean' ? isFromElderlyOrMemberId : true;
    const senderId = typeof isFromElderlyOrMemberId === 'string' ? isFromElderlyOrMemberId : (isFromElderly ? 'current' : 'fam-1');

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId,
      senderName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isFromElderly,
    };
    this.messages.push(msg);
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(this.messages));
    return msg;
  }
}

export const familyService = new FamilyService();
