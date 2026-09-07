import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { ayushmanService, VerificationState } from '../../services/ayushmanService';
import { abhaService } from '../../services/abhaService';
import { authService } from '../../services/authService';

interface HealthcareOnboardingPageProps {
  onComplete: () => void;
}

export const HealthcareOnboardingPage: React.FC<HealthcareOnboardingPageProps> = ({ onComplete }) => {
  // PM-JAY State
  const [pmjaySelection, setPmjaySelection] = useState<'yes' | 'no' | 'unsure' | null>(null);
  const [pmjayId, setPmjayId] = useState('');
  const [showPmjayId, setShowPmjayId] = useState(false);
  const [pmjayStatus, setPmjayStatus] = useState<VerificationState | null>(null);
  const [pmjayMsg, setPmjayMsg] = useState('');
  const [isVerifyingPmjay, setIsVerifyingPmjay] = useState(false);

  // ABHA State
  const [abhaSelection, setAbhaSelection] = useState<'yes' | 'no' | 'unsure' | null>(null);
  const [abhaNumber, setAbhaNumber] = useState('');
  const [showAbhaNumber, setShowAbhaNumber] = useState(false);
  const [abhaStatus, setAbhaStatus] = useState<VerificationState | null>(null);
  const [abhaMsg, setAbhaMsg] = useState('');
  const [isVerifyingAbha, setIsVerifyingAbha] = useState(false);

  const [saving, setSaving] = useState(false);

  const handleVerifyPmjay = async () => {
    if (!pmjayId.trim()) return;
    setIsVerifyingPmjay(true);
    setPmjayStatus(null);
    const result = await ayushmanService.verifyBeneficiary(pmjayId);
    setPmjayStatus(result.status);
    setPmjayMsg(result.message);
    setIsVerifyingPmjay(false);
  };

  const handleVerifyAbha = async () => {
    if (!abhaNumber.trim()) return;
    setIsVerifyingAbha(true);
    setAbhaStatus(null);
    const result = await abhaService.getProfileWithConsent(abhaNumber);
    setAbhaStatus(result.status);
    setAbhaMsg(result.message);
    setIsVerifyingAbha(false);
  };

  const handleContinue = async () => {
    setSaving(true);
    
    // Save to profile
    try {
      authService.updateCurrentUserProfile({
        hasCompletedOnboarding: true,
        pmjayId: pmjayStatus === 'verified' ? pmjayId : undefined,
        pmjayStatus: pmjayStatus ?? undefined,
        abhaId: abhaStatus === 'verified' ? abhaNumber : undefined,
        abhaStatus: abhaStatus ?? undefined,
      });
    } catch (e) {
      console.error('Failed to save onboarding data', e);
    }
    
    // Slight delay for UX
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  const renderStatus = (status: VerificationState | null, msg: string) => {
    if (!status) return null;
    if (status === 'verified') {
      return (
        <div className="mt-3 flex items-start gap-2 bg-green-50 text-green-700 p-3 rounded-xl border border-green-200">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{msg}</span>
        </div>
      );
    }
    if (status === 'unverified') {
      return (
        <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-xl border border-red-200">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{msg}</span>
        </div>
      );
    }
    return (
      <div className="mt-3 flex items-start gap-2 bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-200">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <span className="text-sm font-medium">{msg}</span>
      </div>
    );
  };

  const inputBase = 'w-full bg-white border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sathi-500 focus:border-sathi-400 border-gray-200 hover:border-gray-300';
  
  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10 w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sage-600 to-sage-400 text-white shadow-lg mb-4">
          <Shield className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Healthcare Identity</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
          Connect your healthcare profiles to enable personalized health insights and caregiver monitoring.
        </p>
      </div>

      <div className="space-y-8">
        {/* SECTION 1: PM-JAY */}
        <section className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Are you a PM-JAY (Ayushman Bharat) beneficiary?</h2>
          <div className="flex flex-wrap gap-3 mb-5">
            {['yes', 'no', 'unsure'].map((opt) => (
              <button
                key={opt}
                onClick={() => setPmjaySelection(opt as any)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  pmjaySelection === opt 
                    ? 'bg-sage-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : "I'm not sure"}
              </button>
            ))}
          </div>

          {pmjaySelection === 'yes' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                PM-JAY Beneficiary / Ayushman Card ID
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type={showPmjayId ? 'text' : 'password'}
                    value={pmjayId}
                    onChange={(e) => setPmjayId(e.target.value)}
                    placeholder="Enter your PM-JAY ID"
                    className={inputBase}
                    disabled={isVerifyingPmjay || pmjayStatus === 'verified'}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPmjayId(!showPmjayId)} 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPmjayId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyPmjay}
                  disabled={!pmjayId.trim() || isVerifyingPmjay || pmjayStatus === 'verified'}
                  className="px-6 py-3 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center min-w-[100px]"
                >
                  {isVerifyingPmjay ? <Loader2 className="w-4 h-4 animate-spin" /> : pmjayStatus === 'verified' ? 'Verified' : 'Verify'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
                This information is used securely and solely for authorized healthcare integration.
              </p>
              {renderStatus(pmjayStatus, pmjayMsg)}
            </div>
          )}
        </section>

        {/* SECTION 2: ABHA */}
        <section className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Do you have an ABHA number?</h2>
          <div className="flex flex-wrap gap-3 mb-5">
            {['yes', 'no', 'unsure'].map((opt) => (
              <button
                key={opt}
                onClick={() => setAbhaSelection(opt as any)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  abhaSelection === opt 
                    ? 'bg-sage-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : "I'm not sure"}
              </button>
            ))}
          </div>

          {abhaSelection === 'yes' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>Consent Notice:</strong> By verifying your ABHA number, you consent to MIND SATHI retrieving your basic health profile for personalized insights. 
                  Official ABDM integration requires explicit OTP consent which will be prompted in the future.
                </p>
              </div>
              
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                ABHA Number
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type={showAbhaNumber ? 'text' : 'password'}
                    value={abhaNumber}
                    onChange={(e) => setAbhaNumber(e.target.value)}
                    placeholder="Enter your 14-digit ABHA Number"
                    className={inputBase}
                    disabled={isVerifyingAbha || abhaStatus === 'verified'}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAbhaNumber(!showAbhaNumber)} 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAbhaNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyAbha}
                  disabled={!abhaNumber.trim() || isVerifyingAbha || abhaStatus === 'verified'}
                  className="px-6 py-3 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center min-w-[100px]"
                >
                  {isVerifyingAbha ? <Loader2 className="w-4 h-4 animate-spin" /> : abhaStatus === 'verified' ? 'Verified' : 'Verify'}
                </button>
              </div>
              {renderStatus(abhaStatus, abhaMsg)}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center mb-4 px-4">
          <strong>Privacy Notice:</strong> We DO NOT collect or store Aadhaar numbers. 
          The information provided here is strictly for authorized healthcare portal features.
          <br className="hidden sm:block" /> This is a prototype system; it is not connected to the official live PM-JAY/ABDM database.
        </p>

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sage-600 to-sage-700 hover:from-sage-700 hover:to-sage-800 text-white font-bold py-3.5 rounded-xl shadow-tactile transition-all duration-150 active:translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : <>Continue to Home <ArrowRight className="w-5 h-5" /></>}
        </button>
      </div>
    </div>
  );
};
