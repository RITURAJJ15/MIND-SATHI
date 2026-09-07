import React, { useState } from 'react';
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
import { authService } from './services/authService';
import { useCurrentUser } from './hooks/useCurrentUser';
import type { AuthScreen, AuthRole } from './types/auth';
import type { GameId, DifficultyTier } from './types/game';
import { Brain } from 'lucide-react';

// Role → default tab after login/register
const roleToTab: Record<AuthRole, string> = {
  elderly:   'home',
  caregiver: 'caregiver',
  clinician: 'clinician',
  admin:     'home',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab]     = useState<string>('home');
  const { isAuthenticated, isLoading, currentUser, isElderly } = useCurrentUser(activeTab);
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [authScreen, setAuthScreen]   = useState<AuthScreen>('login');
  const [pendingRole, setPendingRole] = useState<AuthRole | null>(null);
  const [activeGameId, setActiveGameId]       = useState<GameId>('smriti_sangam');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyTier>('saral');

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

  const handleEnterApp = (screen: 'login' | 'register' = 'login') => {
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
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  // ── Auth screens (not yet authenticated) ──────────────────────────────────
  if (!isAuthenticated) {
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

  // ── Patient Onboarding (authenticated elderly, no onboarding yet) ──────────
  if (isElderly && currentUser && !currentUser.hasCompletedOnboarding) {
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

  // ── Main app (authenticated) ───────────────────────────────────────────────
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
