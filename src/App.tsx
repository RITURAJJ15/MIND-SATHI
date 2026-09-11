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
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage';
import { authService } from './services/authService';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useRouter } from './router';
import type { AuthScreen, AuthRole } from './types/auth';
import type { GameId, DifficultyTier } from './types/game';
import { Brain, LogOut } from 'lucide-react';

export const App: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<string>('home');
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

  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [pendingRole, setPendingRole] = useState<AuthRole | null>(null);
  const [activeGameId, setActiveGameId] = useState<GameId>('smriti_sangam');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyTier>('saral');

  // ── Automatic route guard and role protection ──────────────────────────────
  useEffect(() => {
    if (isLoading) return;

    // Do not redirect while processing OAuth callback
    if (currentPath === '/auth/callback') return;

    if (isAuthenticated) {
      const userRole = currentUser?.role || session?.user?.role;

      if (userRole === 'caregiver' || isCaregiver) {
        // Caregiver must stay in caregiver area
        if (currentPath === '/patient/dashboard' || currentPath === '/patient/auth' || currentPath === '/') {
          navigate('/caregiver/dashboard', true);
        }
      } else if (userRole === 'elderly' || (userRole as string) === 'patient' || isElderly) {
        // Patient must stay in patient area
        if (currentPath === '/caregiver/dashboard' || currentPath === '/caregiver/auth' || currentPath === '/') {
          navigate('/patient/dashboard', true);
        }
      } else if (userRole === 'clinician') {
        if (currentPath === '/patient/dashboard' || currentPath === '/caregiver/dashboard' || currentPath === '/') {
          navigate('/doctor/dashboard', true);
        }
      }
    } else {
      // Unauthenticated users cannot access dashboard routes
      if (currentPath === '/patient/dashboard') {
        navigate('/patient/auth', true);
      } else if (currentPath === '/caregiver/dashboard') {
        navigate('/caregiver/auth', true);
      } else if (currentPath === '/doctor/dashboard') {
        navigate('/doctor/auth', true);
      }
    }
  }, [isAuthenticated, isLoading, currentUser?.role, session?.user?.role, isCaregiver, isElderly, currentPath]);

  const handleNavigate = (tab: string, extraId?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'logout') {
      handleLogout();
      return;
    }
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

  const handleLogout = async () => {
    const wasCaregiver = currentUser?.role === 'caregiver' || isCaregiver;
    await authService.logout();
    if (wasCaregiver) {
      navigate('/caregiver/auth', true);
    } else {
      navigate('/', true);
    }
  };

  const handleAuthSuccess = (role: AuthRole) => {
    if (role === 'caregiver') {
      navigate('/caregiver/dashboard', true);
    } else if (role === 'clinician') {
      navigate('/doctor/dashboard', true);
    } else {
      navigate('/patient/dashboard', true);
    }
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

  // ── Route 1: OAuth Callback ────────────────────────────────────────────────
  if (currentPath === '/auth/callback') {
    return <OAuthCallbackPage />;
  }

  // ── Route 2: Caregiver Authentication ──────────────────────────────────────
  if (currentPath === '/caregiver/auth') {
    return (
      <CaregiverAuthPage
        onBackToLanding={() => navigate('/')}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  // ── Route 3: Doctor Authentication ─────────────────────────────────────────
  if (currentPath === '/doctor/auth') {
    return (
      <AuthLayout onBackToLanding={() => navigate('/')}>
        <ClinicianPortalPage />
      </AuthLayout>
    );
  }

  // ── Route 4: Patient Authentication ────────────────────────────────────────
  if (currentPath === '/patient/auth' && !isAuthenticated) {
    return (
      <AuthLayout onBackToLanding={() => navigate('/')}>
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

  // ── Route 5: Root Landing Page ─────────────────────────────────────────────
  if (currentPath === '/' && !isAuthenticated) {
    return (
      <LandingPage
        onEnterApp={(screen, role) => {
          if (role === 'caregiver' || screen === 'caregiver-auth') {
            navigate('/caregiver/auth');
          } else {
            navigate('/patient/auth');
          }
        }}
      />
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
              if (profile.role === 'caregiver') {
                navigate('/caregiver/dashboard', true);
              } else if (profile.role === 'clinician') {
                navigate('/doctor/dashboard', true);
              } else {
                navigate('/patient/dashboard', true);
              }
            }
          }}
        />
      </AuthLayout>
    );
  }

  // ── Route 6: Caregiver Dashboard (Strictly patient oversight & records) ────
  if (currentPath === '/caregiver/dashboard') {
    if (!isAuthenticated) {
      navigate('/caregiver/auth', true);
      return null;
    }

    if (currentUser?.role !== 'caregiver' && !isCaregiver && session?.user?.role !== 'caregiver') {
      // Access denied to non-caregivers
      navigate('/patient/dashboard', true);
      return null;
    }

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
                    currentUser?.avatarUrl ||
                    `https://api.dicebear.com/9.x/avataaars/svg?seed=${currentUser?.id}&backgroundColor=b6e3f4`
                  }
                  alt={currentUser?.name || 'Caregiver'}
                  className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-black text-emerald-950 truncate max-w-[150px]">
                    {currentUser?.name || currentUser?.preferredName || 'Caregiver'}
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

  // ── Route 7: Doctor Dashboard ──────────────────────────────────────────────
  if (currentPath === '/doctor/dashboard') {
    if (!isAuthenticated) {
      navigate('/doctor/auth', true);
      return null;
    }
    return <ClinicianPortalPage />;
  }

  // ── Route 8: Patient Dashboard ─────────────────────────────────────────────
  // Patient Onboarding (authenticated elderly, no onboarding yet)
  if (
    isElderly &&
    currentUser &&
    !currentUser.hasCompletedOnboarding &&
    currentUser.role !== 'caregiver' &&
    !isCaregiver
  ) {
    return (
      <AuthLayout>
        <PatientOnboardingPage
          onComplete={() => {
            authService.updateCurrentUserProfile({ hasCompletedOnboarding: true });
            navigate('/patient/dashboard', true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </AuthLayout>
    );
  }

  // Patient Dashboard Main Layout
  return (
    <MainLayout activeTab={activeTab} onNavigate={handleNavigate} onLogout={handleLogout}>
      {activeTab === 'home' && <HomePage onNavigate={handleNavigate} />}
      {activeTab === 'games' && <GamesHubPage onPlayGame={handleLaunchGame} />}
      {activeTab === 'play' && (
        <GamePlayPage
          gameId={activeGameId}
          difficulty={activeDifficulty}
          onBack={() => setActiveTab('games')}
        />
      )}
      {activeTab === 'daily-plan' && (
        <DailyPlanPage
          onPlayGame={handleLaunchGame}
          onOpenMemories={() => setActiveTab('memories')}
        />
      )}
      {activeTab === 'memories' && <MemoryVaultPage />}
      {activeTab === 'progress' && <ProgressPage />}
      {activeTab === 'leaderboard' && <LeaderboardPage />}
      {activeTab === 'reminders' && <RemindersPage />}
      {activeTab === 'family' && <FamilyCallingPage />}
      {activeTab === 'assistant' && <AIAssistantPage />}
      {activeTab === 'ayushman' && <AyushmanHubPage />}
      {activeTab === 'caregiver' && <CaregiverPortalPage />}
      {activeTab === 'clinician' && <ClinicianPortalPage />}
      {activeTab === 'admin' && <AdminPortalPage />}
      {activeTab === 'settings' && <ProfileSettingsPage />}
    </MainLayout>
  );
};

export default App;
