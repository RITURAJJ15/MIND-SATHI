import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  X,
  Radio,
  Loader2,
  AlertCircle,
  RotateCw,
  Clock,
  Shield,
} from 'lucide-react';
import { liveLocationService } from '../../services/liveLocationService';
import { LiveLocationSession } from '../../types/location';
import { LiveLocationMap } from './LiveLocationMap';

interface CaregiverLiveLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export const CaregiverLiveLocationModal: React.FC<CaregiverLiveLocationModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
}) => {
  const [session, setSession] = useState<LiveLocationSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(false);
  const [secondsAgoText, setSecondsAgoText] = useState<string>('Just now');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize or adopt existing session when modal opens
  useEffect(() => {
    if (!isOpen || !patientId) return;

    let mounted = true;
    setIsLoading(true);
    setErrorMessage('');

    const setupSubscription = (sessionId: string) => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeRef.current = liveLocationService.subscribeToLiveLocation(
        sessionId,
        (updated) => {
          if (!mounted) return;
          setSession(updated);
        }
      );
    };

    const init = async () => {
      try {
        // 1. Check if patient is already actively sharing!
        const existing = await liveLocationService.getSessionForPatient(patientId);
        if (
          existing &&
          existing.status === 'active' &&
          (!existing.expiresAt || new Date(existing.expiresAt).getTime() > Date.now())
        ) {
          if (!mounted) return;
          setSession(existing);
          setIsLoading(false);
          setupSubscription(existing.id);
          return;
        }

        // 2. Only request new session if not already active
        const res = await liveLocationService.requestLiveLocation(patientId);
        if (!mounted) return;

        if (!res.success || !res.session) {
          setErrorMessage(res.error || 'Unable to request patient live location.');
          setIsLoading(false);
          return;
        }

        setSession(res.session);
        setIsLoading(false);
        setupSubscription(res.session.id);
      } catch (err: any) {
        if (!mounted) return;
        setErrorMessage(err.message || 'Error establishing location session.');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isOpen, patientId]);

  // Background polling loop while modal is open:
  // - Picks up when patient taps "Share Live Location" (status transitions from 'requested' to 'active')
  // - Syncs latest coordinates if WebSockets are slow or throttled
  useEffect(() => {
    if (!isOpen || !patientId) return;

    const pollInterval = setInterval(async () => {
      try {
        const latest = await liveLocationService.getSessionForPatient(patientId);
        if (latest) {
          setSession((prev) => {
            if (!prev) return latest;
            if (
              prev.status !== latest.status ||
              prev.lastLatitude !== latest.lastLatitude ||
              prev.lastLongitude !== latest.lastLongitude ||
              prev.lastSeenAt !== latest.lastSeenAt
            ) {
              return latest;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[CaregiverLiveLocation] Polling error:', err);
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [isOpen, patientId]);

  // Heartbeat and freshness monitor (runs every second)
  useEffect(() => {
    if (!isOpen || !session) return;

    const interval = setInterval(() => {
      if (session.status === 'active' && session.lastSeenAt) {
        const diffSeconds = Math.floor((Date.now() - new Date(session.lastSeenAt).getTime()) / 1000);
        const alive = diffSeconds <= 25;
        setIsLive(alive);

        if (diffSeconds < 4) setSecondsAgoText('Just now');
        else if (diffSeconds < 60) setSecondsAgoText(`${diffSeconds}s ago`);
        else setSecondsAgoText(`${Math.floor(diffSeconds / 60)}m ago`);
      } else {
        setIsLive(false);
        if (session.lastSeenAt) {
          const diffSeconds = Math.floor((Date.now() - new Date(session.lastSeenAt).getTime()) / 1000);
          if (diffSeconds < 60) setSecondsAgoText(`${diffSeconds}s ago`);
          else setSecondsAgoText(`${Math.floor(diffSeconds / 60)}m ago`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, session]);

  // Retry / Request Again handler
  const handleRequestAgain = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await liveLocationService.requestLiveLocation(patientId);
      if (!res.success || !res.session) {
        setErrorMessage(res.error || 'Failed to send location request.');
      } else {
        setSession(res.session);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error resending request.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasCoordinates =
    session?.lastLatitude != null &&
    session?.lastLongitude != null &&
    !isNaN(session.lastLatitude) &&
    !isNaN(session.lastLongitude);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-200 animate-scale-up text-left flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLive ? 'bg-emerald-100 text-emerald-700' : session?.status === 'requested' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-gray-900">
                  Live Location: {patientName}
                </h3>
                {isLive ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                ) : session?.status === 'requested' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    WAITING FOR APPROVAL
                  </span>
                ) : session?.status === 'active' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    DISCONNECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Encrypted point-to-point location stream
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg text-sm font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            /* Loading / Requesting */
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="font-bold text-sm text-gray-800">
                Contacting {patientName}'s device...
              </p>
              <p className="text-xs text-gray-500 max-w-xs">
                Establishing a secure live location channel through Mind Sathi Realtime.
              </p>
            </div>
          ) : session?.status === 'requested' ? (
            /* Awaiting Patient Approval */
            <div className="py-12 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-base text-gray-900">
                Waiting for {patientName} to approve
              </h4>
              <p className="text-xs text-gray-600 max-w-sm leading-relaxed">
                A live location prompt has been sent to {patientName}'s screen. The live map will appear automatically as soon as they tap <strong>Share Live Location</strong>.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRequestAgain}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Resend Request</span>
                </button>
              </div>
            </div>
          ) : session?.status === 'active' && hasCoordinates ? (
            /* Active Live Location Map View */
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Stream Status</span>
                  <div className="text-xs font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Active Live Feed</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Last Updated</span>
                  <div className="text-xs font-extrabold text-gray-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>{secondsAgoText}</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">GPS Precision</span>
                  <div className="text-xs font-extrabold text-gray-800 mt-0.5">
                    ±{Math.round(session.accuracyMeters || 15)} meters
                  </div>
                </div>
              </div>

              <LiveLocationMap
                latitude={session.lastLatitude!}
                longitude={session.lastLongitude!}
                accuracyMeters={session.accuracyMeters}
                patientName={patientName}
                isLive={isLive}
                lastUpdatedText={secondsAgoText}
                className="h-80 sm:h-96 w-full rounded-2xl overflow-hidden relative shadow-md border border-gray-200"
              />
            </div>
          ) : session?.status === 'active' && !hasCoordinates ? (
            /* Active, waiting for GPS lock */
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 p-6">
              <Loader2 className="w-9 h-9 text-emerald-600 animate-spin" />
              <h4 className="font-extrabold text-base text-gray-900">
                Acquiring GPS Signal...
              </h4>
              <p className="text-xs text-gray-600 max-w-sm leading-relaxed">
                {patientName} has authorized location sharing. Locking onto device GPS coordinates...
              </p>
            </div>
          ) : (
            /* Disconnected State */
            <div className="space-y-3">
              {hasCoordinates && (
                <LiveLocationMap
                  latitude={session.lastLatitude!}
                  longitude={session.lastLongitude!}
                  accuracyMeters={session.accuracyMeters}
                  patientName={patientName}
                  isLive={false}
                  lastUpdatedText={secondsAgoText}
                  className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden relative shadow-md border border-gray-200"
                />
              )}

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-left space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>🔴 Location Disconnected</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  The patient's live location is no longer being shared. This occurs when {patientName} taps <strong>Stop Sharing</strong>, closes their browser, or loses network connectivity.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRequestAgain}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Request Location Again</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strict 1-to-1 Patient-Caregiver Authorization</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
