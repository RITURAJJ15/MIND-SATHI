import React, { useState, useId } from 'react';
import { Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { authService } from '../../services/authService';
import { validateEmail } from '../../types/auth';
import type { AuthScreen } from '../../types/auth';

interface ForgotPasswordPageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigateAuth }) => {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  const handleBlur = () => {
    setTouched(true);
    const err = validateEmail(email);
    setEmailError(err ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError('');
    setLoading(true);
    await authService.forgotPassword(email);
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-5">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Check Your Email</h1>
        <p className="text-sm text-gray-500 mb-1">
          If an account exists for <span className="font-semibold text-gray-700">{email}</span>, a reset link has been sent.
        </p>
        <p className="text-xs text-gray-400 mb-8">
          This is a demo — no actual email is sent. Check browser console for the mock log.
        </p>
        <button
          type="button"
          onClick={() => onNavigateAuth('login')}
          className="inline-flex items-center gap-2 font-bold text-sathi-600 hover:text-sathi-700 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-calm-blue to-blue-400 text-white shadow-lg mb-4">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Forgot Password?</h1>
        <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send a reset link</p>
      </div>

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
              onChange={(e) => { setEmail(e.target.value); if (touched) { const err = validateEmail(e.target.value); setEmailError(err ?? ''); } }}
              onBlur={handleBlur}
              placeholder="you@example.com"
              aria-describedby={touched && emailError ? `${emailId}-error` : undefined}
              aria-invalid={touched && !!emailError}
              className={`w-full bg-white border rounded-xl px-4 py-3 pl-10 text-gray-900 placeholder-gray-400 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sathi-500 focus:border-sathi-400 ${touched && emailError ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-gray-200 hover:border-gray-300'}`}
            />
          </div>
          {touched && emailError && (
            <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{emailError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sathi-600 to-sathi-700 hover:from-sathi-700 hover:to-sathi-800 text-white font-bold py-3 rounded-xl shadow-tactile hover:shadow-elder-hover transition-all duration-150 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          aria-busy={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <button
          type="button"
          onClick={() => onNavigateAuth('login')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-sathi-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>
      </div>
    </div>
  );
};
