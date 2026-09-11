import React, { useState } from 'react';
import { Loader2, ExternalLink, Copy, Check, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { authService } from '../../services/authService';
import { UserRole } from '../../types/user';

interface GoogleSignInButtonProps {
  intendedRole?: UserRole;
  label?: string;
  className?: string;
  onError?: (error: string) => void;
}

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  intendedRole,
  label = 'Continue with Google',
  className = '',
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const supabaseProjectId = 'tlyeuyflanjsowiqwrxo';
  const callbackUrl = `https://${supabaseProjectId}.supabase.co/auth/v1/callback`;
  const supabaseProvidersUrl = `https://supabase.com/dashboard/project/${supabaseProjectId}/auth/providers`;

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await authService.signInWithGoogle(intendedRole);
      if (!res.success && res.error) {
        setLoading(false);
        if (
          res.error.includes('not enabled') ||
          res.error.includes('Unsupported provider')
        ) {
          setShowSetupModal(true);
        }
        onError?.(res.error);
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Failed to connect to Google';
      if (
        msg.includes('not enabled') ||
        msg.includes('Unsupported provider')
      ) {
        setShowSetupModal(true);
      }
      onError?.(msg);
    }
  };

  const handleCopyCallback = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm shadow-xs hover:shadow-sm transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${className}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-sathi-600" />
        ) : (
          <GoogleIcon className="w-5 h-5 shrink-0" />
        )}
        <span>{loading ? 'Connecting to Google…' : label}</span>
      </button>

      {/* Helper Modal when Supabase Google provider is disabled */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-gray-900">
                    Enable Google Provider in Supabase
                  </h3>
                  <p className="text-xs text-gray-500">Action required in your Supabase Dashboard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg text-sm font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Error: Provider is not enabled in Supabase</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Supabase blocked this request because Google Sign-In is currently <strong>toggled OFF</strong> in your project's Authentication settings.
              </p>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="font-extrabold text-gray-900 text-sm">How to enable in 2 minutes:</div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sathi-100 text-sathi-800 font-black flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <p className="font-bold text-gray-800">Open your Supabase Auth Providers:</p>
                  <a
                    href={supabaseProvidersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sathi-700 hover:text-sathi-900 font-extrabold underline mt-0.5"
                  >
                    <span>Go to Supabase Auth Providers</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sathi-100 text-sathi-800 font-black flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <p className="font-bold text-gray-800">Toggle Google ON:</p>
                  <p className="text-gray-500 text-[11px]">
                    Scroll to <strong>Google</strong>, click it, and switch the toggle to <strong>Enabled</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sathi-100 text-sathi-800 font-black flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div className="w-full">
                  <p className="font-bold text-gray-800">Enter Google OAuth Credentials:</p>
                  <p className="text-gray-500 text-[11px] mb-1.5">
                    Paste your Google Client ID & Client Secret from Google Cloud Console. Set your Authorized Redirect URI in Google Cloud Console to:
                  </p>
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 font-mono text-[11px] text-gray-800">
                    <span className="truncate mr-2">{callbackUrl}</span>
                    <button
                      type="button"
                      onClick={handleCopyCallback}
                      className="text-sathi-700 hover:text-sathi-900 font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-sans text-[10px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="font-sans text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <a
                href={supabaseProvidersUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 bg-sathi-600 hover:bg-sathi-700 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 text-center"
              >
                <span>Open Supabase Dashboard</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Dismiss & Use Email
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
