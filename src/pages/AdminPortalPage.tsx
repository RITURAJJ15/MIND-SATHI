import React, { useState, useEffect } from 'react';
import {
  adminService,
  PlatformSummaryKPIs,
  AdminPatientDetail,
  AdminUserRow,
  GenuineGameStat,
  StateDistributionItem,
} from '../services/adminService';
import {
  Users,
  Brain,
  Globe,
  BarChart2,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Gamepad2,
  Bell,
  UserCheck,
  Stethoscope,
  Database,
  RefreshCw,
  Download,
  Search,
  Filter,
  Eye,
  Lock,
  Unlock,
  KeyRound,
  Sparkles,
  Phone,
  Calendar,
  Award,
  Activity,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Building,
  Heart,
  ChevronRight,
  X,
} from 'lucide-react';
import { AshokaChakraIcon } from '../components/layout/AshokaChakraIcon';

type AdminTab = 'overview' | 'patients' | 'users' | 'games' | 'system';

export const AdminPortalPage: React.FC = () => {
  // Authentication gate state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    adminService.isAdminAuthenticated()
  );

  // Login Form states
  const [adminUserId, setAdminUserId] = useState<string>('RITURAJ11');
  const [adminPassword, setAdminPassword] = useState<string>('RITURAJ@11');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Portal data states
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<PlatformSummaryKPIs | null>(null);
  const [patients, setPatients] = useState<AdminPatientDetail[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [gameStats, setGameStats] = useState<GenuineGameStat[]>([]);
  const [stateDist, setStateDist] = useState<StateDistributionItem[]>([]);
  const [dbHealth, setDbHealth] = useState<any>(null);

  // Filter and Search states
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedPatientModal, setSelectedPatientModal] = useState<AdminPatientDetail | null>(null);

  // Fetch all genuine data when authenticated
  const loadPortalData = async () => {
    setIsLoading(true);
    try {
      const [sum, pts, usrs, gms, dist, hlth] = await Promise.all([
        adminService.getPlatformSummary(),
        adminService.getRegisteredPatients(),
        adminService.getAllRegisteredUsers(),
        adminService.getGenuineGameAnalytics(),
        adminService.getStateDistribution(),
        adminService.getDatabaseHealth(),
      ]);

      setSummary(sum);
      setPatients(pts);
      setUsers(usrs);
      setGameStats(gms);
      setStateDist(dist);
      setDbHealth(hlth);
    } catch (err) {
      console.warn('[AdminPortalPage] Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPortalData();
    }
  }, [isAuthenticated]);

  // Handle Admin Sign In
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      const result = await adminService.authenticateAdmin(adminUserId, adminPassword);
      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError(result.error || 'Invalid credentials. Access restricted to administrator.');
      }
    } catch {
      setAuthError('Authentication verification failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Admin Sign Out / Lock
  const handleAdminLogout = () => {
    adminService.logoutAdmin();
    setIsAuthenticated(false);
    setAdminPassword('');
  };

  // Export JSON summary report
  const handleExportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      platform: 'MIND SATHI Cognitive Health Platform',
      admin: 'RITURAJ11',
      summary,
      patientsCount: patients.length,
      patients,
      totalUsers: users.length,
      gameStats,
      stateDistribution: stateDist,
      databaseHealth: dbHealth,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-sathi-admin-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ADMIN AUTHENTICATION GATEWAY
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-elder border-2 border-amber-300/80 p-6 sm:p-8 relative overflow-hidden animate-fade-in">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Security Badge */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-900 to-slate-800 text-amber-400 shadow-md mb-3 border border-amber-400/30">
              <Shield className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1 bg-amber-100/90 text-amber-900 text-[11px] font-black px-3 py-1 rounded-full border border-amber-300 mb-1.5">
              <AshokaChakraIcon size={12} className="text-blue-800" />
              <span>AUTHORIZED ACCESS ONLY</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Admin Portal Security Gateway
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-xs mx-auto">
              Please enter your administrator credentials to access platform telemetry and patient registries.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Administrator User ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={adminUserId}
                  onChange={(e) => setAdminUserId(e.target.value)}
                  placeholder="e.g. RITURAJ11"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all uppercase"
                />
                <KeyRound className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                >
                  {showPassword ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 hover:from-black hover:to-slate-900 text-amber-300 font-extrabold text-sm shadow-tactile flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>{isAuthenticating ? 'Verifying Credentials...' : 'Unlock Admin Portal'}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-[11px] text-gray-500 font-medium">
              Configured Administrator ID: <span className="font-mono font-bold text-gray-700">RITURAJ11</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Role: Super Administrator • Full Database Access • Non-destructive session
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED ADMIN PORTAL
  // ─────────────────────────────────────────────────────────────────────────────
  const tabs: { id: AdminTab; label: string; icon: React.FC<any>; count?: number }[] = [
    { id: 'overview', label: 'Platform Overview', icon: BarChart2 },
    { id: 'patients', label: 'Registered Patients', icon: UserCheck, count: summary?.elderlyPatients ?? patients.length },
    { id: 'users', label: 'All Registered Accounts', icon: Users, count: summary?.totalUsers ?? users.length },
    { id: 'games', label: 'Cognitive Game Telemetry', icon: Gamepad2, count: summary?.gameSessionsCount },
    { id: 'system', label: 'Database & Sync Status', icon: Database },
  ];

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.shortId.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole =
      roleFilter === 'All' ||
      (roleFilter === 'Elderly' && (u.role === 'elderly' || (u.role as string) === 'patient')) ||
      (roleFilter === 'Caregiver' && u.role === 'caregiver') ||
      (roleFilter === 'Clinician' && (u.role === 'clinician' || (u.role as string) === 'doctor')) ||
      (roleFilter === 'Admin' && u.role === 'admin');
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white p-6 sm:p-8 rounded-3xl shadow-elder relative overflow-hidden border border-amber-400/30">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-400 border border-amber-400/40">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-300">
                MIND SATHI PLATFORM ADMIN
              </span>
              <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                LIVE DATABASE
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Administrator Dashboard
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 font-medium">
              Administrator: <strong className="text-amber-300">Rituraj (RITURAJ11)</strong> • Live Data from Supabase & Dexie
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <button
              onClick={loadPortalData}
              disabled={isLoading}
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-300' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportReport}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-black transition-all cursor-pointer shadow-sm"
              title="Export complete JSON data"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>

            <button
              onClick={handleAdminLogout}
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-xs font-bold transition-all cursor-pointer"
              title="Lock admin session (data is preserved)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Panel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto p-1.5 flex items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-gray-900 text-amber-300 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-amber-400 text-gray-900' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 1: PLATFORM OVERVIEW & TELEMETRY
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 6 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-3xl border-2 border-violet-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold mb-2">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900">
                  {summary?.totalUsers ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">Registered Users</div>
              </div>
              <div className="text-[10px] font-semibold text-violet-700 mt-2 bg-violet-50 px-2 py-0.5 rounded-md inline-block">
                All platform roles
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border-2 border-emerald-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                  {summary?.elderlyPatients ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">Elderly Patients</div>
              </div>
              <div className="text-[10px] font-semibold text-emerald-700 mt-2 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                Registered profiles
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border-2 border-blue-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-blue-700">
                  {summary?.caregivers ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">Caregivers</div>
              </div>
              <div className="text-[10px] font-semibold text-blue-700 mt-2 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                Family & Care team
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-amber-700">
                  {summary?.clinicians ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">Doctors / Clinicians</div>
              </div>
              <div className="text-[10px] font-semibold text-amber-700 mt-2 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                Medical supervisors
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border-2 border-rose-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-2">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-rose-700">
                  {summary?.gameSessionsCount ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">Sessions Played</div>
              </div>
              <div className="text-[10px] font-semibold text-rose-700 mt-2 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                Genuine game runs
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border-2 border-teal-200 shadow-elder flex flex-col justify-between">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-2">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-teal-700">
                  {summary?.abhaVerifiedCount ?? '...'}
                </div>
                <div className="text-xs font-bold text-gray-600 mt-0.5">ABHA Linked</div>
              </div>
              <div className="text-[10px] font-semibold text-teal-700 mt-2 bg-teal-50 px-2 py-0.5 rounded-md inline-block">
                ABDM Verified
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Northeast State Demographics */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-elder">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <span>Northeast State User Distribution</span>
                </h2>
                <span className="text-xs font-bold text-gray-500">Live Accounts</span>
              </div>
              <div className="space-y-3.5">
                {stateDist.map((item) => (
                  <div key={item.state} className="flex items-center gap-3">
                    <span className="text-base w-6">{item.flag}</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 w-32 truncate">
                      {item.state}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                        style={{ width: `${Math.max(4, item.percentage)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-gray-900 w-16 text-right">
                      {item.count} <span className="text-[10px] text-gray-400 font-normal">({item.percentage}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Live System Health */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-elder space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <span>Database & Backend Health</span>
                </h2>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    dbHealth?.supabaseStatus === 'Connected'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {dbHealth?.supabaseStatus || 'Checking...'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500">Supabase Profiles Table</div>
                  <div className="text-xl font-black text-gray-900 mt-1">
                    {dbHealth?.profilesCount ?? '—'} rows
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Live Cloud Database</div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500">Game Sessions Table</div>
                  <div className="text-xl font-black text-gray-900 mt-1">
                    {dbHealth?.sessionsCount ?? '—'} rows
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Completed Sessions</div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500">Dexie IndexedDB Cache</div>
                  <div className="text-xl font-black text-gray-900 mt-1">
                    {dbHealth?.dexieCacheCount ?? '—'} records
                  </div>
                  <div className="text-[10px] text-blue-700 font-semibold mt-0.5">Offline-Ready PWA Storage</div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500">Cloud Response Latency</div>
                  <div className="text-xl font-black text-gray-900 mt-1">
                    {dbHealth?.lastPingMs ?? '—'} ms
                  </div>
                  <div className="text-[10px] text-purple-700 font-semibold mt-0.5">Health Ping</div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black">Data Safety Guarantee</strong>
                  Logging out or clearing browser session does NOT delete any database records. All patient data, family photos, and scores are preserved.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 2: REGISTERED PATIENTS DIRECTORY
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-elder flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-900">
                Registered Elderly Patients ({patients.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Genuine patient records with demographic details, ABHA links, caregivers, and cognitive metrics.
              </p>
            </div>

            <div className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-300 self-start sm:self-auto">
              Total {patients.length} Elderly Registered
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white rounded-3xl border-2 border-gray-200 shadow-elder hover:shadow-xl transition-all p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Patient Header */}
                  <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-gray-100">
                    <img
                      src={patient.avatarUrl}
                      alt={patient.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-300 shadow-md bg-gray-50 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          {patient.formattedId}
                        </span>
                        {patient.isAbhaLinked && (
                          <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                            ABHA
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-base text-gray-900 truncate mt-1 group-hover:text-amber-900">
                        {patient.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {patient.age} yrs • {patient.gender} • {patient.city}, {patient.state}
                      </p>
                    </div>
                  </div>

                  {/* Demographic & Program Badges */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3.5">
                    <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 block">ABHA STATUS</span>
                      <span
                        className={`font-black text-[11px] truncate block ${
                          patient.isAbhaLinked ? 'text-teal-700' : 'text-amber-700'
                        }`}
                      >
                        {patient.isAbhaLinked ? patient.abhaId : 'Not Linked'}
                      </span>
                    </div>

                    <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 block">PM-JAY STATUS</span>
                      <span className="font-black text-[11px] text-blue-700 truncate block">
                        {patient.pmjayId || 'Not Linked'}
                      </span>
                    </div>
                  </div>

                  {/* Cognitive Telemetry Summary */}
                  <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-3 rounded-2xl border border-amber-200/80 mb-3.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-gray-600">Sessions Completed</span>
                      <strong className="font-black text-gray-900">{patient.sessionsPlayedCount}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-gray-600">Average Accuracy</span>
                      <strong className="font-black text-emerald-700">
                        {patient.sessionsPlayedCount > 0 ? `${patient.averageAccuracy}%` : 'Pending'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-600">Cognitive Streak</span>
                      <strong className="font-black text-amber-700">{patient.streakDays} days</strong>
                    </div>
                  </div>

                  {/* Linked Caregiver */}
                  <div className="text-xs text-gray-600 flex items-center gap-1.5 mb-2">
                    <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>
                      Caregiver:{' '}
                      <strong className="text-gray-900">
                        {patient.linkedCaregiverName || 'Self / Direct Patient'}
                      </strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPatientModal(patient)}
                  type="button"
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Complete Patient Record</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 3: ALL REGISTERED USERS MANAGEMENT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-elder overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                User Management Registry ({filteredUsers.length} of {users.length})
              </h2>
              <p className="text-xs text-gray-500">Live platform accounts across all roles.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, ID..."
                  className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs font-bold bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="All">All Roles</option>
                <option value="Elderly">Elderly Patients</option>
                <option value="Caregiver">Caregivers</option>
                <option value="Clinician">Clinicians</option>
                <option value="Admin">Administrators</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Email / Phone</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Streak & XP</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatarUrl}
                          alt={u.name}
                          className="w-8 h-8 rounded-xl object-cover bg-gray-100 border border-gray-200 shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-gray-900">{u.name}</div>
                          <div className="font-mono text-[10px] text-gray-400">ID: {u.shortId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-black text-[10px] px-2 py-0.5 rounded-md ${
                          u.role === 'elderly'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.role === 'caregiver'
                            ? 'bg-blue-100 text-blue-800'
                            : u.role === 'clinician'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-900 text-amber-300'
                        }`}
                      >
                        {u.roleLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800 truncate max-w-[150px]">{u.email}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{u.phone}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">{u.state}</td>
                    <td className="py-3 px-4 uppercase font-bold text-gray-500">{u.language}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{u.streak}d streak</div>
                      <div className="text-[10px] text-amber-700 font-bold">{u.xp} XP</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.status === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'Active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 4: COGNITIVE GAME TELEMETRY
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'games' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-elder flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                Cognitive Game Telemetry & Analytics
              </h2>
              <p className="text-xs text-gray-500">
                Aggregated statistics calculated directly from registered patient game sessions.
              </p>
            </div>
            <div className="text-xs font-bold text-rose-800 bg-rose-100 px-3 py-1.5 rounded-full border border-rose-200">
              Total {summary?.gameSessionsCount ?? 0} Completed Sessions
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gameStats.map((stat) => (
              <div
                key={stat.gameId}
                className="bg-white rounded-3xl border-2 border-gray-200 shadow-elder p-5 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                    {stat.category}
                  </span>
                  <h3 className="text-base font-black text-gray-900 mt-2 leading-snug">
                    {stat.gameName}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Total Plays</span>
                    <strong className="font-black text-gray-900">{stat.plays}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Average Score</span>
                    <strong className="font-black text-amber-700">
                      {stat.plays > 0 ? `${stat.avgScore} pts` : '—'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Average Accuracy</span>
                    <strong className="font-black text-emerald-700">
                      {stat.plays > 0 ? `${stat.avgAccuracy}%` : '—'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Average Time</span>
                    <strong className="font-black text-blue-700">
                      {stat.plays > 0 ? `${stat.avgDurationMinutes} min` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 5: DATABASE & SYSTEM HEALTH
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-elder space-y-6">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              <span>Database Infrastructure & Synchronization Telemetry</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live monitoring of Supabase Cloud Postgres tables, local Dexie IndexedDB cache, and offline queues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600">Supabase Connection</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    dbHealth?.supabaseStatus === 'Connected'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {dbHealth?.supabaseStatus}
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">
                {dbHealth?.lastPingMs ?? '...'} ms
              </div>
              <div className="text-xs text-gray-500 mt-1">Round-trip latency to remote Postgres DB</div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600">Dexie IndexedDB Cache</span>
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  OFFLINE READY
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">
                {dbHealth?.dexieCacheCount ?? '...'} records
              </div>
              <div className="text-xs text-gray-500 mt-1">Instant local access without internet</div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600">Sync Queue Status</span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  SYNCED
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900">
                {dbHealth?.offlinePendingCount ?? 0} pending
              </div>
              <div className="text-xs text-gray-500 mt-1">Background synchronization queue</div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <h3 className="text-sm font-black text-gray-900 mb-2">Supabase Table Verification</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-gray-400 block text-[10px] font-bold">public.profiles</span>
                <strong className="text-base text-gray-900 font-black">{dbHealth?.profilesCount ?? 0}</strong>
                <span className="text-emerald-700 block text-[10px] font-bold">Verified Table</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-gray-400 block text-[10px] font-bold">public.game_sessions</span>
                <strong className="text-base text-gray-900 font-black">{dbHealth?.sessionsCount ?? 0}</strong>
                <span className="text-emerald-700 block text-[10px] font-bold">Verified Table</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-gray-400 block text-[10px] font-bold">public.family_members</span>
                <strong className="text-base text-gray-900 font-black">{dbHealth?.familyCount ?? 0}</strong>
                <span className="text-emerald-700 block text-[10px] font-bold">Verified Table</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-gray-400 block text-[10px] font-bold">Admin Credentials</span>
                <strong className="text-base text-gray-900 font-black">RITURAJ11</strong>
                <span className="text-purple-700 block text-[10px] font-bold">Exclusive Admin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          PATIENT DETAIL MODAL
         ───────────────────────────────────────────────────────────────────────── */}
      {selectedPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-amber-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPatientModal(null)}
              type="button"
              className="absolute right-5 top-5 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-100">
              <img
                src={selectedPatientModal.avatarUrl}
                alt={selectedPatientModal.name}
                className="w-18 h-18 rounded-2xl object-cover border-2 border-amber-300 shadow-md bg-gray-50 shrink-0"
              />
              <div>
                <span className="font-mono text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  {selectedPatientModal.formattedId}
                </span>
                <h3 className="text-xl font-black text-gray-900 mt-1">
                  {selectedPatientModal.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedPatientModal.age} years old • {selectedPatientModal.gender} • {selectedPatientModal.city}, {selectedPatientModal.state}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-gray-500">ABHA Health Number</span>
                <span className="font-mono font-black text-teal-800">
                  {selectedPatientModal.abhaId || 'Not Linked'}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-gray-500">Ayushman PM-JAY Card</span>
                <span className="font-mono font-black text-blue-800">
                  {selectedPatientModal.pmjayId || 'Not Linked'}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-gray-500">Primary Contact Email</span>
                <span className="font-medium text-gray-900">{selectedPatientModal.email}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-gray-500">Phone Number</span>
                <span className="font-mono font-medium text-gray-900">{selectedPatientModal.phone}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="font-bold text-gray-500">Connected Caregiver</span>
                <span className="font-bold text-gray-900">
                  {selectedPatientModal.linkedCaregiverName || 'Self / Direct Patient'}
                </span>
              </div>

              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="font-extrabold text-amber-900 mb-1.5">Cognitive Vitality Telemetry</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg">
                    <div className="text-[10px] text-gray-400 font-bold">SESSIONS</div>
                    <div className="font-black text-gray-900 text-sm mt-0.5">
                      {selectedPatientModal.sessionsPlayedCount}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg">
                    <div className="text-[10px] text-gray-400 font-bold">AVG ACCURACY</div>
                    <div className="font-black text-emerald-700 text-sm mt-0.5">
                      {selectedPatientModal.sessionsPlayedCount > 0
                        ? `${selectedPatientModal.averageAccuracy}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg">
                    <div className="text-[10px] text-gray-400 font-bold">AVG SCORE</div>
                    <div className="font-black text-amber-700 text-sm mt-0.5">
                      {selectedPatientModal.sessionsPlayedCount > 0
                        ? `${selectedPatientModal.averageScore} pts`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedPatientModal(null)}
              type="button"
              className="w-full mt-5 py-3 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black cursor-pointer transition-all"
            >
              Close Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
