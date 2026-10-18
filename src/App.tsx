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
import { CareNavigatorPage } from './pages/CareNavigatorPage';
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
import { Brain, LogOut, Compass, HeartHandshake, ShieldCheck } from 'lucide-react';

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
        // Caregivers use the dedicated standalone portal page
        window.location.href = '/caregiver.html';
        return;
      } else if (userRole === 'elderly' || (userRole as string) === 'patient' || isElderly) {
        // Patient must stay in patient area
        if (currentPath === '/' || currentPath === '/patient/auth') {
          navigate('/patient/dashboard', true);
        }
      } else if (userRole === 'clinician') {
        if (currentPath === '/patient/dashboard' || currentPath === '/' || currentPath === '/doctor/auth') {
          navigate('/doctor/dashboard', true);
        }
      }
    } else {
      // Unauthenticated users cannot access dashboard routes
      if (currentPath === '/caregiver/dashboard' || currentPath === '/caregiver/auth') {
        window.location.href = '/caregiver.html';
        return;
      } else if (currentPath === '/patient/dashboard') {
        navigate('/patient/auth', true);
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
      window.location.href = '/caregiver.html';
    } else {
      navigate('/', true);
    }
  };

  const handleAuthSuccess = (role: AuthRole) => {
    if (role === 'caregiver') {
      window.location.href = '/caregiver.html';
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

  // ── Route 3.5: Administrator Portal ──────────────────────────────────────
  if (currentPath === '/admin' || currentPath === '/admin/portal') {
    return <AdminPortalPage onBackToLanding={() => navigate('/')} />;
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

  // ── Route 6: Caregiver Dashboard & Care Navigator ─────────────────────────
  if (currentPath === '/caregiver/dashboard' || currentPath === '/caregiver/navigator') {
    if (!isAuthenticated) {
      navigate('/caregiver/auth', true);
      return null;
    }

    if (currentUser?.role !== 'caregiver' && !isCaregiver && session?.user?.role !== 'caregiver') {
      // Access denied to non-caregivers
      window.location.href = '/caregiver.html';
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

        {/* Dedicated Caregiver Main Content with Sidebar */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* ── CAREGIVER PANEL SIDEBAR ── */}
            <aside className="w-full md:w-64 shrink-0 space-y-4">
              <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-emerald-200 shadow-elder space-y-2 text-left">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800/80">
                  Caregiver Navigation
                </div>

                {/* Sidebar Item 1: Patient Oversight */}
                <button
                  type="button"
                  onClick={() => navigate('/caregiver/dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                    currentPath === '/caregiver/dashboard'
                      ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md'
                      : 'text-gray-700 hover:text-emerald-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      currentPath === '/caregiver/dashboard' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black">Patient Oversight</div>
                    <div
                      className={`text-[10px] ${
                        currentPath === '/caregiver/dashboard' ? 'text-emerald-100' : 'text-gray-400'
                      }`}
                    >
                      Live records & vitals
                    </div>
                  </div>
                </button>

                {/* Sidebar Item 2: Care Navigator */}
                <button
                  type="button"
                  onClick={() => navigate('/caregiver/navigator')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                    currentPath === '/caregiver/navigator'
                      ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md'
                      : 'text-gray-700 hover:text-emerald-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      currentPath === '/caregiver/navigator' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">Care Navigator</span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          currentPath === '/caregiver/navigator'
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        TinyFish
                      </span>
                    </div>
                    <div
                      className={`text-[10px] ${
                        currentPath === '/caregiver/navigator' ? 'text-emerald-100' : 'text-gray-400'
                      } truncate`}
                    >
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
              {currentPath === '/caregiver/navigator' ? <CareNavigatorPage /> : <CaregiverPortalPage />}
            </div>
          </div>
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
      {activeTab === 'settings' && <ProfileSettingsPage />}
    </MainLayout>
  );
};

export default App;
