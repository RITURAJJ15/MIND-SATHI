import React, { useState, useEffect, useRef } from 'react';
import { DifficultyTier, GameSession } from '../../types/game';
import { FamilyMember } from '../../types/family';
import { soundService } from '../../services/soundService';
import { gameService } from '../../services/gameService';
import { familyService } from '../../services/familyService';
import { authService } from '../../services/authService';
import { storageService } from '../../services/storageService';
import { MOCK_FAMILY_MEMBERS } from '../../data/mockFamily';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeech } from '../../hooks/useSpeech';
import { VoicePromptButton } from '../common/VoicePromptButton';
import { GameSummaryModal } from './GameSummaryModal';
import { DifficultyBadge } from './DifficultyBadge';
import {
  Users,
  HeartHandshake,
  Lightbulb,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Camera,
  Upload,
  Plus,
  Loader2,
  X,
} from 'lucide-react';

interface Question {
  id: string;
  type: 'identify_name' | 'identify_photo' | 'identify_relation';
  prompt: { en: string; hi: string; as: string };
  targetMember: FamilyMember;
  options: {
    id: string;
    label: string;
    photoUrl?: string;
    isCorrect: boolean;
  }[];
  hint: { en: string; hi: string; as: string };
}

function getRelationshipLabel(
  rel: FamilyMember['relationship'] | undefined,
  lang: string = 'en'
): string {
  if (!rel) return 'Family Member';
  if (typeof rel === 'string') return rel;
  if (typeof rel === 'object') {
    return rel[lang] || rel.en || Object.values(rel)[0] || 'Family Member';
  }
  return 'Family Member';
}

interface FamilyRecognitionGameProps {
  initialDifficulty?: DifficultyTier;
  onExit?: () => void;
}

export const FamilyRecognitionGame: React.FC<FamilyRecognitionGameProps> = ({
  initialDifficulty = 'saral',
  onExit,
}) => {
  const { currentLang } = useLanguage();
  const { speakText } = useSpeech();

  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<string[]>([]);

  // Performance metrics
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [completedSession, setCompletedSession] = useState<{
    session: GameSession;
    leveledUp: boolean;
  } | null>(null);

  // In-game quick add family member state
  const [showInGameAddModal, setShowInGameAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('Son');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = authService.getCurrentUser();

  // Load real family members from Supabase & local cache
  useEffect(() => {
    async function loadFamily() {
      setLoadingMembers(true);
      if (currentUser?.id) {
        try {
          const synced = await familyService.syncFamilyMembersFromDb(currentUser.id);
          const valid = (synced || []).filter((m) => Boolean(m.name?.trim() && m.photoUrl));
          setMembers(valid);
        } catch (e) {
          console.warn('[FamilyRecognitionGame] Error loading members:', e);
          const cached = familyService.getFamilyMembersForUser(currentUser.id);
          setMembers(cached.filter((m) => Boolean(m.name?.trim() && m.photoUrl)));
        }
      } else {
        setMembers([]);
      }
      setLoadingMembers(false);
    }
    loadFamily();
  }, [currentUser?.id]);

  // Build randomized question set (works with >= 1 family member!)
  const generateQuestions = (family: FamilyMember[], diff: DifficultyTier) => {
    if (family.length < 1) return [];

    let totalRounds = 5;
    let optionCount = 3;
    if (diff === 'madhyam') {
      totalRounds = 7;
      optionCount = 3;
    } else if (diff === 'nipun') {
      totalRounds = 10;
      optionCount = 4;
    }

    const fallbackNames = ['Priyobrata', 'Ananya', 'Ramesh', 'Sunita', 'Kalyani', 'Bikash', 'Pooja', 'Deepak'];
    const fallbackPhotos = [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    ];

    const generated: Question[] = [];

    for (let i = 0; i < totalRounds; i++) {
      const targetMember = family[i % family.length];
      const otherMembers = family.filter((m) => m.id !== targetMember.id);
      const shuffledOthers = [...otherMembers].sort(() => Math.random() - 0.5);

      const targetRelEn = getRelationshipLabel(targetMember.relationship, 'en');
      const targetRelHi = getRelationshipLabel(targetMember.relationship, 'hi');
      const targetRelAs = getRelationshipLabel(targetMember.relationship, 'as');

      // Distractors: use other family members if available; otherwise use fallback family contacts
      const neededDistractors = optionCount - 1;
      let distractors: FamilyMember[] = [];
      if (shuffledOthers.length >= neededDistractors) {
        distractors = shuffledOthers.slice(0, neededDistractors);
      } else {
        const availableFromOthers = [...shuffledOthers];
        const fillNames = fallbackNames.filter(
          (n) => n.toLowerCase() !== targetMember.name.toLowerCase() && !availableFromOthers.some((o) => o.name.toLowerCase() === n.toLowerCase())
        );
        const fillers: FamilyMember[] = fillNames.slice(0, neededDistractors - availableFromOthers.length).map((n, idx) => ({
          id: `distractor-${i}-${idx}`,
          userId: 'demo',
          name: n,
          relationship: { en: 'Family Relative', hi: 'पारिवारिक रिश्तेदार', as: 'পৰিয়ালৰ আত্মীয়' },
          relationType: 'Relative',
          photoUrl: fallbackPhotos[idx % fallbackPhotos.length],
          phone: '',
          isFavorite: false,
        }));
        distractors = [...availableFromOthers, ...fillers];
      }

      // Rotate between question types
      const types: ('identify_name' | 'identify_photo' | 'identify_relation')[] = [
        'identify_name',
        'identify_relation',
        'identify_photo',
      ];
      const qType = types[i % types.length];

      if (qType === 'identify_name') {
        const rawOptions = [
          { id: targetMember.id, label: targetMember.name, isCorrect: true },
          ...distractors.map((d) => ({ id: d.id, label: d.name, isCorrect: false })),
        ].sort(() => Math.random() - 0.5);

        generated.push({
          id: `q-${i}`,
          type: 'identify_name',
          targetMember,
          prompt: {
            en: 'Who is this family member?',
            hi: 'तस्वीर में यह पारिवारिक सदस्य कौन हैं?',
            as: 'ছবিখনত থকা পৰিয়ালৰ সদস্যজন কোন হয়?',
          },
          options: rawOptions,
          hint: {
            en: `This person is your ${targetRelEn}.`,
            hi: `यह आपके ${targetRelHi} हैं।`,
            as: `তেখেত আপোনাৰ ${targetRelAs} হয়।`,
          },
        });
      } else if (qType === 'identify_relation') {
        const commonRelations = [
          'Son',
          'Daughter',
          'Grandson',
          'Granddaughter',
          'Wife',
          'Husband',
          'Brother',
          'Sister',
          'Caregiver',
        ];
        const otherRelations = commonRelations
          .filter((r) => r.toLowerCase() !== targetRelEn.toLowerCase())
          .sort(() => Math.random() - 0.5)
          .slice(0, optionCount - 1);

        const rawOptions = [
          { id: 'rel-correct', label: targetRelEn, isCorrect: true },
          ...otherRelations.map((r, idx) => ({ id: `rel-${idx}`, label: r, isCorrect: false })),
        ].sort(() => Math.random() - 0.5);

        generated.push({
          id: `q-${i}`,
          type: 'identify_relation',
          targetMember,
          prompt: {
            en: `What is your relation to ${targetMember.name}?`,
            hi: `${targetMember.name} आपके क्या लगते हैं?`,
            as: `${targetMember.name}ৰ সৈতে আপোনাৰ কি সম্পৰ্ক?`,
          },
          options: rawOptions,
          hint: {
            en: `Think about ${targetMember.name}'s role in your family.`,
            hi: `सोचिए कि ${targetMember.name} आपके परिवार में किस रिश्ते में हैं।`,
            as: `${targetMember.name} আপোনাৰ পৰিয়ালৰ কি সম্পৰ্কীয় হয় চিন্তা কৰক।`,
          },
        });
      } else {
        // identify_photo: "Which photo is your [Relationship] [Name]?"
        const rawOptions = [
          {
            id: targetMember.id,
            label: targetMember.name,
            photoUrl: targetMember.photoUrl,
            isCorrect: true,
          },
          ...distractors.map((d) => ({
            id: d.id,
            label: d.name,
            photoUrl: d.photoUrl,
            isCorrect: false,
          })),
        ].sort(() => Math.random() - 0.5);

        generated.push({
          id: `q-${i}`,
          type: 'identify_photo',
          targetMember,
          prompt: {
            en: `Which photo shows your ${targetRelEn}, ${targetMember.name}?`,
            hi: `इनमें से कौन सी तस्वीर आपके ${targetRelHi} (${targetMember.name}) की है?`,
            as: `তেখেতসকলৰ ভিতৰত কোনখন আপোনাৰ ${targetRelAs} (${targetMember.name})ৰ ছবি?`,
          },
          options: rawOptions,
          hint: {
            en: `Look closely at their facial features and warm smile.`,
            hi: `तस्वीर में ध्यान से उनके चेहरे और मुस्कान को पहचानें।`,
            as: `ছবিখনত মনোযোগেৰে চিনাকি মুখ আৰু হাঁহিটো লক্ষ্য কৰক।`,
          },
        });
      }
    }

    return generated;
  };

  const startSession = (diff: DifficultyTier) => {
    setSelectedOptionId(null);
    setIsAnswerChecked(false);
    setShowHint(false);
    setEliminatedOptionIds([]);
    setCurrentIndex(0);
    setCorrectCount(0);
    setMistakesCount(0);
    setHintsUsed(0);
    setReactionTimes([]);
    setCompletedSession(null);
    setStartTime(Date.now());
    setQuestionStartTime(Date.now());

    const qs = generateQuestions(members, diff);
    setQuestions(qs);
  };

  // Start when members are ready
  useEffect(() => {
    if (members.length >= 2) {
      startSession(difficulty);
    }
  }, [members, difficulty]);

  // Read voice prompt on new question if user prefers
  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]) {
      setQuestionStartTime(Date.now());
      const q = questions[currentIndex];
      const textToSpeak =
        currentLang === 'hi'
          ? q.prompt.hi
          : currentLang === 'as'
          ? q.prompt.as
          : q.prompt.en;

      if (currentUser?.accessibility?.textToSpeechAuto) {
        speakText(textToSpeak);
      }
    }
  }, [currentIndex, questions, currentLang]);

  const handleSelectOption = (optionId: string) => {
    if (isAnswerChecked) return;
    setSelectedOptionId(optionId);
    soundService.playCardFlip();
  };

  const handleApplyHint = () => {
    if (showHint || isAnswerChecked) return;
    setShowHint(true);
    setHintsUsed((prev) => prev + 1);

    const q = questions[currentIndex];
    if (!q) return;

    // Eliminate one incorrect option to assist elderly players
    const incorrect = q.options.filter((o) => !o.isCorrect && !eliminatedOptionIds.includes(o.id));
    if (incorrect.length > 0) {
      const toEliminate = incorrect[0].id;
      setEliminatedOptionIds((prev) => [...prev, toEliminate]);
    }

    const hintText =
      currentLang === 'hi' ? q.hint.hi : currentLang === 'as' ? q.hint.as : q.hint.en;
    speakText(hintText);
  };

  const handleConfirmAnswer = async () => {
    if (!selectedOptionId || isAnswerChecked) return;

    const reactionTime = Date.now() - questionStartTime;
    setReactionTimes((prev) => [...prev, reactionTime]);

    const q = questions[currentIndex];
    const chosen = q.options.find((o) => o.id === selectedOptionId);
    const isCorrect = Boolean(chosen?.isCorrect);

    setIsAnswerChecked(true);

    if (isCorrect) {
      soundService.playMatchSuccess();
      setCorrectCount((prev) => prev + 1);
    } else {
      soundService.playSoftMistake();
      setMistakesCount((prev) => prev + 1);
    }
  };

  const handleNextQuestion = async () => {
    const nextIdx = currentIndex + 1;

    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx);
      setSelectedOptionId(null);
      setIsAnswerChecked(false);
      setShowHint(false);
      setEliminatedOptionIds([]);
    } else {
      // Game Complete — finalize session
      const totalDurationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const totalQs = questions.length;
      const finalCorrect = correctCount + (isAnswerChecked && questions[currentIndex]?.options.find((o) => o.id === selectedOptionId)?.isCorrect ? 0 : 0);
      const accuracy = Math.round((finalCorrect / totalQs) * 100);
      const avgReactionMs =
        reactionTimes.length > 0
          ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
          : 2500;

      soundService.playVictoryFanfare();

      const recordResult = await gameService.recordSession({
        gameId: 'family_memory',
        durationSeconds: totalDurationSec,
        accuracy,
        mistakesCount,
        hintsUsed,
        difficulty,
        reactionTimeMs: avgReactionMs,
      });

      setCompletedSession(recordResult);
    }
  };

  // ── INSUFFICIENT FAMILY DATA STATE ──────────────────────────────────────────
  if (!loadingMembers && members.length < 1) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-elder border border-rose-100 text-center max-w-2xl mx-auto my-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-100 to-amber-100 flex items-center justify-center mx-auto mb-6 text-rose-600 shadow-inner">
          <HeartHandshake className="w-10 h-10" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3 tracking-tight">
          {currentLang === 'hi'
            ? 'पारिवारिक पहचान खेल'
            : currentLang === 'as'
            ? 'পৰিয়াল চিনাক্তকৰণ খেল'
            : 'Family Recognition Game'}
        </h2>

        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 text-sm font-bold px-4 py-1.5 rounded-full mb-4 border border-amber-200">
          <Users className="w-4 h-4" />
          <span>
            {currentLang === 'hi'
              ? 'पारिवारिक सदस्यों की तस्वीरें आवश्यक हैं'
              : currentLang === 'as'
              ? 'পৰিয়ালৰ সদস্যৰ ছবি প্ৰয়োজন'
              : 'Add family photos to start recognizing your loved ones'}
          </span>
        </div>

        <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
          {currentLang === 'hi'
            ? 'यह विशेष खेल आपकी याददाश्त और अपने प्रियजनों से जुड़ाव बनाए रखने के लिए डिज़ाइन किया गया है। आप अभी एक तस्वीर अपलोड करके शुरू कर सकते हैं या अभ्यास परिवार के साथ खेल सकते हैं।'
            : currentLang === 'as'
            ? 'এই বিশেষ খেলটো আপোনাৰ স্মৃতিশক্তি আৰু আপোনজনৰ সৈতে আৱেগিক সংযোগ অটুট ৰাখিবলৈ তৈয়াৰ কৰা হৈছে। আপুনি এতিয়াই ছবি আপলোড কৰি আৰম্ভ কৰিব পাৰে বা অনুশীলন পৰিয়ালৰ সৈতে খেলিব পাৰে।'
            : 'This personalized cognitive exercise uses real photographs of your loved ones to strengthen emotional memory and facial recognition. Add a photo of your family member now or try with our practice family!'}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowInGameAddModal(true)}
            type="button"
            className="w-full sm:w-auto px-6 py-3.5 bg-sathi-600 hover:bg-sathi-700 active:scale-95 text-white font-bold rounded-2xl shadow-tactile transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Add Family Member & Photo</span>
          </button>

          <button
            onClick={() => setMembers(MOCK_FAMILY_MEMBERS)}
            type="button"
            className="w-full sm:w-auto px-6 py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-2xl transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Play with Practice Family</span>
          </button>

          <button
            onClick={onExit}
            type="button"
            className="w-full sm:w-auto px-5 py-3.5 text-gray-600 hover:bg-gray-100 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loadingMembers || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-white rounded-3xl shadow-elder">
        <RefreshCw className="w-10 h-10 text-sathi-600 animate-spin" />
        <p className="text-gray-600 font-bold text-lg">
          {currentLang === 'hi'
            ? 'पारिवारिक यादें तैयार हो रही हैं...'
            : currentLang === 'as'
            ? 'পৰিয়ালৰ স্মৃতি সজাই থকা হৈছে...'
            : 'Preparing family reminiscence session...'}
        </p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const targetMember = currentQ.targetMember;
  const currentPrompt =
    currentLang === 'hi'
      ? currentQ.prompt.hi
      : currentLang === 'as'
      ? currentQ.prompt.as
      : currentQ.prompt.en;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header Bar: Difficulty, Progress, Voice */}
      <div className="bg-white rounded-2xl p-5 shadow-elder border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">
              {currentLang === 'hi'
                ? 'परिवार पहचान'
                : currentLang === 'as'
                ? 'পৰিয়াল চিনি পোৱা'
                : 'Family Recognition'}
            </h1>
            <p className="text-xs font-semibold text-gray-500">
              {currentLang === 'hi'
                ? 'तस्वीरों और पारिवारिक संबंधों का अभ्यास'
                : currentLang === 'as'
                ? 'ছবি আৰু সম্বন্ধ চিনি উলিওৱাৰ খেল'
                : 'Facial & Relational Reminiscence Recall'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-2xl border border-gray-200">
            {(['saral', 'madhyam', 'nipun'] as DifficultyTier[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDifficulty(d);
                  startSession(d);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  difficulty === d
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {d === 'saral'
                  ? (currentLang === 'hi' ? 'सरल' : currentLang === 'as' ? 'সহজ' : 'Saral')
                  : d === 'madhyam'
                  ? (currentLang === 'hi' ? 'मध्यम' : currentLang === 'as' ? 'মধ্যম' : 'Madhyam')
                  : (currentLang === 'hi' ? 'निपुण' : currentLang === 'as' ? 'নিপুণ' : 'Nipun')}
              </button>
            ))}
          </div>
          <DifficultyBadge difficulty={difficulty} />
          <div className="bg-rose-50 text-rose-700 px-3.5 py-1.5 rounded-xl font-bold text-sm border border-rose-200">
            {currentIndex + 1} / {questions.length}
          </div>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-elder border border-gray-100 space-y-6">
        {/* Question Header & Voice Button */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              {currentLang === 'hi'
                ? `प्रश्न ${currentIndex + 1}`
                : currentLang === 'as'
                ? `প্ৰশ্ন ${currentIndex + 1}`
                : `Round ${currentIndex + 1}`}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-snug">
              {currentPrompt}
            </h2>
          </div>
          <VoicePromptButton text={currentPrompt} size="md" />
        </div>

        {/* Display Area: Large Photo if identifying Name or Relation */}
        {(currentQ.type === 'identify_name' || currentQ.type === 'identify_relation') && (
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative group">
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-xl border-4 border-amber-200 ring-4 ring-amber-500/20 bg-gray-100 transition-all transform hover:scale-[1.02]">
                <img
                  src={targetMember.photoUrl}
                  alt={targetMember.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {currentQ.type === 'identify_relation' && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/85 backdrop-blur-sm text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-md whitespace-nowrap">
                  {targetMember.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Options Grid */}
        {currentQ.type === 'identify_photo' ? (
          // Photo Grid Choice
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
            {currentQ.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isEliminated = eliminatedOptionIds.includes(option.id);

              let borderClass = 'border-gray-200 hover:border-rose-300';
              if (isSelected) borderClass = 'border-rose-500 ring-4 ring-rose-500/30';
              if (isAnswerChecked) {
                if (option.isCorrect) borderClass = 'border-emerald-500 ring-4 ring-emerald-500/30';
                else if (isSelected && !option.isCorrect) borderClass = 'border-red-500 ring-4 ring-red-500/30 opacity-75';
              }

              if (isEliminated) {
                return (
                  <div
                    key={option.id}
                    className="opacity-20 grayscale pointer-events-none rounded-2xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center min-h-[160px]"
                  >
                    <XCircle className="w-8 h-8 text-gray-400" />
                  </div>
                );
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={isAnswerChecked}
                  type="button"
                  className={`group relative rounded-2xl overflow-hidden border-3 ${borderClass} bg-white shadow-md transition-all cursor-pointer flex flex-col items-center`}
                >
                  <div className="w-full h-36 sm:h-44 bg-gray-100 overflow-hidden">
                    <img
                      src={option.photoUrl}
                      alt="Family Member Option"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  {isAnswerChecked && option.isCorrect && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                  {isAnswerChecked && isSelected && !option.isCorrect && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          // Text Buttons Grid (Name or Relation)
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {currentQ.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isEliminated = eliminatedOptionIds.includes(option.id);

              let styleClass =
                'bg-gray-50 border-gray-200 text-gray-800 hover:bg-rose-50/50 hover:border-rose-300';

              if (isSelected) {
                styleClass = 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20';
              }

              if (isAnswerChecked) {
                if (option.isCorrect) {
                  styleClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/30';
                } else if (isSelected && !option.isCorrect) {
                  styleClass = 'bg-red-50 border-red-400 text-red-900 opacity-80';
                }
              }

              if (isEliminated) {
                return (
                  <div
                    key={option.id}
                    className="opacity-25 pointer-events-none rounded-2xl border-2 border-dashed border-gray-300 p-4 text-center text-sm font-medium text-gray-400"
                  >
                    —
                  </div>
                );
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={isAnswerChecked}
                  type="button"
                  className={`min-h-[64px] px-6 py-4 rounded-2xl border-2 font-bold text-lg text-left flex items-center justify-between transition-all cursor-pointer shadow-sm ${styleClass}`}
                >
                  <span>{option.label}</span>
                  {isAnswerChecked && option.isCorrect && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 ml-2" />
                  )}
                  {isAnswerChecked && isSelected && !option.isCorrect && (
                    <XCircle className="w-6 h-6 text-red-500 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Hint Box (Elderly Gentle Assistance) */}
        {showHint && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                {currentLang === 'hi' ? 'संकेत' : currentLang === 'as' ? 'ইঙ্গিত' : 'Gentle Hint'}
              </span>
              <p className="text-sm font-medium text-amber-900">
                {currentLang === 'hi'
                  ? currentQ.hint.hi
                  : currentLang === 'as'
                  ? currentQ.hint.as
                  : currentQ.hint.en}
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions: Hint & Submit/Next */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleApplyHint}
            disabled={showHint || isAnswerChecked}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-bold text-sm hover:bg-amber-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span>
              {currentLang === 'hi'
                ? 'संकेत देखें'
                : currentLang === 'as'
                ? 'ইঙ্গিত চাওক'
                : 'Need a Hint?'}
            </span>
          </button>

          {!isAnswerChecked ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={!selectedOptionId}
              type="button"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-sathi-600 text-white font-bold text-base hover:bg-sathi-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md transition-all cursor-pointer"
            >
              <span>
                {currentLang === 'hi' ? 'पुष्टि करें' : currentLang === 'as' ? 'নিশ্চিত কৰক' : 'Confirm'}
              </span>
              <CheckCircle2 className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              type="button"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-base hover:from-emerald-700 hover:to-teal-700 active:scale-95 shadow-md transition-all cursor-pointer animate-pulse"
            >
              <span>
                {currentIndex + 1 < questions.length
                  ? currentLang === 'hi'
                    ? 'अगला प्रश्न'
                    : currentLang === 'as'
                    ? 'পৰৱৰ্তী প্ৰশ্ন'
                    : 'Next Question'
                  : currentLang === 'hi'
                  ? 'सत्र पूरा करें'
                  : currentLang === 'as'
                  ? 'সম্পূৰ্ণ কৰক'
                  : 'Complete Session'}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Celebratory Modal on Completion */}
      {completedSession && (
        <GameSummaryModal
          session={completedSession.session}
          leveledUp={completedSession.leveledUp}
          onPlayAgain={() => startSession(difficulty)}
          onContinue={onExit || (() => window.history.back())}
        />
      )}

      {/* QUICK IN-GAME ADD MEMBER MODAL */}
      {showInGameAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 relative">
            <button
              onClick={() => {
                setShowInGameAddModal(false);
                setPhotoPreview('');
                setNewMemberName('');
              }}
              type="button"
              className="absolute top-5 right-5 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Add Family Member</h3>
              <p className="text-xs text-gray-500 mt-1">
                Upload a real photo to immediately begin the Family Recognition Game!
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newMemberName.trim()) return;
                const userId = currentUser?.id || 'guest';
                const created = familyService.addFamilyMember({
                  userId,
                  name: newMemberName.trim(),
                  relationship: { en: newMemberRel, hi: newMemberRel, as: newMemberRel },
                  relationType: newMemberRel,
                  photoUrl:
                    photoPreview ||
                    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
                  phone: newMemberPhone.trim() || '+91 94350 00000',
                  isFavorite: true,
                  isOnline: true,
                });
                setMembers((prev) => [...prev, created]);
                setShowInGameAddModal(false);
                setNewMemberName('');
                setPhotoPreview('');
              }}
              className="space-y-4"
            >
              {/* Photo Upload with Preview */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 overflow-hidden flex items-center justify-center relative shadow-xs">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-rose-400" />
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                </div>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sathi-600 hover:bg-sathi-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoPreview ? 'Change Photo' : 'Choose Photo'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setIsUploadingPhoto(true);
                        try {
                          const url = await storageService.processAndStorePhoto(
                            'family-photos',
                            currentUser?.id || 'temp',
                            f,
                            f.name
                          );
                          setPhotoPreview(url);
                        } finally {
                          setIsUploadingPhoto(false);
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Priyobrata Borah"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Relationship</label>
                <select
                  value={newMemberRel}
                  onChange={(e) => setNewMemberRel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500 cursor-pointer"
                >
                  {['Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Grandchild', 'Friend', 'Caregiver'].map(
                    (rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone (+91)</label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="+91 94350 12890"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowInGameAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMemberName.trim() || isUploadingPhoto}
                  className="px-5 py-2.5 rounded-xl bg-sathi-600 hover:bg-sathi-700 text-white text-xs font-bold shadow-tactile cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  Save & Play
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
