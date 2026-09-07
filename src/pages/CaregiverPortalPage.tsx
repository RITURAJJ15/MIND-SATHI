import React, { useState, useEffect } from 'react';
import { caregiverService } from '../services/caregiverService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { authService } from '../services/authService';
import { geminiService, CaregiverAIInsightResult } from '../services/geminiService';
import { gameService } from '../services/gameService';
import { dailyPlanService } from '../services/dailyPlanService';
import { familyService } from '../services/familyService';
import { FamilyMember } from '../types/family';
import {
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Heart,
  Activity,
  CheckCircle2,
  Bell,
  Clock,
  Phone,
  ChevronDown,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Award,
  Brain,
  Lock,
  Mail,
  User,
  UserPlus,
  Link as LinkIcon,
  LogOut,
  Users,
  CalendarCheck,
  Loader2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

export const CaregiverPortalPage: React.FC = () => {
  const { currentLang } = useLanguage();
  const { currentUser } = useCurrentUser('caregiver');

  // Authentication gate state
  const isCaregiver = currentUser && currentUser.role === 'caregiver';
  const isElderlyPatient = Boolean(
    currentUser && (currentUser.role === 'elderly' || (currentUser.role as string) === 'patient')
  );
  const [assignedCaregiver, setAssignedCaregiver] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [loadingCaregiverInfo, setLoadingCaregiverInfo] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Patient linking state
  const [assignedPatients, setAssignedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientIdentifier, setPatientIdentifier] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(true);

  // Gemini Caregiver AI Insights state
  const [aiInsight, setAiInsight] = useState<CaregiverAIInsightResult | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [patientFamily, setPatientFamily] = useState<FamilyMember[]>([]);

  // Load assigned patient for authenticated caregiver
  const refreshAssignedPatients = async (caregiverId: string) => {
    setIsLoadingPatients(true);
    try {
      const pts = await caregiverService.getAssignedPatients(caregiverId);
      if (pts && pts.length > 0) {
        setAssignedPatients([pts[0]]);
        const primary = pts[0];
        setSelectedPatient(primary);
        // Load patient family members & latest game sessions from Supabase
        familyService.syncFamilyMembersFromDb(primary.id).then((f) => setPatientFamily(f));
        await gameService.syncSessionsFromDb(primary.id);
        fetchAiInsight(caregiverId, primary.id);
      } else {
        setAssignedPatients([]);
        setSelectedPatient(null);
        // Load available patients to help user link
        caregiverService.getAvailablePatients().then((av) => setAvailablePatients(av));
      }
    } catch (e) {
      console.warn('Error loading assigned patients:', e);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (isCaregiver && currentUser?.id) {
      refreshAssignedPatients(currentUser.id);
    } else {
      setIsLoadingPatients(false);
    }
  }, [isCaregiver, currentUser?.id]);

  useEffect(() => {
    if (isElderlyPatient && currentUser?.id) {
      setLoadingCaregiverInfo(true);
      caregiverService
        .getAssignedCaregiverForPatient(currentUser.id)
        .then((cg) => {
          setAssignedCaregiver(cg);
        })
        .catch(() => {})
        .finally(() => {
          setLoadingCaregiverInfo(false);
        });
    }
  }, [isElderlyPatient, currentUser?.id]);

  const handleCopyPatientId = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const fetchAiInsight = async (caregiverId: string, patientId: string) => {
    if (!caregiverId || !patientId) return;
    setIsGeneratingAi(true);
    try {
      const insight = await geminiService.generateCaregiverInsights(
        caregiverId,
        patientId,
        currentLang
      );
      setAiInsight(insight);
    } catch (err) {
      console.warn('Error fetching AI caregiver insight:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Handle Caregiver Login
  const handleCaregiverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await authService.login({
        email: authEmail.trim(),
        password: authPassword.trim(),
      });

      if (!res.success || !res.data) {
        setAuthError(res.error?.message || 'Login failed. Please verify your credentials.');
      } else if (res.data.user.role !== 'caregiver') {
        setAuthError('This account is registered as ' + res.data.user.role + '. Please sign in with a Caregiver account.');
      } else {
        // Immediately fetch connected patient
        await refreshAssignedPatients(res.data.user.id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Caregiver Registration
  const handleCaregiverRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authName.trim() || !authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill in all required fields.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await authService.register({
        name: authName.trim(),
        email: authEmail.trim().toLowerCase(),
        mobile: authMobile.trim(),
        password: authPassword.trim(),
        confirmPassword: authPassword.trim(),
        role: 'caregiver',
      });

      if (!res.success) {
        setAuthError(res.error?.message || 'Registration failed. Email may already be in use.');
      } else if (res.data?.user?.id) {
        await refreshAssignedPatients(res.data.user.id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error creating account.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Linking Patient (1-to-1 Connection)
  const handleLinkPatient = async (targetIdOrEmail: string) => {
    if (!currentUser?.id) return;
    setLinkError('');
    setLinkLoading(true);

    try {
      const res = await caregiverService.linkPatientToCaregiver(currentUser.id, targetIdOrEmail);
      if (!res.success || !res.patient) {
        setLinkError(res.error || 'Could not connect to patient.');
      } else {
        setShowLinkModal(false);
        setPatientIdentifier('');
        if (res.patient) {
          authService.setLinkedPatient(res.patient);
        }
        await refreshAssignedPatients(currentUser.id);
      }
    } catch (err: any) {
      setLinkError(err.message || 'Error connecting to patient.');
    } finally {
      setLinkLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: AUTHENTICATION GATE (User is not logged in as a Caregiver)
  // ──────────────────────────────────────────────────────────────────────────
  if (!isCaregiver) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in space-y-6">
        {/* Patient Status & Linking Information if logged in as elderly patient */}
        {isElderlyPatient && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-emerald-200 text-left">
            {loadingCaregiverInfo ? (
              <div className="flex items-center justify-center py-6 gap-3 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-sm font-semibold">Checking caregiver status...</span>
              </div>
            ) : assignedCaregiver ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center border border-emerald-300">
                    <ShieldCheck className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Active Linked Caregiver
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-1">
                      {assignedCaregiver.name || assignedCaregiver.preferredName}
                    </h3>
                  </div>
                </div>
                <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100 space-y-2 text-sm">
                  {assignedCaregiver.phone && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold">{assignedCaregiver.phone}</span>
                    </div>
                  )}
                  {assignedCaregiver.email && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold">{assignedCaregiver.email}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 pt-2 border-t border-emerald-200/60">
                    Your caregiver has secure real-time access to your daily cognitive scores, medication reminders, and safety updates.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center border border-amber-300">
                    <AlertTriangle className="w-6 h-6 text-amber-700" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      No Caregiver Assigned Yet
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-1">
                      Link Your Family Caregiver
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  You are signed in as <strong>{currentUser?.name || currentUser?.preferredName || 'Patient'}</strong>. To allow your son, daughter, or designated caregiver to view your daily health summary and memory vault, share your unique Patient ID below:
                </p>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 mb-4">
                  <div className="text-xs font-bold text-amber-900 mb-1">YOUR UNIQUE PATIENT ID</div>
                  <div className="flex items-center justify-between gap-2 bg-white rounded-xl px-4 py-2.5 border border-amber-300 font-mono text-xs sm:text-sm font-bold text-gray-900">
                    <span className="truncate select-all">{currentUser?.id}</span>
                    <button
                      type="button"
                      onClick={handleCopyPatientId}
                      className="shrink-0 flex items-center gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId ? 'Copied!' : 'Copy ID'}</span>
                    </button>
                  </div>
                  {currentUser?.email && (
                    <div className="mt-2 text-xs text-gray-600">
                      Registered Email: <span className="font-semibold text-gray-900">{currentUser.email}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  Your caregiver can enter this Patient ID or your registered email when they create their account or sign in below.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-8 rounded-3xl shadow-elder border border-emerald-200 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-300 shadow-sm">
            <UserCheck className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {currentLang === 'hi' ? 'देखभालकर्ता पोर्टल (Caregiver Portal)' : 'Caregiver Oversight & Safety Hub'}
          </h2>
          <p className="text-sm text-gray-600 mt-2 mb-6 leading-relaxed">
            {isElderlyPatient
              ? 'Are you this patient’s family caregiver? Sign in with your caregiver account or register a new one below to connect.'
              : 'To safeguard senior cognitive health records and view real telemetry, please sign in with your verified Caregiver credentials or create a new Caregiver account.'}
          </p>

          {/* Auth Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Caregiver Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Create Caregiver Account
            </button>
          </div>

          {authError && (
            <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{authError}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleCaregiverLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Caregiver Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="caregiver@example.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                <span>Sign In as Caregiver</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleCaregiverRegister} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Caregiver Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="caregiver@gmail.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (+91)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={authMobile}
                    onChange={(e) => setAuthMobile(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Create Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Create Caregiver Account</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Loading state while verifying connected senior from database ──
  if (isLoadingPatients) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-elder border border-emerald-200">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-900">
            {currentLang === 'hi' ? 'वरिष्ठ मरीज़ प्रोफ़ाइल लोड हो रही है...' : 'Loading Connected Senior Profile...'}
          </h3>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Retrieving real-time cognitive accuracy, daily activity plan, and AI progress summary from the secure database.
          </p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: CAREGIVER LOGGED IN BUT NO PATIENT LINKED YET (1-to-1 Connection)
  // ──────────────────────────────────────────────────────────────────────────
  if (assignedPatients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-elder border border-amber-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-3xl flex items-center justify-center mx-auto mb-3 border border-amber-300">
              <LinkIcon className="w-8 h-8 text-amber-700" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">
              Connect to Your Senior (Patient)
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
              Every elderly patient report connects strictly to <strong>one caregiver</strong>. Enter your loved one's registered email, phone number, or patient code.
            </p>
          </div>

          {linkError && (
            <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{linkError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLinkPatient(patientIdentifier);
            }}
            className="space-y-4 mb-6"
          >
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Senior's Registered Email or Phone Number
              </label>
              <input
                type="text"
                required
                value={patientIdentifier}
                onChange={(e) => setPatientIdentifier(e.target.value)}
                placeholder="e.g. biren.borah@gmail.com or +91 94350 12890"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={linkLoading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              <span>Link Patient & Access Dashboard</span>
            </button>
          </form>

          {/* Quick Picker for Registered Unassigned Elders */}
          {availablePatients.length > 0 && (
            <div className="border-t border-gray-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Or Select From Available Registered Elders:
              </h4>
              <div className="space-y-2">
                {availablePatients.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-2xl flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={p.profile_photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'}
                        alt={p.full_name}
                        className="w-10 h-10 rounded-xl object-cover border border-gray-300"
                      />
                      <div>
                        <div className="font-extrabold text-sm text-gray-900">{p.full_name} ({p.age || 70} yrs)</div>
                        <div className="text-xs text-gray-500">{p.email || p.phone || p.city}</div>
                      </div>
                    </div>

                    {p.isLinkedToOther ? (
                      <span className="text-[11px] font-bold text-gray-400 bg-gray-200 px-2.5 py-1 rounded-lg">
                        Already Linked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLinkPatient(p.id)}
                        className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 3: FULL CAREGIVER DASHBOARD FOR LINKED PATIENT
  // ──────────────────────────────────────────────────────────────────────────
  const elderId = selectedPatient.id;
  const status = caregiverService.getElderCognitiveStatus(elderId);
  const moods = caregiverService.getMoodsForUser(elderId);
  const alerts = caregiverService.getAlertsForElder(elderId);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-elder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-7 h-7 text-emerald-300" />
            <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-200">
              CAREGIVER MONITORING SUITE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {currentLang === 'hi' ? 'देखभालकर्ता निगरानी केंद्र (Caregiver Portal)' : 'Caregiver Oversight & Safety Hub'}
          </h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            Real-time cognitive telemetry, game records, and Gemini AI insights for <strong>{selectedPatient.full_name || selectedPatient.name}</strong>.
          </p>
        </div>

        {/* Monitored Senior Status Badge */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0 flex items-center gap-3.5">
          <img
            src={
              selectedPatient.profile_photo_url ||
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'
            }
            alt={selectedPatient.full_name}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-300 shadow-sm"
          />
          <div className="text-left">
            <div className="text-xs text-emerald-200 font-bold uppercase">Linked Senior</div>
            <div className="text-base font-black text-white">
              {selectedPatient.full_name} ({selectedPatient.age || 72} yrs)
            </div>
            <div className="text-xs text-emerald-300 flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{status.playedToday ? 'Played Games Today' : 'Pending Routine'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* STRICT 1-TO-1 CONNECTED SENIOR DOSSIER */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-emerald-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={
                  selectedPatient.profile_photo_url ||
                  selectedPatient.avatarUrl ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'
                }
                alt={selectedPatient.full_name || selectedPatient.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Connected & Active" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-gray-900">
                  {selectedPatient.full_name || selectedPatient.name}
                </h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Strict 1-to-1 Connected Senior</span>
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedPatient.age || 72} years old • {selectedPatient.gender ? (selectedPatient.gender === 'female' ? 'Female' : 'Male') : 'Senior'} • {selectedPatient.city || 'Guwahati'}, {selectedPatient.state || 'Assam'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLinkModal(true);
                caregiverService.getAvailablePatients().then((av) => setAvailablePatients(av));
              }}
              className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-gray-200"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Change Connected Senior</span>
            </button>
          </div>
        </div>

        {/* Detailed Senior Data Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registered Phone</div>
            <div className="text-xs font-extrabold text-gray-800 mt-0.5 truncate">
              {selectedPatient.phone || 'Not provided'}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registered Email</div>
            <div className="text-xs font-extrabold text-gray-800 mt-0.5 truncate">
              {selectedPatient.email || 'Not provided'}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ABHA Status</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {selectedPatient.abha_id || selectedPatient.abhaId ? (
                <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{selectedPatient.abha_id || selectedPatient.abhaId}</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-gray-400">Not Linked</span>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ayushman PM-JAY</div>
            <div className="text-xs font-extrabold text-gray-800 mt-0.5 truncate">
              {selectedPatient.pmjay_id || selectedPatient.pmjayId ? (
                <span className="text-emerald-700">Enrolled ({selectedPatient.pmjay_id || selectedPatient.pmjayId})</span>
              ) : (
                <span className="text-gray-400">Not Enrolled</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vital Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">Cognitive Accuracy</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">
            {status.recentAccuracy > 0 ? `${status.recentAccuracy}%` : 'Pending'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {status.totalSessionsCount} recorded session{status.totalSessionsCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">Today's Activity Plan</span>
            <CalendarCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700">
            {status.todayPlanCompleted} / {status.todayPlanTotal}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {status.planProgressPercent}% tasks completed today
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">Practice Streak</span>
            <Activity className="w-5 h-5 text-sathi-600" />
          </div>
          <div className="text-2xl font-extrabold text-sathi-700">
            {selectedPatient.streak_days || 1} Days
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Total XP: {selectedPatient.total_xp || 50} pts
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-elder border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">Safety Status</span>
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-900">
            {alerts.filter((a) => !a.acknowledged && a.severity === 'urgent').length === 0 ? 'Normal' : 'Attention'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {alerts.filter((a) => !a.acknowledged).length} pending alert(s)
          </p>
        </div>
      </div>

      {/* GEMINI CAREGIVER AI INSIGHTS CARD */}
      <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 p-6 sm:p-7 rounded-3xl shadow-elder border-2 border-purple-200 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-gray-900">
                  {currentLang === 'hi' ? 'AI संज्ञानात्मक प्रगति विश्लेषण' : 'AI Cognitive Progress & Trend Summary'}
                </h3>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                  Gemini AI Grounded
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Grounded strictly in {selectedPatient.full_name}'s real game telemetry and routine completion
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchAiInsight(currentUser?.id || '', elderId)}
            disabled={isGeneratingAi}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition-all shadow-sm disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
            <span>{isGeneratingAi ? 'Analyzing...' : 'Refresh AI Analysis'}</span>
          </button>
        </div>

        {/* Cognitive Summary */}
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-purple-100 mb-4 shadow-xs">
          <p className="text-sm text-gray-800 font-medium leading-relaxed">
            {aiInsight?.cognitiveSummary ||
              `${selectedPatient.full_name} is actively monitored. Baseline responses and daily activities show regular engagement.`}
          </p>
        </div>

        {/* Strengths & Areas for Support */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase mb-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Observed Strengths</span>
            </div>
            <ul className="space-y-1.5">
              {(aiInsight?.strengths || [
                'Consistent attendance during daily activity routines',
                'Strong engagement with visual recall games',
              ]).map((s, idx) => (
                <li key={idx} className="text-xs text-emerald-950 flex items-start gap-1.5 font-medium">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>Areas for Support & Adaptation</span>
            </div>
            <ul className="space-y-1.5">
              {(aiInsight?.areasForSupport || [
                'Allow extra time for arithmetic calculations in Market Math',
                'Gentle encouragement to maintain hydration goals',
              ]).map((a, idx) => (
                <li key={idx} className="text-xs text-amber-950 flex items-start gap-1.5 font-medium">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Caregiver Daily Recommendations */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Recommended Caregiver Actions Today</span>
          </h4>
          <div className="space-y-2">
            {(aiInsight?.recommendationsForCaregiver || [
              'Prompt a 5-minute memory game session following morning tea.',
              'Encourage viewing family photos to stimulate autobiographical memory recall.',
            ]).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{r}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100 italic">
            Disclaimer: Non-diagnostic cognitive wellness telemetry. MIND SATHI provides observational support only.
          </p>
        </div>
      </div>

      {/* Patient's Registered Family Members with Photos */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-rose-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-600" />
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">
                {selectedPatient.full_name}'s Registered Family Network
              </h3>
              <p className="text-xs text-gray-500">
                Family members uploaded by the patient for 1-Tap Calling and Memory Games
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-rose-100 text-rose-800 px-3 py-1 rounded-full border border-rose-300">
            {patientFamily.length} Family Contacts
          </span>
        </div>

        {patientFamily.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {patientFamily.map((fam) => (
              <div
                key={fam.id}
                className="bg-rose-50/50 border border-rose-200 rounded-2xl p-3 flex flex-col items-center text-center shadow-xs"
              >
                <img
                  src={fam.photoUrl}
                  alt={fam.name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-rose-300 mb-1.5 bg-white"
                />
                <div className="font-extrabold text-xs text-gray-900 truncate w-full">{fam.name}</div>
                <div className="text-[10px] font-bold text-rose-700">
                  {typeof fam.relationship === 'string' ? fam.relationship : (fam.relationship as any)?.en}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{fam.phone}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic text-center py-4">
            No family members registered by {selectedPatient.full_name} yet.
          </p>
        )}
      </div>

      {/* Safety & SOS Alerts Section */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <span>Safety & Health Alerts</span>
          </h3>
          <span className="text-xs font-bold text-gray-500">
            {alerts.filter((a) => !a.acknowledged).length} Pending
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                  a.severity === 'urgent'
                    ? 'bg-red-50 border-red-300 text-red-950'
                    : a.severity === 'warning'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-blue-50/50 border-blue-200 text-blue-950'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      a.severity === 'urgent' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {a.severity}
                    </span>
                    <h4 className="font-extrabold text-base truncate">{a.title}</h4>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{a.message}</p>
                </div>

                {!a.acknowledged && (
                  <button
                    onClick={() => {
                      caregiverService.acknowledgeAlert(a.id);
                    }}
                    type="button"
                    className="bg-white hover:bg-gray-100 text-gray-800 font-bold px-4 py-2 rounded-xl text-xs border border-gray-300 shadow-sm cursor-pointer shrink-0"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-500">
            ✓ No urgent alerts. {selectedPatient.full_name}'s safety status is optimal.
          </div>
        )}
      </div>

      {/* MODAL: Change / Connect Senior (Enforcing 1-to-1) */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-lg text-gray-900">
                  Switch Connected Senior
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowLinkModal(false); setLinkError(''); }}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              MIND SATHI maintains a <strong>Strict 1 Patient ↔ 1 Caregiver relationship</strong>. Connecting a new senior will rebind your caregiver access to that senior.
            </p>

            {linkError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{linkError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLinkPatient(patientIdentifier);
              }}
              className="space-y-3 mb-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Senior's Registered Email or Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={patientIdentifier}
                  onChange={(e) => setPatientIdentifier(e.target.value)}
                  placeholder="e.g. dadi@mindsathi.in or 9876543210"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowLinkModal(false); setLinkError(''); }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {linkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  <span>Connect Senior</span>
                </button>
              </div>
            </form>

            {availablePatients.length > 0 && (
              <div className="border-t border-gray-100 pt-3 max-h-56 overflow-y-auto space-y-2">
                <div className="text-[11px] font-bold uppercase text-gray-400">Available Registered Seniors:</div>
                {availablePatients.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={p.profile_photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'}
                        alt={p.full_name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-900 truncate">{p.full_name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{p.email || p.phone}</div>
                      </div>
                    </div>
                    {p.isLinkedToOther ? (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded">Linked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLinkPatient(p.id)}
                        className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
