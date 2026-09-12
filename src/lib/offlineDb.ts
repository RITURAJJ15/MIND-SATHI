import Dexie, { Table } from 'dexie';
import { GameSession } from '../types/game';
import { UserProfile } from '../types/user';
import { FamilyMember } from '../types/family';
import { Reminder } from '../types/reminder';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineGameSession extends GameSession {
  syncStatus: SyncStatus;
  syncError?: string;
  syncedAt?: string;
}

export interface OfflineFamilyMember extends FamilyMember {
  syncStatus: SyncStatus;
  updatedAt?: string;
}

export interface OfflineReminder extends Reminder {
  syncStatus: SyncStatus;
  updatedAt?: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'game_session' | 'profile_update' | 'reminder_toggle' | 'family_member' | 'daily_plan' | 'xp_progress';
  entityId: string;
  payload: any;
  timestamp: string;
  status: SyncStatus;
  retryCount: number;
  error?: string;
}

export interface SyncMetadataItem {
  key: string;
  value: any;
}

export interface OfflineMutation {
  id: string;
  userId?: string;
  patientId: string;
  entityType: 'game_session' | 'daily_plan' | 'xp_progress' | 'reminder' | 'profile' | 'family_member';
  entityId: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  payload: any;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
  idempotencyKey: string;
}

export interface OfflineDailyPlan {
  patientIdAndDate: string; // Composite key: `${patientId}_${planDate}`
  patientId: string;
  planDate: string;
  completedTaskIds: string[];
  earnedXp: number;
  isAllCompleted: boolean;
  lastUpdated: string;
  syncStatus: SyncStatus;
}

export class MindSathiOfflineDB extends Dexie {
  profiles!: Table<UserProfile, string>;
  gameSessions!: Table<OfflineGameSession, string>;
  familyMembers!: Table<OfflineFamilyMember, string>;
  reminders!: Table<OfflineReminder, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncMetadata!: Table<SyncMetadataItem, string>;
  offlineMutations!: Table<OfflineMutation, string>;
  dailyPlans!: Table<OfflineDailyPlan, string>;

  constructor() {
    super('MindSathiOfflineDB');

    this.version(1).stores({
      profiles: 'id, role, email, phone, updatedAt',
      gameSessions: 'id, userId, gameId, score, accuracy, timestamp, syncStatus',
      familyMembers: 'id, userId, name, relationship, syncStatus',
      reminders: 'id, userId, time, syncStatus',
      syncQueue: '++id, type, entityId, status, timestamp, retryCount',
      syncMetadata: 'key',
    });

    this.version(2).stores({
      profiles: 'id, role, email, phone, updatedAt',
      gameSessions: 'id, userId, gameId, score, accuracy, timestamp, syncStatus',
      familyMembers: 'id, userId, name, relationship, syncStatus',
      reminders: 'id, userId, time, syncStatus',
      syncQueue: '++id, type, entityId, status, timestamp, retryCount',
      syncMetadata: 'key',
      offlineMutations: 'id, patientId, entityType, entityId, operation, status, idempotencyKey, createdAt',
      dailyPlans: 'patientIdAndDate, patientId, planDate, lastUpdated, syncStatus',
    });
  }
}

export const offlineDb = new MindSathiOfflineDB();

