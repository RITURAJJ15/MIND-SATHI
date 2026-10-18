import React, { useState, useEffect } from 'react';
import {
  Compass,
  Search,
  Building2,
  Pill,
  FileText,
  Bell,
  ExternalLink,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  KeyRound,
  ChevronRight,
  Info,
} from 'lucide-react';
import { careNavigatorService } from '../services/careNavigatorService';
import type { NavigatorSection, NavigatorResultItem } from '../../api/caregiver/navigator';
import { useLanguage } from '../hooks/useLanguage';

interface CareNavigatorPageProps {
  initialSection?: NavigatorSection;
}

export const CareNavigatorPage: React.FC<CareNavigatorPageProps> = ({ initialSection = 'care_finder' }) => {
  const { currentLang } = useLanguage();
  const [activeSection, setActiveSection] = useState<NavigatorSection>(initialSection);
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<NavigatorResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [configMessage, setConfigMessage] = useState<string>('');
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Quick search suggestions per section
  const sectionDefaults: Record<NavigatorSection, { defaultQuery: string; placeholder: string; chips: string[] }> = {
    care_finder: {
      defaultQuery: 'Guwahati',
      placeholder: 'Enter city, locality, or 6-digit PIN code (e.g. Guwahati, 781001)...',
      chips: ['Guwahati', 'Dibrugarh', 'Silchar', 'Shillong', 'Imphal', 'Agartala', '781001', '786001'],
    },
    medicine: {
      defaultQuery: 'Assam',
      placeholder: 'Enter city, district, or PIN code for Jan Aushadhi Kendras...',
      chips: ['Guwahati', 'Kamrup', 'Dibrugarh', 'Jorhat', 'Silchar', 'Tezpur', '781005'],
    },
    schemes: {
      defaultQuery: 'Ayushman Bharat PM-JAY senior citizen',
      placeholder: 'Search senior healthcare schemes (e.g. PM-JAY, Vayoshri, Pension)...',
      chips: [
        'Ayushman PM-JAY Senior 70+',
        'Rashtriya Vayoshri Yojana',
        'Elderline 14567',
        'National Old Age Pension (IGNOAPS)',
        'Assam Atal Amrit Abhiyan',
      ],
    },
    notices: {
      defaultQuery: 'senior citizens elderly health advisory',
      placeholder: 'Search advisories or press Latest to view current health notices...',
      chips: [
        'MoHFW Senior Advisory',
        'Seasonal Heat/Cold Advisory',
        'Dementia Care Guidelines',
        'Flu & Pneumonia Elderly Alert',
      ],
    },
  };

  const executeSearch = async (sectionToSearch: NavigatorSection, searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let res;
      switch (sectionToSearch) {
        case 'care_finder':
          res = await careNavigatorService.findNearbyCare(searchQuery);
          break;
        case 'medicine':
          res = await careNavigatorService.findAffordableMedicine(searchQuery);
          break;
        case 'schemes':
          res = await careNavigatorService.findGovernmentSchemes(searchQuery);
          break;
        case 'notices':
          res = await careNavigatorService.findHealthNotices(searchQuery);
          break;
      }

      if (res.configured === false) {
        setIsConfigured(false);
        setConfigMessage(res.message || 'TinyFish API key is not configured.');
        setResults([]);
      } else {
        setIsConfigured(true);
        if (!res.success) {
          setError(res.message || 'Search failed. Please try again.');
          setResults([]);
        } else {
          setResults(res.results || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Perform initial search when switching sections
  useEffect(() => {
    const config = sectionDefaults[activeSection];
    setQuery(config.defaultQuery);
    executeSearch(activeSection, config.defaultQuery);
  }, [activeSection]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    executeSearch(activeSection, query.trim());
  };

  const handleChipClick = (chip: string) => {
    setQuery(chip);
    executeSearch(activeSection, chip);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto text-left">
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-elder border border-emerald-700/60 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Compass className="w-5 h-5 text-emerald-300 animate-pulse" />
            </span>
            <span className="text-[11px] uppercase tracking-widest font-black text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Caregiver Resource Hub • TinyFish Web Agent
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Care Navigator
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
            Locate verified geriatric clinics, Jan Aushadhi generic medicine Kendras, official senior healthcare welfare schemes, and public health advisories across Northeast India and nationwide.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-emerald-700/50 text-[11px] text-emerald-200">
            <span className="flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Official Sources
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Live Search Telemetry
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Northeast & Pan-India Scope
            </span>
          </div>
        </div>
      </div>

      {/* ── 4 SECTION NAVIGATION TABS ── */}
      <div className="bg-white p-1.5 sm:p-2 rounded-2xl shadow-xs border border-emerald-200 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('care_finder')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'care_finder'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-700 hover:text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Nearby Care Finder</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('medicine')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'medicine'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-700 hover:text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <Pill className="w-4 h-4 shrink-0" />
          <span>Affordable Medicine</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('schemes')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'schemes'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-700 hover:text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Government Schemes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('notices')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'notices'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-700 hover:text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span>Health Notices</span>
        </button>
      </div>

      {/* ── SECTION SAFETY / ETHICS DISCLAIMER BANNERS ── */}
      {activeSection === 'medicine' && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-4 text-amber-950 flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-black block uppercase text-[11px] text-amber-800 mb-0.5">
              Official Jan Aushadhi Resource Disclaimer
            </span>
            <p>
              MIND SATHI indexes official Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) Kendras and government generic medicine databases. We <strong>do not claim live stock availability</strong> or recommend medication substitutions. Always verify directly with the authorized pharmacist or licensed Kendra before purchasing.
            </p>
          </div>
        </div>
      )}

      {activeSection === 'schemes' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-blue-950 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-black block uppercase text-[11px] text-blue-800 mb-0.5">
              Government Welfare Scheme Verification Notice
            </span>
            <p>
              Information is gathered directly from official national portals (such as <em>myscheme.gov.in</em>, <em>pmjay.gov.in</em>, and <em>socialjustice.gov.in</em>). <strong>MIND SATHI does not guarantee scheme eligibility</strong>. Benefit determinations, document requirements, and final approvals are governed solely by the respective state and central authorities.
            </p>
          </div>
        </div>
      )}

      {/* ── SEARCH INPUT BAR & CHIPS ── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-elder border border-emerald-200">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={sectionDefaults[activeSection].placeholder}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Official Records</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-gray-400 mr-1">Suggested:</span>
            {sectionDefaults[activeSection].chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* ── STATE 1: CONFIGURATION REQUIRED STATE ── */}
      {!isConfigured && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-6 sm:p-8 text-left shadow-elder">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-200/70 text-amber-900 rounded-2xl shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-amber-950">
                TinyFish Web Agent Configuration Required
              </h3>
              <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                To protect user privacy and avoid displaying fabricated search results, MIND SATHI retrieves live data using the official TinyFish Web Agent API.
              </p>

              <div className="bg-white/80 border border-amber-200 rounded-2xl p-4 mt-3 space-y-2 text-xs text-gray-700 font-mono">
                <div className="text-[11px] font-bold text-gray-500 font-sans uppercase">
                  How to configure locally in your `.env` file:
                </div>
                <div className="p-2.5 bg-gray-900 text-emerald-400 rounded-xl overflow-x-auto text-xs">
                  TINYFISH_API_KEY=sk-tinyfish-your_api_key_here
                </div>
                <p className="text-[11px] text-gray-500 font-sans mt-1">
                  💡 In Vercel production, add <strong>TINYFISH_API_KEY</strong> under <em>Project Settings → Environment Variables</em>. Never use a <code>VITE_</code> prefix to ensure the key stays strictly on the server.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => executeSearch(activeSection, query)}
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Configuration Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE 2: LOADING SKELETON ── */}
      {isLoading && (
        <div className="space-y-3.5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-emerald-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* ── STATE 3: ERROR STATE ── */}
      {!isLoading && error && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 text-rose-950 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black uppercase text-rose-800">Search Service Notice</div>
              <p className="text-xs mt-0.5 text-rose-900/90">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => executeSearch(activeSection, query)}
            className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ── STATE 4: EMPTY RESULTS STATE ── */}
      {!isLoading && isConfigured && !error && hasSearched && results.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-emerald-200 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">
            No official records found for "{query}"
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Try searching by the state name (e.g. <em>Assam</em>), major city (e.g. <em>Guwahati</em>), or a broader keyword. We do not display synthetic or simulated search results.
          </p>
        </div>
      )}

      {/* ── STATE 5: POPULATED RESULTS LIST ── */}
      {!isLoading && isConfigured && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold px-1">
            <span>Found {results.length} official resource{results.length !== 1 ? 's' : ''} for "{query}"</span>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Verified by TinyFish Search
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {results.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Domain badge & Date */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {item.siteName}
                      </span>
                      {item.date && (
                        <span className="text-gray-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          {item.date}
                        </span>
                      )}
                      <span className="text-gray-400 text-[10px]">
                        • Checked: {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-extrabold text-gray-900 group-hover:text-emerald-800 transition-colors leading-snug">
                      {item.title}
                    </h3>

                    {/* Snippet */}
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {item.snippet}
                    </p>
                  </div>

                  {/* Visit Official Source Link */}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white font-extrabold text-xs rounded-xl border border-emerald-200 hover:border-emerald-600 transition-all flex items-center gap-1.5 shrink-0 self-start mt-1 cursor-pointer shadow-2xs group/btn"
                    >
                      <span>Official Link</span>
                      <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
