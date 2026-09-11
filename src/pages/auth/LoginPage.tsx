import React, { useState } from 'react';
import {
  LogIn,
  ShieldCheck,
  Heart,
  Stethoscope,
  User,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { AshokaChakraIcon } from '../../components/layout/AshokaChakraIcon';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import type { AuthScreen, AuthRole } from '../../types/auth';
import { UserRole } from '../../types/user';
import { authService } from '../../services/authService';
import { navigate } from '../../router';

interface LoginPageProps {
  onNavigateAuth?: (screen: AuthScreen) => void;
  onLoginSuccess?: (role: AuthRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('elderly');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Patient Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAyushman, setIsAyushman] = useState<'yes' | 'no' | null>(null);
  const [ayushmanId, setAyushmanId] = useState('');

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // Email confirmation & cooldown states
  const [needsConfirmationNotice, setNeedsConfirmationNotice] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  // Countdown timer for resending confirmation emails (strictly client-side, does NOT make network calls)
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResendConfirmation = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || confirmedEmail || email).trim();
    if (!emailToUse) {
      setGlobalError('Please enter your email address to resend confirmation.');
      return;
    }
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setResendNotice('');
    setGlobalError('');
    try {
      const res = await authService.resendConfirmationEmail(emailToUse);
      if (res.success) {
        setResendNotice(`Confirmation email re-sent to ${emailToUse}! Please check your inbox.`);
        setResendCooldown(60);
      } else {
        if (res.cooldownRemaining) {
          setResendCooldown(res.cooldownRemaining);
        }
        setGlobalError(res.error || 'Failed to resend confirmation email.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error sending confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-clicking
    setGlobalError('');
    setGlobalSuccess('');
    setResendNotice('');
    setNeedsConfirmationNotice(false);
    setIsSubmitting(true);

    try {
      if (authMode === 'signup') {
        const res = await authService.signUpPatientWithEmail(
          email.trim(),
          password,
          name.trim(),
          phone.trim(),
          {
            isAyushman: isAyushman === 'yes',
            ayushmanId: isAyushman === 'yes' ? ayushmanId.trim() : undefined,
          }
        );

        if (!res.success) {
          setGlobalError(res.error || 'Failed to create patient account.');
        } else if (res.needsEmailConfirmation) {
          setConfirmedEmail(res.email || email.trim());
          setNeedsConfirmationNotice(true);
          setResendCooldown(60);
        } else if (res.profile) {
          setGlobalSuccess('Account created successfully! Redirecting to Patient Dashboard...');
          if (onLoginSuccess) onLoginSuccess('elderly');
          setTimeout(() => navigate('/patient/dashboard', true), 600);
        }
      } else {
        const res = await authService.signInPatientWithEmail(email.trim(), password);
        if (!res.success) {
          setGlobalError(res.error || 'Login failed. Please verify your email and password.');
          if (res.isUnconfirmed) {
            setConfirmedEmail(email.trim());
            setNeedsConfirmationNotice(true);
          }
        } else if (res.profile) {
          setGlobalSuccess('Signed in successfully! Opening Patient Dashboard...');
          if (onLoginSuccess) onLoginSuccess('elderly');
          setTimeout(() => navigate('/patient/dashboard', true), 400);
        }
      }
    } catch (err: any) {
      setGlobalError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-elder p-6 sm:p-10 text-center animate-fade-in max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sathi-600 to-amber-500 text-white shadow-lg mb-3">
          <LogIn className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {authMode === 'signup' ? 'Create Patient Account' : 'Patient / Senior Login'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {authMode === 'signup'
            ? 'Sign up to play cognitive games, track memory milestones, and stay connected with family.'
            : 'Welcome back! Sign in to continue your daily cognitive journey and memory games.'}
        </p>
      </div>

      {/* Confirmation Notice Block */}
      {needsConfirmationNotice && (
        <div className="p-5 mb-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-left space-y-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <Mail className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-amber-950">Check your email to confirm your account</h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                We sent a confirmation link to <strong className="text-amber-950">{confirmedEmail || email}</strong>. Please check your inbox (and spam/junk folder) and click the link to activate your account.
              </p>
            </div>
          </div>

          {resendNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resendNotice}</span>
            </div>
          )}

          <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={resendCooldown > 0 || resendLoading}
              onClick={() => handleResendConfirmation()}
              className="px-3 py-1.5 bg-sathi-600 hover:bg-sathi-700 disabled:bg-sathi-300 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {resendLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              <span>{resendCooldown > 0 ? `Resend email in (${resendCooldown}s)` : 'Resend confirmation email'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setNeedsConfirmationNotice(false);
                setGlobalError('');
              }}
              className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Already confirmed? Sign In
            </button>
          </div>
        </div>
      )}

      {/* Error & Success Alerts */}
      {globalError && (
        <div role="alert" aria-live="assertive" className="mb-5 flex flex-col gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-left">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-rose-800 leading-relaxed">{globalError}</p>
          </div>
          <div className="pt-2 border-t border-rose-200 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setGlobalError('');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Switch to Sign In Tab
            </button>
            {globalError.toLowerCase().includes('confirm') && (
              <button
                type="button"
                disabled={resendCooldown > 0 || resendLoading}
                onClick={() => handleResendConfirmation()}
                className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                {resendCooldown > 0 ? `Resend available in (${resendCooldown}s)` : 'Resend Confirmation Email'}
              </button>
            )}
          </div>
        </div>
      )}

      {globalSuccess && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-left">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs font-semibold text-emerald-800">{globalSuccess}</p>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="mb-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 text-left">
          I am signing in as:
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedRole('elderly')}
            className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              selectedRole === 'elderly'
                ? 'bg-amber-50 border-sathi-600 text-sathi-900 shadow-xs ring-2 ring-sathi-500/20'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${selectedRole === 'elderly' ? 'text-amber-600' : 'text-gray-400'}`} />
            <span>Senior / Patient</span>
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = '/caregiver.html'; }}
            className="py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer bg-gray-50 border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            <User className="w-4 h-4 text-gray-400 hover:text-emerald-600" />
            <span>Caregiver</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/doctor/auth')}
            className="py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
          >
            <Stethoscope className="w-4 h-4 text-gray-400 hover:text-blue-600" />
            <span>Clinician</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs for Patient */}
      <div className="flex rounded-2xl bg-amber-50/80 p-1.5 mb-6 border border-amber-200/70">
        <button
          type="button"
          onClick={() => { setAuthMode('signin'); setGlobalError(''); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            authMode === 'signin'
              ? 'bg-white text-sathi-900 shadow-sm border border-amber-200/60'
              : 'text-gray-600 hover:text-sathi-800'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setAuthMode('signup'); setGlobalError(''); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            authMode === 'signup'
              ? 'bg-white text-sathi-900 shadow-sm border border-amber-200/60'
              : 'text-gray-600 hover:text-sathi-800'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Patient Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4 text-left mb-6">
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Chandra Verma"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@gmail.com"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sathi-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Ayushman Bharat Option on Sign Up */}
        {authMode === 'signup' && (
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-left">
            <div className="flex items-center gap-2 mb-1">
              <AshokaChakraIcon size={16} className="text-blue-800" />
              <span className="text-xs sm:text-sm font-bold text-gray-900">
                Are you registered under Ayushman Bharat (PM-JAY)?
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mb-2.5">
              Link your PM-JAY / ABHA card with your verified health profile.
            </p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIsAyushman('yes')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isAyushman === 'yes'
                    ? 'bg-sathi-600 text-white border-sathi-600 shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50'
                }`}
              >
                Yes, I am a Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAyushman('no');
                  setAyushmanId('');
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isAyushman === 'no'
                    ? 'bg-gray-800 text-white border-gray-800 shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                No / Later
              </button>
            </div>

            {isAyushman === 'yes' && (
              <div className="space-y-1 animate-in fade-in duration-200 pt-1">
                <input
                  type="text"
                  value={ayushmanId}
                  onChange={(e) => setAyushmanId(e.target.value)}
                  placeholder="Enter PM-JAY ID (e.g. PMJAY-AS-9921-4820)"
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-sathi-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-gradient-to-r from-sathi-600 to-amber-600 hover:from-sathi-700 hover:to-amber-700 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : authMode === 'signup' ? (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Create Patient Account</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In to Patient Dashboard</span>
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

      {/* Primary Google Sign In */}
      <div className="mb-6">
        <GoogleSignInButton
          intendedRole="elderly"
          label="Continue with Google as Senior / Patient"
          onError={(err) => setGlobalError(err)}
          className="py-3.5 shadow-sm hover:shadow-md"
        />
      </div>

      {/* Security Banner */}
      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-left space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Verified Database Security & Privacy</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          MIND SATHI securely authenticates all patients using Supabase. Your cognitive scores, daily health streak, and family photos are permanently stored in the PostgreSQL database and safely preserved across devices and browser sessions.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
