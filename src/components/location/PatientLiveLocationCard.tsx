import React, { useState, useEffect } from 'react';
import { MapPin, Shield, Radio, Loader2, Square, Play, AlertCircle } from 'lucide-react';
import { liveLocationService } from '../../services/liveLocationService';
import { LiveLocationSession } from '../../types/location';
import { LocationPermissionModal } from './LocationPermissionModal';

interface PatientLiveLocationCardProps {
  patientId: string;
  caregiverName?: string;
}

export const PatientLiveLocationCard: React.FC<PatientLiveLocationCardProps> = ({
  patientId,
  caregiverName = 'Your Caregiver',
}) => {
  const [activeSession, setActiveSession] = useState<LiveLocationSession | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [incomingRequest, setIncomingRequest] = useState<LiveLocationSession | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastUpdateText, setLastUpdateText] = useState<string>('Just now');
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // 1. Subscribe to incoming location requests from the connected caregiver
  useEffect(() => {
    if (!patientId || patientId === 'guest') return;

    const unsubscribe = liveLocationService.subscribeToIncomingRequests(
      patientId,
      (session) => {
        if (session.status === 'requested') {
          setIncomingRequest(session);
        } else if (session.status === 'stopped' || session.status === 'disconnected') {
          if (isSharing) {
            liveLocationService.stopSharing(session.id);
            setIsSharing(false);
            setActiveSession(null);
          }
        }
      }
    );

    return () => {
      unsubscribe();
      if (isSharing) {
        liveLocationService.stopSharing();
      }
    };
  }, [patientId, isSharing]);

  // 2. Timer to display "Last updated: X seconds ago" while sharing
  useEffect(() => {
    if (!isSharing) {
      setSecondsAgo(0);
      return;
    }

    const interval = setInterval(() => {
      setSecondsAgo((prev) => {
        const next = prev + 1;
        if (next < 5) setLastUpdateText('Just now');
        else if (next < 60) setLastUpdateText(`${next}s ago`);
        else setLastUpdateText(`${Math.floor(next / 60)}m ago`);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSharing]);

  // Handler: Patient approves location sharing from modal
  const handleApproveSharing = async () => {
    if (!incomingRequest) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await liveLocationService.respondToRequest(incomingRequest.id, true);
      if (!res.success || !res.session) {
        setErrorMessage(res.error || 'Failed to approve location request.');
        return;
      }

      const started = liveLocationService.startSharing(
        res.session.id,
        () => {
          setSecondsAgo(0);
          setLastUpdateText('Just now');
        },
        (err) => {
          setErrorMessage(err.message);
          liveLocationService.stopSharing(res.session!.id);
          setIsSharing(false);
          setActiveSession(null);
        }
      );

      if (started) {
        setIsSharing(true);
        setActiveSession(res.session);
        setIncomingRequest(null);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error activating live location.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Patient declines location sharing
  const handleDeclineSharing = async () => {
    if (!incomingRequest) return;
    setIsProcessing(true);
    try {
      await liveLocationService.respondToRequest(incomingRequest.id, false);
      setIncomingRequest(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Patient initiates sharing directly from dashboard
  const handleStartSharingDirectly = async () => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await liveLocationService.patientStartSharing();
      if (!res.success || !res.session) {
        setErrorMessage(res.error || 'Failed to start live location sharing.');
        return;
      }

      const started = liveLocationService.startSharing(
        res.session.id,
        () => {
          setSecondsAgo(0);
          setLastUpdateText('Just now');
        },
        (err) => {
          setErrorMessage(err.message);
          liveLocationService.stopSharing(res.session!.id);
          setIsSharing(false);
          setActiveSession(null);
        }
      );

      if (started) {
        setIsSharing(true);
        setActiveSession(res.session);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error activating live location.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Explicit Stop Sharing button
  const handleStopSharing = async () => {
    setIsProcessing(true);
    try {
      if (activeSession) {
        await liveLocationService.stopSharing(activeSession.id);
      } else {
        await liveLocationService.stopSharing();
      }
      setIsSharing(false);
      setActiveSession(null);
      setSecondsAgo(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-elder border border-gray-200 text-left transition-all">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-800">
              Live Location
            </h3>
          </div>
          {isSharing ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>ACTIVE</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span>OFF</span>
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSharing ? (
          /* Active State */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>🟢 Live Location Sharing</span>
            </div>
            <p className="text-xs text-emerald-950 font-semibold leading-relaxed bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
              Live location is being shared with your caregiver ({caregiverName}).
            </p>
            <div className="text-[11px] font-semibold text-gray-400">
              Last updated: <span className="text-gray-700 font-bold">{lastUpdateText}</span>
            </div>
            <button
              type="button"
              onClick={handleStopSharing}
              disabled={isProcessing}
              className="w-full mt-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
              <span>Stop Sharing</span>
            </button>
          </div>
        ) : (
          /* Inactive State */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span>Location sharing is OFF</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Share your real-time location with your connected caregiver <strong>{caregiverName}</strong>.
            </p>
            {incomingRequest ? (
              <button
                type="button"
                onClick={() => setIncomingRequest(incomingRequest)}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 animate-bounce"
              >
                <Radio className="w-4 h-4" />
                <span>View Caregiver Location Request</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartSharingDirectly}
                disabled={isProcessing}
                className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>Share My Live Location</span>
              </button>
            )}
            <div className="py-1">
              <span className="text-[11px] text-gray-400 italic">
                Protected by Mind Sathi Patient Consent Protocol
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Permission Modal */}
      <LocationPermissionModal
        isOpen={Boolean(incomingRequest)}
        caregiverName={incomingRequest?.caregiverName || caregiverName}
        isProcessing={isProcessing}
        errorMessage={errorMessage}
        onAccept={handleApproveSharing}
        onDecline={handleDeclineSharing}
      />
    </>
  );
};
