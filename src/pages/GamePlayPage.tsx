import React from 'react';
import { GameId, DifficultyTier } from '../types/game';
import { MemoryMatchGame } from '../components/games/MemoryMatchGame';
import { WordAssociationGame } from '../components/games/WordAssociationGame';
import { PatternSequenceGame } from '../components/games/PatternSequenceGame';
import { MarketMathGame } from '../components/games/MarketMathGame';
import { FocusVigilanceGame } from '../components/games/FocusVigilanceGame';
import { SpatialOrientationGame } from '../components/games/SpatialOrientationGame';
import { FamilyRecognitionGame } from '../components/games/FamilyRecognitionGame';
import { NortheastCulturalGames } from '../components/games/NortheastCulturalGames';
import { useLanguage } from '../hooks/useLanguage';
import { ArrowLeft, Sparkles } from 'lucide-react';

const NE_GAME_IDS: GameId[] = [
  'ne_states_memory', 'guess_the_place', 'culture_match',
  'food_memory', 'nature_memory', 'festival_memory',
];

const KNOWN_GAME_IDS: GameId[] = [
  'smriti_sangam',
  'shabda_mala',
  'rangoli_rekha',
  'bazaar_hisaab',
  'dhyan_kendra',
  'disha_sathi',
  'family_memory',
  'sequence_memory',
  'object_recognition',
  'word_recall',
  'number_pattern',
  'daily_challenge',
  ...NE_GAME_IDS,
];

interface GamePlayPageProps {
  gameId: GameId;
  difficulty?: DifficultyTier;
  onBack: () => void;
}

export const GamePlayPage: React.FC<GamePlayPageProps> = ({ gameId, difficulty = 'saral', onBack }) => {
  const { t } = useLanguage();

  const isUnknownGame = !KNOWN_GAME_IDS.includes(gameId);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top back button */}
      <div>
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-bold px-4 py-2.5 rounded-2xl shadow-sm border border-gray-300 transition-all cursor-pointer text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.common.back}</span>
        </button>
      </div>

      {/* Standard Cognitive Games */}
      {gameId === 'smriti_sangam' && <MemoryMatchGame initialDifficulty={difficulty} onExit={onBack} />}
      {gameId === 'shabda_mala' && <WordAssociationGame initialDifficulty={difficulty} />}
      {gameId === 'rangoli_rekha' && <PatternSequenceGame initialDifficulty={difficulty} />}
      {gameId === 'bazaar_hisaab' && <MarketMathGame initialDifficulty={difficulty} />}
      {gameId === 'dhyan_kendra' && <FocusVigilanceGame initialDifficulty={difficulty} />}
      {gameId === 'disha_sathi' && <SpatialOrientationGame initialDifficulty={difficulty} />}
      {gameId === 'family_memory' && <FamilyRecognitionGame initialDifficulty={difficulty} onExit={onBack} />}

      {/* Daily Plan Schedule Mapped Games */}
      {gameId === 'sequence_memory' && <PatternSequenceGame initialDifficulty={difficulty} />}
      {gameId === 'object_recognition' && <MemoryMatchGame initialDifficulty={difficulty} onExit={onBack} />}
      {gameId === 'word_recall' && <WordAssociationGame initialDifficulty={difficulty} />}
      {gameId === 'number_pattern' && <MarketMathGame initialDifficulty={difficulty} />}
      {gameId === 'daily_challenge' && <MemoryMatchGame initialDifficulty={difficulty} onExit={onBack} />}

      {/* Northeast Cultural Games */}
      {NE_GAME_IDS.includes(gameId) && (
        <NortheastCulturalGames gameId={gameId} difficulty={difficulty} onExit={onBack} />
      )}

      {/* Resilient Fallback Engine: Prevents blank screen for any unanticipated game ID */}
      {isUnknownGame && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-sm flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Starting adaptive cognitive exercise</p>
              <p className="text-xs text-amber-700 mt-1">
                Launching our cognitive memory exercise engine for your scheduled activity.
              </p>
            </div>
          </div>
          <MemoryMatchGame initialDifficulty={difficulty} onExit={onBack} />
        </div>
      )}
    </div>
  );
};
