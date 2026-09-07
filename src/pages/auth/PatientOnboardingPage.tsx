import React, { useState } from 'react';
import {
  User,
  Users,
  Heart,
  Settings,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Camera,
  Star,
  ShieldCheck,
  Volume2,
  Type,
  MapPin,
  Calendar,
  Upload,
  Loader2,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { familyService } from '../../services/familyService';
import { storageService } from '../../services/storageService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { SupportedLanguage } from '../../types/user';
import { RelationshipType, FamilyMember } from '../../types/family';
import { LANGUAGE_META } from '../../data/translations';
import { AshokaChakraIcon } from '../../components/layout/AshokaChakraIcon';

interface PatientOnboardingPageProps {
  onComplete: () => void;
}

const NORTHEAST_STATES = [
  'Assam',
  'Meghalaya',
  'Manipur',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Arunachal Pradesh',
  'Sikkim',
  'West Bengal',
  'Other Indian State',
];

const RELATIONSHIP_OPTIONS: RelationshipType[] = [
  'Son',
  'Daughter',
  'Spouse',
  'Brother',
  'Sister',
  'Grandchild',
  'Friend',
  'Caregiver',
  'Other',
];

// Curated realistic friendly photos for family avatars
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
];

export const PatientOnboardingPage: React.FC<PatientOnboardingPageProps> = ({ onComplete }) => {
  const { currentUser } = useCurrentUser();
  const { currentLang, changeLanguage } = useLanguage();

  // Current wizard step: 1 (Personal Details) | 2 (Family Setup) | 3 (Preferences)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Personal Details
  const [name, setName] = useState(currentUser?.name || 'Biren Borah');
  const [preferredName, setPreferredName] = useState(currentUser?.preferredName || 'Bora Da');
  const [age, setAge] = useState<number>(currentUser?.age || 72);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(currentUser?.gender || 'male');
  const [state, setState] = useState(currentUser?.state || 'Assam');
  const [city, setCity] = useState(currentUser?.city || 'Guwahati');
  const [preferredLang, setPreferredLang] = useState<SupportedLanguage>(currentLang || 'as');
  const [emergencyName, setEmergencyName] = useState('Priyobrata Borah');
  const [emergencyPhone, setEmergencyPhone] = useState('+91 94350 12890');
  const [emergencyRel, setEmergencyRel] = useState('Son');

  // Step 2: Dynamic Family Setup
  const [familyCount, setFamilyCount] = useState<number>(3);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [familyList, setFamilyList] = useState<FamilyMember[]>([
    {
      id: 'fam-onboard-1',
      userId: currentUser?.id || 'current',
      name: 'Priyobrata Borah',
      relationship: { en: 'Son', hi: 'बेटा', as: 'ল’ৰা (পুত্ৰ)' },
      relationType: 'Son',
      photoUrl: AVATAR_PRESETS[0],
      phone: '+91 94350 12890',
      email: 'priyo.borah@gmail.com',
      isFavorite: true,
      isPrimaryContact: true,
      isOnline: true,
      city: 'Guwahati, Assam',
    },
    {
      id: 'fam-onboard-2',
      userId: currentUser?.id || 'current',
      name: 'Ananya Phukan',
      relationship: { en: 'Daughter', hi: 'बेटी', as: 'জীয়াৰী' },
      relationType: 'Daughter',
      photoUrl: AVATAR_PRESETS[1],
      phone: '+91 98640 45210',
      email: 'ananya.p@outlook.com',
      isFavorite: true,
      isPrimaryContact: false,
      isOnline: false,
      city: 'Shillong, Meghalaya',
    },
    {
      id: 'fam-onboard-3',
      userId: currentUser?.id || 'current',
      name: 'Aarav Borah',
      relationship: { en: 'Grandchild', hi: 'पोता', as: 'নাতি' },
      relationType: 'Grandchild',
      photoUrl: AVATAR_PRESETS[4],
      phone: '+91 91010 33241',
      isFavorite: false,
      isPrimaryContact: false,
      isOnline: true,
      city: 'Guwahati, Assam',
    },
  ]);

  // Step 3: Preferences
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extralarge'>('large');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [textToSpeechAuto, setTextToSpeechAuto] = useState<boolean>(true);
  const [soundEffects, setSoundEffects] = useState<boolean>(true);

  // Synchronize family card count
  const handleCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(8, count));
    setFamilyCount(validCount);
    if (validCount > familyList.length) {
      const added: FamilyMember[] = [];
      for (let i = familyList.length; i < validCount; i++) {
        added.push({
          id: `fam-dyn-${Date.now()}-${i}`,
          userId: currentUser?.id || 'current',
          name: i === 3 ? 'Kalyani Borah' : `Family Member ${i + 1}`,
          relationship: { en: 'Spouse', hi: 'जीवनसाथी', as: 'পত্নী' },
          relationType: 'Spouse',
          photoUrl: AVATAR_PRESETS[i % AVATAR_PRESETS.length],
          phone: '+91 94350 00000',
          isFavorite: false,
          isPrimaryContact: false,
          isOnline: false,
          city: state,
        });
      }
      setFamilyList([...familyList, ...added]);
    } else if (validCount < familyList.length) {
      setFamilyList(familyList.slice(0, validCount));
    }
  };

  const updateFamilyMemberField = (index: number, updates: Partial<FamilyMember>) => {
    setFamilyList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const handleFinishOnboarding = () => {
    // Save profile to authService
    try {
      authService.updateCurrentUserProfile({
        name,
        preferredName,
        age,
        gender,
        state,
        city,
        northeastRegion: state,
        primaryLanguage: preferredLang,
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRel,
        },
        accessibility: {
          fontSize,
          highContrast,
          textToSpeechAuto,
          soundEffects,
          speechRate: 0.85,
        },
        hasCompletedOnboarding: true,
        familyMemberCount: familyList.length,
      });

      // Save family members to familyService
      if (currentUser?.id) {
        familyService.setFamilyMembersForUser(currentUser.id, familyList);
      }
    } catch (e) {
      console.error('Error saving onboarding info', e);
    }

    onComplete();
  };

  const stepsList = [
    { num: 1, label: 'Personal Details', icon: User },
    { num: 2, label: 'Family Setup', icon: Users },
    { num: 3, label: 'Preferences', icon: Settings },
  ];

  const inputBase =
    'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500 focus:border-sathi-500 transition-all';

  return (
    <div className="bg-white rounded-3xl shadow-elder border border-amber-200/90 p-6 sm:p-10 w-full max-w-2xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center gap-1.5 bg-amber-100/90 text-amber-900 text-xs font-black px-3.5 py-1.5 rounded-full border border-amber-300 mb-3">
          <AshokaChakraIcon size={12} className="text-blue-800" />
          <span>MIND SATHI ONBOARDING</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Welcome to Your Cognitive Companion
        </h1>
        <p className="text-sm text-gray-600 mt-1.5 max-w-md mx-auto">
          Let's tailor your experience with family connections and accessible comfort.
        </p>
      </div>

      {/* Progress Indicator: Account -> Personal Details -> Family -> Preferences -> Dashboard */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative max-w-md mx-auto">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-gray-200 -z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-sathi-600 transition-all duration-300 -z-0"
            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
          />

          {stepsList.map((step) => {
            const isDone = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            const StepIcon = step.icon;
            return (
              <div key={step.num} className="flex flex-col items-center z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-sathi-600 text-white shadow-md ring-4 ring-sathi-100 scale-105'
                      : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}
                >
                  {isDone ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[11px] font-extrabold mt-1.5 whitespace-nowrap ${
                    isCurrent ? 'text-sathi-800' : isDone ? 'text-emerald-700' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: PERSONAL DETAILS */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-sathi-600" />
              <span>Step 1: Patient Profile & Region</span>
            </h2>
            <p className="text-xs text-gray-500">
              Personalized for familiar cultural context and senior safety.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Patient Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biren Borah"
                className={inputBase}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                How should we address you? (Nickname/Title)
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="e.g. Dadi Ji, Bora Da, Aji"
                className={inputBase}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 70)}
                className={inputBase}
                min={40}
                max={110}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className={`${inputBase} cursor-pointer`}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Preferred Language</label>
              <select
                value={preferredLang}
                onChange={(e) => {
                  const val = e.target.value as SupportedLanguage;
                  setPreferredLang(val);
                  changeLanguage(val);
                }}
                className={`${inputBase} cursor-pointer`}
              >
                {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_META[code].nativeName} ({LANGUAGE_META[code].label})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>State / Region in Northeast India</span>
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={`${inputBase} cursor-pointer`}
              >
                {NORTHEAST_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">City / Hometown</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Guwahati, Imphal, Aizawl, Shillong"
                className={inputBase}
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-800 mb-2.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-rose-600" />
              <span>Emergency Primary Contact</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Contact Name"
                className="bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="Phone (+91)"
                className="bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text"
                value={emergencyRel}
                onChange={(e) => setEmergencyRel(e.target.value)}
                placeholder="Relationship (e.g. Son)"
                className="bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: DYNAMIC FAMILY SETUP */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              <span>Step 2: Family & Loved Ones Setup</span>
            </h2>
            <p className="text-xs text-gray-500">
              These photos and contacts power your 1-Tap Calling and the Family Memory Game.
            </p>
          </div>

          {/* Question: How many members are there in your family? */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-amber-950">
                How many members are there in your family?
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Select below to create dynamic profile cards for each member.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleCountChange(num)}
                  className={`w-9 h-9 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    familyCount === num
                      ? 'bg-sathi-600 text-white shadow-sm scale-105'
                      : 'bg-white text-gray-700 border border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload Tip Banner */}
          <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-extrabold text-gray-900 block">Personalize with Real Family Photos</span>
              <span className="text-gray-600">
                Upload real photos of your children, grandchildren, and loved ones. The <strong>Family Recognition Game</strong> and 1-Tap Calling will automatically use these photos!
              </span>
            </div>
          </div>

          {/* Dynamically created Family Member Cards */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {familyList.map((member, idx) => (
              <div
                key={member.id || idx}
                className="bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 transition-all hover:border-sathi-300"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Photo picker / Avatar / Real Photo Upload */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="relative group">
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-sathi-300 shadow-md bg-white"
                      />
                      {uploadingIndex === idx && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sathi-600 hover:bg-sathi-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-xs">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingIndex === idx}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingIndex(idx);
                              try {
                                const photoUrl = await storageService.processAndStorePhoto(
                                  'family-photos',
                                  currentUser?.id || 'patient-onboarding',
                                  file,
                                  file.name
                                );
                                updateFamilyMemberField(idx, { photoUrl });
                              } catch (err) {
                                console.warn('Photo upload error:', err);
                              } finally {
                                setUploadingIndex(null);
                              }
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const nextAvatar = AVATAR_PRESETS[(idx + 1) % AVATAR_PRESETS.length];
                          updateFamilyMemberField(idx, { photoUrl: nextAvatar });
                        }}
                        className="p-1 rounded-lg bg-white border border-gray-300 text-gray-600 hover:text-sathi-600 hover:border-sathi-300 text-[11px] font-medium transition-all"
                        title="Cycle preset avatars"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => updateFamilyMemberField(idx, { name: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-sathi-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Relationship</label>
                      <select
                        value={typeof member.relationship === 'string' ? member.relationship : member.relationType || 'Son'}
                        onChange={(e) => {
                          const rel = e.target.value;
                          updateFamilyMemberField(idx, {
                            relationType: rel,
                            relationship: { en: rel, hi: rel, as: rel },
                          });
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-sathi-500 focus:outline-none cursor-pointer"
                      >
                        {RELATIONSHIP_OPTIONS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={member.phone}
                        onChange={(e) => updateFamilyMemberField(idx, { phone: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-sathi-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Optional Email</label>
                      <input
                        type="email"
                        value={member.email || ''}
                        onChange={(e) => updateFamilyMemberField(idx, { email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-sathi-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Favorite / Primary Contact Toggle */}
                  <div className="flex sm:flex-col items-center gap-2 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => updateFamilyMemberField(idx, { isFavorite: !member.isFavorite })}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        member.isFavorite
                          ? 'bg-amber-100 text-amber-600 border-amber-300'
                          : 'bg-white text-gray-400 border-gray-200 hover:text-amber-500'
                      }`}
                      title={member.isFavorite ? 'Favorite contact' : 'Mark as favorite'}
                    >
                      <Star className={`w-4 h-4 ${member.isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>

                    <span className="text-[10px] font-bold text-gray-500">
                      {member.isFavorite ? 'Primary' : 'Normal'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: PREFERENCES & ACCESSIBILITY */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-sathi-600" />
              <span>Step 3: Senior Accessibility & Comfort</span>
            </h2>
            <p className="text-xs text-gray-500">
              Choose text size and sound options designed specifically for elderly readability.
            </p>
          </div>

          {/* Text Size */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-sathi-600" />
              <span>Reading Text Size</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'normal', label: 'Regular', sample: 'Aa (16px)' },
                { key: 'large', label: 'Large (Recommended)', sample: 'Aa (18px)' },
                { key: 'extralarge', label: 'Extra Large', sample: 'Aa (22px)' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFontSize(opt.key as any)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    fontSize === opt.key
                      ? 'bg-sathi-600 text-white border-sathi-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{opt.sample}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Assistance */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Voice Assistance (Text-to-Speech)</div>
                <div className="text-xs text-gray-600">
                  Read aloud daily instructions, games, and reminders automatically
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={textToSpeechAuto}
              onChange={(e) => setTextToSpeechAuto(e.target.checked)}
              className="w-5 h-5 rounded text-sathi-600 cursor-pointer"
            />
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
            <div>
              <div className="text-sm font-bold text-gray-900">High Contrast Palette</div>
              <div className="text-xs text-gray-600">
                Enhance visual separation of buttons and text for low-vision clarity
              </div>
            </div>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="w-5 h-5 rounded text-sathi-600 cursor-pointer"
            />
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
            <div>
              <div className="text-sm font-bold text-gray-900">Audio Chimes & Feedback</div>
              <div className="text-xs text-gray-600">
                Soft gentle Indian chimes when finishing games or tasks
              </div>
            </div>
            <input
              type="checkbox"
              checked={soundEffects}
              onChange={(e) => setSoundEffects(e.target.checked)}
              className="w-5 h-5 rounded text-sathi-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Navigation Buttons: Back, Continue / Complete */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={() => setCurrentStep(currentStep - 1)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 font-bold text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleFinishOnboarding}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            Skip for now
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-2 bg-sathi-600 hover:bg-sathi-700 text-white font-bold px-6 py-3 rounded-xl shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-xl shadow-tactile transition-all cursor-pointer active:translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open Patient Dashboard</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
