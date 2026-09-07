import { supabase } from '../lib/supabase';
import { offlineDb, OfflineGameSession, SyncQueueItem } from '../lib/offlineDb';
import { authService } from './authService';

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
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.isSyncing = false;
      this.notify();
    });

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
        this.syncPendingData();
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

  public async getPendingCount(): Promise<number> {
    try {
      const pendingSessions = await offlineDb.gameSessions
        .filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'failed')
        .count();
      const pendingQueue = await offlineDb.syncQueue
        .filter((q) => q.status === 'pending' || q.status === 'failed')
        .count();
      return pendingSessions + pendingQueue;
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
    } else if (this.lastError && pendingCount > 0) {
      state = 'sync-failed';
    } else if (pendingCount > 0) {
      state = 'syncing'; // Will sync momentarily
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
   * Synchronizes all pending records to Supabase.
   * - Uses real authenticated Supabase UUIDs.
   * - Idempotent to prevent duplicate records using localSessionId.
   * - Dispatches 'mind_sathi_sync_completed' event to refresh caregiver telemetry.
   */
  public async syncPendingData(): Promise<{ success: boolean; syncedCount: number; error?: string | null }> {
    if (!this.isOnline) {
      this.lastError = 'Device is currently offline.';
      await this.notify();
      return { success: false, syncedCount: 0, error: this.lastError };
    }

    if (this.isSyncing) {
      return { success: true, syncedCount: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    await this.notify();

    let syncedCount = 0;

    try {
      // 1. Fetch pending game sessions
      const pendingSessions = await offlineDb.gameSessions
        .filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'failed')
        .toArray();

      for (const session of pendingSessions) {
        // Only push real user UUIDs to Supabase
        if (session.userId && session.userId.includes('-') && session.userId.length > 20) {
          try {
            // Idempotency check: check if already exists in Supabase
            const { data: existing } = await supabase
              .from('game_sessions')
              .select('id')
              .eq('patient_id', session.userId)
              .filter('metadata->>localSessionId', 'eq', session.id)
              .maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase.from('game_sessions').insert({
                patient_id: session.userId,
                game_id: session.gameId,
                score: session.score,
                accuracy: session.accuracy,
                duration_seconds: session.durationSeconds,
                metadata: {
                  mistakesCount: session.mistakesCount,
                  hintsUsed: session.hintsUsed,
                  difficulty: session.difficulty,
                  xpEarned: session.xpEarned,
                  domainScores: session.domainScores,
                  reactionTimeMs: session.reactionTimeMs,
                  localSessionId: session.id,
                },
                created_at: session.timestamp,
              });

              if (insertError) {
                console.warn('[SyncService] Session upload error:', insertError);
                throw insertError;
              }
            }

            // Mark record as synced in Dexie
            await offlineDb.gameSessions.update(session.id, {
              syncStatus: 'synced',
              syncedAt: new Date().toISOString(),
              syncError: undefined,
            });
            syncedCount++;
          } catch (err: any) {
            console.warn('[SyncService] Failed to sync session:', session.id, err);
            await offlineDb.gameSessions.update(session.id, {
              syncStatus: 'failed',
              syncError: err.message || 'Sync failed',
            });
            throw err;
          }
        } else {
          // Non-UUID session (e.g. guest mode) marked as synced locally
          await offlineDb.gameSessions.update(session.id, {
            syncStatus: 'synced',
            syncedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Fetch pending sync queue items (profile updates, reminder completions, etc.)
      const queueItems = await offlineDb.syncQueue
        .filter((q) => q.status === 'pending' || q.status === 'failed')
        .toArray();

      for (const item of queueItems) {
        if (!item.id) continue;
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

          // Delete processed queue item
          await offlineDb.syncQueue.delete(item.id);
          syncedCount++;
        } catch (queueErr: any) {
          await offlineDb.syncQueue.update(item.id, {
            status: 'failed',
            retryCount: (item.retryCount || 0) + 1,
            error: queueErr.message || 'Sync error',
          });
        }
      }

      // 3. Update last successful sync time
      this.lastSyncTime = new Date().toISOString();
      await offlineDb.syncMetadata.put({ key: 'lastSyncTime', value: this.lastSyncTime });

      // 4. Notify all components & refresh caregiver dashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mind_sathi_sync_completed', {
          detail: { syncedCount, timestamp: this.lastSyncTime }
        }));
      }

      this.isSyncing = false;
      this.lastError = null;
      await this.notify();
      return { success: true, syncedCount };
    } catch (err: any) {
      this.isSyncing = false;
      this.lastError = err?.message || 'Synchronization failed. Network interrupted.';
      await this.notify();
      return { success: false, syncedCount, error: this.lastError };
    }
  }

  /**
   * Caches active user profile and related data into Dexie for offline use.
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
