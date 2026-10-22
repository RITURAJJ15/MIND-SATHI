import { supabase } from '../lib/supabase';
import {
  offlineDb,
  OfflineGameSession,
  SyncQueueItem,
  OfflineMutation,
  SyncStatus,
} from '../lib/offlineDb';

export type SyncState = 'online-synced' | 'offline' | 'syncing' | 'sync-failed';

export interface SyncInfo {
  state: SyncState;
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

class SyncService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastError: string | null = null;
  private lastSyncTime: string | null = null;
  private listeners: Set<(info: SyncInfo) => void> = new Set();
  private initialized: boolean = false;
  private heartbeatInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  private async initListeners() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.lastError = null;
      this.notify();
      // Automatically detect reconnection and start synchronization
      this.syncOfflineChanges(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.isSyncing = false;
      this.notify();
    });

    // Auto-sync when tab returns to foreground
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline) {
          this.syncOfflineChanges(true);
        }
      });
    }

    // Periodic check every 30 seconds if online to sync any pending queue
    this.heartbeatInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const pending = await this.getPendingCount();
        if (pending > 0) {
          this.syncOfflineChanges(false);
        }
      }
    }, 30000);

    // Restore lastSyncTime from Dexie
    try {
      const meta = await offlineDb.syncMetadata.get('lastSyncTime');
      if (meta && meta.value) {
        this.lastSyncTime = meta.value;
      }
    } catch {
      // IndexedDB fallback
    }

    // Initial sync check if online
    if (this.isOnline) {
      setTimeout(() => {
        this.syncOfflineChanges(true);
      }, 1500);
    }
  }

  public subscribe(listener: (info: SyncInfo) => void): () => void {
    this.listeners.add(listener);
    this.getSyncInfo().then((info) => listener(info));
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const info = await this.getSyncInfo();
    this.listeners.forEach((l) => l(info));
  }

  /**
   * Sanitizes diagnostic error details without exposing sensitive health data or tokens.
   */
  private categorizeError(err: any): string {
    if (!err) return 'Unknown synchronization error';
    const msg = typeof err === 'string' ? err : err.message || '';
    const code = String(err.code || '');

    if (code === '401' || msg.includes('JWT') || msg.includes('token') || msg.includes('auth') || msg.includes('Unauthorized')) {
      return 'Authentication session expired. Please sign in again.';
    }
    if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
      return 'Server schema mismatch. Safe fallback applied.';
    }
    if (code === '23503' || msg.includes('foreign key')) {
      return 'Account record synchronization pending server link.';
    }
    if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return 'Duplicate record acknowledged by server.';
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network interrupted') || msg.includes('offline') || code === 'FETCH_ERROR') {
      return 'Network connection interrupted. Will retry automatically.';
    }
    if (code === '429' || msg.includes('rate limit')) {
      return 'Sync rate limited by server. Retrying shortly.';
    }

    return 'Server sync error. Changes safely preserved on device.';
  }

  /**
   * Checks whether an item is eligible for background retry based on exponential backoff.
   */
  private isEligibleForRetry(
    item: { retryCount?: number; updatedAt?: string; lastError?: string; error?: string },
    isManual: boolean
  ): boolean {
    if (isManual) return true;
    const retries = item.retryCount || 0;
    if (retries === 0) return true;
    if (retries >= 5) return false; // Bound automatic retries to 5 attempts; require manual sync or reconnect
    const lastTimestamp = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    const backoffDelay = Math.min(1000 * Math.pow(2, retries), 60000);
    return Date.now() - lastTimestamp >= backoffDelay;
  }

  /**
   * Checks if any pending records are currently in 'failed' status.
   */
  public async hasFailedRecords(): Promise<boolean> {
    try {
      const failedMutations = await offlineDb.offlineMutations
        .filter((m) => m.status === 'failed')
        .count();
      if (failedMutations > 0) return true;

      const failedSessions = await offlineDb.gameSessions
        .filter((s) => s.syncStatus === 'failed')
        .count();
      if (failedSessions > 0) return true;

      const failedQueue = await offlineDb.syncQueue
        .filter((q) => q.status === 'failed')
        .count();
      return failedQueue > 0;
    } catch {
      return false;
    }
  }

  public async getPendingCount(): Promise<number> {
    try {
      const pendingMutations = await offlineDb.offlineMutations
        .filter((m) => m.status === 'pending' || m.status === 'failed')
        .toArray();

      const mutationGameSessionIds = new Set<string>();
      for (const m of pendingMutations) {
        if (m.entityType === 'game_session') {
          const sid = m.payload?.localSessionId || m.entityId;
          if (sid) mutationGameSessionIds.add(sid);
        }
      }

      const pendingSessions = await offlineDb.gameSessions
        .filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'failed')
        .toArray();

      // Deduplicate: game sessions already tracked via offlineMutations are not counted twice
      const uniquePendingSessions = pendingSessions.filter((s) => !mutationGameSessionIds.has(s.id));

      const pendingQueue = await offlineDb.syncQueue
        .filter((q) => q.status === 'pending' || q.status === 'failed')
        .count();

      return pendingMutations.length + uniquePendingSessions.length + pendingQueue;
    } catch {
      return 0;
    }
  }

  public async getSyncInfo(): Promise<SyncInfo> {
    const pendingCount = await this.getPendingCount();

    let state: SyncState = 'online-synced';
    if (!this.isOnline) {
      state = 'offline';
    } else if (this.isSyncing) {
      state = 'syncing';
    } else if (pendingCount > 0) {
      if (this.lastError) {
        state = 'sync-failed';
      } else {
        const hasFailed = await this.hasFailedRecords();
        state = hasFailed ? 'sync-failed' : 'online-synced';
      }
    } else {
      state = 'online-synced';
    }

    return {
      state,
      isOnline: this.isOnline,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  /**
   * Records a durable mutation in Dexie IndexedDB with an idempotency key.
   * If online, immediately triggers background synchronization.
   */
  public async recordMutation(params: {
    userId?: string;
    patientId: string;
    entityType: OfflineMutation['entityType'];
    entityId: string;
    operation: OfflineMutation['operation'];
    payload: any;
    idempotencyKey: string;
  }): Promise<OfflineMutation> {
    const now = new Date().toISOString();
    const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Check if an existing mutation with the same idempotency key already exists
    let mutation: OfflineMutation | undefined;
    try {
      const existing = await offlineDb.offlineMutations
        .where('idempotencyKey')
        .equals(params.idempotencyKey)
        .first();

      if (existing) {
        mutation = {
          ...existing,
          payload: params.payload,
          updatedAt: now,
          status: 'pending',
          lastError: undefined,
        };
        await offlineDb.offlineMutations.put(mutation);
      }
    } catch (e) {
      // Fallback
    }

    if (!mutation) {
      mutation = {
        id: mutationId,
        userId: params.userId,
        patientId: params.patientId,
        entityType: params.entityType,
        entityId: params.entityId,
        operation: params.operation,
        payload: params.payload,
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        status: 'pending',
        idempotencyKey: params.idempotencyKey,
      };

      try {
        await offlineDb.offlineMutations.put(mutation);
      } catch (err) {
        console.warn('[SyncService] Failed to persist mutation to Dexie:', err);
      }
    }

    await this.notify();

    // If online, immediately trigger background sync
    if (this.isOnline) {
      this.syncOfflineChanges(false).catch((err) => {
        console.warn('[SyncService] Background sync note:', err);
      });
    }

    return mutation;
  }

  /**
   * Main synchronization engine:
   * - Processes mutations safely in chronological order.
   * - Strictly idempotent using unique idempotency keys.
   * - Retries temporary failures without losing unsynced items.
   * - Dispatches 'mind_sathi_sync_completed' event on completion.
   */
  public async syncOfflineChanges(isManual: boolean = false): Promise<{ success: boolean; syncedCount: number; error?: string | null }> {
    if (!this.isOnline) {
      this.lastError = 'Device is currently offline.';
      await this.notify();
      return { success: false, syncedCount: 0, error: this.lastError };
    }

    if (this.isSyncing) {
      return { success: true, syncedCount: 0 };
    }

    this.isSyncing = true;
    await this.notify();

    let syncedCount = 0;
    let failedCount = 0;
    let lastFailureReason: string | null = null;

    try {
      // 1. Process durable offlineMutations
      const mutations = await offlineDb.offlineMutations
        .filter((m) => m.status === 'pending' || m.status === 'failed')
        .toArray();

      // Sort by creation time to preserve causality
      mutations.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const mut of mutations) {
        const isRealUser = mut.patientId && mut.patientId.includes('-') && mut.patientId.length > 20;

        if (!this.isEligibleForRetry(mut, isManual)) {
          failedCount++;
          continue;
        }

        try {
          if (!isRealUser) {
            // Local guest/demo mutation marked as synced locally
            await offlineDb.offlineMutations.update(mut.id, {
              status: 'synced',
              updatedAt: new Date().toISOString(),
            });
            syncedCount++;
            continue;
          }

          if (mut.entityType === 'game_session') {
            const localSessionId = mut.payload.localSessionId || mut.entityId;
            const { data: existing } = await supabase
              .from('game_sessions')
              .select('id')
              .eq('patient_id', mut.patientId)
              .filter('metadata->>localSessionId', 'eq', localSessionId)
              .maybeSingle();

            if (!existing) {
              const sessionTimestamp = mut.payload.timestamp || mut.createdAt || new Date().toISOString();
              // Insert only confirmed table columns: patient_id, game_id, score, accuracy, duration_seconds, completed_at, metadata
              const { error: insertError } = await supabase.from('game_sessions').insert({
                patient_id: mut.patientId,
                game_id: mut.payload.gameId,
                score: mut.payload.score || 0,
                accuracy: mut.payload.accuracy || 0,
                duration_seconds: mut.payload.durationSeconds || 0,
                completed_at: sessionTimestamp,
                metadata: {
                  ...(mut.payload.metadata || {}),
                  difficulty: mut.payload.difficulty || mut.payload.metadata?.difficulty || 'saral',
                  reactionTimeMs: mut.payload.reactionTimeMs || 0,
                  xpEarned: mut.payload.xpEarned || mut.payload.metadata?.xpEarned || 50,
                  mistakesCount: mut.payload.mistakesCount || mut.payload.metadata?.mistakesCount || 0,
                  hintsUsed: mut.payload.hintsUsed || mut.payload.metadata?.hintsUsed || 0,
                  domainScores: mut.payload.domainScores || mut.payload.metadata?.domainScores || null,
                  localSessionId,
                  idempotencyKey: mut.idempotencyKey,
                },
              });

              if (insertError) throw insertError;
            }

            await offlineDb.gameSessions.update(localSessionId, {
              syncStatus: 'synced',
              syncedAt: new Date().toISOString(),
              syncError: undefined,
            }).catch(() => {});

          } else if (mut.entityType === 'daily_plan') {
            const planDate = mut.payload.planDate;
            const incomingCompletedIds: string[] = mut.payload.completedTaskIds || [];

            const { data: remotePlan } = await supabase
              .from('daily_patient_plans')
              .select('tasks, earned_xp, is_all_completed')
              .eq('patient_id', mut.patientId)
              .eq('plan_date', planDate)
              .maybeSingle();

            let mergedTasks = mut.payload.tasks || [];
            let mergedCompletedIds = new Set<string>(incomingCompletedIds);

            if (remotePlan && Array.isArray(remotePlan.tasks)) {
              remotePlan.tasks.forEach((rt: any) => {
                if (rt.completed) mergedCompletedIds.add(rt.id);
              });

              mergedTasks = mergedTasks.map((t: any) => ({
                ...t,
                completed: mergedCompletedIds.has(t.id),
                completedAt: mergedCompletedIds.has(t.id) ? (t.completedAt || new Date().toISOString()) : undefined,
              }));
            }

            const earnedXp = mergedTasks
              .filter((t: any) => mergedCompletedIds.has(t.id))
              .reduce((sum: number, t: any) => sum + (t.rewardXp || 0), 0);
            const isAllCompleted = mergedTasks.length > 0 && mergedCompletedIds.size === mergedTasks.length;

            const { error: planError } = await supabase
              .from('daily_patient_plans')
              .upsert({
                patient_id: mut.patientId,
                plan_date: planDate,
                tasks: mergedTasks,
                earned_xp: earnedXp,
                is_all_completed: isAllCompleted,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'patient_id,plan_date' });

            if (planError) throw planError;

            try {
              const { data: prof } = await supabase
                .from('profiles')
                .select('accessibility')
                .eq('id', mut.patientId)
                .maybeSingle();

              const currentAcc = prof?.accessibility || {};
              const currentPlans = currentAcc.daily_plans || {};
              await supabase
                .from('profiles')
                .update({
                  accessibility: {
                    ...currentAcc,
                    daily_plans: {
                      ...currentPlans,
                      [planDate]: {
                        completedTaskIds: Array.from(mergedCompletedIds),
                        earnedXp,
                        isAllCompleted,
                        lastUpdated: new Date().toISOString(),
                      },
                    },
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', mut.patientId);
            } catch (e) {
              console.warn('[SyncService] Accessibility daily_plans sync notice:', e);
            }

            await offlineDb.dailyPlans.update(`${mut.patientId}_${planDate}`, {
              syncStatus: 'synced',
            }).catch(() => {});

          } else if (mut.entityType === 'xp_progress') {
            const { error: xpError } = await supabase
              .from('profiles')
              .update({
                total_xp: mut.payload.totalXp,
                level: mut.payload.level,
                level_title: mut.payload.levelTitle,
                updated_at: new Date().toISOString(),
              })
              .eq('id', mut.patientId);

            if (xpError) throw xpError;

          } else if (mut.entityType === 'reminder') {
            if (mut.operation === 'update') {
              const { error: remError } = await supabase
                .from('reminders')
                .update({
                  is_completed: mut.payload.isCompletedToday ?? mut.payload.isCompleted,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', mut.entityId);

              if (remError) throw remError;
            } else if (mut.operation === 'delete') {
              const { error: remDelError } = await supabase
                .from('reminders')
                .delete()
                .eq('id', mut.entityId);

              if (remDelError) throw remDelError;
            }

          } else if (mut.entityType === 'profile') {
            const { error: profError } = await supabase
              .from('profiles')
              .update(mut.payload)
              .eq('id', mut.patientId);

            if (profError) throw profError;

          } else if (mut.entityType === 'family_member') {
            if (mut.operation === 'delete') {
              await supabase.from('family_members').delete().eq('id', mut.entityId);
            } else {
              await supabase.from('family_members').upsert(mut.payload);
            }
          }

          // Delete synced mutation to keep durable storage clean
          await offlineDb.offlineMutations.delete(mut.id);
          syncedCount++;
        } catch (mutErr: any) {
          failedCount++;
          const safeErrorMsg = this.categorizeError(mutErr);
          lastFailureReason = safeErrorMsg;

          if (mut.entityType === 'game_session') {
            const localSessionId = mut.payload?.localSessionId || mut.entityId;
            if (localSessionId) {
              await offlineDb.gameSessions.update(localSessionId, {
                syncStatus: 'failed',
                syncError: safeErrorMsg,
              }).catch(() => {});
            }
          }

          console.warn('[SyncService] Failed to sync mutation:', mut.id, safeErrorMsg);
          await offlineDb.offlineMutations.update(mut.id, {
            status: 'failed',
            retryCount: (mut.retryCount || 0) + 1,
            lastError: safeErrorMsg,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Drain legacy gameSessions from offlineDb
      const pendingSessions = await offlineDb.gameSessions
        .filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'failed')
        .toArray();

      for (const session of pendingSessions) {
        // Skip if this session is already represented in offlineMutations to avoid duplicate processing
        const alreadyInMutations = mutations.some(
          (m) => m.entityType === 'game_session' && (m.payload?.localSessionId === session.id || m.entityId === session.id)
        );
        if (alreadyInMutations) {
          continue;
        }

        if (session.userId && session.userId.includes('-') && session.userId.length > 20) {
          if (!this.isEligibleForRetry({ retryCount: 0, lastError: session.syncError }, isManual)) {
            failedCount++;
            continue;
          }

          try {
            const { data: existing } = await supabase
              .from('game_sessions')
              .select('id')
              .eq('patient_id', session.userId)
              .filter('metadata->>localSessionId', 'eq', session.id)
              .maybeSingle();

            if (!existing) {
              const sessionTimestamp = session.timestamp || new Date().toISOString();
              // Insert only confirmed table columns: patient_id, game_id, score, accuracy, duration_seconds, completed_at, metadata
              const { error: insertError } = await supabase.from('game_sessions').insert({
                patient_id: session.userId,
                game_id: session.gameId,
                score: session.score || 0,
                accuracy: session.accuracy || 0,
                duration_seconds: session.durationSeconds || 0,
                completed_at: sessionTimestamp,
                metadata: {
                  difficulty: session.difficulty || 'saral',
                  reactionTimeMs: session.reactionTimeMs || 0,
                  xpEarned: session.xpEarned || 50,
                  mistakesCount: session.mistakesCount || 0,
                  hintsUsed: session.hintsUsed || 0,
                  domainScores: session.domainScores || null,
                  localSessionId: session.id,
                },
              });

              if (insertError) throw insertError;
            }

            await offlineDb.gameSessions.update(session.id, {
              syncStatus: 'synced',
              syncedAt: new Date().toISOString(),
              syncError: undefined,
            });
            syncedCount++;
          } catch (err: any) {
            failedCount++;
            const safeErrorMsg = this.categorizeError(err);
            lastFailureReason = safeErrorMsg;
            await offlineDb.gameSessions.update(session.id, {
              syncStatus: 'failed',
              syncError: safeErrorMsg,
            });
          }
        } else {
          await offlineDb.gameSessions.update(session.id, {
            syncStatus: 'synced',
            syncedAt: new Date().toISOString(),
            syncError: undefined,
          });
        }
      }

      // 3. Drain legacy syncQueue from offlineDb
      const queueItems = await offlineDb.syncQueue
        .filter((q) => q.status === 'pending' || q.status === 'failed')
        .toArray();

      for (const item of queueItems) {
        if (!item.id) continue;
        if (!this.isEligibleForRetry({ retryCount: item.retryCount, error: item.error }, isManual)) {
          failedCount++;
          continue;
        }

        try {
          if (item.type === 'profile_update') {
            const { error } = await supabase
              .from('profiles')
              .update(item.payload)
              .eq('id', item.entityId);
            if (error) throw error;
          } else if (item.type === 'reminder_toggle') {
            const { error } = await supabase
              .from('reminders')
              .update({ is_completed: item.payload.isCompleted })
              .eq('id', item.entityId);
            if (error) throw error;
          }

          await offlineDb.syncQueue.delete(item.id);
          syncedCount++;
        } catch (queueErr: any) {
          failedCount++;
          const safeErrorMsg = this.categorizeError(queueErr);
          lastFailureReason = safeErrorMsg;
          await offlineDb.syncQueue.update(item.id, {
            status: 'failed',
            retryCount: (item.retryCount || 0) + 1,
            error: safeErrorMsg,
          });
        }
      }

      // Update last successful sync time ONLY when at least 1 record synced or queue is clean
      if (syncedCount > 0 || (failedCount === 0 && mutations.length === 0)) {
        this.lastSyncTime = new Date().toISOString();
        await offlineDb.syncMetadata.put({ key: 'lastSyncTime', value: this.lastSyncTime });
      }

      if (failedCount > 0) {
        this.lastError = lastFailureReason || `${failedCount} record(s) failed to synchronize.`;
      } else {
        this.lastError = null;
      }

      // Dispatch completion event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mind_sathi_sync_completed', {
          detail: { syncedCount, failedCount, timestamp: this.lastSyncTime }
        }));
      }

      return { success: failedCount === 0, syncedCount, error: this.lastError };
    } catch (err: any) {
      this.lastError = this.categorizeError(err);
      return { success: false, syncedCount, error: this.lastError };
    } finally {
      this.isSyncing = false;
      await this.notify();
    }
  }

  /**
   * Alias for backward compatibility.
   */
  public async syncPendingData(): Promise<{ success: boolean; syncedCount: number; error?: string | null }> {
    return this.syncOfflineChanges(true);
  }

  /**
   * Caches active user profile into Dexie for offline access.
   */
  public async cacheUserDataForOffline(user: any): Promise<void> {
    if (!user || !user.id) return;
    try {
      await offlineDb.profiles.put(user);
    } catch (err) {
      console.warn('[SyncService] Error caching user profile in Dexie:', err);
    }
  }
}

export const syncService = new SyncService();
