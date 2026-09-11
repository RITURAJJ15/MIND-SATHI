import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { navigate } from '../../router';

export const OAuthCallbackPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function processCallback() {
      try {
        const targetRoute = await authService.handleOAuthCallback();
        if (isMounted) {
          if (targetRoute === '/caregiver/dashboard' || targetRoute.startsWith('/caregiver')) {
            window.location.href = '/caregiver.html';
          } else {
            navigate(targetRoute, true);
          }
        }
      } catch (err: any) {
        console.error('[OAuthCallbackPage] error processing callback:', err);
        if (isMounted) {
          setError(err.message || 'Authentication verification failed. Please try signing in again.');
        }
      }
    }

    processCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#FDFAF5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Authentication Error</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/caregiver/auth', true)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all"
            >
              Caregiver Login
            </button>
            <button
              type="button"
              onClick={() => navigate('/patient/auth', true)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-sathi-600 hover:bg-sathi-700 text-white cursor-pointer transition-all"
            >
              Patient Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFAF5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 animate-pulse">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Verifying Google Account...</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Securing your session with Supabase and verifying your access credentials.
        </p>
        <div className="flex items-center justify-center gap-2 text-emerald-600 pt-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-bold">Redirecting to your dashboard...</span>
        </div>
      </div>
    </div>
  );
};
