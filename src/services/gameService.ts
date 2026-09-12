import { CognitiveDomain, DifficultyTier, GameId, GameSession } from '../types/game';
import { authService } from './authService';
import { profileService } from './profileService';
import { soundService } from './soundService';
import { dailyPlanService } from './dailyPlanService';
import { supabase } from '../lib/supabase';
import { offlineDb } from '../lib/offlineDb';
import { syncService } from './syncService';

const STORAGE_KEY_SESSIONS = 'mind_sathi_game_sessions';

// Default initial sessions is empty for genuine user gameplay telemetry
const DEFAULT_INITIAL_SESSIONS: GameSession[] = [];

class GameService {
  private sessions: GameSession[];

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GameSession[];
        this.sessions = parsed.filter((s) => s.userId !== 'e1000000-0000-4000-a000-000000000001' && !s.id.startsWith('sess-'));
      } catch {
        this.sessions = [];
      }
    } else {
      this.sessions = [];
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify([]));
    }

    // Load Dexie stored sessions to ensure complete offline persistence
    if (typeof window !== 'undefined') {
      offlineDb.gameSessions.toArray().then((dexieSessions) => {
        if (dexieSessions && dexieSessions.length > 0) {
          const existingIds = new Set(this.sessions.map((s) => s.id));
          dexieSessions.forEach((ds) => {
            if (!existingIds.has(ds.id)) {
              this.sessions.push(ds);
            }
          });
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(this.sessions));
        }
      }).catch((e) => console.warn('[GameService] Dexie restore notice:', e));
    }
  }

  public getAllSessions(): GameSession[] {
    return [...this.sessions];
  }

  public getSessionsForUser(userId: string): GameSession[] {
    return this.sessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public recordSession(params: {
    gameId: GameId;
    durationSeconds: number;
    accuracy: number;
    mistakesCount: number;
    hintsUsed: number;
    difficulty: DifficultyTier;
    reactionTimeMs?: number;
  }): { session: GameSession; xpEarned: number; leveledUp: boolean } {
    const user = authService.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    // Base XP calculation based on difficulty and accuracy
    let baseMultiplier = 1.0;
    if (params.difficulty === 'madhyam') baseMultiplier = 1.3;
    if (params.difficulty === 'nipun') baseMultiplier = 1.6;

    const rawScore = Math.round(params.accuracy * 0.8 + (100 - Math.min(params.mistakesCount * 10, 50)) * 0.2);
    const xpEarned = Math.round((40 + Math.floor(params.accuracy * 0.4)) * baseMultiplier);

    // Get current domain scores or defaults
    const currentDomainScores = this.calculateDomainScores(user.id);

    // Map game to primary cognitive domain
    const gameDomainMap: Record<GameId, CognitiveDomain> = {
      smriti_sangam: 'memory',
      shabda_mala: 'language',
      rangoli_rekha: 'working_memory',
      bazaar_hisaab: 'executive',
      dhyan_kendra: 'attention',
      disha_sathi: 'visuospatial',
      sequence_memory: 'working_memory',
      object_recognition: 'memory',
      word_recall: 'language',
      number_pattern: 'executive',
      daily_challenge: 'memory',
      family_memory: 'family_reminiscence',
      ne_states_memory: 'northeast_culture',
      guess_the_place: 'northeast_culture',
      culture_match: 'northeast_culture',
      food_memory: 'northeast_culture',
      nature_memory: 'northeast_culture',
      festival_memory: 'northeast_culture',
    };
    const primaryDomain = gameDomainMap[params.gameId] || 'memory';

    // Increment primary domain slightly based on accuracy
    const domainScores = { ...currentDomainScores };
    const currentVal = domainScores[primaryDomain] || 75;
    const delta = params.accuracy >= 80 ? 2 : params.accuracy >= 60 ? 1 : -1;
    domainScores[primaryDomain] = Math.max(40, Math.min(98, currentVal + delta));

    const newSession: GameSession = {
      id: `sess-${Date.now()}`,
      gameId: params.gameId,
      userId: user.id,
      timestamp: new Date().toISOString(),
      durationSeconds: params.durationSeconds,
      score: rawScore,
      accuracy: params.accuracy,
      reactionTimeMs: params.reactionTimeMs,
      difficulty: params.difficulty,
      completed: true,
      xpEarned,
      mistakesCount: params.mistakesCount,
      hintsUsed: params.hintsUsed,
      domainScores,
    };

    this.sessions.push(newSession);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(this.sessions));

    // Offline-first save: Write to Dexie IndexedDB with 'pending' syncStatus
    offlineDb.gameSessions.put({
      ...newSession,
      syncStatus: 'pending',
    }).catch((dexieErr) => {
      console.warn('[GameService] Dexie write warning:', dexieErr);
    });

    // Record durable mutation in Dexie offlineMutations queue
    syncService.recordMutation({
      userId: user.id,
      patientId: user.id,
      entityType: 'game_session',
      entityId: newSession.id,
      operation: 'insert',
      payload: {
        ...newSession,
        localSessionId: newSession.id,
      },
      idempotencyKey: `${user.id}_game_session_${newSession.id}_insert`,
    }).catch((mutErr) => {
      console.warn('[GameService] Mutation queue note:', mutErr);
    });

    // Award XP and check level
    const { leveledUp } = profileService.addXpToCurrentUser(xpEarned);
    soundService.playVictoryFanfare();

    // Auto-complete corresponding task in daily plan
    try {
      dailyPlanService.onGameCompleted(user.id, params.gameId);
    } catch (e) {
      console.warn('[GameService] Daily plan auto-complete error:', e);
    }

    return { session: newSession, xpEarned, leveledUp };
  }

  public async syncSessionsFromDb(userId: string): Promise<GameSession[]> {
    if (userId && userId.includes('-') && userId.length > 20) {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('patient_id', userId)
          .order('completed_at', { ascending: false });

        if (data && !error && data.length > 0) {
          const mapped: GameSession[] = data.map((d) => ({
            id: d.id,
            gameId: d.game_id as GameId,
            userId: d.patient_id,
            timestamp: d.completed_at,
            durationSeconds: d.duration_seconds || 0,
            score: d.score,
            accuracy: Number(d.accuracy) || 100,
            difficulty: (d.metadata?.difficulty || 'saral') as DifficultyTier,
            completed: true,
            xpEarned: d.metadata?.xpEarned || 50,
            mistakesCount: d.metadata?.mistakesCount || 0,
            hintsUsed: d.metadata?.hintsUsed || 0,
            domainScores: d.metadata?.domainScores,
          }));

          this.sessions = [
            ...this.sessions.filter((s) => s.userId !== userId),
            ...mapped,
          ];
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(this.sessions));
          return mapped;
        }
      } catch (err) {
        console.warn('[GameService] Error syncing game sessions from Supabase:', err);
      }
    }
    return this.getSessionsForUser(userId);
  }

  public calculateDomainScores(userId: string): Record<CognitiveDomain, number> {
    const userSessions = this.getSessionsForUser(userId);
    const baselineScores: Record<CognitiveDomain, number> = {
      memory: 75,
      language: 75,
      working_memory: 75,
      executive: 75,
      attention: 75,
      visuospatial: 75,
      northeast_culture: 75,
      family_reminiscence: 75,
    };

    if (userSessions.length === 0) {
      return baselineScores;
    }

    // Average the domain scores across all recorded sessions
    const domainTotals: Record<string, { sum: number; count: number }> = {};
    const domains: CognitiveDomain[] = [
      'memory',
      'language',
      'working_memory',
      'executive',
      'attention',
      'visuospatial',
      'northeast_culture',
      'family_reminiscence',
    ];

    domains.forEach((d) => {
      domainTotals[d] = { sum: 0, count: 0 };
    });

    userSessions.forEach((s) => {
      if (s.domainScores) {
        domains.forEach((d) => {
          if (s.domainScores![d] !== undefined) {
            domainTotals[d].sum += s.domainScores![d]!;
            domainTotals[d].count += 1;
          }
        });
      }
    });

    const result = { ...baselineScores };
    domains.forEach((d) => {
      if (domainTotals[d].count > 0) {
        result[d] = Math.round(domainTotals[d].sum / domainTotals[d].count);
      }
    });

    return result;
  }
}

export const gameService = new GameService();
