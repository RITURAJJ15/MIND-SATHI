import React, { useState } from 'react';
import {
  UserCheck,
  X,
  ShieldCheck,
  HeartHandshake,
  AlertCircle,
} from 'lucide-react';
import { GoogleSignInButton } from '../common/GoogleSignInButton';

interface CaregiverAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'caregiver') => void;
  initialMode?: 'login' | 'register';
}

export const CaregiverAuthModal: React.FC<CaregiverAuthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [error, setError] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden my-6 animate-scale-up text-center">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 mb-3">
            <UserCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="text-[11px] uppercase tracking-widest font-black text-emerald-300 mb-1">
            MIND SATHI • CAREGIVER ACCESS
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Caregiver Sign In
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-sm mx-auto leading-relaxed">
            Authenticate securely with your Google account to access your patient monitoring dashboard.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 mb-6 text-left flex items-start gap-3">
            <HeartHandshake className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed font-medium">
              Caregiver accounts use verified Google Authentication. Once signed in, you can connect directly to your senior using their verified Google Email or unique Connection Code.
            </div>
          </div>

          <div className="mb-4">
            <GoogleSignInButton
              intendedRole="caregiver"
              label="Continue with Google as Caregiver"
              className="py-3.5 shadow-sm hover:shadow-md border-emerald-200 hover:bg-emerald-50/50"
              onError={(err) => setError(err)}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 font-semibold pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted & persistent Supabase cloud synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
