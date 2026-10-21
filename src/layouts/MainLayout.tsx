import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Check,
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close desktop "More" dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  // Primary navigation tabs in vertical order (core daily patient journey)
  const primaryNavItems = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'daily-plan', label: t.nav.dailyPlan, icon: CalendarCheck },
    { id: 'games', label: t.nav.games, icon: Gamepad2 },
    { id: 'family', label: t.nav.family || 'Family & Calling', icon: Phone },
    { id: 'reminders', label: t.nav.reminders, icon: Bell },
  ];

  // Mind Sathi AI assistant flagship companion
  const assistantItem = {
    id: 'assistant',
    label: t.nav.assistant || 'Mind Sathi AI',
    icon: Bot,
  };

  // Secondary tools and specialized portals organized in "More"
  const secondaryNavItems = [
    {
      id: 'progress',
      label: t.nav.progress,
      icon: LineChart,
      tag: 'Analytics',
      desc: 'Cognitive trends & session metrics',
    },
    {
      id: 'memories',
      label: t.nav.memories,
      icon: Heart,
      tag: 'Reminiscence',
      desc: 'Photo albums & voice memories',
    },
    {
      id: 'leaderboard',
      label: t.nav.leaderboard,
      icon: Users,
      tag: 'Community',
      desc: 'Senior Club & wellness streaks',
    },
    {
      id: 'ayushman',
      label: t.nav.ayushman,
      icon: Building,
      tag: 'ABDM',
      desc: 'ABHA Health Card & PM-JAY scheme',
    },
    {
      id: 'clinician',
      label: t.nav.clinicianPortal,
      icon: Stethoscope,
      tag: 'Doctor',
      desc: 'Doctor summaries & clinical scores',
    },
    {
      id: 'caregiver',
      label: t.nav.caregiverPortal,
      icon: UserCheck,
      tag: 'Caregiver',
      desc: 'Safety controls & caregiver dashboard',
    },
  ];

  const activeSecondaryItem = secondaryNavItems.find((item) => item.id === activeTab);
  const isMoreActive = Boolean(activeSecondaryItem);

  // Auto-expand "More Tools" if user navigates to a secondary tab
  useEffect(() => {
    if (isMoreActive) {
      setMoreMenuOpen(true);
    }
  }, [isMoreActive]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Top Accessibility & System Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8E2D8] shadow-sm w-full">
        <div className="max-w-[1600px] w-full mx-auto px-2.5 xs:px-4 sm:px-6 py-2 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Logo & Tagline */}
          <button
            onClick={() => onNavigate('home')}
            type="button"
            className="flex items-center gap-2 xs:gap-3 text-left cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base xs:text-lg sm:text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">
                  MIND SATHI
                </span>
                <span className="hidden xl:inline-block text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 whitespace-nowrap">
                  AYUSHMAN READY
                </span>
              </div>
              <p className="hidden md:block text-[10px] sm:text-[11px] text-sathi-700 font-bold tracking-wide italic truncate max-w-[150px] 2xl:max-w-none">
                {t.common.tagline}
              </p>
            </div>
          </button>

          {/* Center Actions: Language & Accessibility Cluster */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0">
            <LanguageSwitcher />
            <div className="flex items-center gap-0.5 bg-gray-100/90 p-0.5 rounded-xl border border-gray-300/80 shadow-2xs">
              <FontScaler />
              <button
                onClick={toggleSound}
                type="button"
                className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                  settings.soundEffects
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
                title={settings.soundEffects ? 'Sound Effects: On' : 'Sound Effects: Muted'}
                aria-label="Toggle sound"
              >
                {settings.soundEffects ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Right Actions: Sync Status, SOS Button & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <SyncStatusIndicator />
            <SOSButton />

            {/* Current Active User Profile & Integrated Sign Out */}
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-50/90 border border-amber-300/80 p-1 pl-2.5 rounded-xl shadow-2xs">
              {currentUser.avatarUrl && (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-amber-300 shrink-0"
                />
              )}
              <span className="font-extrabold text-xs text-amber-950 max-w-[85px] md:max-w-[105px] xl:max-w-[130px] truncate">
                {currentUser.preferredName || currentUser.name}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded-md">
                {currentUser.role}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  type="button"
                  className="ml-0.5 p-1 rounded-lg hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                  title="Sign out of MIND SATHI"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

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

            {/* Mobile Navigation Groups */}
            <div className="space-y-3">
              {/* Core Daily Essentials */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 px-1">
                  Daily Journey
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[...primaryNavItems, assistantItem].map((item) => {
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
              </div>

              {/* Tools & Care Portals */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 px-1">
                  {t.nav.more || 'More Portals & Tools'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {secondaryNavItems.map((item) => {
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
              </div>
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

      {/* Main Body: Left Vertical Sidebar + Main Content Area */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row min-w-0 overflow-x-hidden">
        {/* Left Vertical Sidebar (Desktop >= 1024px) - Compact & Senior Friendly */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-[#E8E2D8] bg-[#FFFBF7]/85 backdrop-blur-sm sticky top-[57px] sm:top-[61px] h-[calc(100vh-61px)] overflow-y-auto no-scrollbar p-2.5 xl:p-3 justify-between gap-3">
          <div className="space-y-3">
            {/* Primary Vertical Navigation List */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 px-2 pb-0.5">
                Main Menu
              </p>
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-extrabold text-left transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-sathi-600 text-white shadow-md shadow-sathi-600/20 ring-1 ring-sathi-700/30'
                        : 'text-stone-700 hover:text-amber-950 hover:bg-amber-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-amber-800'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mind Sathi AI Featured Companion Card */}
            <div className="pt-1.5 border-t border-amber-200/60">
              <button
                onClick={() => onNavigate(assistantItem.id)}
                type="button"
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
                  activeTab === assistantItem.id
                    ? 'bg-sathi-600 text-white border-sathi-700 shadow-md shadow-sathi-600/20'
                    : 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-950 border-amber-300/80 shadow-2xs'
                }`}
                title="Mind Sathi AI Voice & Chat Companion"
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === assistantItem.id ? 'bg-white/20' : 'bg-amber-200/80'}`}>
                  <Bot className={`w-4 h-4 ${activeTab === assistantItem.id ? 'text-white' : 'text-amber-900'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-extrabold truncate">{assistantItem.label}</span>
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
                  </div>
                  <p className={`text-[10px] font-medium truncate ${activeTab === assistantItem.id ? 'text-amber-100' : 'text-amber-800'}`}>
                    AI Companion
                  </p>
                </div>
              </button>
            </div>

            {/* More Tools Dropdown / Expandable Section */}
            <div className="pt-1.5 border-t border-amber-200/60">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                type="button"
                aria-expanded={moreMenuOpen}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isMoreActive
                    ? 'bg-amber-100/90 text-amber-950 border border-amber-300'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-amber-100/50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{t.nav.more || 'More Tools'}</span>
                  {activeSecondaryItem && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sathi-600 animate-pulse" />
                  )}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${
                    moreMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expandable Secondary Items List */}
              {moreMenuOpen && (
                <div className="mt-1 space-y-0.5 pl-0.5 pr-0.5 animate-in fade-in-50 duration-200">
                  {secondaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-sathi-600 text-white font-extrabold shadow-sm'
                            : 'text-stone-700 hover:text-amber-950 hover:bg-amber-100/60 font-semibold'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-amber-800'}`} />
                        <span className="text-xs truncate flex-1">{item.label}</span>
                        {isActive && <Check className="w-3 h-3 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full overflow-x-hidden p-3 xs:p-4 sm:p-5 lg:p-6 pb-28 lg:pb-8">
          {children}
        </main>
      </div>

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

          {/* 4. Reminders */}
          <button
            type="button"
            onClick={() => onNavigate('reminders')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
              activeTab === 'reminders'
                ? 'text-sathi-700 font-extrabold scale-105'
                : 'text-gray-500 hover:text-gray-900 font-semibold'
            }`}
          >
            <Bell className={`w-5 h-5 mb-0.5 ${activeTab === 'reminders' ? 'text-sathi-600 stroke-[2.5]' : ''}`} />
            <span className="text-[10px] leading-tight">{t.nav.reminders}</span>
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
      <footer className="bg-white border-t border-[#EDE7DF] mt-12 py-8 text-gray-600 w-full overflow-hidden">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
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
