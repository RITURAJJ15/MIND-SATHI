import React, { useState } from 'react';
import { UserPlus, ShieldCheck, Heart, Stethoscope, User, AlertCircle } from 'lucide-react';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import type { AuthScreen, AuthRole } from '../../types/auth';
import { UserRole } from '../../types/user';

interface RegisterPageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
  onRegisterSuccess: (role: AuthRole) => void;
  preselectedRole?: AuthRole;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateAuth, preselectedRole }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    preselectedRole || 'elderly'
  );
  const [globalError, setGlobalError] = useState('');

  const roleLabels: Record<string, { label: string; desc: string }> = {
    elderly: { label: 'Senior / Patient', desc: 'Play cognitive brain games, track daily health plans & routines.' },
    caregiver: { label: 'Family Caregiver', desc: 'Monitor your loved one’s progress, manage reminders & memory vault.' },
    clinician: { label: 'Healthcare Clinician', desc: 'Longitudinal MoCA/MMSE cognitive reports & patient telemetry.' },
  };

  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10 text-center animate-fade-in max-w-lg mx-auto">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sathi-600 to-amber-500 text-white shadow-lg mb-4">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Create Your Account</h1>
        <p className="text-sm text-gray-500 mt-1">Sign up securely with your verified Google Account</p>
      </div>

      {globalError && (
        <div role="alert" aria-live="assertive" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-left">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs font-medium text-red-700">{globalError}</p>
        </div>
      )}

      {/* Role Selection */}
      <div className="mb-6 text-left">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
          Select Your Account Role:
        </label>
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setSelectedRole('elderly')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
              selectedRole === 'elderly'
                ? 'bg-amber-50/80 border-sathi-600 shadow-xs ring-2 ring-sathi-500/20'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${selectedRole === 'elderly' ? 'bg-amber-100 text-sathi-800' : 'bg-gray-200 text-gray-600'}`}>
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{roleLabels.elderly.label}</div>
              <div className="text-xs text-gray-500 font-medium leading-relaxed">{roleLabels.elderly.desc}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('caregiver')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
              selectedRole === 'caregiver'
                ? 'bg-emerald-50/80 border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${selectedRole === 'caregiver' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{roleLabels.caregiver.label}</div>
              <div className="text-xs text-gray-500 font-medium leading-relaxed">{roleLabels.caregiver.desc}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('clinician')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
              selectedRole === 'clinician'
                ? 'bg-blue-50/80 border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${selectedRole === 'clinician' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{roleLabels.clinician.label}</div>
              <div className="text-xs text-gray-500 font-medium leading-relaxed">{roleLabels.clinician.desc}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Primary Google Sign Up */}
      <div className="mb-6">
        <GoogleSignInButton
          intendedRole={selectedRole}
          label={`Sign Up with Google as ${roleLabels[selectedRole]?.label || 'User'}`}
          onError={(err) => setGlobalError(err)}
          className="py-3.5 shadow-sm hover:shadow-md"
        />
      </div>

      <div className="flex items-center gap-2 justify-center text-xs text-gray-500 font-medium bg-gray-50 p-3 rounded-xl border border-gray-200/80 mb-6">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Your data is permanently synced to your verified Google account.</span>
      </div>

      <div className="pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <button type="button" onClick={() => onNavigateAuth('login')} className="font-bold text-sathi-600 hover:text-sathi-700 transition-colors cursor-pointer">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
