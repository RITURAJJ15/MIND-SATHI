import React, { useState, useEffect } from 'react';
import {
  MapPin,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Navigation,
  Loader2,
  Compass,
} from 'lucide-react';
import { locationService } from '../../services/locationService';
import { PatientLocation } from '../../types/location';
import { HomeLocationMap } from './HomeLocationMap';

export interface HomeLocationModalProps {
  isOpen?: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  location?: PatientLocation | null;
  initialLocation?: PatientLocation | null;
  onLocationUpdated?: (loc: PatientLocation) => void;
}

export const HomeLocationModal: React.FC<HomeLocationModalProps> = ({
  isOpen = true,
  onClose,
  patientId,
  patientName = 'Patient',
  location: locationProp,
  initialLocation,
  onLocationUpdated,
}) => {
  const activeInitial = locationProp || initialLocation || null;
  const [location, setLocation] = useState<PatientLocation | null>(activeInitial);
  const [loading, setLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showConfirmChange, setShowConfirmChange] = useState(false);

  // Load latest location from Supabase whenever modal opens
  useEffect(() => {
    const effectiveId = patientId || activeInitial?.patientId;
    if (!isOpen || !effectiveId) return;

    if (activeInitial) {
      setLocation(activeInitial);
    }

    setLoading(true);
    locationService
      .getPatientHomeLocation(effectiveId)
      .then((loc) => {
        if (loc) {
          setLocation(loc);
        }
      })
      .catch((err) => {
        console.warn('Failed to load patient location:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, patientId, activeInitial]);

  if (!isOpen) return null;

  // Handle detecting and saving location
  const handleDetectAndSave = async () => {
    setIsDetecting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Request browser geolocation
      const coords = await locationService.requestBrowserCoordinates();

      // 2. Reverse geocode locality name
      let locName = 'My Home Location';
      try {
        locName = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      } catch {
        // fallback
      }

      // 3. Save to Supabase (upsert)
      const targetId = patientId || location?.patientId || '';
      const res = await locationService.savePatientHomeLocation(targetId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationName: locName,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'Failed to save location in database.');
      } else {
        setLocation(res.data);
        setShowConfirmChange(false);
        setSuccessMsg('Home location saved successfully in Supabase.');
        onLocationUpdated?.(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to access location.');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-amber-100 overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/30 border border-amber-400/40 text-amber-200">
              <MapPin className="w-5 h-5 text-amber-300" />
            </span>
            <span className="text-[11px] uppercase tracking-widest font-black text-amber-200">
              MIND SATHI • HOME LOCATION
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
            My Home Location
          </h2>
          <p className="text-xs text-amber-100/90 mt-1 max-w-md leading-relaxed">
            Your registered residence coordinates, secured and associated strictly with your authenticated account.
          </p>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={handleDetectAndSave}
                  className="mt-2 block px-3 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-rose-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
              <span className="text-xs font-bold">Loading saved location from database…</span>
            </div>
          ) : location ? (
            <div className="space-y-4">
              {/* Map Preview */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <HomeLocationMap
                  latitude={location.latitude}
                  longitude={location.longitude}
                  locationName={location.locationName || 'My Home Location'}
                  zoom={15}
                  className="h-64 sm:h-72 w-full"
                />
              </div>

              {/* Location Details Card */}
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-0.5">
                      REGISTERED ADDRESS / LOCALITY
                    </div>
                    <div className="text-base font-black text-gray-900">
                      {location.locationName || 'My Home Location'}
                    </div>
                    <div className="text-xs text-gray-600 font-mono mt-1">
                      Latitude: <strong className="text-gray-900">{location.latitude.toFixed(6)}°</strong> • Longitude: <strong className="text-gray-900">{location.longitude.toFixed(6)}°</strong>
                    </div>
                    {location.updatedAt && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        Last verified: {new Date(location.updatedAt).toLocaleDateString()} at {new Date(location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 rounded-2xl bg-amber-100/80 border border-amber-300 text-amber-800 shrink-0">
                    <Compass className="w-5 h-5 text-amber-700" />
                  </div>
                </div>
              </div>

              {/* Confirmation Prompt when patient requests to change location */}
              {showConfirmChange ? (
                <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-2xl text-left space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Navigation className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-extrabold text-orange-950">
                        Update Home Location?
                      </h4>
                      <p className="text-xs text-orange-900 mt-0.5 leading-relaxed">
                        We will detect your current GPS coordinates and update your permanent record in Supabase.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirmChange(false)}
                      className="flex-1 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDetectAndSave}
                      disabled={isDetecting}
                      className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {isDetecting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Detecting GPS…</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Confirm & Detect</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmChange(true)}
                    className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-700" />
                    <span>Change Home Location</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-tactile"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* No location registered yet */
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center mx-auto text-amber-700">
                <MapPin className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  No Home Location Registered Yet
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Registering your home location enables MIND SATHI to safeguard your daily routines and provide personalized cultural context.
                </p>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 max-w-md mx-auto text-left flex items-start gap-2.5">
                <Navigation className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 font-medium">
                  We will request your browser's location permission once. Your coordinates are never shared publicly.
                </div>
              </div>

              <button
                type="button"
                onClick={handleDetectAndSave}
                disabled={isDetecting}
                className="w-full max-w-md mx-auto py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-sm rounded-xl shadow-tactile transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Detecting Location…</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>📍 Set My Home Location</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Privacy Footnote */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-semibold text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Protected by Supabase Row-Level Security • No continuous background tracking</span>
          </div>
        </div>
      </div>
    </div>
  );
};
