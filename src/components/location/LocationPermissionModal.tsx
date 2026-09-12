import React from 'react';
import { MapPin, Shield, Check, X, AlertCircle, Loader2 } from 'lucide-react';

interface LocationPermissionModalProps {
  isOpen: boolean;
  caregiverName: string;
  isProcessing: boolean;
  errorMessage?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  caregiverName,
  isProcessing,
  errorMessage,
  onAccept,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-scale-up text-left">
        {/* Header with Icon */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
            <MapPin className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Location Request
            </span>
            <h3 className="font-extrabold text-lg text-gray-900 mt-1">
              Share Your Live Location?
            </h3>
          </div>
        </div>

        {/* Body content */}
        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            Your connected caregiver <strong>{caregiverName || 'Your Caregiver'}</strong> wants to view your live GPS location.
          </p>

          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-900">
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Your Privacy is Protected</p>
              <p className="text-emerald-800 leading-snug">
                Only your verified caregiver can view your position. You can stop sharing at any time with a single tap.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onDecline}
            disabled={isProcessing}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <X className="w-4 h-4 text-gray-500" />
            <span>Don't Share</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isProcessing}
            className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Share Live Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
