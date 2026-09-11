import React, { useState } from 'react';
import {
  UserCheck,
  Mail,
  Lock,
  User,
  Phone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  HeartHandshake,
  Eye,
  EyeOff,
} from 'lucide-react';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import { authService } from '../../services/authService';
import type { AuthRole } from '../../types/auth';

interface CaregiverAuthPageProps {
  onBackToLanding: () => void;
  onSuccess: (role: AuthRole) => void;
}

export const CaregiverAuthPage: React.FC<CaregiverAuthPageProps> = ({
  onBackToLanding,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.loginCaregiverWithEmailPassword(email, password);
      if (res.success) {
        setSuccessMsg('Caregiver sign in successful! Loading portal...');
        setTimeout(() => {
          onSuccess('caregiver');
        }, 600);
      } else {
        setError(res.error?.message || 'Caregiver sign in failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.registerCaregiverWithEmailPassword({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      if (res.success) {
        setSuccessMsg('Caregiver account created successfully! Loading portal...');
        setTimeout(() => {
          onSuccess('caregiver');
        }, 600);
      } else {
        setError(res.error?.message || 'Caregiver registration failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-emerald-800 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-emerald-600" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/logo_icon.png" alt="MIND SATHI" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <span className="text-sm font-black text-gray-900 tracking-tight block leading-none">
                MIND SATHI
              </span>
              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5 uppercase tracking-wider">
                Caregiver Portal
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg">
          {/* Card Container */}
          <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 p-6 sm:p-10 text-center animate-fade-in relative overflow-hidden">
            {/* Top decorative badge */}
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-600/20">
              <HeartHandshake className="w-8 h-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Caregiver Portal
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-6">
              Dedicated portal for compassionate oversight, real-time safety, and cognitive telemetry.
            </p>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3.5 text-left text-xs font-semibold text-rose-800 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* Success banner */}
            {successMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 text-left text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="leading-relaxed">{successMsg}</p>
              </div>
            )}

            {/* Tab Selector */}
            <div className="grid grid-cols-2 p-1.5 bg-gray-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className={`py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Caregiver Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setError('');
                  setSuccessMsg('');
                }}
                className={`py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* TAB 1: CAREGIVER SIGN IN */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Caregiver Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@gmail.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>Sign In as Caregiver</span>
                </button>
              </form>
            )}

            {/* TAB 2: CREATE CAREGIVER ACCOUNT */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Caregiver Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Caregiver Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@gmail.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                    ⚠️ Must be a different email from the patient's account.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Phone / Mobile (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-3"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>Create Caregiver Account</span>
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-bold">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button for Caregiver */}
            <GoogleSignInButton
              intendedRole="caregiver"
              label={
                activeTab === 'login'
                  ? 'Continue with Google as Caregiver'
                  : 'Sign Up with Google as Caregiver'
              }
              onError={(err) => setError(err)}
              className="py-3.5 shadow-xs hover:shadow-md border-emerald-200 hover:bg-emerald-50/40 text-emerald-900"
            />

            {/* Role Collision & Security Warning */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-left space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Strict 1 Caregiver ↔ 1 Patient Protocol</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Patients and Caregivers must use separate Google accounts or email addresses. After signing in, you will be able to connect directly to your patient by entering their registered email ID. The link is stored in the database and remains connected across logouts.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaregiverAuthPage;
