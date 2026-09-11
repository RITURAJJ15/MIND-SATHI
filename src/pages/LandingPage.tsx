import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Gamepad2,
  Heart,
  LineChart,
  Users,
  Shield,
  ArrowRight,
  Play,
  Star,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  UserCheck,
  Stethoscope,
  Bell,
  Sparkles,
  Trophy,
  Activity,
  Clock,
  Zap,
  Target,
  Eye,
  Grid3x3,
  BookOpen,
} from 'lucide-react';
import type { AuthRole } from '../types/auth';

interface LandingPageProps {
  onEnterApp: (screen?: 'login' | 'register' | 'caregiver-auth', role?: AuthRole) => void;
  onCaregiverSuccess?: () => void;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (1800 / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString('en-IN')}{suffix}</span>;
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const GAMES = [
  { id: 'memory_match', icon: Grid3x3, emoji: '🧩', name: 'Memory Match', hindi: 'स्मृति मिलान', domain: 'Short-Term Memory', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200', tagline: 'Flip and pair cards to exercise your recognition memory.' },
  { id: 'pattern_predictor', icon: Target, emoji: '🎯', name: 'Pattern Predictor', hindi: 'पैटर्न पहचान', domain: 'Executive Function', color: 'from-violet-500 to-purple-700', bg: 'bg-violet-50', border: 'border-violet-200', tagline: 'Identify the next shape in growing visual sequences.' },
  { id: 'focus_finder', icon: Eye, emoji: '🔍', name: 'Focus Finder', hindi: 'ध्यान खोजी', domain: 'Attention & Focus', color: 'from-teal-500 to-cyan-700', bg: 'bg-teal-50', border: 'border-teal-200', tagline: 'Spot the hidden object and sharpen your sustained attention.' },
  { id: 'sequence_recall', icon: Activity, emoji: '🔢', name: 'Sequence Recall', hindi: 'क्रम स्मरण', domain: 'Working Memory', color: 'from-rose-500 to-red-700', bg: 'bg-rose-50', border: 'border-rose-200', tagline: 'Remember and repeat progressively longer number chains.' },
  { id: 'object_recognition', icon: Zap, emoji: '⚡', name: 'Object Recognition', hindi: 'वस्तु पहचान', domain: 'Visual Processing', color: 'from-emerald-500 to-green-700', bg: 'bg-emerald-50', border: 'border-emerald-200', tagline: 'Name everyday objects quickly to boost cognitive speed.' },
  { id: 'memory_journey', icon: BookOpen, emoji: '📖', name: 'My Memory Journey', hindi: 'मेरी यादों की यात्रा', domain: 'Episodic Memory', color: 'from-pink-500 to-rose-600', bg: 'bg-pink-50', border: 'border-pink-200', tagline: 'Revisit cherished life events to enrich reminiscence therapy.' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: Users, label: 'Profile', desc: 'Create your personalized elder profile with language, health, and family preferences.' },
  { step: '02', icon: Gamepad2, label: 'Play', desc: 'Enjoy six adaptive cognitive games crafted for mental wellness.' },
  { step: '03', icon: LineChart, label: 'Analyze', desc: 'MIND SATHI tracks your performance across six cognitive domains.' },
  { step: '04', icon: Sparkles, label: 'Personalize', desc: 'AI adapts difficulty and suggests the most suitable next game for you.' },
  { step: '05', icon: Trophy, label: 'Progress', desc: 'Earn XP, unlock achievements, and celebrate every milestone.' },
];

const FAMILY_MEMBERS = [
  { name: 'Priya', relation: 'Daughter', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Priya&backgroundColor=b6e3f4', online: true },
  { name: 'Rohan', relation: 'Son', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rohan&backgroundColor=ffd5dc', online: false },
  { name: 'Ananya', relation: 'Granddaughter', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ananya&backgroundColor=d1d4f9', online: true },
  { name: 'Dr. Sharma', relation: 'Caregiver', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Sharma&backgroundColor=c0aede', online: false },
];

const MEMORY_PHOTOS = [
  { title: 'Festival of Lights 1987', tag: 'Diwali', emoji: '🪔', color: 'from-amber-400 to-orange-500' },
  { title: 'Family Reunion 2002', tag: 'Together', emoji: '👨‍👩‍👧‍👦', color: 'from-rose-400 to-pink-500' },
  { title: 'Our Wedding Day', tag: 'Milestone', emoji: '💐', color: 'from-violet-400 to-purple-500' },
  { title: 'First Grandchild', tag: 'Joy', emoji: '👶', color: 'from-emerald-400 to-teal-500' },
];

const DOMAIN_SCORES = [
  { label: 'Memory', score: 78, color: 'bg-amber-500' },
  { label: 'Focus', score: 85, color: 'bg-teal-500' },
  { label: 'Executive', score: 62, color: 'bg-violet-500' },
  { label: 'Language', score: 91, color: 'bg-rose-500' },
  { label: 'Visual', score: 70, color: 'bg-emerald-500' },
  { label: 'Working Mem.', score: 55, color: 'bg-indigo-500' },
];

function HeroIllustration({ onEnterApp }: { onEnterApp: () => void }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div ref={ref} className={`relative transition-all duration-1000 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
      <div className="relative mx-auto" style={{ maxWidth: 440 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-200/60 to-orange-300/40 rounded-[48px] blur-2xl scale-110" />
        <div className="relative bg-white/80 backdrop-blur-sm rounded-[40px] p-8 border border-white shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sathi-600 to-amber-500 flex items-center justify-center shadow-xl animate-float">
              <Brain className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[{ emoji: '🧩', label: 'Memory', color: 'bg-amber-50 border-amber-200' }, { emoji: '🎯', label: 'Pattern', color: 'bg-violet-50 border-violet-200' }, { emoji: '🔍', label: 'Focus', color: 'bg-teal-50 border-teal-200' }].map(({ emoji, label, color }) => (
              <div key={label} className={`${color} border-2 rounded-2xl p-3 text-center cursor-pointer hover:scale-105 transition-transform`} onClick={onEnterApp}>
                <div className="text-2xl">{emoji}</div>
                <div className="text-[10px] font-bold text-gray-700 mt-1">{label}</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">Weekly Cognitive Score</span>
              <span className="text-sm font-black text-sathi-600">78/100</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full w-[78%] bg-gradient-to-r from-sathi-500 to-amber-500 rounded-full" />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 font-semibold">
              <span>Keep going! 🌟</span>
              <span>+12 pts this week</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-rose-50 border-2 border-rose-100 rounded-2xl p-3">
            <div className="flex -space-x-2">
              {['Priya', 'Rohan', 'Ananya'].map(name => (
                <img key={name} src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${name}&backgroundColor=b6e3f4`} alt={name} className="w-8 h-8 rounded-xl border-2 border-white bg-gray-100" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-900">Family Connected</div>
              <div className="text-[10px] text-rose-600 font-semibold">3 members · Priya online now</div>
            </div>
            <Heart className="w-5 h-5 text-rose-500 shrink-0 fill-rose-500" />
          </div>
        </div>
        <div className="absolute -top-4 -right-4 bg-amber-500 text-white rounded-2xl px-3 py-2 shadow-xl text-xs font-black animate-float" style={{ animationDelay: '0.5s' }}>
          +150 XP 🏆
        </div>
        <div className="absolute -bottom-4 -left-4 bg-white border-2 border-sathi-200 rounded-2xl px-3 py-2 shadow-xl text-xs font-bold animate-float" style={{ animationDelay: '1s' }}>
          🔥 7-day streak
        </div>
      </div>
    </div>
  );
}

function AnimatedProgressPanel() {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="bg-white rounded-3xl p-7 shadow-elder-hover border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-base font-extrabold text-gray-900">Cognitive Domain Report</h4>
          <p className="text-xs text-gray-500 mt-0.5">Last 30 days · Ramesh Sharma</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">↑ 8% overall</div>
      </div>
      <div className="space-y-4">
        {DOMAIN_SCORES.map(({ label, score, color }, i) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-semibold text-gray-700">{label}</span>
              <span className="text-sm font-black text-gray-900">{score}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-1000`}
                style={{ width: inView ? `${score}%` : '0%', transitionDelay: `${i * 120}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-5 border-t border-gray-100">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Achievements</div>
        <div className="flex gap-2 flex-wrap">
          {['🧠 Mind Sharp', '🔥 Week Warrior', '💎 Memory Pro', '🌟 Family Star'].map((badge) => (
            <div key={badge} className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold text-amber-800">{badge}</div>
          ))}
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Daily Play Sessions</div>
        <div className="flex items-end gap-2 h-16">
          {[65, 80, 55, 90, 75, 60, 85].map((h, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-sathi-500 to-amber-400 rounded-t-lg transition-all duration-700" style={{ height: inView ? `${h}%` : '0%', transitionDelay: `${800 + i * 80}ms` }} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="flex-1 text-center text-[10px] text-gray-400 font-semibold">{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp, onCaregiverSuccess }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'Home', id: 'hero' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Cognitive Games', id: 'games' },
    { label: 'Family', id: 'family' },
    { label: 'For Caregivers', id: 'caregivers' },
    { label: 'About', id: 'about' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFAF5] font-sans text-gray-900 overflow-x-hidden">
      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <button onClick={() => scrollToSection('hero')} type="button" className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-none">MIND SATHI</div>
                <div className="text-[10px] sm:text-xs font-bold text-sathi-600 italic leading-none mt-0.5">Khelo. Socho. Badho.</div>
              </div>
            </button>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map(({ label, id }) => (
                <button key={id} onClick={() => scrollToSection(id)} type="button" className="px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:text-sathi-700 hover:bg-sathi-50 transition-all cursor-pointer">
                  {label}
                </button>
              ))}
            </nav>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-2.5">
              <button
                onClick={() => onEnterApp('caregiver-auth', 'caregiver')}
                type="button"
                id="nav-caregiver-btn"
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Caregiver Portal</span>
              </button>
              <button onClick={() => onEnterApp('login')} type="button" id="nav-login-btn" className="px-5 py-2.5 rounded-xl text-sm font-bold text-sathi-700 border-2 border-sathi-300 hover:bg-sathi-50 transition-all cursor-pointer">
                Login
              </button>
              <button onClick={() => onEnterApp('register')} type="button" id="nav-get-started-btn" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sathi-600 to-amber-600 hover:from-sathi-700 hover:to-amber-700 shadow-lg hover:shadow-xl transition-all cursor-pointer">
                Get Started
              </button>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} type="button" className="lg:hidden p-2 rounded-xl bg-white/80 border border-gray-200 text-gray-700 cursor-pointer shadow-sm" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile flyout */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-xl p-5 space-y-2">
            {navLinks.map(({ label, id }) => (
              <button key={id} onClick={() => { scrollToSection(id); setMobileMenuOpen(false); }} type="button" className="block w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-sathi-50 hover:text-sathi-700 transition-all cursor-pointer">
                {label}
              </button>
            ))}
            <div className="pt-2">
              <button
                onClick={() => { onEnterApp('caregiver-auth', 'caregiver'); setMobileMenuOpen(false); }}
                type="button"
                className="w-full py-3 px-4 rounded-xl font-extrabold text-sm text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>Caregiver Portal (Sign In / Register)</span>
              </button>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => onEnterApp('login')} type="button" className="flex-1 py-3 rounded-xl font-bold border-2 border-sathi-300 text-sathi-700 hover:bg-sathi-50 cursor-pointer">Login</button>
              <button onClick={() => onEnterApp('register')} type="button" className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-sathi-600 to-amber-600 cursor-pointer">Get Started</button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-amber-200/40 to-orange-300/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-sathi-200/30 to-sage-200/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-amber-50/60 to-orange-50/40 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-xs sm:text-sm font-bold mb-6 border border-amber-200">
                <Sparkles className="w-4 h-4" />
                <span>Ayushman Ready · Trilingual · Adaptive AI</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight">
                Keep Your Mind
                <span className="block bg-gradient-to-r from-sathi-600 via-amber-600 to-orange-500 bg-clip-text text-transparent">Active.</span>
                Stay Connected.
              </h1>
              <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                MIND SATHI combines personalized cognitive games, meaningful family memories and adaptive engagement to create a supportive digital experience for elderly users.
              </p>
              <p className="mt-2 text-sm text-sathi-700 font-bold italic indic-text">"खेलो। सोचो। साथ बढ़ो।"</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button onClick={() => onEnterApp('login')} type="button" id="hero-cta-primary" className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-extrabold text-white bg-gradient-to-r from-sathi-600 to-amber-600 hover:from-sathi-700 hover:to-amber-700 shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer">
                  <span>Sign In / Enter Dashboard</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => onEnterApp('register')} type="button" id="hero-cta-secondary" className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-bold text-gray-800 bg-white hover:bg-gray-50 border-2 border-gray-200 shadow-md hover:shadow-lg transition-all cursor-pointer">
                  <span>Create Account</span>
                </button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                {['6 Cognitive Games', 'English · Hindi · Assamese', 'ABHA / PM-JAY Ready'].map(text => (
                  <span key={text} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />{text}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2.5 justify-center lg:justify-start flex-wrap">
                <span className="text-xs text-gray-600 font-semibold">Are you a family caregiver?</span>
                <button
                  onClick={() => onEnterApp('caregiver-auth', 'caregiver')}
                  type="button"
                  id="hero-caregiver-cta"
                  className="text-xs font-black text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Caregiver Direct Log In / Sign Up</span>
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                </button>
              </div>
            </div>
            {/* Illustration */}
            <HeroIllustration onEnterApp={onEnterApp} />
          </div>
          <div className="flex flex-col items-center mt-16 gap-2 animate-bounce">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Explore More</span>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-sathi-700 via-sathi-600 to-amber-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 10000, suffix: '+', label: 'Active Elders' },
              { value: 6, suffix: '', label: 'Cognitive Games' },
              { value: 3, suffix: '', label: 'Languages Supported' },
              { value: 95, suffix: '%', label: 'Family Satisfaction' },
            ].map(({ value, suffix, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="text-3xl sm:text-4xl font-black text-white"><AnimatedCounter target={value} suffix={suffix} /></div>
                <div className="text-xs sm:text-sm font-semibold text-amber-200 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-xs font-bold mb-4 border border-violet-200">
              <Sparkles className="w-4 h-4" /> HOW IT WORKS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Your Journey to a Sharper Mind</h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto text-base sm:text-lg">From your first login to daily progress — MIND SATHI adapts every step to suit you.</p>
          </FadeUp>
          <div className="relative">
            <div className="hidden lg:block absolute top-16 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-sathi-200 via-amber-300 to-sathi-200 z-0" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
              {HOW_IT_WORKS.map(({ step, icon: Icon, label, desc }, i) => (
                <FadeUp key={step} delay={i * 100}>
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white border-2 border-sathi-200 shadow-elder flex items-center justify-center mb-4 hover:border-sathi-400 hover:shadow-elder-hover transition-all">
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-sathi-600" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-sathi-600 to-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-md">{step}</div>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-2">{label}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COGNITIVE GAMES ────────────────────────────────────── */}
      <section id="games" className="py-20 sm:py-28 bg-gradient-to-b from-[#FDF8F2] to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-xs font-bold mb-4 border border-amber-200">
              <Gamepad2 className="w-4 h-4" /> COGNITIVE GAMES
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Six Games. Six Cognitive Domains.</h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto text-base sm:text-lg">Each game targets a specific area of cognitive health, designed with clinical guidance for elderly users.</p>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {GAMES.map((game, i) => {
              const Icon = game.icon;
              const isHovered = activeGame === game.id;
              return (
                <FadeUp key={game.id} delay={i * 80}>
                  <div
                    className={`relative overflow-hidden rounded-3xl border-2 p-6 sm:p-7 cursor-pointer transition-all duration-300 ${game.bg} ${game.border} ${isHovered ? 'shadow-elder-hover scale-[1.02]' : 'shadow-elder hover:shadow-elder-hover hover:scale-[1.01]'}`}
                    onMouseEnter={() => setActiveGame(game.id)}
                    onMouseLeave={() => setActiveGame(null)}
                    onClick={() => onEnterApp('login')}
                    id={`game-card-${game.id}`}
                  >
                    <div className="absolute -right-4 -top-4 text-7xl opacity-10 select-none pointer-events-none">{game.emoji}</div>
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-white shadow-lg mb-5`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{game.domain}</div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-1">{game.name}</h3>
                    <p className="text-xs text-gray-500 italic mb-1 indic-text">{game.hindi}</p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{game.tagline}</p>
                    <div className={`mt-5 flex items-center gap-2 text-sm font-bold transition-all ${isHovered ? 'text-gray-900' : 'text-gray-500'}`}>
                      <Play className="w-4 h-4" />
                      <span>Play Now</span>
                      <ArrowRight className={`w-4 h-4 transition-transform ${isHovered ? 'translate-x-1' : ''}`} />
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
          <FadeUp className="text-center mt-12">
            <button onClick={() => onEnterApp('login')} type="button" id="games-cta-btn" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-extrabold text-white bg-gradient-to-r from-sathi-600 to-amber-600 hover:from-sathi-700 hover:to-amber-700 shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer">
              <Sparkles className="w-5 h-5" />
              <span>Start Playing Free</span>
            </button>
          </FadeUp>
        </div>
      </section>

      {/* ── FAMILY CONNECTION ──────────────────────────────────── */}
      <section id="family" className="py-20 sm:py-28 bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeUp>
              <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-full text-xs font-bold mb-6 border border-rose-200">
                <Heart className="w-4 h-4" /> FAMILY CONNECTION
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-5">
                Stay Close to the
                <span className="block text-transparent bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text">People You Love</span>
              </h2>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-8">
                MIND SATHI's Memory Vault lets you preserve and relive precious family memories — photos, stories, milestones — turning reminiscence into a powerful therapeutic exercise.
              </p>
              <ul className="space-y-4">
                {['Add family members with photos and relationship labels', 'Create a shared Memory Vault of photos and stories', 'Play "My Memory Journey" using your own family memories', 'Authorized family members can view your daily activity'].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="w-4 h-4" /></div>
                    <span className="text-gray-700 text-sm sm:text-base font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeUp>
            <FadeUp delay={200}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {FAMILY_MEMBERS.map((member) => (
                    <div key={member.name} className="bg-white rounded-2xl p-4 shadow-elder text-center border border-gray-100 hover:shadow-elder-hover transition-all">
                      <div className="relative inline-block mb-2">
                        <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-2xl mx-auto bg-gray-100" />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${member.online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="font-bold text-gray-900 text-xs">{member.name}</div>
                      <div className="text-[10px] text-gray-500">{member.relation}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {MEMORY_PHOTOS.map((mem) => (
                    <div key={mem.title} className={`relative rounded-2xl overflow-hidden h-28 sm:h-32 bg-gradient-to-br ${mem.color} shadow-elder hover:shadow-elder-hover transition-all cursor-pointer group`} onClick={() => onEnterApp('login')}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3 text-center">
                        <span className="text-3xl mb-1">{mem.emoji}</span>
                        <div className="text-xs font-bold leading-tight">{mem.title}</div>
                        <div className="text-[10px] font-semibold opacity-80 mt-0.5 bg-white/20 px-2 py-0.5 rounded-full">{mem.tag}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── ADAPTIVE EXPERIENCE ────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full text-xs font-bold mb-4 border border-teal-200">
              <Zap className="w-4 h-4" /> ADAPTIVE INTELLIGENCE
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">The More You Play, The More It Understands You</h2>
            <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed italic">
              "Every game helps MIND SATHI understand your engagement pattern and personalize what comes next."
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Brain, color: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200', title: 'Domain Mapping', desc: 'Each game maps to one of six cognitive domains: memory, attention, executive function, language, working memory, and visual processing.' },
              { icon: Activity, color: 'text-teal-600', bg: 'bg-teal-100', border: 'border-teal-200', title: 'Adaptive Difficulty', desc: 'MIND SATHI automatically adjusts game difficulty based on your real-time performance — always challenging, never frustrating.' },
              { icon: Star, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', title: 'Smart Recommendations', desc: 'Based on your cognitive profile and history, MIND SATHI suggests the single best game to play next for maximum benefit.' },
            ].map(({ icon: Icon, color, bg, border, title, desc }, i) => (
              <FadeUp key={title} delay={i * 120}>
                <div className={`bg-white p-7 rounded-3xl border-2 ${border} shadow-elder hover:shadow-elder-hover transition-all h-full`}>
                  <div className={`w-14 h-14 rounded-2xl ${bg} border ${border} flex items-center justify-center mb-5`}>
                    <Icon className={`w-7 h-7 ${color}`} />
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 mb-3">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRESS ───────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeUp><AnimatedProgressPanel /></FadeUp>
            <FadeUp delay={150}>
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold mb-6 border border-emerald-200">
                <Trophy className="w-4 h-4" /> PROGRESS & ACHIEVEMENTS
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-5">
                Watch Your Mind
                <span className="block text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text">Grow Stronger</span>
              </h2>
              <p className="text-gray-600 text-base leading-relaxed mb-8">
                Beautifully visualized progress reports show your improvement across all six cognitive domains. Earn XP, unlock achievement badges, and celebrate every milestone with your family.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'XP & Level System', icon: Trophy }, { label: 'Streak Rewards', icon: Zap }, { label: 'Cognitive Radar', icon: Activity }, { label: 'Family Leaderboard', icon: Users }].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-elder">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">{label}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── CAREGIVERS ─────────────────────────────────────────── */}
      <section id="caregivers" className="py-20 sm:py-28 bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeUp>
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-xs font-bold mb-6 border border-indigo-200">
                <UserCheck className="w-4 h-4" /> FOR CAREGIVERS
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-5">
                Full Visibility.
                <span className="block text-transparent bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text">Compassionate Oversight.</span>
              </h2>
              <p className="text-gray-600 text-base leading-relaxed mb-8">
                Authorized caregivers get a dedicated portal to monitor game session history, mood trends, streak consistency and cognitive health indicators — all without interrupting the elder's experience.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Bell, label: 'Mood & Activity Alerts', desc: 'Receive notifications if mood declines or activity drops.' },
                  { icon: LineChart, label: 'Longitudinal Reports', desc: '30, 60, and 90-day trend charts for each cognitive domain.' },
                  { icon: Stethoscope, label: 'Clinician Export', desc: 'Share structured reports with healthcare providers directly.' },
                  { icon: Shield, label: 'Privacy First', desc: 'Elders control what data caregivers can see.' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-4 bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-indigo-600" /></div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onEnterApp('caregiver-auth', 'caregiver')}
                  type="button"
                  id="caregiver-section-login-btn"
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Caregiver Sign In</span>
                </button>
                <button
                  onClick={() => onEnterApp('caregiver-auth', 'caregiver')}
                  type="button"
                  id="caregiver-section-register-btn"
                  className="px-6 py-3.5 rounded-2xl bg-white hover:bg-indigo-50 text-indigo-900 font-bold text-sm border-2 border-indigo-200 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Create Caregiver Account</span>
                </button>
              </div>
            </FadeUp>
            <FadeUp delay={150}>
              {/* Caregiver portal mockup */}
              <div className="bg-white rounded-3xl shadow-elder-hover border border-indigo-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-6 h-6" />
                    <div>
                      <div className="font-extrabold text-sm">Caregiver Portal</div>
                      <div className="text-xs text-indigo-200">Monitoring: Ramesh Sharma</div>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">This Week's Activity</div>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const heights = [60, 80, 40, 90, 70, 55, 85];
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <div className="w-8 text-xs text-gray-500 font-semibold shrink-0">{day}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-400 to-violet-500 h-full rounded-full" style={{ width: `${heights[i]}%` }} />
                        </div>
                        <div className="text-xs font-bold text-gray-700 w-8 text-right">{heights[i]}%</div>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-gray-100 flex gap-3">
                    <div className="flex-1 bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-200">
                      <div className="text-xl font-black text-emerald-600">7</div>
                      <div className="text-[10px] text-gray-600 font-semibold">Day Streak</div>
                    </div>
                    <div className="flex-1 bg-amber-50 rounded-2xl p-3 text-center border border-amber-200">
                      <div className="text-xl font-black text-amber-600">😊</div>
                      <div className="text-[10px] text-gray-600 font-semibold">Avg. Mood</div>
                    </div>
                    <div className="flex-1 bg-violet-50 rounded-2xl p-3 text-center border border-violet-200">
                      <div className="text-xl font-black text-violet-600">2450</div>
                      <div className="text-[10px] text-gray-600 font-semibold">XP Earned</div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── AYUSHMAN / HEALTHCARE ──────────────────────────────── */}
      <section id="about" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-xs font-bold mb-4 border border-amber-200">
              🏛️ AYUSHMAN BHARAT / HEALTHCARE
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Designed for India's Healthcare Ecosystem</h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto text-base leading-relaxed">
              MIND SATHI is built with India's national digital health infrastructure in mind, enabling optional and voluntary integration with government health IDs.
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <FadeUp>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-7 rounded-3xl border-2 border-amber-200 shadow-elder h-full">
                <div className="text-3xl mb-4">🏛️</div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">PM-JAY / Ayushman Bharat</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  You can optionally provide your <strong>PM-JAY beneficiary ID</strong> to help MIND SATHI associate your cognitive health data with your Ayushman Bharat profile for seamless healthcare coordination.
                </p>
                <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 text-xs text-amber-800 font-semibold">
                  ⚠️ Stored securely for reference and ABDM digital record syncing. No Aadhaar number collected.
                </div>
              </div>
            </FadeUp>
            <FadeUp delay={150}>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-7 rounded-3xl border-2 border-blue-200 shadow-elder h-full">
                <div className="text-3xl mb-4">🩺</div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">ABHA Health Account</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Optionally link your <strong>ABHA (Ayushman Bharat Health Account)</strong> number. This prepares MIND SATHI for official ABDM M1/M2/M3 compliant integration with your clinician.
                </p>
                <div className="bg-blue-100 border border-blue-300 rounded-xl p-3 text-xs text-blue-800 font-semibold">
                  ✓ Ready for ABDM M1/M2/M3 health data interoperability across India.
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-sathi-700 via-sathi-800 to-amber-800 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="w-96 h-96 rounded-full bg-white blur-3xl absolute -top-20 -right-20" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Start Your Cognitive Wellness Journey Today
            </h2>
            <p className="mt-6 text-lg text-amber-100 max-w-xl mx-auto font-medium leading-relaxed">
              Join thousands of elderly users across India who are keeping their minds sharp, staying connected with their families, and living each day with joy.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => onEnterApp('login')} type="button" className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl text-lg font-extrabold text-sathi-800 bg-white hover:bg-amber-50 shadow-2xl hover:scale-105 transition-all cursor-pointer">
                <Brain className="w-6 h-6" />
                <span>Sign In &amp; Open Dashboard</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => onEnterApp('register')} type="button" className="group inline-flex items-center justify-center gap-2 px-8 py-5 rounded-2xl text-lg font-bold text-white border-2 border-white/60 hover:bg-white/10 transition-all cursor-pointer">
                <span>Create New Account</span>
              </button>
            </div>
            <p className="mt-8 text-2xl font-black text-amber-200 indic-text">खेलो। सोचो। साथ बढ़ो। 🙏</p>
          </FadeUp>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <img src="/logo_icon.png" alt="MIND SATHI Logo" className="w-full h-full object-contain drop-shadow-sm" />
                </div>
                <div>
                  <div className="text-white font-black text-base">MIND SATHI</div>
                  <div className="text-sathi-400 text-xs font-bold italic">Khelo. Socho. Badho.</div>
                </div>
              </div>
              <p className="text-xs leading-relaxed">An adaptive cognitive engagement and elderly-care ecosystem built with love for India's senior citizens.</p>
            </div>
            {/* Navigate */}
            <div>
              <div className="text-white font-bold text-sm mb-4">Navigate</div>
              {navLinks.map(({ label, id }) => (
                <button key={id} onClick={() => scrollToSection(id)} type="button" className="block text-xs text-gray-400 hover:text-white py-1.5 cursor-pointer transition-colors">{label}</button>
              ))}
            </div>
            {/* Games */}
            <div>
              <div className="text-white font-bold text-sm mb-4">Games</div>
              {GAMES.map(g => (
                <button key={g.id} onClick={() => onEnterApp('login')} type="button" className="block text-xs text-gray-400 hover:text-white py-1.5 cursor-pointer transition-colors">{g.name}</button>
              ))}
            </div>
            {/* Helplines */}
            <div>
              <div className="text-white font-bold text-sm mb-4">Important Helplines</div>
              <div className="space-y-2">
                <div className="bg-amber-900/40 border border-amber-700/30 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-amber-400 font-semibold">PM-JAY Ayushman</div>
                  <div className="text-white font-mono font-black text-lg">14555</div>
                </div>
                <div className="bg-blue-900/40 border border-blue-700/30 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-blue-400 font-semibold">Senior Citizen Emergency</div>
                  <div className="text-white font-mono font-black text-lg">14567</div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span>© 2026 MIND SATHI Ecosystem. All rights reserved.</span>
            <span className="flex items-center gap-2 bg-emerald-900/40 text-emerald-400 border border-emerald-800/30 px-3 py-1.5 rounded-full font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready for ABDM M1/M2/M3 Integration
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
