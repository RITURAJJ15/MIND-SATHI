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
import { ArrowLeft } from 'lucide-react';

const NE_GAME_IDS: GameId[] = [
  'ne_states_memory', 'guess_the_place', 'culture_match',
  'food_memory', 'nature_memory', 'festival_memory',
];

interface GamePlayPageProps {
  gameId: GameId;
  difficulty?: DifficultyTier;
  onBack: () => void;
}

export const GamePlayPage: React.FC<GamePlayPageProps> = ({ gameId, difficulty = 'saral', onBack }) => {
  const { t } = useLanguage();

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

      {/* Northeast Cultural Games */}
      {NE_GAME_IDS.includes(gameId) && (
        <NortheastCulturalGames gameId={gameId} difficulty={difficulty} onExit={onBack} />
      )}
    </div>
  );
};
