import React, { useState, useEffect, useRef } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { familyService } from '../../services/familyService';
import { authService } from '../../services/authService';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { GameSummaryModal } from './GameSummaryModal';
import { DifficultyBadge } from './DifficultyBadge';
import { Sparkles, Users, RefreshCw } from 'lucide-react';

interface CardItem {
  id: string;
  key: string;
  name: { en: string; hi: string; as: string; [key: string]: string };
  emojiOrImage: string;
  isImage: boolean;
  isFlipped: boolean;
  isMatched: boolean;
}

const CULTURAL_ITEMS = [
  { key: 'diya', name: { en: 'Golden Diya', hi: 'दीपक (दीया)', as: 'বন্তি (চাকি)' }, val: '🪔' },
  { key: 'lotus', name: { en: 'Sacred Lotus', hi: 'कमल का फूल', as: 'পদুম ফুল' }, val: '🪷' },
  { key: 'tea', name: { en: 'Kulhad Chai', hi: 'कुल्हड़ चाय', as: 'গৰম চাহ' }, val: '☕' },
  { key: 'peacock', name: { en: 'Peacock Feather', hi: 'मोर पंख', as: 'ময়ূৰৰ পাখি' }, val: '🪶' },
  { key: 'music', name: { en: 'Sitar & Music', hi: 'सितार एवं संगीत', as: 'সংগীত আৰু সুৰ' }, val: '🪕' },
  { key: 'sweet', name: { en: 'Diwali Laddoo', hi: 'मोतीचूर लड्डू', as: 'লাডু' }, val: '🧆' },
  { key: 'tree', name: { en: 'Banyan Tree', hi: 'बरगद का वृक्ष', as: 'বৰগছ' }, val: '🌳' },
  { key: 'bell', name: { en: 'Temple Bell', hi: 'मंदिर की घंटी', as: 'মন্দিৰৰ ঘণ্টা' }, val: '🔔' },
];

export const MemoryMatchGame: React.FC<{ initialDifficulty?: DifficultyTier; onExit?: () => void }> = ({
  initialDifficulty = 'saral',
}) => {
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [useFamilyPhotos, setUseFamilyPhotos] = useState<boolean>(false);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchesFound, setMatchesFound] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [completedSession, setCompletedSession] = useState<{ session: GameSession; leveledUp: boolean } | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize or reset board
  const setupBoard = (diff: DifficultyTier, withFamily: boolean) => {
    isProcessingRef.current = false;
    setFlippedCards([]);
    setMatchesFound(0);
    setMoves(0);
    setMistakes(0);
    setCompletedSession(null);
    setStartTime(Date.now());

    let pairCount = 4; // saral = 4 pairs (8 cards)
    if (diff === 'madhyam') pairCount = 6; // 12 cards
    if (diff === 'nipun') pairCount = 8; // 16 cards

    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    const memories = familyService.getMemoriesForUser(currentUser.id);

    let selectedItems: { key: string; name: { en: string; hi: string; as: string }; val: string; isImage: boolean }[] = [];

    if (withFamily && memories.length >= 3) {
      const memItems = memories.slice(0, pairCount).map((m) => ({
        key: m.id,
        name: { en: m.title, hi: m.title, as: m.title },
        val: m.photoUrl,
        isImage: true,
      }));
      // If memories fewer than pairCount, pad with cultural items
      if (memItems.length < pairCount) {
        const extraCultural = CULTURAL_ITEMS.slice(0, pairCount - memItems.length).map((c) => ({
          key: c.key,
          name: c.name,
          val: c.val,
          isImage: false,
        }));
        selectedItems = [...memItems, ...extraCultural];
      } else {
        selectedItems = memItems;
      }
    } else {
      selectedItems = CULTURAL_ITEMS.slice(0, pairCount).map((c) => ({
        key: c.key,
        name: c.name,
        val: c.val,
        isImage: false,
      }));
    }

    // Create duplicated paired cards and shuffle
    const paired: CardItem[] = [];
    selectedItems.forEach((item, index) => {
      paired.push({
        id: `card-${index}-a`,
        key: item.key,
        name: item.name,
        emojiOrImage: item.val,
        isImage: item.isImage,
        isFlipped: false,
        isMatched: false,
      });
      paired.push({
        id: `card-${index}-b`,
        key: item.key,
        name: item.name,
        emojiOrImage: item.val,
        isImage: item.isImage,
        isFlipped: false,
        isMatched: false,
      });
    });

    // Shuffle
    const shuffled = [...paired].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  };

  useEffect(() => {
    setupBoard(difficulty, useFamilyPhotos);
  }, [difficulty, useFamilyPhotos]);

  const handleCardClick = (index: number) => {
    if (isProcessingRef.current) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;

    soundService.playCardFlip();

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, index];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      isProcessingRef.current = true;
      setMoves((m) => m + 1);

      const [firstIdx, secondIdx] = newFlipped;
      const cardA = newCards[firstIdx];
      const cardB = newCards[secondIdx];

      if (cardA.key === cardB.key) {
        // MATCH FOUND!
        setTimeout(() => {
          soundService.playMatchSuccess();
          newCards[firstIdx].isMatched = true;
          newCards[secondIdx].isMatched = true;
          setCards([...newCards]);
          setFlippedCards([]);
          setMatchesFound((prev) => {
            const updated = prev + 1;
            const totalPairs = cards.length / 2;
            if (updated === totalPairs) {
              handleGameComplete();
            }
            return updated;
          });
          isProcessingRef.current = false;
        }, 500);
      } else {
        // MISMATCH
        setMistakes((m) => m + 1);
        setTimeout(() => {
          soundService.playSoftMistake();
          newCards[firstIdx].isFlipped = false;
          newCards[secondIdx].isFlipped = false;
          setCards([...newCards]);
          setFlippedCards([]);
          isProcessingRef.current = false;
        }, 1100);
      }
    }
  };

  const handleGameComplete = () => {
    const durationSeconds = Math.max(10, Math.round((Date.now() - startTime) / 1000));
    const totalPairs = cards.length / 2;
    // Accuracy calculation
    const totalAttempts = moves + 1;
    const accuracy = Math.min(100, Math.max(50, Math.round((totalPairs / Math.max(totalPairs, totalAttempts)) * 100)));

    const result = gameService.recordSession({
      gameId: 'smriti_sangam',
      durationSeconds,
      accuracy,
      mistakesCount: mistakes,
      hintsUsed: 0,
      difficulty,
      reactionTimeMs: Math.round((durationSeconds * 1000) / (moves * 2 || 1)),
    });

    setCompletedSession(result);
  };

  const instructionText = currentLang === 'hi'
    ? 'कार्डों को छूकर उनके जोड़े खोजें। जितनी कम चालों में आप सभी जोड़ियां बनाएंगे, उतना अधिक लाभ होगा।'
    : currentLang === 'as'
    ? 'কাৰ্ডত স্পৰ্শ কৰি একে জোৰা বিচাৰক। মনত ৰাখি খেলক।'
    : 'Tap cards to reveal pairs. Match all pairs to complete the session.';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Game Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-elder border border-amber-200 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {currentLang === 'hi' ? 'स्मृति संगम (Memory Match)' : currentLang === 'as' ? 'স্মৃতি সংগম (Memory Match)' : 'Smriti Sangam (Memory Match)'}
            </h1>
            <DifficultyBadge difficulty={difficulty} />
            <VoicePromptButton text={instructionText} size="sm" />
          </div>
          <p className="text-gray-600 text-sm">{instructionText}</p>
        </div>

        {/* Toggles: Family Photos vs Cultural and Difficulty */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setUseFamilyPhotos(!useFamilyPhotos)}
            type="button"
            className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              useFamilyPhotos
                ? 'bg-sathi-600 text-white shadow-md'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{currentLang === 'hi' ? 'पारिवारिक फोटो' : currentLang === 'as' ? 'পৰিয়ালৰ ছবি' : 'Family Photos'}</span>
          </button>

          <button
            onClick={() => setupBoard(difficulty, useFamilyPhotos)}
            type="button"
            className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
            title="Restart board"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Score and Stats Pill */}
      <div className="grid grid-cols-3 gap-3 mb-6 text-center">
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200">
          <span className="text-xs text-gray-500 font-bold uppercase">{currentLang === 'hi' ? 'जोड़ी बनी' : currentLang === 'as' ? 'জোৰা মিলিল' : 'Matches'}</span>
          <p className="text-2xl font-extrabold text-sathi-600">{matchesFound} / {cards.length / 2}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200">
          <span className="text-xs text-gray-500 font-bold uppercase">{currentLang === 'hi' ? 'चालें' : currentLang === 'as' ? 'চাল' : 'Moves'}</span>
          <p className="text-2xl font-extrabold text-gray-800">{moves}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200">
          <span className="text-xs text-gray-500 font-bold uppercase">{currentLang === 'hi' ? 'कठिनाई' : currentLang === 'as' ? 'কঠিনতা' : 'Tier'}</span>
          <div className="flex justify-center gap-1 mt-1">
            {(['saral', 'madhyam', 'nipun'] as DifficultyTier[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                  difficulty === d ? 'bg-sathi-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {d === 'saral' ? '1' : d === 'madhyam' ? '2' : '3'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div
        className={`grid gap-2 xs:gap-3 sm:gap-4 justify-center ${
          cards.length <= 8
            ? 'grid-cols-2 sm:grid-cols-4'
            : cards.length <= 12
            ? 'grid-cols-3 sm:grid-cols-4'
            : 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-4'
        }`}
      >
        {cards.map((card, idx) => {
          const isOpen = card.isFlipped || card.isMatched;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(idx)}
              disabled={isOpen}
              type="button"
              className={`h-24 xs:h-28 sm:h-36 rounded-2xl sm:rounded-3xl font-extrabold flex flex-col items-center justify-center transition-all duration-300 transform select-none relative overflow-hidden cursor-pointer shadow-elder ${
                card.isMatched
                  ? 'bg-emerald-50 border-3 sm:border-4 border-emerald-400 opacity-90 scale-95'
                  : isOpen
                  ? 'bg-amber-50 border-3 sm:border-4 border-sathi-400 rotate-0'
                  : 'bg-gradient-to-br from-sathi-500 to-sathi-700 hover:from-sathi-600 hover:to-sathi-800 text-white border-3 sm:border-4 border-sathi-300 hover:scale-[1.02] shadow-tactile'
              }`}
              aria-label={isOpen ? card.name[currentLang] || card.name.en : 'Hidden Card'}
            >
              {isOpen ? (
                card.isImage ? (
                  <div className="w-full h-full p-1 xs:p-1.5 flex flex-col items-center justify-center">
                    <img
                      src={card.emojiOrImage}
                      alt={card.name.en}
                      className="w-full h-16 xs:h-20 sm:h-24 object-cover rounded-xl sm:rounded-2xl"
                    />
                    <span className="text-[10px] xs:text-[11px] sm:text-xs text-gray-800 font-bold truncate mt-1 max-w-[85px] xs:max-w-[100px]">
                      {card.name[currentLang] || card.name.en}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-3xl xs:text-4xl sm:text-5xl mb-0.5 sm:mb-1">{card.emojiOrImage}</span>
                    <span className="text-[10px] xs:text-xs sm:text-sm text-gray-800 font-bold px-1 text-center line-clamp-1">
                      {card.name[currentLang] || card.name.en}
                    </span>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-amber-100">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 opacity-75 animate-pulse-subtle" />
                  <span className="text-[10px] sm:text-xs font-bold mt-1 tracking-widest uppercase opacity-90">
                    {currentLang === 'hi' ? 'खोलो' : currentLang === 'as' ? 'খোলা' : 'OPEN'}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Completion Modal */}
      {completedSession && (
        <GameSummaryModal
          session={completedSession.session}
          leveledUp={completedSession.leveledUp}
          onPlayAgain={() => setupBoard(difficulty, useFamilyPhotos)}
          onContinue={() => setupBoard(difficulty, useFamilyPhotos)}
        />
      )}
    </div>
  );
};
