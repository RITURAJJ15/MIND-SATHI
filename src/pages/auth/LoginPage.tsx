import React, { useState } from 'react';
import { LogIn, ShieldCheck, Heart, Stethoscope, User, AlertCircle } from 'lucide-react';
import { AshokaChakraIcon } from '../../components/layout/AshokaChakraIcon';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import type { AuthScreen, AuthRole } from '../../types/auth';
import { UserRole } from '../../types/user';
import { navigate } from '../../router';

interface LoginPageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
  onLoginSuccess: (role: AuthRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateAuth }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('elderly');
  const [isAyushman, setIsAyushman] = useState<'yes' | 'no' | null>(null);
  const [ayushmanId, setAyushmanId] = useState('');
  const [globalError, setGlobalError] = useState('');

  const roleLabels: Record<string, string> = {
    elderly: 'Patient / Senior',
    caregiver: 'Family Caregiver',
    clinician: 'Doctor / Clinician',
  };

  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10 text-center animate-fade-in max-w-lg mx-auto">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sathi-600 to-amber-500 text-white shadow-lg mb-4">
          <LogIn className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sign In to MIND SATHI</h1>
        <p className="text-sm text-gray-500 mt-1">Select your account type and continue with Google</p>
      </div>

      {globalError && (
        <div role="alert" aria-live="assertive" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-left">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs font-medium text-red-700">{globalError}</p>
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
            onClick={() => navigate('/caregiver/auth')}
            className="py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer bg-gray-50 border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            <User className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
            <span>Caregiver</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/doctor/auth')}
            className="py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
          >
            <Stethoscope className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
            <span>Clinician</span>
          </button>
        </div>
      </div>

      {/* Primary Google Sign In */}
      <div className="mb-6">
        <GoogleSignInButton
          intendedRole={selectedRole}
          label={`Continue with Google as ${roleLabels[selectedRole] || 'User'}`}
          onError={(err) => setGlobalError(err)}
          className="py-3.5 shadow-sm hover:shadow-md"
        />
      </div>

      {/* Ayushman Bharat Member Section (Optional, for Seniors) */}
      {selectedRole === 'elderly' && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-left mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AshokaChakraIcon size={16} className="text-blue-800" />
            <span className="text-xs sm:text-sm font-bold text-gray-900">
              Are you registered under Ayushman Bharat (PM-JAY)?
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-2.5">
            Link your PM-JAY / ABHA card with your verified Google health account.
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
                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-sathi-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Security Banner */}
      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-left space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Verified Google Identity Security</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          MIND SATHI strictly authenticates all Patients, Caregivers, and Doctors using real Google accounts. Your cognitive game scores, family tree, and care plans are permanently stored in the Supabase PostgreSQL database. Fake credentials and mock logins are disabled.
        </p>
      </div>

      <div className="mt-6 pt-5 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-500">
          New to MIND SATHI? Simply click <strong>Continue with Google</strong> above to automatically create your secure account.
        </p>
      </div>
    </div>
  );
};
