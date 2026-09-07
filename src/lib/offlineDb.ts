import Dexie, { Table } from 'dexie';
import { GameSession } from '../types/game';
import { UserProfile } from '../types/user';
import { FamilyMember } from '../types/family';
import { Reminder } from '../types/reminder';

export type SyncStatus = 'pending' | 'synced' | 'failed';

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
  type: 'game_session' | 'profile_update' | 'reminder_toggle' | 'family_member';
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

export class MindSathiOfflineDB extends Dexie {
  profiles!: Table<UserProfile, string>;
  gameSessions!: Table<OfflineGameSession, string>;
  familyMembers!: Table<OfflineFamilyMember, string>;
  reminders!: Table<OfflineReminder, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncMetadata!: Table<SyncMetadataItem, string>;

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
  }
}

export const offlineDb = new MindSathiOfflineDB();
