import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Phone,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  Sparkles,
  Building2,
  Info,
  ListOrdered,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import {
  bookingAssistantService,
  type BookingAssistanceType,
  type BookingAssistantResult,
} from '../../services/bookingAssistantService';

interface HelpMeBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  providerUrl: string;
}

export const HelpMeBookModal: React.FC<HelpMeBookModalProps> = ({
  isOpen,
  onClose,
  providerName,
  providerUrl,
}) => {
  const [assistanceType, setAssistanceType] = useState<BookingAssistanceType>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BookingAssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [hasStartedLookup, setHasStartedLookup] = useState<boolean>(false);

  // Reset state when opening for a new provider
  useEffect(() => {
    if (isOpen) {
      setAssistanceType('all');
      setIsLoading(false);
      setResult(null);
      setError(null);
      setIsConfigured(true);
      setHasStartedLookup(false);
    }
  }, [isOpen, providerUrl]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleStartLookup = async () => {
    setIsLoading(true);
    setError(null);
    setHasStartedLookup(true);

    try {
      const res = await bookingAssistantService.getBookingAssistance({
        providerUrl,
        providerName,
        assistanceType,
      });

      if (res.configured === false) {
        setIsConfigured(false);
        setError(res.message || 'TinyFish API key is not configured.');
        setResult(null);
      } else if (!res.success) {
        setError(res.message || 'Failed to retrieve booking options from provider website.');
        setResult(null);
      } else {
        setResult(res.result || null);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected network error occurred.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const domainName = (() => {
    try {
      return new URL(providerUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'official provider';
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-me-book-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-emerald-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 shrink-0 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-[10px] uppercase tracking-widest font-black text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  TinyFish Agent • Read-Only Assistance
                </span>
              </div>
              <h2 id="help-me-book-title" className="text-lg sm:text-xl font-black text-white truncate">
                Help Me Book: {providerName}
              </h2>
              <p className="text-[11px] text-emerald-100/90 truncate flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Source: {domainName}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              aria-label="Close booking assistant"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BODY (SCROLLABLE) ── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-gray-800">
          {/* Read-Only Disclaimer Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-950 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-emerald-900 block mb-0.5">
                Read-Only Assisted Search
              </span>
              <span>
                MIND SATHI helps you discover official booking options and phone numbers. We <strong>never submit forms or make reservations on your behalf</strong>, and your personal data is never shared.
              </span>
            </div>
          </div>

          {/* ── STAGE 1: CHOICE SELECTION (Before Lookup Started or For Modifying Type) ── */}
          {!hasStartedLookup && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wider">
                  What would you like help with?
                </label>
                <p className="text-xs text-gray-500">
                  Select the specific booking information you want TinyFish Agent to locate on {providerName}'s official portal:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssistanceType('all')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                    assistanceType === 'all'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${assistanceType === 'all' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-extrabold text-gray-900">
                      Complete Booking Guide (Recommended)
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Find the direct appointment webpage, appointment desk phone number, and step-by-step patient booking instructions.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssistanceType('find_page')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                    assistanceType === 'find_page'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${assistanceType === 'find_page' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-extrabold text-gray-900">
                      Find Official Appointment Webpage
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Locate the hospital's verified online OPD booking or doctor appointment registration link.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssistanceType('find_phone')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                    assistanceType === 'find_phone'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${assistanceType === 'find_phone' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-extrabold text-gray-900">
                      Find Hospital Appointment Phone Number
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Find the direct telephone number for patient appointments, OPD inquiries, or reception desk.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssistanceType('booking_steps')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                    assistanceType === 'booking_steps'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${assistanceType === 'booking_steps' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-extrabold text-gray-900">
                      Explain Booking Steps
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Read through the clinic's appointment policy and summarize the steps required to see a specialist.
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartLookup}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Guided Lookup</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STAGE 2: LOADING STATE ── */}
          {isLoading && (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-gray-900">
                  Inspecting Official Booking Channels...
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  TinyFish Agent is safely reviewing {domainName} in read-only mode to find verified appointment links and contact numbers.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero patient data is shared</span>
              </div>
            </div>
          )}

          {/* ── STAGE 3: CONFIGURATION REQUIRED STATE ── */}
          {!isLoading && !isConfigured && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-amber-950">
                    TinyFish Agent Configuration Required
                  </h4>
                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    Live booking assistance requires the TinyFish Agent API key to be configured in your environment variables.
                  </p>
                </div>
              </div>
              <div className="bg-gray-900 text-emerald-400 p-2.5 rounded-xl font-mono text-xs overflow-x-auto">
                TINYFISH_API_KEY=sk-tinyfish-your_key_here
              </div>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartLookup}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Check</span>
                </button>
                <a
                  href={providerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs rounded-lg border border-gray-300 transition-colors flex items-center gap-1"
                >
                  <span>Visit Hospital Website Directly</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* ── STAGE 4: ERROR / TIMEOUT STATE ── */}
          {!isLoading && isConfigured && error && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-rose-900">
                    Lookup Notice
                  </h4>
                  <p className="text-xs text-rose-900/90 leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartLookup}
                  className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                <a
                  href={providerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs rounded-lg border border-gray-300 transition-colors flex items-center gap-1"
                >
                  <span>Open Official Homepage</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* ── STAGE 5: POPULATED RESULTS ── */}
          {!isLoading && isConfigured && !error && result && (
            <div className="space-y-5 animate-fade-in">
              {/* Telemetry & Checked Timestamp Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs pb-3 border-b border-gray-200">
                <span className="flex items-center gap-1.5 text-gray-500 font-semibold text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Checked: {new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {new Date(result.checkedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Verified by TinyFish
                </span>
              </div>

              {/* Status Summary */}
              {result.statusSummary && (
                <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <span className="font-extrabold text-gray-900 block mb-0.5">Summary of Findings:</span>
                  <p>{result.statusSummary}</p>
                </div>
              )}

              {/* Finding 1: Official Booking URL */}
              <div className="p-4 rounded-2xl border bg-white space-y-2 border-emerald-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-black text-gray-900">Online Appointment Portal</span>
                  </div>
                  {result.hasVerifiedBookingUrl ? (
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified URL
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                      Not Verified Online
                    </span>
                  )}
                </div>

                {result.hasVerifiedBookingUrl && result.officialBookingUrl ? (
                  <div className="pt-2">
                    <a
                      href={result.officialBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Open Official Booking Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="block text-[10px] text-gray-400 mt-1 truncate">
                      Target: {result.officialBookingUrl}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 pt-1">
                    No dedicated online booking portal was found on the official site. You may use their phone line or visit their reception desk.
                  </p>
                )}
              </div>

              {/* Finding 2: Appointment Phone Number */}
              <div className="p-4 rounded-2xl border bg-white space-y-2 border-emerald-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-black text-gray-900">Hospital Appointment Phone</span>
                  </div>
                  {result.hasVerifiedPhone ? (
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified Phone
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                      Not Verified
                    </span>
                  )}
                </div>

                {result.hasVerifiedPhone && result.appointmentPhone ? (
                  <div className="pt-2">
                    <a
                      href={`tel:${result.appointmentPhone.replace(/[^0-9+]/g, '')}`}
                      className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Hospital: {result.appointmentPhone}</span>
                    </a>
                    <span className="block text-[10px] text-gray-400 mt-1">
                      Tap to place call via your phone or dial directly.
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 pt-1">
                    No direct appointment phone line could be confirmed on their web page.
                  </p>
                )}
              </div>

              {/* Finding 3: Booking Steps / Guidance */}
              {result.hasBookingSteps && result.bookingSteps.length > 0 && (
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-black text-gray-900">How to Book at this Facility:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 pl-1 leading-relaxed">
                    {result.bookingSteps.map((step, idx) => (
                      <li key={idx} className="text-xs">
                        <span className="font-semibold text-gray-900">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* No Results at All State */}
              {!result.detailsFound && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-center space-y-2">
                  <Info className="w-6 h-6 text-amber-700 mx-auto" />
                  <h4 className="text-xs font-bold text-amber-950">
                    No Online Booking Options Detected
                  </h4>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    This healthcare provider may only accept walk-in OPD consultations or offline patient registrations.
                  </p>
                  <a
                    href={providerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-950 underline hover:text-black pt-1"
                  >
                    <span>Visit Hospital Official Site</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Verified Source Links */}
              {result.sourceUrls && result.sourceUrls.length > 0 && (
                <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-500 space-y-1">
                  <span className="font-bold text-gray-600 block">Sources Checked:</span>
                  <div className="flex flex-wrap gap-2">
                    {result.sourceUrls.map((sUrl, idx) => (
                      <a
                        key={idx}
                        href={sUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 hover:underline max-w-[240px] truncate"
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{sUrl}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Option to perform another lookup */}
              <div className="pt-2 flex items-center justify-between text-xs border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setHasStartedLookup(false)}
                  className="text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Choose Another Option</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-gray-50 p-3.5 sm:p-4 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1 text-emerald-800 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>MIND SATHI Caregiver Companion</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
