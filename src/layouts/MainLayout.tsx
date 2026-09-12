import React, { useState } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { useAccessibility } from '../hooks/useAccessibility';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { FontScaler } from '../components/common/FontScaler';
import { SOSButton } from '../components/common/SOSButton';
import { SyncStatusIndicator } from '../components/common/SyncStatusIndicator';
import {
  Brain,
  Home,
  Gamepad2,
  CalendarCheck,
  Heart,
  LineChart,
  Users,
  Bell,
  Building,
  UserCheck,
  Stethoscope,
  Volume2,
  VolumeX,
  Menu,
  X,
  Sparkles,
  Phone,
  Bot,
  LogOut,
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, onNavigate, onLogout }) => {
  const { currentUser } = useCurrentUser(activeTab);
  const { currentLang, t } = useLanguage();
  const { settings, toggleSound } = useAccessibility();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'games', label: t.nav.games, icon: Gamepad2 },
    { id: 'family', label: t.nav.family, icon: Phone },
    { id: 'daily-plan', label: t.nav.dailyPlan, icon: CalendarCheck },
    { id: 'memories', label: t.nav.memories, icon: Heart },
    { id: 'progress', label: t.nav.progress, icon: LineChart },
    { id: 'leaderboard', label: t.nav.leaderboard, icon: Users },
    { id: 'reminders', label: t.nav.reminders, icon: Bell },
    { id: 'assistant', label: t.nav.assistant, icon: Bot },
    { id: 'ayushman', label: t.nav.ayushman, icon: Building },
    { id: 'clinician', label: t.nav.clinicianPortal, icon: Stethoscope },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Top Accessibility & System Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8E2D8] shadow-sm">
        <div className="max-w-7xl mx-auto px-2.5 xs:px-4 sm:px-6 py-2 xs:py-2.5 flex items-center justify-between gap-1.5 xs:gap-3">
          {/* Logo & Tagline */}
          <button
            onClick={() => onNavigate('home')}
            type="button"
            className="flex items-center gap-2 xs:gap-3 text-left cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 xs:w-11 xs:h-11 sm:w-12 sm:h-12 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg xs:text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  MIND SATHI
                </span>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                  AYUSHMAN READY
                </span>
              </div>
              <p className="hidden xs:block text-[11px] sm:text-xs text-sathi-700 font-bold tracking-wide italic truncate max-w-[170px] sm:max-w-none">
                {t.common.tagline}
              </p>
            </div>
          </button>

          {/* Center Actions: Language & Font Scaler (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher />
            <FontScaler />
            <button
              onClick={toggleSound}
              type="button"
              className={`p-2 rounded-2xl border cursor-pointer transition-all ${
                settings.soundEffects
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-gray-100 text-gray-400 border-gray-300'
              }`}
              title="Toggle procedural audio chimes"
              aria-label="Toggle sound"
            >
              {settings.soundEffects ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {/* Right: Sync Status, SOS Button & Active Profile Selector */}
          <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
            <SyncStatusIndicator />
            <SOSButton />

            {/* Current Active User Profile Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-amber-50/90 border border-amber-300/80 py-1.5 px-3 rounded-2xl shadow-2xs">
              {currentUser.avatarUrl && (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover border border-amber-300 shrink-0"
                />
              )}
              <span className="font-extrabold text-xs text-amber-950 max-w-[110px] md:max-w-[130px] truncate">
                {currentUser.preferredName || currentUser.name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded-md">
                {currentUser.role}
              </span>
            </div>

            {/* Logout / Sign Out Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                type="button"
                className="flex items-center gap-1.5 px-2 xs:px-3 py-1.5 sm:py-2 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-all cursor-pointer shadow-sm hover:border-red-300"
                title="Sign out of MIND SATHI"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            )}

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="lg:hidden p-1.5 xs:p-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 xs:w-6 xs:h-6" /> : <Menu className="w-5 h-5 xs:w-6 xs:h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Primary Navigation Bar */}
        <nav className="hidden lg:block border-t border-[#EFE9E0] bg-[#FFFBF7]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-start gap-1 overflow-x-auto py-1.5 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-sathi-600 text-white shadow-sm'
                      : 'text-gray-700 hover:text-sathi-800 hover:bg-amber-100/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Flyout Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#EFE9E0] bg-white p-3.5 xs:p-4 shadow-2xl animate-fade-in space-y-3 max-h-[80vh] overflow-y-auto">
            {/* Quick Controls in Drawer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <LanguageSwitcher />
              <FontScaler />
              <button
                onClick={toggleSound}
                type="button"
                className={`p-2 rounded-2xl border cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold ${
                  settings.soundEffects
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-gray-100 text-gray-400 border-gray-300'
                }`}
              >
                {settings.soundEffects ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{settings.soundEffects ? 'Audio On' : 'Muted'}</span>
              </button>
            </div>

            {/* User Details in Drawer */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-3">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-amber-300 shrink-0 bg-white"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-gray-900 truncate">
                  {currentUser.preferredName || currentUser.name}
                </div>
                <div className="text-xs text-amber-800 font-medium capitalize">
                  {currentUser.role} • {currentUser.levelTitle || 'Sadhak'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    type="button"
                    className={`flex items-center gap-2 p-2.5 xs:p-3 rounded-2xl text-xs sm:text-sm font-bold text-left transition-all ${
                      isActive
                        ? 'bg-sathi-600 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-800 hover:bg-amber-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {onLogout && (
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Sign Out / Log Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 xs:p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
        {children}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar (<1024px) for Senior Thumb Ease */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8E2D8] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-safe">
        <div className="max-w-lg mx-auto flex items-center justify-around gap-1">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              activeTab === 'home'
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <Home className={`w-5 h-5 mb-0.5 ${activeTab === 'home' ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">{t.nav.home}</span>
          </button>

          {/* 2. Games */}
          <button
            type="button"
            onClick={() => onNavigate('games')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              activeTab === 'games' || activeTab === 'play'
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <Gamepad2 className={`w-5 h-5 mb-0.5 ${activeTab === 'games' || activeTab === 'play' ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">{t.nav.games}</span>
          </button>

          {/* 3. Daily Plan */}
          <button
            type="button"
            onClick={() => onNavigate('daily-plan')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              activeTab === 'daily-plan'
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <CalendarCheck className={`w-5 h-5 mb-0.5 ${activeTab === 'daily-plan' ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">{t.nav.dailyPlan}</span>
          </button>

          {/* 4. Progress */}
          <button
            type="button"
            onClick={() => onNavigate('progress')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              activeTab === 'progress'
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <LineChart className={`w-5 h-5 mb-0.5 ${activeTab === 'progress' ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">{t.nav.progress}</span>
          </button>

          {/* 5. More / Menu Drawer */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              mobileMenuOpen
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <Menu className={`w-5 h-5 mb-0.5 ${mobileMenuOpen ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Accessible Footer */}
      <footer className="bg-white border-t border-[#EDE7DF] mt-12 py-8 text-gray-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img src="/logo_icon.png" alt="MIND SATHI" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="font-extrabold text-gray-900 text-base">MIND SATHI</div>
              <div className="text-xs text-sathi-700 font-semibold">{t.common.tagline}</div>
            </div>
          </div>

          {/* Helplines and ABDM readiness */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-gray-700">
            <span className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              🏛️ PM-JAY Ayushman Helpline: <strong className="text-amber-900 font-mono">14555</strong>
            </span>
            <span className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
              🚑 Senior Citizen Emergency: <strong className="text-blue-900 font-mono">14567</strong>
            </span>
            <span className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              ✓ Ready for official ABDM M1/M2/M3 Integration
            </span>
          </div>

          <p className="text-xs text-gray-400">
            © 2026 MIND SATHI Ecosystem. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
