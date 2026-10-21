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
  UserCheck,
  CheckSquare,
  Square,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  bookingAssistantService,
  type BookingAssistanceType,
  type BookingAssistantResult,
  type BookingProposal,
  type BookingConfirmationResult,
} from '../../services/bookingAssistantService';
import { caregiverService } from '../../services/caregiverService';
import { supabase } from '../../lib/supabase';

interface HelpMeBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  providerUrl: string;
}

type ModalTab = 'book_appointment' | 'readonly_guide';
type BookingStep = 'select_patient' | 'review_proposal' | 'confirmed_result';

export const HelpMeBookModal: React.FC<HelpMeBookModalProps> = ({
  isOpen,
  onClose,
  providerName,
  providerUrl,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<ModalTab>('book_appointment');

  // Caregiver and Linked Patients state
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [department, setDepartment] = useState<string>('General Medicine / OPD');

  // Booking Flow (Stage 1 & Stage 2) State
  const [bookingStep, setBookingStep] = useState<BookingStep>('select_patient');
  const [proposal, setProposal] = useState<BookingProposal | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<BookingConfirmationResult | null>(null);
  const [hasCaregiverAgreed, setHasCaregiverAgreed] = useState<boolean>(false);

  // Read-only Assistance State (Preserved 100%)
  const [assistanceType, setAssistanceType] = useState<BookingAssistanceType>('all');
  const [hasStartedLookup, setHasStartedLookup] = useState<boolean>(false);
  const [readOnlyResult, setReadOnlyResult] = useState<BookingAssistantResult | null>(null);

  // General Status State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);

  // Load caregiver session and authorized linked patients
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadSessionAndPatients = async () => {
      setIsLoadingPatients(true);
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id;
        if (!uid) {
          if (isMounted) {
            setCaregiverId(null);
            setLinkedPatients([]);
          }
          return;
        }

        if (isMounted) setCaregiverId(uid);

        const patients = await caregiverService.getAssignedPatients(uid);
        if (isMounted) {
          setLinkedPatients(patients);
          if (patients.length > 0 && !selectedPatientId) {
            setSelectedPatientId(patients[0].id);
          }
        }
      } catch (err) {
        console.warn('[HelpMeBookModal] Error loading linked patients:', err);
      } finally {
        if (isMounted) setIsLoadingPatients(false);
      }
    };

    loadSessionAndPatients();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Reset state on open or provider change
  useEffect(() => {
    if (isOpen) {
      setActiveTab('book_appointment');
      setBookingStep('select_patient');
      setProposal(null);
      setConfirmationResult(null);
      setHasCaregiverAgreed(false);
      setAssistanceType('all');
      setIsLoading(false);
      setReadOnlyResult(null);
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

  const domainName = (() => {
    try {
      return new URL(providerUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'official provider';
    }
  })();

  const selectedPatient = linkedPatients.find((p) => p.id === selectedPatientId);

  // ── Handler: Stage 1 - Prepare Proposal (Stops strictly before submission) ──
  const handlePrepareProposal = async () => {
    if (!selectedPatientId) {
      setError('Please select an authorized patient linked to your caregiver account.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Reviewing ${domainName} availability for ${department}...`);
    setError(null);

    try {
      const res = await bookingAssistantService.prepareBookingProposal({
        providerUrl,
        providerName,
        patientId: selectedPatientId,
        department,
      });

      if (res.configured === false) {
        setIsConfigured(false);
        setError(res.message || 'TinyFish API key is not configured.');
      } else if (!res.success || !res.proposal) {
        setError(res.message || 'Could not prepare appointment proposal from hospital site.');
      } else {
        setProposal(res.proposal);
        setBookingStep('review_proposal');
        setHasCaregiverAgreed(false);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while preparing the appointment proposal.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handler: Stage 2 - Explicit Caregiver Confirmation ───────────────────────
  const handleConfirmAndBook = async () => {
    if (!proposal) return;
    if (!hasCaregiverAgreed) {
      setError('You must explicitly review and check the confirmation box before submitting.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Submitting verified appointment request to ${proposal.providerName}...`);
    setError(null);

    try {
      const res = await bookingAssistantService.confirmBooking({
        proposalId: proposal.proposalId,
        signature: proposal.signature,
        patientId: proposal.patientId,
        providerUrl: proposal.providerUrl,
        appointmentSlot: proposal.appointmentSlot,
        department: proposal.department,
        providerName: proposal.providerName,
        expiresAt: proposal.expiresAt,
        caregiverConfirmed: true,
      });

      if (!res.success || !res.confirmation) {
        setError(res.message || 'Appointment submission could not be completed.');
      } else {
        setConfirmationResult(res.confirmation);
        setBookingStep('confirmed_result');
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Network failure submitting booking confirmation.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handler: Read-Only Guide Lookup (Preserved 100%) ────────────────────────
  const handleStartReadOnlyLookup = async () => {
    setIsLoading(true);
    setLoadingMessage(`Inspecting ${domainName} in read-only mode...`);
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
        setReadOnlyResult(null);
      } else if (!res.success) {
        setError(res.message || 'Failed to retrieve booking options from provider website.');
        setReadOnlyResult(null);
      } else {
        setReadOnlyResult(res.result || null);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected network error occurred.');
      setReadOnlyResult(null);
    } finally {
      setIsLoading(false);
    }
  };

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
                  TinyFish Agent • Caregiver-Confirmed
                </span>
              </div>
              <h2 id="help-me-book-title" className="text-lg sm:text-xl font-black text-white truncate">
                {providerName}
              </h2>
              <p className="text-[11px] text-emerald-100/90 truncate flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Official Source: {domainName}</span>
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

          {/* Tab Selector: Booking vs Read-Only Guide */}
          <div className="mt-4 flex rounded-xl bg-emerald-950/50 p-1 border border-emerald-500/30 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('book_appointment');
                setError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'book_appointment'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('readonly_guide');
                setError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'readonly_guide'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Read-Only Guide</span>
            </button>
          </div>
        </div>

        {/* ── BODY (SCROLLABLE) ── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-gray-800">
          {/* Read-Only Disclaimer / Privacy Guarantee Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-950 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-emerald-900 block mb-0.5">
                Privacy & Authorization Safeguards
              </span>
              <span>
                MIND SATHI requires your explicit review and confirmation before any booking action. Zero medical records, diagnoses, or medications are ever sent.
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: CAREGIVER-CONFIRMED APPOINTMENT BOOKING                      */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'book_appointment' && (
            <div className="space-y-4">
              {/* ── STAGE 1: PATIENT SELECTION & DETAILS ── */}
              {bookingStep === 'select_patient' && !isLoading && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      <span>Select Authorized Patient</span>
                    </label>
                    <p className="text-xs text-gray-500">
                      Under MIND SATHI consent rules, you may only book appointments for patients linked to your caregiver account:
                    </p>
                  </div>

                  {isLoadingPatients ? (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Loading authorized patients...</span>
                    </div>
                  ) : linkedPatients.length === 0 ? (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-2">
                      <div className="flex items-start gap-2 text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs font-bold">No Authorized Patients Found</div>
                      </div>
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        To book an appointment, you must first connect to a patient using their 6-digit code in the Caregiver Portal.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedPatients.map((pt) => {
                        const isSelected = pt.id === selectedPatientId;
                        return (
                          <div
                            key={pt.id}
                            onClick={() => setSelectedPatientId(pt.id)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  isSelected ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {(pt.full_name || pt.name || 'P')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-black text-gray-900">
                                  {pt.full_name || pt.name || 'Patient'}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Phone: {pt.phone || 'Recorded with provider'} • Age: {pt.age || 'Senior'}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Choose'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Department Selection */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-black uppercase text-gray-700 tracking-wider">
                      Department / Speciality
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="General Medicine / OPD">General Medicine / OPD Consultation</option>
                      <option value="Geriatrics / Senior Health">Geriatrics / Senior Health</option>
                      <option value="Neurology / Memory Care">Neurology / Cognitive & Memory Care</option>
                      <option value="Cardiology">Cardiology / Heart Health</option>
                      <option value="Orthopedics">Orthopedics / Joint Care</option>
                      <option value="Psychiatry & Mental Health">Psychiatry & Mental Wellness</option>
                    </select>
                  </div>

                  {/* Stage 1 Action Button */}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handlePrepareProposal}
                      disabled={linkedPatients.length === 0 || !selectedPatientId}
                      className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Search Availability & Prepare Proposal</span>
                    </button>
                    <p className="text-[11px] text-center text-gray-500 mt-2">
                      Stage 1 stops safely before final booking. You will review exact details before any submission.
                    </p>
                  </div>
                </div>
              )}

              {/* ── STAGE 2: REVIEW PROPOSAL & EXPLICIT CONFIRMATION ── */}
              {bookingStep === 'review_proposal' && proposal && !isLoading && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span>Review Proposed Appointment Slot</span>
                    </h3>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                      Pre-Submission Review
                    </span>
                  </div>

                  {/* Proposal Detail Card */}
                  <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-white space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-xs font-black text-gray-900">{proposal.providerName}</div>
                        <div className="text-[11px] text-gray-500">{proposal.department}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        Available Slot
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 space-y-1.5">
                      <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Slot: {proposal.appointmentSlot}</span>
                      </div>
                      <div className="text-[11px] text-emerald-900 flex items-center justify-between">
                        <span>Consultation Fee: {proposal.estimatedFee}</span>
                      </div>
                      <div className="text-[10px] text-emerald-800/80">
                        Policy: {proposal.cancellationPolicy}
                      </div>
                    </div>

                    {/* Patient Data Transmission Disclosure */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-xs">
                      <div className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider">
                        Patient Information to be Transmitted:
                      </div>
                      <div className="text-xs text-gray-900 font-semibold flex items-center justify-between">
                        <span>Patient Name:</span>
                        <span className="font-mono text-gray-800">{proposal.patientName}</span>
                      </div>
                      <div className="text-xs text-gray-900 font-semibold flex items-center justify-between">
                        <span>Contact Phone:</span>
                        <span className="font-mono text-gray-800">{proposal.patientPhone}</span>
                      </div>
                      <div className="pt-1 text-[10px] text-gray-500 border-t border-gray-200 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>No diagnoses, medical history, or credit cards are transmitted.</span>
                      </div>
                    </div>

                    {/* Expiry Window Notice */}
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>This proposal is bound by HMAC token and valid for 10 minutes.</span>
                    </div>
                  </div>

                  {/* Explicit Caregiver Checkbox */}
                  <label
                    className="p-3.5 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 flex items-start gap-3 cursor-pointer select-none transition-all hover:bg-emerald-50"
                  >
                    <input
                      type="checkbox"
                      checked={hasCaregiverAgreed}
                      onChange={(e) => setHasCaregiverAgreed(e.target.checked)}
                      className="sr-only"
                    />
                    <div className="mt-0.5 shrink-0 text-emerald-700">
                      {hasCaregiverAgreed ? (
                        <CheckSquare className="w-5 h-5 text-emerald-700" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="text-xs text-gray-800 leading-relaxed font-medium">
                      I have verified the patient and slot above. I explicitly authorize MIND SATHI to submit this single outpatient booking request for <strong>{proposal.patientName}</strong>.
                    </div>
                  </label>

                  {/* Stage 2 Action Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingStep('select_patient')}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndBook}
                      disabled={!hasCaregiverAgreed}
                      className="flex-1 py-3 px-6 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm and Book Appointment</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STAGE 3: CONFIRMATION / HANDOFF RESULT ── */}
              {bookingStep === 'confirmed_result' && confirmationResult && !isLoading && (
                <div className="space-y-4 animate-fade-in">
                  {confirmationResult.status === 'booked' ? (
                    <div className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Appointment Successfully Booked!</span>
                      </div>
                      <p className="text-xs text-emerald-950 leading-relaxed">
                        {confirmationResult.statusMessage}
                      </p>
                      {confirmationResult.bookingReference && (
                        <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-bold">Booking Reference:</span>
                          <span className="text-xs font-mono font-black text-emerald-800">
                            {confirmationResult.bookingReference}
                          </span>
                        </div>
                      )}
                      <div className="text-[11px] text-gray-600 space-y-1 pt-1">
                        <div className="font-bold text-gray-700">Next Steps:</div>
                        <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                          {confirmationResult.safeNextSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : confirmationResult.status === 'handoff_required' ? (
                    <div className="p-5 rounded-2xl border-2 border-blue-300 bg-blue-50/50 space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
                        <Info className="w-5 h-5 text-blue-700" />
                        <span>Official Hospital Handoff Required</span>
                      </div>
                      <p className="text-xs text-blue-950 leading-relaxed">
                        {confirmationResult.statusMessage}
                      </p>
                      {confirmationResult.handoffReason && (
                        <div className="p-2.5 bg-white/80 rounded-xl border border-blue-200 text-[11px] text-blue-900 font-medium">
                          <strong>Reason:</strong> {confirmationResult.handoffReason}
                        </div>
                      )}

                      <div className="space-y-2 pt-2">
                        {confirmationResult.officialBookingUrl && (
                          <a
                            href={confirmationResult.officialBookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                          >
                            <span>Complete on Official Hospital Website</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {confirmationResult.officialPhone && (
                          <a
                            href={`tel:${confirmationResult.officialPhone.replace(/[^0-9+]/g, '')}`}
                            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Hospital: {confirmationResult.officialPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl border-2 border-rose-300 bg-rose-50/50 space-y-3">
                      <div className="flex items-center gap-2 text-rose-900 font-black text-sm">
                        <AlertCircle className="w-5 h-5 text-rose-700" />
                        <span>Booking Could Not Be Completed</span>
                      </div>
                      <p className="text-xs text-rose-950 leading-relaxed">
                        {confirmationResult.statusMessage}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: READ-ONLY ASSISTANCE GUIDE (Preserved 100%)                  */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'readonly_guide' && (
            <div className="space-y-4">
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
                          ? 'border-emerald-600 bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
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
                      onClick={handleStartReadOnlyLookup}
                      className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Guided Lookup</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Populated Read-Only Results */}
              {!isLoading && readOnlyResult && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs pb-3 border-b border-gray-200">
                    <span className="flex items-center gap-1.5 text-gray-500 font-semibold text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Checked: {new Date(readOnlyResult.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Verified by TinyFish
                    </span>
                  </div>

                  {readOnlyResult.statusSummary && (
                    <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      <span className="font-extrabold text-gray-900 block mb-0.5">Summary of Findings:</span>
                      <p>{readOnlyResult.statusSummary}</p>
                    </div>
                  )}

                  {/* Finding 1: Official Booking URL */}
                  <div className="p-4 rounded-2xl border bg-white space-y-2 border-emerald-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-black text-gray-900">Online Appointment Portal</span>
                      </div>
                      {readOnlyResult.hasVerifiedBookingUrl ? (
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

                    {readOnlyResult.hasVerifiedBookingUrl && readOnlyResult.officialBookingUrl ? (
                      <div className="pt-2">
                        <a
                          href={readOnlyResult.officialBookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Open Official Booking Page</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 pt-1">
                        No dedicated online booking portal was found on the official site.
                      </p>
                    )}
                  </div>

                  {/* Finding 2: Phone */}
                  <div className="p-4 rounded-2xl border bg-white space-y-2 border-emerald-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-black text-gray-900">Hospital Appointment Phone</span>
                      </div>
                      {readOnlyResult.hasVerifiedPhone ? (
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

                    {readOnlyResult.hasVerifiedPhone && readOnlyResult.appointmentPhone ? (
                      <div className="pt-2">
                        <a
                          href={`tel:${readOnlyResult.appointmentPhone.replace(/[^0-9+]/g, '')}`}
                          className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call Hospital: {readOnlyResult.appointmentPhone}</span>
                        </a>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 pt-1">
                        No direct appointment phone line could be confirmed on their web page.
                      </p>
                    )}
                  </div>

                  {/* Finding 3: Steps */}
                  {readOnlyResult.hasBookingSteps && readOnlyResult.bookingSteps.length > 0 && (
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-black text-gray-900">How to Book at this Facility:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 pl-1 leading-relaxed">
                        {readOnlyResult.bookingSteps.map((step, idx) => (
                          <li key={idx} className="text-xs font-semibold text-gray-900">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center text-xs">
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
          )}

          {/* ── LOADING SPINNER STATE ── */}
          {isLoading && (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-gray-900">
                  {loadingMessage || 'Contacting Official Booking Portal...'}
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  TinyFish Agent is safely reviewing official channels with strict privacy constraints.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero medical records or diagnoses shared</span>
              </div>
            </div>
          )}

          {/* ── ERROR STATE ── */}
          {!isLoading && error && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase text-rose-900">Notice</div>
                  <div className="text-xs text-rose-900/90 leading-relaxed">{error}</div>
                </div>
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
