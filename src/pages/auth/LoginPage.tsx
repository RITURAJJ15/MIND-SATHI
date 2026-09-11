import React, { useState, useId } from 'react';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, LogIn, ShieldCheck } from 'lucide-react';
import { AshokaChakraIcon } from '../../components/layout/AshokaChakraIcon';
import { authService } from '../../services/authService';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import { validateEmail } from '../../types/auth';
import type { AuthScreen, AuthRole } from '../../types/auth';

interface LoginPageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
  onLoginSuccess: (role: AuthRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateAuth, onLoginSuccess }) => {
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAyushman, setIsAyushman] = useState<'yes' | 'no' | null>(null);
  const [ayushmanId, setAyushmanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password) errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((t) => ({ ...t, [field]: true }));
    if (field === 'email') {
      const err = validateEmail(email);
      setFieldErrors((e) => ({ ...e, email: err ?? undefined }));
    }
    if (field === 'password') {
      setFieldErrors((e) => ({ ...e, password: !password ? 'Password is required.' : undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setGlobalError('');
    if (!validate()) return;

    setLoading(true);
    const result = await authService.login({
      email,
      password,
      rememberMe,
      ayushmanMemberId: isAyushman === 'yes' ? ayushmanId : undefined,
    });
    setLoading(false);

    if (!result.success || !result.data) {
      setGlobalError(result.error?.message ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(result.data.user.role);
  };

  const inputBase =
    'w-full bg-white border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sathi-500 focus:border-sathi-400';

  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sathi-600 to-amber-500 text-white shadow-lg mb-4">
          <LogIn className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Welcome Back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your MIND SATHI account</p>
      </div>

      {/* Google Authentication */}
      <div className="mb-6 space-y-4">
        <GoogleSignInButton
          onError={(err) => setGlobalError(err)}
          label="Continue with Google"
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">or email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      {globalError && (
        <div role="alert" aria-live="assertive" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-700">{globalError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor={emailId} className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              aria-describedby={touched.email && fieldErrors.email ? `${emailId}-error` : undefined}
              aria-invalid={touched.email && !!fieldErrors.email}
              className={`${inputBase} pl-10 ${touched.email && fieldErrors.email ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-gray-200 hover:border-gray-300'}`}
            />
          </div>
          {touched.email && fieldErrors.email && (
            <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={passwordId} className="text-sm font-semibold text-gray-700">Password</label>
            <button type="button" onClick={() => onNavigateAuth('forgot-password')} className="text-xs font-semibold text-sathi-600 hover:text-sathi-700 transition-colors">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="Enter your password"
              aria-describedby={touched.password && fieldErrors.password ? `${passwordId}-error` : undefined}
              aria-invalid={touched.password && !!fieldErrors.password}
              className={`${inputBase} pl-10 pr-11 ${touched.password && fieldErrors.password ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-gray-200 hover:border-gray-300'}`}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {touched.password && fieldErrors.password && (
            <p id={`${passwordId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors.password}
            </p>
          )}
        </div>

        {/* Ayushman Bharat Member Section */}
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <AshokaChakraIcon size={16} className="text-blue-800" />
            <span className="text-sm font-bold text-gray-900">
              Are you registered under Ayushman Bharat (PM-JAY)?
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            National health scheme coverage. You can link your beneficiary card now or in your dashboard.
          </p>
          <div className="flex gap-2.5 mb-3">
            <button
              type="button"
              onClick={() => setIsAyushman('yes')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                isAyushman === 'yes'
                  ? 'bg-sathi-600 text-white border-sathi-600 shadow-sm'
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
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                isAyushman === 'no'
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              No / Not sure
            </button>
          </div>

          {isAyushman === 'yes' && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-gray-700">
                PM-JAY Beneficiary ID / Ayushman Card Number (Optional)
              </label>
              <input
                type="text"
                value={ayushmanId}
                onChange={(e) => setAyushmanId(e.target.value)}
                placeholder="e.g. PMJAY-UP-84729104"
                className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-sathi-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-500 flex items-start gap-1.5 mt-1 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Your Ayushman healthcare benefits &amp; ABHA records will sync with your profile upon sign in.
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-sathi-600 focus:ring-sathi-500 cursor-pointer" />
          <label htmlFor="remember-me" className="text-sm text-gray-600 font-medium cursor-pointer select-none">Remember me for 30 days</label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sathi-600 to-sathi-700 hover:from-sathi-700 hover:to-sathi-800 text-white font-bold py-3 rounded-xl shadow-tactile hover:shadow-elder-hover transition-all duration-150 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          aria-busy={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Don't have an account?{' '}
          <button type="button" onClick={() => onNavigateAuth('select-role')} className="font-bold text-sathi-600 hover:text-sathi-700 transition-colors">
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
};
