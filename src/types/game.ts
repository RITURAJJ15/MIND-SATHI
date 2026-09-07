export type CognitiveDomain = 
  | 'memory'           // Short-term, episodic & recognition memory
  | 'language'         // Vocabulary, semantic fluency, verbal retrieval
  | 'working_memory'   // Sequential recall, pattern retention
  | 'executive'        // Everyday math, problem solving, decision making
  | 'attention'        // Processing speed, vigilance, visual reaction
  | 'visuospatial'     // Clock orientation, spatial navigation
  | 'northeast_culture'// Northeast cultural heritage, geography & traditions
  | 'family_reminiscence'; // Personal and family face/name recall

export type DifficultyTier = 'saral' | 'madhyam' | 'nipun'; // Easy, Medium, Challenging

export type GameId = 
  // Standard & Existing Cognitive Games
  | 'smriti_sangam'    // Memory Match
  | 'shabda_mala'      // Word Association
  | 'rangoli_rekha'    // Pattern Sequence
  | 'bazaar_hisaab'    // Daily Market Math
  | 'dhyan_kendra'     // Focus & Reaction
  | 'disha_sathi'      // Spatial & Orientation
  | 'sequence_memory'  // Sequence Memory Reproduction
  | 'object_recognition' // Object Recognition
  | 'word_recall'      // Word Recall
  | 'number_pattern'   // Number / Pattern Math Game
  | 'daily_challenge'  // Daily Memory Challenge
  | 'family_memory'    // Family Member Recall Game
  // Northeast India Cultural Cognitive Games
  | 'ne_states_memory' // Northeast States & Capitals Match
  | 'guess_the_place'  // Guess the Landmark
  | 'culture_match'    // Cultural Objects & Textiles Match
  | 'food_memory'      // Traditional Northeast Cuisine Memory
  | 'nature_memory'    // Northeast Wildlife & Landscapes
  | 'festival_memory'; // Northeast Festivals & Traditions

export interface GameMetadata {
  id: GameId;
  category?: 'cognitive' | 'northeast_culture' | 'family';
  title: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  tagline: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  domain: CognitiveDomain;
  domainLabel: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  iconName: string;
  accentColor: string;
  bgGradient: string;
  durationMinutes: number;
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  description: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  instructions: {
    en: string[];
    hi: string[];
    as: string[];
    [key: string]: string[];
  };
}

export interface GameSession {
  id: string;
  gameId: GameId;
  userId: string;
  timestamp: string;
  durationSeconds: number;
  score: number;
  accuracy: number; // 0 to 100 percentage
  reactionTimeMs?: number;
  difficulty: DifficultyTier;
  completed: boolean;
  xpEarned: number;
  mistakesCount: number;
  hintsUsed: number;
  domainScores: Partial<Record<CognitiveDomain, number>>; // normalized 0-100
}

export interface GameRecommendation {
  gameId: GameId;
  priority: 'high' | 'medium' | 'routine';
  reason: {
    en: string;
    hi: string;
    as: string;
    [key: string]: string;
  };
  suggestedDifficulty: DifficultyTier;
  targetDomain: CognitiveDomain;
}
