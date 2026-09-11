import React, { useState, useEffect } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { SelectRolePage } from './pages/auth/SelectRolePage';
import { HomePage } from './pages/HomePage';
import { GamesHubPage } from './pages/GamesHubPage';
import { GamePlayPage } from './pages/GamePlayPage';
import { DailyPlanPage } from './pages/DailyPlanPage';
import { MemoryVaultPage } from './pages/MemoryVaultPage';
import { ProgressPage } from './pages/ProgressPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { RemindersPage } from './pages/RemindersPage';
import { AyushmanHubPage } from './pages/AyushmanHubPage';
import { CaregiverPortalPage } from './pages/CaregiverPortalPage';
import { ClinicianPortalPage } from './pages/ClinicianPortalPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { FamilyCallingPage } from './pages/FamilyCallingPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { PatientOnboardingPage } from './pages/auth/PatientOnboardingPage';
import { CaregiverAuthPage } from './pages/auth/CaregiverAuthPage';
import { authService } from './services/authService';
import { useCurrentUser } from './hooks/useCurrentUser';
import type { AuthScreen, AuthRole } from './types/auth';
import type { GameId, DifficultyTier } from './types/game';
import { Brain, LogOut } from 'lucide-react';

// Role → default tab after login/register
const roleToTab: Record<AuthRole, string> = {
  elderly:   'home',
  caregiver: 'caregiver',
  clinician: 'clinician',
  admin:     'home',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab]     = useState<string>('home');
  const {
    isAuthenticated,
    isLoading,
    currentUser,
    session,
    isElderly,
    isCaregiver,
    needsRoleSelection,
    completeGoogleProfile,
  } = useCurrentUser(activeTab);
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [authScreen, setAuthScreen]   = useState<AuthScreen>('login');
  const [pendingRole, setPendingRole] = useState<AuthRole | null>(null);
  const [activeGameId, setActiveGameId]       = useState<GameId>('smriti_sangam');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyTier>('saral');

  useEffect(() => {
    if ((currentUser?.role === 'caregiver' || session?.user?.role === 'caregiver' || isCaregiver) && activeTab !== 'caregiver') {
      setActiveTab('caregiver');
    }
  }, [currentUser?.role, session?.user?.role, isCaregiver, activeTab]);

  const handleNavigate = (tab: string, extraId?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'logout') { handleLogout(); return; }
    if (tab === 'play' && extraId) {
      setActiveGameId(extraId as GameId);
      setActiveTab('play');
    } else {
      setActiveTab(tab);
    }
  };

  const handleLaunchGame = (gameId: string, diff?: DifficultyTier) => {
    setActiveGameId(gameId as GameId);
    if (diff) setActiveDifficulty(diff);
    setActiveTab('play');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnterApp = (screen: 'login' | 'register' | 'caregiver-auth' = 'login') => {
    setAuthScreen(screen);
    setShowLanding(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogout = async () => {
    await authService.logout();
    setAuthScreen('login');
    setShowLanding(false);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (role: AuthRole) => {
    const tab = roleToTab[role] ?? 'home';
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNavigateAuth = (screen: AuthScreen) => setAuthScreen(screen);

  const handleSelectRole = (role: AuthRole) => {
    setPendingRole(role);
    setAuthScreen('register');
  };

  // ── Startup loading — wait for Supabase session check ──────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sathi-900 via-sathi-800 to-amber-900 flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl p-2.5">
          <img src="/logo_icon.png" alt="MIND SATHI" className="w-full h-full object-contain animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-white text-xl font-black tracking-tight">MIND SATHI</p>
          <p className="text-white/60 text-sm font-medium mt-1">माइंड साथी · মাইণ্ড সাৰথি</p>
        </div>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce" />
        </div>
      </div>
    );
  }

  // ── Landing page ───────────────────────────────────────────────────────────
  if (showLanding && !isAuthenticated) {
    return (
      <LandingPage
        onEnterApp={handleEnterApp}
        onCaregiverSuccess={() => {
          setActiveTab('caregiver');
          setShowLanding(false);
        }}
      />
    );
  }

  // ── Auth screens (not yet authenticated) ──────────────────────────────────
  if (!isAuthenticated) {
    if (authScreen === 'caregiver-auth') {
      return (
        <CaregiverAuthPage
          onBackToLanding={() => setShowLanding(true)}
          onSuccess={handleAuthSuccess}
        />
      );
    }

    return (
      <AuthLayout onBackToLanding={() => setShowLanding(true)}>
        {authScreen === 'login' && (
          <LoginPage
            onNavigateAuth={handleNavigateAuth}
            onLoginSuccess={handleAuthSuccess}
          />
        )}
        {authScreen === 'register' && (
          <RegisterPage
            onNavigateAuth={handleNavigateAuth}
            onRegisterSuccess={handleAuthSuccess}
            preselectedRole={pendingRole ?? undefined}
          />
        )}
        {authScreen === 'forgot-password' && (
          <ForgotPasswordPage onNavigateAuth={handleNavigateAuth} />
        )}
        {authScreen === 'select-role' && (
          <SelectRolePage
            onNavigateAuth={handleNavigateAuth}
            onSelectRole={handleSelectRole}
          />
        )}
      </AuthLayout>
    );
  }

  // ── First-time Google Auth: Role Selection required ───────────────────────
  if (isAuthenticated && needsRoleSelection) {
    return (
      <AuthLayout>
        <SelectRolePage
          onNavigateAuth={handleNavigateAuth}
          onSelectRole={async (role) => {
            const profile = await completeGoogleProfile(role);
            if (profile) {
              const tab = roleToTab[profile.role] ?? 'home';
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
          }}
        />
      </AuthLayout>
    );
  }

  // ── Patient Onboarding (authenticated elderly, no onboarding yet) ──────────
  // STRICT: Patient Onboarding is strictly for elderly seniors. Caregivers must NEVER be routed here!
  if (
    !isCaregiver &&
    session?.user?.role !== 'caregiver' &&
    currentUser?.role !== 'caregiver' &&
    isElderly &&
    currentUser &&
    !currentUser.hasCompletedOnboarding
  ) {
    return (
      <AuthLayout>
        <PatientOnboardingPage
          onComplete={() => {
            // Mark locally first so the UI transitions immediately
            authService.updateCurrentUserProfile({ hasCompletedOnboarding: true });
            setActiveTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </AuthLayout>
    );
  }

  // ── Dedicated Caregiver Portal View (Strictly patient oversight & records) ──
  if (currentUser?.role === 'caregiver' || session?.user?.role === 'caregiver' || isCaregiver) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        {/* Caregiver Dedicated Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xs">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
                <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-xs" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                    MIND SATHI
                  </span>
                  <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    Caregiver Panel
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-semibold hidden sm:block">
                  Dedicated Patient Oversight & Cognitive Wellness Records
                </p>
              </div>
            </div>

            {/* Caregiver Name, Photo & Logout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-2xl">
                <img
                  src={
                    currentUser.avatarUrl ||
                    `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser.id}&backgroundColor=b6e3f4`
                  }
                  alt={currentUser.name || 'Caregiver'}
                  className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-black text-emerald-950 truncate max-w-[150px]">
                    {currentUser.name || currentUser.preferredName || 'Caregiver'}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700">Verified Caregiver</div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-gray-700 text-xs font-bold transition-all border border-gray-200 hover:border-rose-200 cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dedicated Caregiver Main Content — strictly patient details & records */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
          <CaregiverPortalPage />
        </main>
      </div>
    );
  }

  // ── Main app (authenticated elderly / clinician / admin) ──────────────────
  return (
    <MainLayout activeTab={activeTab} onNavigate={handleNavigate} onLogout={handleLogout}>
      {activeTab === 'home'        && <HomePage onNavigate={handleNavigate} />}
      {activeTab === 'games'       && <GamesHubPage onPlayGame={handleLaunchGame} />}
      {activeTab === 'play'        && (
        <GamePlayPage
          gameId={activeGameId}
          difficulty={activeDifficulty}
          onBack={() => setActiveTab('games')}
        />
      )}
      {activeTab === 'daily-plan'  && (
        <DailyPlanPage
          onPlayGame={handleLaunchGame}
          onOpenMemories={() => setActiveTab('memories')}
        />
      )}
      {activeTab === 'memories'    && <MemoryVaultPage />}
      {activeTab === 'progress'    && <ProgressPage />}
      {activeTab === 'leaderboard' && <LeaderboardPage />}
      {activeTab === 'reminders'   && <RemindersPage />}
      {activeTab === 'family'      && <FamilyCallingPage />}
      {activeTab === 'assistant'   && <AIAssistantPage />}
      {activeTab === 'ayushman'    && <AyushmanHubPage />}
      {activeTab === 'caregiver'   && <CaregiverPortalPage />}
      {activeTab === 'clinician'   && <ClinicianPortalPage />}
      {activeTab === 'admin'       && <AdminPortalPage />}
      {activeTab === 'settings'    && <ProfileSettingsPage />}
    </MainLayout>
  );
};

export default App;
