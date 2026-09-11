import React, { useState, useId } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone, Loader2, AlertCircle, UserPlus, ShieldCheck } from 'lucide-react';
import { AshokaChakraIcon } from '../../components/layout/AshokaChakraIcon';
import { authService } from '../../services/authService';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import { validateEmail, validatePassword, validateMobile, validateName } from '../../types/auth';
import type { AuthScreen, AuthRole, RegisterPayload } from '../../types/auth';

interface RegisterPageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
  onRegisterSuccess: (role: AuthRole) => void;
  preselectedRole?: AuthRole;
}

const ROLE_OPTIONS: { value: AuthRole; label: string; description: string }[] = [
  { value: 'elderly', label: 'Elderly User', description: 'Play games, track progress' },
  { value: 'caregiver', label: 'Caregiver', description: 'Monitor loved ones' },
  { value: 'clinician', label: 'Healthcare Professional', description: 'Clinical oversight' },
  { value: 'admin', label: 'Administrator', description: 'System management' },
];

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateAuth, onRegisterSuccess, preselectedRole }) => {
  const nameId = useId();
  const emailId = useId();
  const mobileId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const roleId = useId();

  const [form, setForm] = useState<RegisterPayload>({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    role: preselectedRole ?? 'elderly',
  });
  const [isAyushman, setIsAyushman] = useState<'yes' | 'no' | null>(null);
  const [ayushmanId, setAyushmanId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterPayload, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterPayload, boolean>>>({});

  const set = (field: keyof RegisterPayload, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      setFieldErrors((e) => ({ ...e, [field]: validateField(field, value) ?? undefined }));
    }
  };

  const validateField = (field: keyof RegisterPayload, value: string): string | null => {
    switch (field) {
      case 'name': return validateName(value);
      case 'email': return validateEmail(value);
      case 'mobile': return validateMobile(value);
      case 'password': return validatePassword(value);
      case 'confirmPassword': return value !== form.password ? 'Passwords do not match.' : null;
      default: return null;
    }
  };

  const handleBlur = (field: keyof RegisterPayload) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field, form[field] as string);
    setFieldErrors((e) => ({ ...e, [field]: err ?? undefined }));
  };

  const validate = (): boolean => {
    const fields: (keyof RegisterPayload)[] = ['name', 'email', 'mobile', 'password', 'confirmPassword'];
    const errors: Partial<Record<keyof RegisterPayload, string>> = {};
    fields.forEach((f) => {
      const err = validateField(f, form[f] as string);
      if (err) errors[f] = err;
    });
    setFieldErrors(errors);
    setTouched({ name: true, email: true, mobile: true, password: true, confirmPassword: true });
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    if (!validate()) return;

    setLoading(true);
    const result = await authService.register(form);
    setLoading(false);

    if (!result.success || !result.data) {
      if (result.error?.field) {
        setFieldErrors((e) => ({ ...e, [result.error!.field!]: result.error!.message }));
        setTouched((t) => ({ ...t, [result.error!.field!]: true }));
      } else {
        setGlobalError(result.error?.message ?? 'Registration failed. Please try again.');
      }
      return;
    }
    onRegisterSuccess(result.data.user.role);
  };

  const inputBase = 'w-full bg-white border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sathi-500 focus:border-sathi-400';
  const errClass = 'border-red-400 focus:ring-red-400 focus:border-red-400';
  const okClass = 'border-gray-200 hover:border-gray-300';

  const FieldError = ({ field, id }: { field: keyof RegisterPayload; id: string }) =>
    touched[field] && fieldErrors[field] ? (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors[field]}
      </p>
    ) : null;

  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sage-600 to-sage-400 text-white shadow-lg mb-4">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Create Account</h1>
        <p className="text-sm text-gray-500 mt-1">Join MIND SATHI and start your journey</p>
      </div>

      {globalError && (
        <div role="alert" aria-live="assertive" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-700">{globalError}</p>
        </div>
      )}

      {/* Google Authentication */}
      <div className="mb-6 space-y-4">
        <GoogleSignInButton
          intendedRole={form.role}
          onError={(err) => setGlobalError(err)}
          label="Sign Up with Google"
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">or register with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor={nameId} className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={nameId}
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="Sunita Devi"
              aria-describedby={touched.name && fieldErrors.name ? `${nameId}-error` : undefined}
              aria-invalid={touched.name && !!fieldErrors.name}
              className={`${inputBase} pl-10 ${touched.name && fieldErrors.name ? errClass : okClass}`}
            />
          </div>
          <FieldError field="name" id={nameId} />
        </div>

        {/* Email */}
        <div>
          <label htmlFor={emailId} className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              aria-describedby={touched.email && fieldErrors.email ? `${emailId}-error` : undefined}
              aria-invalid={touched.email && !!fieldErrors.email}
              className={`${inputBase} pl-10 ${touched.email && fieldErrors.email ? errClass : okClass}`}
            />
          </div>
          <FieldError field="email" id={emailId} />
        </div>

        {/* Mobile */}
        <div>
          <label htmlFor={mobileId} className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile Number</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <div className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 select-none pointer-events-none">+91</div>
            <input
              id={mobileId}
              type="tel"
              autoComplete="tel"
              value={form.mobile}
              onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={() => handleBlur('mobile')}
              placeholder="9876543210"
              maxLength={10}
              aria-describedby={touched.mobile && fieldErrors.mobile ? `${mobileId}-error` : undefined}
              aria-invalid={touched.mobile && !!fieldErrors.mobile}
              className={`${inputBase} pl-16 ${touched.mobile && fieldErrors.mobile ? errClass : okClass}`}
            />
          </div>
          <FieldError field="mobile" id={mobileId} />
        </div>

        {/* Password */}
        <div>
          <label htmlFor={passwordId} className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              aria-describedby={touched.password && fieldErrors.password ? `${passwordId}-error` : undefined}
              aria-invalid={touched.password && !!fieldErrors.password}
              className={`${inputBase} pl-10 pr-11 ${touched.password && fieldErrors.password ? errClass : okClass}`}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError field="password" id={passwordId} />
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor={confirmId} className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id={confirmId}
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              placeholder="Re-enter your password"
              aria-describedby={touched.confirmPassword && fieldErrors.confirmPassword ? `${confirmId}-error` : undefined}
              aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
              className={`${inputBase} pl-10 pr-11 ${touched.confirmPassword && fieldErrors.confirmPassword ? errClass : okClass}`}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError field="confirmPassword" id={confirmId} />
        </div>

        {/* Role */}
        <div>
          <label htmlFor={roleId} className="block text-sm font-semibold text-gray-700 mb-1.5">I am a…</label>
          <select
            id={roleId}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AuthRole }))}
            className={`${inputBase} ${okClass} appearance-none cursor-pointer`}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
            ))}
          </select>
        </div>

        {/* Ayushman Bharat Member Section */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 text-left">
          <div className="flex items-center gap-2 mb-1.5">
            <AshokaChakraIcon size={16} className="text-blue-800" />
            <span className="text-sm font-bold text-gray-900">
              Are you registered under Ayushman Bharat?
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            National health insurance coverage (PM-JAY). Distinct from your ABHA health records account.
          </p>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={() => {
                setIsAyushman('yes');
                setForm((f) => ({ ...f, isAyushmanMember: true }));
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                isAyushman === 'yes'
                  ? 'bg-sathi-600 text-white border-sathi-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAyushman('no');
                setAyushmanId('');
                setForm((f) => ({ ...f, isAyushmanMember: false, ayushmanMemberId: undefined }));
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                isAyushman === 'no'
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              No
            </button>
          </div>

          {isAyushman === 'yes' && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-gray-700">
                Enter Ayushman Bharat Member ID (PM-JAY Beneficiary ID)
              </label>
              <input
                type="text"
                value={ayushmanId}
                onChange={(e) => {
                  setAyushmanId(e.target.value);
                  setForm((f) => ({ ...f, ayushmanMemberId: e.target.value }));
                }}
                placeholder="e.g. PMJAY-AS-849201"
                className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-sathi-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-500 flex items-start gap-1.5 mt-1.5 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  This ID is used only for eligibility verification and profile information. 
                  We do <strong>NOT</strong> ask for or collect your Aadhaar number.
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sage-600 to-sage-700 hover:from-sage-700 hover:to-sage-800 text-white font-bold py-3 rounded-xl shadow-tactile hover:shadow-elder-hover transition-all duration-150 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          aria-busy={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</> : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <button type="button" onClick={() => onNavigateAuth('login')} className="font-bold text-sathi-600 hover:text-sathi-700 transition-colors">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
