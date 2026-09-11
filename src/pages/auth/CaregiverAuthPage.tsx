import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  HeartHandshake,
} from 'lucide-react';
import { GoogleSignInButton } from '../../components/common/GoogleSignInButton';
import { type AuthRole } from '../../types/auth';
import { navigate } from '../../router';

interface CaregiverAuthPageProps {
  onBackToLanding?: () => void;
  onSuccess?: (role: AuthRole) => void;
}

export const CaregiverAuthPage: React.FC<CaregiverAuthPageProps> = ({
  onBackToLanding,
}) => {
  const [error, setError] = useState('');

  const handleBack = () => {
    if (onBackToLanding) {
      onBackToLanding();
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
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
              Caregiver Login
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-6">
              Dedicated portal for compassionate family oversight, cognitive telemetry, and safety updates.
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

            {/* Google OAuth Button for Caregiver */}
            <div className="space-y-4">
              <GoogleSignInButton
                intendedRole="caregiver"
                label="Continue with Google as Caregiver"
                onError={(err) => setError(err)}
                className="py-4 shadow-sm hover:shadow-md border-emerald-200 hover:bg-emerald-50/40 text-emerald-900 font-extrabold"
              />

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-medium bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verified Google Authentication • Database-backed Security</span>
              </div>
            </div>

            {/* Role Separation & Protocol Explainer */}
            <div className="mt-8 pt-6 border-t border-gray-100 text-left space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Strict 1 Caregiver ↔ 1 Patient Protocol</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Patients and Caregivers must authenticate with separate Google accounts. After signing in, you will connect directly to your patient by entering their registered Google email address.
              </p>
              <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200/70 text-[11px] text-amber-900 font-medium leading-relaxed">
                <strong>Note:</strong> If this Google account is already registered as a Patient, please sign in with a different Google account for your Caregiver profile.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaregiverAuthPage;
