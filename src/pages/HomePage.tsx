import React, { useState, useEffect, useRef } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { useSpeech } from '../hooks/useSpeech';
import { VoicePromptButton } from '../components/common/VoicePromptButton';
import { RecommendedGameCard } from '../components/dashboard/RecommendedGameCard';
import { DailyPlanCard } from '../components/dashboard/DailyPlanCard';
import { StreakXPWidget } from '../components/dashboard/StreakXPWidget';
import { CognitiveRadarChart } from '../components/dashboard/CognitiveRadarChart';
import { MoodCheckinWidget } from '../components/dashboard/MoodCheckinWidget';
import { COGNITIVE_GAMES } from '../data/mockGames';
import { NORTHEAST_GAMES } from '../data/mockNortheastGames';
import { familyService } from '../services/familyService';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { caregiverService } from '../services/caregiverService';
import { FamilyMember } from '../types/family';
import {
  Sparkles,
  ArrowRight,
  Play,
  Heart,
  Bell,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Bot,
  LogOut,
  Camera,
  Loader2,
  Users,
  Phone,
  CheckCircle2,
  X,
  Plus,
  Sun,
  Shield,
  UserCheck,
} from 'lucide-react';
import { AshokaChakraIcon } from '../components/layout/AshokaChakraIcon';

interface HomePageProps {
  onNavigate: (tab: string, extra?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { currentUser } = useCurrentUser('home');
  const { currentLang, t } = useLanguage();

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() =>
    familyService.getFamilyMembersForUser(currentUser.id)
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaInput, setAbhaInput] = useState(currentUser.abhaId || '');
  const [abhaError, setAbhaError] = useState('');
  const [abhaSuccess, setAbhaSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Caregiver link status state
  const [assignedCaregiver, setAssignedCaregiver] = useState<any | null>(null);
  const [loadingCaregiver, setLoadingCaregiver] = useState<boolean>(true);
  const [unlinkLoading, setUnlinkLoading] = useState<boolean>(false);
  const [showCaregiverModal, setShowCaregiverModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync family members & assigned caregiver from database on mount
  useEffect(() => {
    if (!currentUser?.id) return;
    familyService.syncFamilyMembersFromDb(currentUser.id).then((members) => {
      if (members && members.length > 0) {
        setFamilyMembers(members);
      } else {
        setFamilyMembers(familyService.getFamilyMembersForUser(currentUser.id));
      }
    });

    setLoadingCaregiver(true);
    caregiverService
      .getAssignedCaregiverForPatient(currentUser.id)
      .then((cg) => setAssignedCaregiver(cg))
      .catch((e) => console.warn('Error checking assigned caregiver:', e))
      .finally(() => setLoadingCaregiver(false));
  }, [currentUser?.id]);

  // Handle Unlinking Caregiver (instantly cuts off caregiver access)
  const handleUnlinkCaregiver = async () => {
    if (!currentUser?.id) return;
    const confirmMsg =
      currentLang === 'hi'
        ? 'क्या आप अपने देखभालकर्ता (Caregiver) को अनलिंक करना चाहते हैं? अनलिंक करने के बाद वे आपकी गतिविधियों और प्रगति को नहीं देख पाएंगे।'
        : 'Are you sure you want to unlink your caregiver? Once unlinked, they will be disconnected and will NOT be able to monitor or access any of your records.';

    if (window.confirm(confirmMsg)) {
      setUnlinkLoading(true);
      try {
        const ok = await caregiverService.unlinkCaregiverFromPatient(currentUser.id);
        if (ok) {
          setAssignedCaregiver(null);
          setShowCaregiverModal(false);
        }
      } finally {
        setUnlinkLoading(false);
      }
    }
  };

  const memories = familyService.getMemoriesForUser(currentUser.id);
  const featuredMemory = memories[0];

  const greeting = currentLang === 'hi'
    ? `नमस्ते, ${currentUser.preferredName || currentUser.name}! आज आपका मन कैसा है?`
    : currentLang === 'as'
    ? `নমস্কাৰ, ${currentUser.preferredName || currentUser.name}! আজি আপোনাৰ মন কেনে?`
    : `Namaste, ${currentUser.preferredName || currentUser.name}! How is your spirit today?`;

  const isAbhaLinked = Boolean(currentUser.abhaId && currentUser.abhaStatus === 'verified');

  // Handle uploading patient photo directly from Home Page
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    setIsUploadingPhoto(true);
    try {
      const photoUrl = await storageService.processAndStorePhoto(
        'family-photos',
        currentUser.id,
        file,
        `patient-avatar-${Date.now()}`
      );
      // Update profile locally and push to Supabase
      authService.updateCurrentUserProfile({ avatarUrl: photoUrl });
    } catch (err) {
      console.warn('Patient photo upload error:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle Linking ABHA Number
  const handleSaveAbha = (e: React.FormEvent) => {
    e.preventDefault();
    setAbhaError('');
    const clean = abhaInput.replace(/[^0-9]/g, '');
    if (clean.length !== 14) {
      setAbhaError('Please enter a valid 14-digit ABHA Number (e.g. 91-1234-5678-9012)');
      return;
    }

    const formatted = `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 10)}-${clean.slice(10, 14)}`;
    authService.updateCurrentUserProfile({
      abhaId: formatted,
      abhaStatus: 'verified',
      isAyushmanMember: true,
    });
    setAbhaSuccess(true);
    setTimeout(() => {
      setAbhaSuccess(false);
      setShowAbhaModal(false);
    }, 1200);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Elder Greeting Banner with Photo Upload and ABHA Status (Navy Tricolor Theme) */}
      <div className="bg-[#0B2239] text-white p-4 xs:p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 border border-[#163654]">
        {/* Ashoka Chakra Watermark in Center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 sm:opacity-20 text-[#1D4A75] z-0">
          <AshokaChakraIcon size={280} className="sm:w-[340px] sm:h-[340px]" />
        </div>

        {/* Indian Tricolor Wave along bottom right */}
        <div className="absolute right-0 bottom-0 pointer-events-none z-0 overflow-hidden w-48 xs:w-64 sm:w-96 lg:w-[480px] h-20 xs:h-28 sm:h-36">
          <img
            src="/indian_flag_wave.svg"
            alt="Indian Tricolor Wave"
            className="w-full h-full object-fill object-bottom-right opacity-80 sm:opacity-100"
          />
        </div>

        {/* Left Welcome Details */}
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
            <Sun className="w-4 h-4 xs:w-5 xs:h-5 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-[11px] xs:text-xs sm:text-sm uppercase tracking-widest font-extrabold text-[#F59E0B]">
              {currentLang === 'hi' ? 'दैनिक स्वागत' : currentLang === 'as' ? 'দৈনিক আদৰণি' : 'DAILY WELCOME'}
            </span>
            <VoicePromptButton text={greeting} size="sm" />
          </div>

          <h1 className="text-xl xs:text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            {t.common.greeting}, {currentUser.preferredName || currentUser.name}!
          </h1>

          <p className="text-slate-300 text-xs xs:text-sm sm:text-base mt-1.5 sm:mt-2 font-normal max-w-xl leading-relaxed">
            {currentLang === 'hi'
              ? 'मस्तिष्क को सक्रिय और मन को शांत रखने के लिए आपकी व्यक्तिगत दिनचर्या तैयार है।'
              : currentLang === 'as'
              ? 'মগজু সতেজ আৰু মন শান্ত ৰখাৰ বাবে আপোনাৰ দৈনিক তালিকা সাজু।'
              : 'Your personalized cognitive routine is ready to keep your mind sharp and heart joyful.'}
          </p>

          <button
            type="button"
            onClick={() => onNavigate('daily-plan')}
            className="mt-4 sm:mt-5 inline-flex items-center gap-2 xs:gap-2.5 px-4 xs:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-[#D9531E] via-[#C84B16] to-[#BD410E] hover:from-[#E65C23] hover:to-[#CD4912] text-white font-bold text-xs xs:text-sm sm:text-base shadow-lg hover:shadow-orange-950/40 hover:scale-102 transition-all cursor-pointer group"
          >
            <Play className="w-3.5 h-3.5 xs:w-4 xs:h-4 fill-white shrink-0" />
            <span>
              {currentLang === 'hi'
                ? 'आज का अभ्यास शुरू करें'
                : currentLang === 'as'
                ? 'আজিৰ অভ্যাস আৰম্ভ কৰক'
                : "Start Today's Practice"}
            </span>
            <ArrowRight className="w-3.5 h-3.5 xs:w-4 xs:h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* User Profile Glass Card */}
        <div className="relative z-10 shrink-0 bg-[#0C2947]/80 backdrop-blur-md px-3.5 xs:px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border border-white/15 shadow-xl flex items-center gap-3 sm:gap-4 w-full lg:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with Camera Overlay */}
            <div className="relative group shrink-0">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md bg-[#091C2E]"
              />
              {isUploadingPhoto ? (
                <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                  <Loader2 className="w-4 h-4 xs:w-5 xs:h-5 animate-spin text-amber-300" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 hover:bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex flex-col items-center justify-center text-white text-[8px] xs:text-[9px] font-bold transition-all cursor-pointer"
                  title="Click to update patient photo"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-300 mb-0.5" />
                  <span>Change</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            <div className="text-left min-w-0 pr-1">
              <div className="text-sm xs:text-base sm:text-lg font-black text-white truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[180px]">
                {currentUser.name}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-300 font-medium truncate">
                {currentUser.levelTitle || 'Sadhak Sathi (Seeker)'}
              </div>

              {/* ABHA Status Badge */}
              {isAbhaLinked ? (
                <div className="text-[10px] xs:text-xs text-emerald-300 font-medium mt-1 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40 w-fit">
                  <ShieldCheck className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">ABHA: Linked</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAbhaModal(true)}
                  className="text-[10px] xs:text-xs text-slate-200 bg-[#081B2E]/80 hover:bg-[#0F3050] border border-blue-400/30 rounded-full px-2 py-0.5 font-medium mt-1 flex items-center gap-1 transition-all cursor-pointer shadow-xs w-fit"
                  title="Click to link your ABHA health ID"
                >
                  <Shield className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-blue-300 shrink-0" />
                  <span>ABHA: (Link)</span>
                </button>
              )}

              {/* Caregiver Link Status Button */}
              {loadingCaregiver ? (
                <div className="text-[10px] xs:text-xs text-slate-300 font-medium mt-1 flex items-center gap-1 bg-[#081B2E]/80 px-2 py-0.5 rounded-full border border-slate-700 w-fit">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Caregiver: Checking...</span>
                </div>
              ) : assignedCaregiver ? (
                <button
                  type="button"
                  onClick={() => setShowCaregiverModal(true)}
                  className="text-[10px] xs:text-xs text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-400/50 rounded-full px-2.5 py-0.5 font-bold mt-1 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs w-fit"
                  title="Caregiver linked. Click to view or unlink."
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate max-w-[120px] xs:max-w-[150px]">
                    Caregiver: Linked
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCaregiverModal(true)}
                  className="text-[10px] xs:text-xs text-amber-200 bg-amber-950/60 hover:bg-amber-900 border border-amber-400/40 rounded-full px-2.5 py-0.5 font-bold mt-1 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs w-fit"
                  title="No caregiver linked. Click for instructions."
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span>Caregiver: Not Linked</span>
                </button>
              )}

              {/* Patient Connection Code for Caregiver & Doctor */}
              {currentUser.connectionCode && (
                <div className="text-[10px] xs:text-xs text-blue-200 bg-[#081F38]/90 border border-blue-400/40 rounded-full px-2.5 py-0.5 font-bold mt-1 flex items-center gap-1.5 w-fit">
                  <span className="text-slate-300">Code:</span>
                  <strong className="text-amber-300 font-mono tracking-wider">{currentUser.connectionCode}</strong>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(currentUser.connectionCode || '');
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="ml-1 text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-1.5 py-0.5 rounded cursor-pointer transition-all font-semibold"
                  >
                    {copiedCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Logout Pill Button */}
          <button
            onClick={() => onNavigate('logout')}
            type="button"
            className="ml-auto px-2.5 xs:px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 bg-transparent hover:bg-white/10 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
            title="Sign out of your account"
            aria-label="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 text-white" />
            <span className="hidden xs:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Caregiver Oversight Status Banner with Direct Unlink Option */}
      <div className="animate-fade-in">
        {assignedCaregiver ? (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <img
                  src={
                    assignedCaregiver.avatarUrl ||
                    `https://api.dicebear.com/9.x/avataaars/svg?seed=${assignedCaregiver.id}&backgroundColor=b6e3f4`
                  }
                  alt={assignedCaregiver.name}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm bg-white"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                    🟢 Linked with Caregiver
                  </span>
                </div>
                <div className="text-base font-extrabold text-gray-900 mt-0.5">
                  {assignedCaregiver.name}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {assignedCaregiver.email || assignedCaregiver.phone || 'Authorized Family Caregiver'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleUnlinkCaregiver}
                disabled={unlinkLoading}
                className="px-4 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border-2 border-rose-200 hover:border-rose-300 text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {unlinkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" /> : <X className="w-3.5 h-3.5 text-rose-600" />}
                <span>Unlink Caregiver</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200 p-4 sm:p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    ⚪ Caregiver: Not Linked
                  </span>
                </div>
                <div className="text-sm font-extrabold text-gray-900 mt-0.5">
                  No Family Caregiver Connected
                </div>
                <p className="text-xs text-amber-950 font-medium max-w-xl">
                  Your caregiver can sign in from the Landing Page and connect using your email ({currentUser.email}) and password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCaregiverModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-amber-100/70 text-amber-900 border-2 border-amber-300 text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>How to Connect</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Grid: Personalized Recommendation & Streak/XP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecommendedGameCard onPlayGame={(gameId) => onNavigate('play', gameId)} />
        </div>
        <div>
          <StreakXPWidget />
        </div>
      </div>

      {/* Center Section: Daily Plan Checklist & Cognitive Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DailyPlanCard
            onPlayGame={(gameId) => onNavigate('play', gameId)}
            onOpenMemories={() => onNavigate('memories')}
          />
        </div>
        <div className="space-y-6">
          <MoodCheckinWidget />
          <CognitiveRadarChart />
        </div>
      </div>

      {/* Family Members with Photos Section (Every Record Visible) */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-rose-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-100" />
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">
                {currentLang === 'hi'
                  ? 'मेरे अपने व पारिवारिक संपर्क (Family & Loved Ones)'
                  : currentLang === 'as'
                  ? 'মোৰ আপোনজন আৰু পৰিয়ালৰ ফটো'
                  : 'My Family & Loved Ones'}
              </h3>
              <p className="text-xs text-gray-500">
                {currentLang === 'hi'
                  ? 'आपके पंजीकृत पारिवारिक सदस्य, उनकी तस्वीरें और त्वरित संपर्क।'
                  : currentLang === 'as'
                  ? 'পৰিয়ালৰ ফটো আৰু ১-টেপ যোগাযোগ।'
                  : 'Your registered family members with photos and 1-tap connection.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('family')}
            type="button"
            className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>{currentLang === 'hi' ? 'सभी देखें' : currentLang === 'as' ? 'সকলো চাওক' : 'View All'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {familyMembers.length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {familyMembers.slice(0, 4).map((member) => {
              const relText =
                typeof member.relationship === 'string'
                  ? member.relationship
                  : (member.relationship as any)?.[currentLang] || (member.relationship as any)?.en || 'Family';

              return (
                <div
                  key={member.id}
                  onClick={() => onNavigate('family')}
                  className="bg-rose-50/40 hover:bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 flex flex-col items-center text-center cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
                >
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-rose-300 shadow-sm bg-white mb-2"
                  />
                  <div className="font-extrabold text-gray-900 text-sm truncate w-full">
                    {member.name}
                  </div>
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full mt-0.5">
                    {relText}
                  </span>
                  <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{member.phone || 'Saved'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 bg-rose-50/50 border border-rose-200 rounded-2xl text-center">
            <Users className="w-10 h-10 text-rose-400 mx-auto mb-2" />
            <h4 className="font-extrabold text-gray-900 text-sm">
              {currentLang === 'hi' ? 'कोई पारिवारिक सदस्य नहीं मिला' : 'No Family Members Added Yet'}
            </h4>
            <p className="text-xs text-gray-600 mt-1 mb-3">
              {currentLang === 'hi'
                ? 'पारिवारिक सदस्यों को फोटो सहित जोड़ें ताकि पहचान खेल और कॉलिंग सक्रिय हो सके।'
                : 'Add family members with photos to power the Family Recognition Game and 1-Tap Calling.'}
            </p>
            <button
              onClick={() => onNavigate('family')}
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{currentLang === 'hi' ? 'परिवार जोड़ें' : 'Add Family & Photo'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 6 Cognitive Games Quick Launcher Carousel */}
      <div className="bg-white p-5 xs:p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div>
            <h3 className="text-lg xs:text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-sathi-600" />
              <span>{t.games.allGames}</span>
            </h3>
            <p className="text-[11px] xs:text-xs sm:text-sm text-gray-500 mt-0.5">
              {currentLang === 'hi' ? 'संज्ञानात्मक स्फूर्ति के लिए प्रमाणित 6 खेल' : currentLang === 'as' ? 'স্মৃতি আৰু বিবেচনাৰ ৬ খেল' : 'Explore all 6 domain-specific cognitive training games'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('games')}
            type="button"
            className="text-xs sm:text-sm font-bold text-sathi-700 hover:text-sathi-800 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>{currentLang === 'hi' ? 'सभी देखें' : currentLang === 'as' ? 'সকলো' : 'View All'}</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 xs:gap-3 sm:gap-4">
          {COGNITIVE_GAMES.map((game) => {
            const title = (game.title as Record<string, string>)[currentLang] || game.title.en;
            const getGameEmoji = (id: string) => {
              switch (id) {
                case 'smriti_sangam': return '🧩';
                case 'shabda_mala': return '📖';
                case 'rangoli_rekha': return '🎨';
                case 'bazaar_hisaab': return '🛍️';
                case 'dhyan_kendra': return '👁️';
                case 'disha_sathi': return '🧭';
                case 'family_memory': return '👨‍👩‍👧';
                default: return '🎯';
              }
            };

            return (
              <div
                key={game.id}
                onClick={() => onNavigate('play', game.id)}
                className="p-3.5 sm:p-4 rounded-2xl border-2 border-gray-100 hover:border-sathi-400 bg-white hover:bg-sathi-50/50 transition-all cursor-pointer flex flex-col items-center text-center group shadow-xs hover:scale-105"
              >
                <div className="text-3xl sm:text-4xl mb-2 group-hover:scale-110 transition-transform">
                  {getGameEmoji(game.id)}
                </div>
                <div className="font-extrabold text-gray-900 text-xs sm:text-sm line-clamp-1">{title}</div>
                <div className="text-[11px] font-bold text-sathi-700 capitalize mt-0.5">{game.domain}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured Northeast Cultural Game Banner */}
      {(() => {
        const todayNE = NORTHEAST_GAMES[0];
        const title = (todayNE.title as Record<string, string>)[currentLang] || todayNE.title.en;
        const tagline = (todayNE.tagline as Record<string, string>)[currentLang] || todayNE.tagline.en;
        const desc = (todayNE.description as Record<string, string>)[currentLang] || todayNE.description.en;
        return (
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-sage-800 text-white p-6 sm:p-8 rounded-3xl shadow-elder relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🦏</span>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-200">
                    Northeast Heritage Focus • Assam &amp; 7 Sisters
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold">{title}</h3>
                <p className="text-emerald-200 text-xs sm:text-sm mt-1 max-w-xl">{tagline} — {desc.slice(0, 80)}…</p>
              </div>
              <button
                onClick={() => onNavigate('play', todayNE.id)}
                type="button"
                className="shrink-0 bg-white text-emerald-800 font-extrabold py-3 px-6 rounded-2xl shadow-tactile hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{currentLang === 'hi' ? 'खेलें' : currentLang === 'as' ? 'খেলক' : 'Play Now'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Quick Access: Ayushman + AI Assistant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('ayushman')}
          type="button"
          className="bg-gradient-to-br from-blue-700 to-indigo-800 text-white p-5 rounded-3xl shadow-elder hover:shadow-xl transition-all text-left cursor-pointer hover:scale-[1.01] group"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-200">Ayushman Bharat</span>
          </div>
          <p className="font-extrabold text-base">{currentLang === 'hi' ? 'ABHA कार्ड और PM-JAY लाभ देखें' : currentLang === 'as' ? 'ABHA কাৰ্ড আৰু PM-JAY সুবিধা চাওক' : 'View ABHA Card & PM-JAY Benefits'}</p>
          <p className="text-blue-200 text-xs mt-1">₹5 Lakh free coverage • 25,000+ hospitals</p>
          <div className="flex items-center gap-1 mt-3 text-amber-300 text-xs font-bold group-hover:gap-2 transition-all">
            <span>Access Hub</span><ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigate('assistant')}
          type="button"
          className="bg-gradient-to-br from-violet-700 to-purple-800 text-white p-5 rounded-3xl shadow-elder hover:shadow-xl transition-all text-left cursor-pointer hover:scale-[1.01] group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-violet-200" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-violet-200">AI Companion</span>
          </div>
          <p className="font-extrabold text-base">{currentLang === 'hi' ? 'माइंड साथी AI से बात करें' : currentLang === 'as' ? 'মাইণ্ড সাৰথি AIৰ সৈতে কথা পাতক' : 'Chat with MIND SATHI AI'}</p>
          <p className="text-violet-200 text-xs mt-1">{currentLang === 'hi' ? 'खेल, दवाएं, लोककथाएं — सब कुछ!' : 'Games, reminders, stories & more!'}</p>
          <div className="flex items-center gap-1 mt-3 text-violet-200 text-xs font-bold group-hover:gap-2 transition-all">
            <span>Open Assistant</span><ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Patient's Linked Family Members Section */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">
                {currentLang === 'hi' ? 'मेरा परिवार व परिजन' : currentLang === 'as' ? 'মোৰ পৰিয়ালৰ সদস্যসকল' : 'My Family Circle'}
              </h3>
              <p className="text-xs text-gray-500">
                {currentLang === 'hi'
                  ? 'आपके प्रियजनों की तस्वीरें, विवरण और त्वरित संपर्क'
                  : currentLang === 'as'
                  ? 'আপোনাৰ আপোনজনৰ ফটো আৰু পোনপটীয়া যোগাযোগ'
                  : 'Linked family member photos, relationships, and 1-tap call'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('family')}
            type="button"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-700" />
            <span>{currentLang === 'hi' ? 'परिवार प्रबंधित करें' : currentLang === 'as' ? 'পৰিয়াল পৰিচালনা' : 'Manage Family'}</span>
          </button>
        </div>

        {familyMembers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {familyMembers.map((member) => {
              const relText =
                typeof member.relationship === 'string'
                  ? member.relationship
                  : member.relationship[currentLang] || member.relationship.en || member.relationType;

              return (
                <div
                  key={member.id}
                  className="bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 border-2 border-amber-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs hover:shadow-md transition-all group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={member.photoUrl}
                      alt={member.name}
                      className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-amber-300 shadow-sm bg-white"
                    />
                    {member.isFavorite && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white p-0.5 rounded-full shadow-xs" title="Favorite">
                        <Heart className="w-3 h-3 fill-current" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-sm sm:text-base text-gray-900 truncate group-hover:text-amber-900">
                      {member.name}
                    </h4>
                    <span className="inline-block mt-0.5 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      {relText}
                    </span>
                    {member.phone && (
                      <p className="text-[11px] text-gray-500 font-mono mt-1 truncate flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-gray-400" />
                        <span>{member.phone}</span>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onNavigate('family')}
                    type="button"
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
                    title={`Call ${member.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 px-4 bg-amber-50/40 rounded-2xl border border-dashed border-amber-200">
            <Users className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-800">
              {currentLang === 'hi' ? 'अभी कोई परिवार सदस्य नहीं जोड़ा गया है' : 'No family members linked yet'}
            </p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-3">
              {currentLang === 'hi'
                ? 'अपने बेटे, बेटी या पोते-पोतियों की फोटो जोड़ें ताकि स्मृति खेल और कॉलिंग व्यक्तिगत हो सके।'
                : 'Add photos and details of your loved ones to personalize memory games and one-touch calling.'}
            </p>
            <button
              onClick={() => onNavigate('family')}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-tactile cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{currentLang === 'hi' ? 'सदस्य और फोटो जोड़ें' : 'Add Family Members & Photos'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Featured Family Memory Preview Banner */}
      {featuredMemory && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 p-6 rounded-3xl shadow-elder border-2 border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={featuredMemory.photoUrl}
              alt={featuredMemory.title}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-rose-300 shadow-md shrink-0"
            />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                {currentLang === 'hi' ? 'आज की खास याद' : currentLang === 'as' ? 'আজিৰ বিশেষ স্মৃতি' : 'Featured Family Memory'}
              </span>
              <h4 className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                {featuredMemory.title} ({featuredMemory.dateOrEra})
              </h4>
              <p className="text-xs sm:text-sm text-gray-600 italic mt-0.5 max-w-xl">
                "{featuredMemory.reminiscenceQuestion[currentLang] || featuredMemory.reminiscenceQuestion.en}"
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('memories')}
            type="button"
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-6 rounded-2xl shadow-tactile flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>{currentLang === 'hi' ? 'यादें देखें (+25 XP)' : currentLang === 'as' ? 'স্মৃতি চাওক (+25 XP)' : 'Reminisce (+25 XP)'}</span>
          </button>
        </div>
      )}

      {/* Quick ABHA Linking Modal */}
      {showAbhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 border border-amber-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-extrabold text-gray-900">
                  {currentLang === 'hi' ? 'ABHA स्वास्थ्य पहचान जोड़ें' : 'Link ABHA Health Number'}
                </h3>
              </div>
              <button
                onClick={() => setShowAbhaModal(false)}
                type="button"
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Ayushman Bharat Digital Mission (ABDM) 14-digit ABHA number unlocks digital health records and hospital benefits across India.
            </p>

            {abhaSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center text-emerald-800 font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>ABHA Successfully Linked!</span>
              </div>
            ) : (
              <form onSubmit={handleSaveAbha} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    14-Digit ABHA Number
                  </label>
                  <input
                    type="text"
                    value={abhaInput}
                    onChange={(e) => setAbhaInput(e.target.value)}
                    placeholder="e.g. 91-1234-5678-9012"
                    maxLength={17}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {abhaError && <p className="text-xs text-rose-600 font-bold mt-1">{abhaError}</p>}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill demo ABHA
                      setAbhaInput('91-8273-1928-1123');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    Use Demo ABHA
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Verify & Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Caregiver Status & Unlink Modal */}
      {showCaregiverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-scale-up text-left">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-lg text-gray-900">
                  Caregiver Connection Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCaregiverModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {assignedCaregiver ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <img
                    src={
                      assignedCaregiver.avatarUrl ||
                      `https://api.dicebear.com/9.x/avataaars/svg?seed=${assignedCaregiver.id}&backgroundColor=b6e3f4`
                    }
                    alt={assignedCaregiver.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 bg-white shadow-xs"
                  />
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      🟢 Connected
                    </span>
                    <h4 className="font-extrabold text-base text-gray-900 mt-1">
                      {assignedCaregiver.name}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {assignedCaregiver.email || assignedCaregiver.phone || 'Designated Family Caregiver'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  This caregiver is authorized to view your daily activity routines, cognitive game completion accuracy, and safety alerts.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleUnlinkCaregiver}
                    disabled={unlinkLoading}
                    className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 text-rose-700 font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {unlinkLoading ? <Loader2 className="w-4 h-4 animate-spin text-rose-600" /> : <X className="w-4 h-4 text-rose-600" />}
                    <span>Unlink Caregiver Now</span>
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    Unlinking will instantly revoke the caregiver's access to all your records.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2 font-bold">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-gray-900 text-base">
                    No Caregiver Linked
                  </h4>
                  <p className="text-xs text-amber-900 mt-1">
                    No family caregiver is currently authorized to monitor your profile.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs text-gray-700">
                  <div className="font-bold text-gray-900">How your caregiver can connect:</div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">1.</span>
                    <span>Caregiver visits the <strong>Landing Page</strong> and clicks <strong>Caregiver Portal</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">2.</span>
                    <span>They register or sign in with their Caregiver account.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">3.</span>
                    <span>
                      They connect by entering your unique Connection Code:
                      <span className="inline-flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                        {currentUser.connectionCode || 'Available upon sign-in'}
                        <button
                          type="button"
                          onClick={() => {
                            if (currentUser.connectionCode) {
                              navigator.clipboard.writeText(currentUser.connectionCode);
                              setCopiedCode(true);
                              setTimeout(() => setCopiedCode(false), 2000);
                            }
                          }}
                          className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded hover:bg-blue-700 cursor-pointer"
                        >
                          {copiedCode ? 'Copied!' : 'Copy'}
                        </button>
                      </span>
                      {' or your registered email ('}<strong>{currentUser.email}</strong>{').'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCaregiverModal(false)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
