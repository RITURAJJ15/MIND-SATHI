import React from 'react';
import { Brain, ArrowLeft, ShieldCheck } from 'lucide-react';
import { AshokaChakraIcon } from '../components/layout/AshokaChakraIcon';

interface AuthLayoutProps {
  children: React.ReactNode;
  onBackToLanding?: () => void;
  onNavigateAuth?: (screen: string) => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, onBackToLanding }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F2] via-[#FFFBF6] to-amber-50/60 flex flex-col relative">
      {/* Subtle National Tricolor Ribbon at Top */}
      <div className="w-full h-1 bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-gray-900 tracking-tight leading-none">MIND SATHI</span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AshokaChakraIcon size={11} className="text-blue-700" />
                SIH 2026
              </span>
            </div>
            <div className="text-[10px] font-bold text-sathi-700 italic leading-none mt-1">
              Khelo. Socho. Saath Badho. • Northeast Cognitive Wellness
            </div>
          </div>
        </div>

        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            type="button"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-sathi-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Overview</span>
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          {/* Subtle national identity badge */}
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-600 bg-white/80 border border-amber-200/80 px-4 py-1.5 rounded-full shadow-xs w-fit mx-auto">
            <span className="text-sm">🇮🇳</span>
            <span>Digital Health & Cognitive Care Initiative</span>
            <span className="text-gray-300">•</span>
            <span className="text-blue-900 font-semibold flex items-center gap-1">
              <AshokaChakraIcon size={12} className="text-blue-800" />
              Ayushman Bharat Compatible
            </span>
          </div>

          {/* Decorative blobs */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200/20 to-orange-200/15 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-sathi-200/15 to-sage-100/15 blur-3xl" />
          </div>

          {children}
        </div>
      </main>

      {/* Footer note */}
      <footer className="text-center pb-6 px-4">
        <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-2 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
          <span>No Aadhaar number collected</span>
          <span className="text-gray-300">•</span>
          <span>Ayushman PM-JAY Verified Portal</span>
          <span className="text-gray-300">•</span>
          <span>Built for Northeast India (SIH 2026)</span>
        </p>
      </footer>
    </div>
  );
};
