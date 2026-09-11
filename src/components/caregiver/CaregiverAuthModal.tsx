import React, { useState } from 'react';
import {
  UserCheck,
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  Camera,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { GoogleSignInButton } from '../common/GoogleSignInButton';
import { validateEmail, validatePassword, validateName } from '../../types/auth';

interface CaregiverAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'caregiver') => void;
  initialMode?: 'login' | 'register';
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&fit=crop&q=80',
];

export const CaregiverAuthModal: React.FC<CaregiverAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[0]);
  const [customAvatar, setCustomAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login({
        name: name.trim() || undefined,
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role: 'caregiver',
      });

      if (!res.success || !res.data) {
        setError(res.error?.message || 'Login failed. Please verify your email and password.');
      } else {
        onSuccess('caregiver');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nameErr = validateName(name);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const chosenAvatar = customAvatar.trim() || avatarUrl;
      const res = await authService.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
        role: 'caregiver',
        avatarUrl: chosenAvatar,
      });

      if (!res.success) {
        setError(res.error?.message || 'Registration failed. Email may already be in use.');
      } else {
        onSuccess('caregiver');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error creating caregiver account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden my-6 animate-scale-up">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/30 border border-emerald-400/40 text-emerald-200">
              <UserCheck className="w-5 h-5 text-emerald-300" />
            </span>
            <span className="text-xs uppercase tracking-widest font-black text-emerald-300">
              MIND SATHI • CAREGIVER PORTAL
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
            {mode === 'login' ? 'Caregiver Sign In' : 'New Caregiver Registration'}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-sm leading-relaxed">
            {mode === 'login'
              ? 'Sign in with your name, email, and password to monitor your assigned patient.'
              : 'Create your caregiver profile with your photo to oversee your loved one safely.'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Caregiver Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Authentication for Caregivers */}
          <div className="mb-5 space-y-3">
            <GoogleSignInButton
              intendedRole="caregiver"
              label={mode === 'login' ? 'Continue with Google as Caregiver' : 'Sign Up with Google as Caregiver'}
              className="border-emerald-200 hover:bg-emerald-50/50"
              onError={(err) => setError(err)}
            />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">or caregiver credentials</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>

          {mode === 'login' ? (
            /* ── LOGIN FORM ── */
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Caregiver Name <span className="text-gray-400 font-normal">(Optional / To display)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Caregiver Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="caregiver@gmail.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                <span>Sign In to Caregiver Portal</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-gray-500">New caregiver? </span>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Create an account now
                </button>
              </div>
            </form>
          ) : (
            /* ── REGISTER FORM ── */
            <form onSubmit={handleRegister} className="space-y-4 text-left">
              {/* Photo selection with live preview */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Caregiver Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  <img
                    src={avatarUrl}
                    alt="Caregiver Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm"
                  />
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer transition-all border border-gray-300">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <div className="text-[10px] text-gray-400 font-medium">Or pick an avatar:</div>
                    <div className="flex gap-1.5">
                      {DEFAULT_AVATARS.map((av, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAvatarUrl(av)}
                          className={`w-7 h-7 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            avatarUrl === av ? 'border-emerald-600 scale-105' : 'border-transparent opacity-70'
                          }`}
                        >
                          <img src={av} alt="avatar" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Caregiver Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="caregiver@gmail.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Create Caregiver Account</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-gray-500">Already registered? </span>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
