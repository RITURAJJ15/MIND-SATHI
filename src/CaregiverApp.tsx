import React, { useState, useEffect } from 'react';
import { CaregiverPortalPage } from './pages/CaregiverPortalPage';
import { CareNavigatorPage } from './pages/CareNavigatorPage';
import { useCurrentUser } from './hooks/useCurrentUser';
import { authService } from './services/authService';
import { useLanguage } from './hooks/useLanguage';
import {
  HeartHandshake,
  ArrowLeft,
  LogOut,
  ShieldCheck,
  Globe,
  Compass,
} from 'lucide-react';

export const CaregiverApp: React.FC = () => {
  const { currentUser, isAuthenticated, isCaregiver } = useCurrentUser('caregiver');
  const { currentLang, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'oversight' | 'navigator'>(() => {
    return window.location.hash.includes('navigator') ? 'navigator' : 'oversight';
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes('navigator')) {
        setActiveTab('navigator');
      } else {
        setActiveTab('oversight');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleTabChange = (tab: 'oversight' | 'navigator') => {
    setActiveTab(tab);
    window.location.hash = tab === 'navigator' ? '#/caregiver/navigator' : '#/caregiver/dashboard';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await authService.logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex flex-col font-sans text-gray-900 selection:bg-emerald-200 selection:text-emerald-900">
      {/* ── STICKY TOP HEADER ── */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand & Portal Label */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              title="Return to Patient App"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0 shadow-xs group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </a>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <HeartHandshake className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-none">
                    MIND SATHI
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Caregiver Hub
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-medium block mt-0.5 hidden sm:block">
                  Family Oversight & Cognitive Telemetry Portal
                </span>
              </div>
            </div>
          </div>

          {/* Right Navigation & Profile Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => changeLanguage(currentLang === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-emerald-300 text-xs font-bold text-gray-700 hover:bg-emerald-50/50 transition-all cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentLang === 'en' ? 'हिंदी' : 'English'}</span>
            </button>

            {/* Link back to Patient App */}
            <a
              href="/"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-emerald-800 hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-200 transition-all"
            >
              <span>Patient Dashboard</span>
            </a>

            {/* Authenticated Caregiver Profile & Logout */}
            {isAuthenticated && isCaregiver && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-gray-200">
                <div className="hidden sm:flex items-center gap-2 text-left">
                  <img
                    src={
                      currentUser?.avatarUrl ||
                      `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser?.id}&backgroundColor=b6e3f4`
                    }
                    alt={currentUser?.name || 'Caregiver'}
                    className="w-8 h-8 rounded-xl object-cover border border-emerald-300"
                  />
                  <div className="leading-tight">
                    <span className="text-xs font-extrabold text-gray-900 block truncate max-w-[120px]">
                      {currentUser?.name || 'Caregiver'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      Active
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out of Caregiver Portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT BODY WITH CAREGIVER PANEL SIDEBAR ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* ── CAREGIVER PANEL SIDEBAR ── */}
          <aside className="w-full md:w-64 shrink-0 space-y-4">
            <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-emerald-200 shadow-elder space-y-2">
              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800/80">
                Caregiver Navigation
              </div>

              {/* Sidebar Item 1: Patient Oversight */}
              <button
                type="button"
                onClick={() => handleTabChange('oversight')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                  activeTab === 'oversight'
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md'
                    : 'text-gray-700 hover:text-emerald-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    activeTab === 'oversight' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Patient Oversight</div>
                  <div className={`text-[10px] ${activeTab === 'oversight' ? 'text-emerald-100' : 'text-gray-400'}`}>
                    Live records & telemetry
                  </div>
                </div>
              </button>

              {/* Sidebar Item 2: Care Navigator (Integrated with TinyFish) */}
              <button
                type="button"
                onClick={() => handleTabChange('navigator')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                  activeTab === 'navigator'
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md'
                    : 'text-gray-700 hover:text-emerald-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    activeTab === 'navigator' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Care Navigator</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        activeTab === 'navigator'
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      TinyFish
                    </span>
                  </div>
                  <div className={`text-[10px] ${activeTab === 'navigator' ? 'text-emerald-100' : 'text-gray-400'} truncate`}>
                    Care, drugs & schemes
                  </div>
                </div>
              </button>
            </div>

            {/* Privacy Guarantee Card */}
            <div className="bg-emerald-900/95 text-white p-4 rounded-3xl border border-emerald-700/50 shadow-xs hidden md:block text-left">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-300 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>1:1 Caregiver Shield</span>
              </div>
              <p className="text-[11px] text-emerald-100/80 leading-relaxed">
                Patient privacy is protected. Care Navigator queries are executed server-side without sending patient health records or GPS coordinates.
              </p>
            </div>
          </aside>

          {/* ── ACTIVE VIEW CONTENT BODY ── */}
          <div className="flex-1 min-w-0 w-full">
            {activeTab === 'oversight' ? <CaregiverPortalPage /> : <CareNavigatorPage />}
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-emerald-100 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>MIND SATHI Caregiver Oversight System • End-to-End Encrypted Patient Data</span>
          </div>
          <div className="flex items-center gap-4 text-gray-500">
            <a href="/" className="hover:text-emerald-700 font-medium transition-colors">
              Patient Portal
            </a>
            <span>•</span>
            <span>Independent Tab Isolation Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CaregiverApp;
