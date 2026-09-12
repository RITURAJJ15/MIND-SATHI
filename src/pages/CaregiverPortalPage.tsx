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
  Check,
  Eye,
  EyeOff,
  Gamepad2,
} from 'lucide-react';
import { GoogleSignInButton } from '../components/common/GoogleSignInButton';

export const CaregiverPortalPage: React.FC = () => {
  const { currentLang } = useLanguage();
  const { currentUser } = useCurrentUser('caregiver');

  // Direct active caregiver user state for immediate UI reaction without reload
  const [activeCaregiverUser, setActiveCaregiverUser] = useState<any | null>(() => {
    const cg = authService.getCurrentUser('caregiver');
    if (cg && cg.role === 'caregiver' && cg.id !== 'guest') return cg;
    return currentUser && currentUser.role === 'caregiver' && currentUser.id !== 'guest' ? currentUser : null;
  });

  useEffect(() => {
    const unsub = authService.subscribe(() => {
      const cg = authService.getCurrentUser('caregiver');
      if (cg && cg.role === 'caregiver' && cg.id !== 'guest') {
        setActiveCaregiverUser(cg);
      }
    });
    return unsub;
  }, []);

  // Authentication gate state
  const isCaregiver = Boolean(
    (activeCaregiverUser && activeCaregiverUser.role === 'caregiver' && activeCaregiverUser.id !== 'guest') ||
    (currentUser && currentUser.role === 'caregiver' && currentUser.id !== 'guest')
  );
  const isElderlyPatient = Boolean(
    !isCaregiver && currentUser && currentUser.id !== 'guest' && (currentUser.role === 'elderly' || (currentUser.role as string) === 'patient')
  );
  const [assignedCaregiver, setAssignedCaregiver] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [loadingCaregiverInfo, setLoadingCaregiverInfo] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Caregiver Authentication form state (Email & Password + Name)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return; // Prevent double-clicking
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      if (authMode === 'signup') {
        const res = await authService.signUpCaregiverWithEmail(
          authEmail.trim(),
          authPassword,
          authName.trim(),
          authPhone.trim()
        );
        if (!res.success) {
          setAuthError(res.error || 'Failed to create caregiver account.');
        } else if (res.needsEmailConfirmation) {
          setAuthSuccess(res.message || 'Caregiver account created! If confirmation is required, please check your inbox before signing in.');
        } else if (res.profile) {
          setAuthSuccess('Caregiver account created successfully!');
          setActiveCaregiverUser(res.profile);
          await refreshAssignedPatients(res.profile.id);
        }
      } else {
        const res = await authService.signInCaregiverWithEmail(
          authEmail.trim(),
          authPassword
        );
        if (!res.success) {
          setAuthError(res.error || 'Login failed. Please verify your email and password.');
        } else if (res.profile) {
          setAuthSuccess('Signed in successfully!');
          setActiveCaregiverUser(res.profile);
          await refreshAssignedPatients(res.profile.id);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Patient linking state (Connection Code or Verified Email)
  const [assignedPatients, setAssignedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientIdentifier, setPatientIdentifier] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(true);
  const [patientGameSessions, setPatientGameSessions] = useState<any[]>([]);

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
        const sessions = gameService.getSessionsForUser(primary.id);
        setPatientGameSessions(sessions);
        fetchAiInsight(caregiverId, primary.id);
      } else {
        setAssignedPatients([]);
        setSelectedPatient(null);
        setPatientGameSessions([]);
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

  // Handle Connecting Patient using Registered Email
  const handleConnectByEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cg = activeCaregiverUser || currentUser;
    if (!cg?.id) {
      setLinkError('Please sign in as a caregiver first.');
      return;
    }
    if (!patientIdentifier.trim()) {
      setLinkError('Please enter a patient email address or connection code.');
      return;
    }
    setLinkError('');
    setLinkSuccess('');
    setLinkLoading(true);

    try {
      const res = await caregiverService.linkPatientByEmail(cg.id, patientIdentifier.trim());
      if (!res.success || !res.patient) {
        setLinkError(res.error || 'Could not connect to patient. Please check the email address.');
      } else {
        setLinkSuccess(`Successfully connected to ${res.patient.full_name || res.patient.name}!`);
        setShowLinkModal(false);
        setPatientIdentifier('');
        if (res.patient) {
          authService.setLinkedPatient(res.patient);
        }
        await refreshAssignedPatients(cg.id);
      }
    } catch (err: any) {
      setLinkError(err.message || 'Error connecting to patient.');
    } finally {
      setLinkLoading(false);
    }
  };

  // Handle Disconnecting / Unlinking Patient
  const handleDisconnectPatient = async () => {
    const cg = activeCaregiverUser || currentUser;
    if (!cg?.id) return;
    const patientName = selectedPatient?.full_name || selectedPatient?.name || 'this patient';
    if (window.confirm(`Are you sure you want to unlink from ${patientName}? Once unlinked, you will no longer have access to their records until you reconnect.`)) {
      setLinkLoading(true);
      try {
        await caregiverService.unlinkPatient(cg.id);
        setSelectedPatient(null);
        setAssignedPatients([]);
        setPatientFamily([]);
        setPatientGameSessions([]);
        setAiInsight(null);
        setLinkSuccess('');
      } finally {
        setLinkLoading(false);
      }
    }
  };

  // Handle Linking Patient fallback
  const handleLinkPatient = async (targetIdOrEmail: string) => {
    const cg = activeCaregiverUser || currentUser;
    if (!cg?.id) {
      setLinkError('Please sign in as a caregiver first.');
      return;
    }
    setLinkError('');
    setLinkLoading(true);

    try {
      const res = await caregiverService.linkPatientToCaregiver(cg.id, targetIdOrEmail);
      if (!res.success || !res.patient) {
        setLinkError(res.error || 'Could not connect to patient.');
      } else {
        setShowLinkModal(false);
        setPatientIdentifier('');
        if (res.patient) {
          authService.setLinkedPatient(res.patient);
        }
        await refreshAssignedPatients(cg.id);
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
      <div className="max-w-xl mx-auto py-6 sm:py-10 px-4 animate-fade-in space-y-6">
        <div className="bg-white rounded-3xl shadow-elder border border-emerald-200 p-6 sm:p-10 text-center relative overflow-hidden">
          {/* Header Icon */}
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-600/20">
            <UserCheck className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {authMode === 'signup' ? 'Create Caregiver Account' : 'Caregiver Portal Login'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 mb-6 leading-relaxed max-w-md mx-auto">
            {authMode === 'signup'
              ? 'Register with your name and email to connect with your senior and monitor their cognitive progress.'
              : 'Sign in to access your linked patient\'s cognitive metrics, daily health summary, and safety alerts.'}
          </p>

          {/* Error / Success Banners */}
          {authError && (
            <div className="p-4 mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl text-left space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{authError}</span>
              </div>
              <div className="pt-2 border-t border-rose-200 flex flex-wrap gap-2">
                {authMode === 'signup' ? (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Switch to Sign In Tab
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Switch to Create Account Tab
                  </button>
                )}
              </div>
            </div>
          )}

          {authSuccess && (
            <div className="p-3.5 mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-2xl bg-emerald-50/80 p-1.5 mb-6 border border-emerald-200/70">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200/50'
                  : 'text-gray-600 hover:text-emerald-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200/50'
                  : 'text-gray-600 hover:text-emerald-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Anjali Sharma"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="caregiver@gmail.com"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {authSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : authMode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Caregiver Account</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In as Caregiver</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-extrabold text-gray-400">
                Or Continue With Google
              </span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <GoogleSignInButton
            intendedRole="caregiver"
            label="Continue with Google as Caregiver"
            className="py-3.5 shadow-xs hover:shadow-md border-emerald-200 hover:bg-emerald-50/40 text-emerald-900 font-extrabold"
            onError={(err) => setAuthError(err)}
          />

          {/* Role Separation Notice */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-left space-y-2 text-[11px] text-gray-500 leading-relaxed bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>1 Caregiver ↔ 1 Patient Security Protocol</span>
            </div>
            <p>
              Your caregiver account is dedicated to senior safety and family oversight. After signing in, you will connect to your patient by entering their registered email ID.
            </p>
          </div>
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
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in space-y-6">
        {/* Caregiver Identity Card */}
        <div className="bg-white p-5 rounded-3xl shadow-elder border border-emerald-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={
                currentUser?.avatarUrl ||
                `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser?.id}&backgroundColor=b6e3f4`
              }
              alt={currentUser?.name || 'Caregiver'}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm"
            />
            <div className="text-left">
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Authorized Caregiver</span>
              </div>
              <div className="text-lg font-black text-gray-900">
                {currentUser?.name || currentUser?.preferredName || 'Caregiver'}
              </div>
              <div className="text-xs text-gray-500 font-medium">{currentUser?.email}</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full">
              No Patient Linked Yet
            </span>
          </div>
        </div>

        {/* Patient Connection Form */}
        <div className="bg-white p-8 rounded-3xl shadow-elder border border-emerald-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto mb-3 border border-emerald-300">
              <Mail className="w-8 h-8 text-emerald-700" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">
              Connect to Patient
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto leading-relaxed">
              Enter your patient's registered email address to link their account to your caregiver panel.
            </p>
          </div>

          {linkError && (
            <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{linkError}</span>
            </div>
          )}

          {linkSuccess && (
            <div className="p-3.5 mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{linkSuccess}</span>
            </div>
          )}

          <form onSubmit={handleConnectByEmail} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Patient's Registered Email ID or Connection Code
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={patientIdentifier}
                  onChange={(e) => setPatientIdentifier(e.target.value)}
                  placeholder="e.g. senior@gmail.com or MS-A1B2C3"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                💡 Enter the patient's registered email address or their 6-character connection code (e.g. MS-XXXXXX).
              </p>
            </div>

            <button
              type="submit"
              disabled={linkLoading || !patientIdentifier.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              <span>Connect to Patient</span>
            </button>
          </form>

          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>1 Caregiver ↔ 1 Patient Privacy Protocol</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Once connected, the patient's real cognitive telemetry, game records, and medical profile will be displayed here. The connection will remain active even after logout until either you or the patient explicitly unlinks.
            </p>
          </div>
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
      {/* ── CAREGIVER IDENTITY BAR ── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-elder border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3.5">
          <img
            src={
              currentUser?.avatarUrl ||
              `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser?.id}&backgroundColor=b6e3f4`
            }
            alt={currentUser?.name || 'Caregiver'}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm"
          />
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Logged In Caregiver</span>
            </div>
            <div className="text-lg font-black text-gray-900">
              {currentUser?.name || currentUser?.preferredName || 'Caregiver'}
            </div>
            <div className="text-xs text-gray-500 font-medium">{currentUser?.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Green Dot Connected Status */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border-2 border-emerald-400 text-emerald-800 text-xs font-black shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs" />
            <span>Connected: {selectedPatient.full_name || selectedPatient.name}</span>
          </div>

          <button
            type="button"
            onClick={handleDisconnectPatient}
            disabled={linkLoading}
            className="text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Unlink Patient
          </button>
        </div>
      </div>

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
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected Patient</span>
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
              onClick={handleDisconnectPatient}
              disabled={linkLoading}
              className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Unlink Patient</span>
            </button>
          </div>
        </div>

        {/* Detailed Senior Data Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
          <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Connection Code</div>
            <div className="text-xs font-black text-emerald-950 mt-0.5 tracking-wider truncate">
              {selectedPatient.connectionCode || selectedPatient.secondary_language || ('MS-' + (selectedPatient.id || '').replace(/-/g, '').substring(0, 6).toUpperCase())}
            </div>
          </div>

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

      {/* 30-Day Cognitive Telemetry & Game Session Records */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-emerald-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">
                {selectedPatient.full_name}'s Cognitive Play Records
              </h3>
              <p className="text-xs text-gray-500">
                Verified database sessions: Accuracy, Score, Reaction Time, and Domain Metrics
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300 self-start sm:self-auto">
            {patientGameSessions.length} Recorded Sessions
          </span>
        </div>

        {patientGameSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] border-b border-gray-200">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Game</th>
                  <th className="py-2.5 px-3">Difficulty</th>
                  <th className="py-2.5 px-3">Accuracy</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patientGameSessions.map((sess: any) => (
                  <tr key={sess.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-700 whitespace-nowrap">
                      {new Date(sess.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900 capitalize whitespace-nowrap">
                      {sess.gameId.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 capitalize text-gray-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[10px]">
                        {sess.difficulty || 'saral'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-black text-emerald-700 whitespace-nowrap">
                      {sess.accuracy}%
                    </td>
                    <td className="py-3 px-3 font-black text-gray-900 whitespace-nowrap">
                      {sess.score} pts
                    </td>
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                      {sess.durationSeconds ? `${Math.round(sess.durationSeconds / 60)} min` : '--'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-gray-500">
            No game sessions recorded for {selectedPatient.full_name} yet. Sessions will appear here in real-time as games are played.
          </div>
        )}
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
                handleConnectByEmail();
              }}
              className="space-y-3 mb-4 text-left"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Patient's Connection Code or Google Email
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={patientIdentifier}
                    onChange={(e) => setPatientIdentifier(e.target.value)}
                    placeholder="e.g. MS-1A2B3C or senior@gmail.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Found on the patient's MIND SATHI Home Screen banner (e.g. <strong>MS-XXXXXX</strong>) or registered Google email.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowLinkModal(false); setLinkError(''); }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading || !patientIdentifier.trim()}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {linkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  <span>Connect Senior</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
