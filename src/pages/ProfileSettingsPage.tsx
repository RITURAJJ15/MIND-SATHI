import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { useAccessibility } from '../hooks/useAccessibility';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { FontScaler } from '../components/common/FontScaler';
import { Settings, Eye, Volume2, ShieldCheck, User, RefreshCcw, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { locationService } from '../services/locationService';
import { PatientLocation } from '../types/location';
import { HomeLocationModal } from '../components/location/HomeLocationModal';

export const ProfileSettingsPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const { settings, setFontSize, toggleHighContrast, toggleSound } = useAccessibility();

  // Home location state
  const [homeLocation, setHomeLocation] = useState<PatientLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);
  const [updatingLocation, setUpdatingLocation] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [locationToast, setLocationToast] = useState<string>('');

  useEffect(() => {
    if (!currentUser?.id) return;
    setLoadingLocation(true);
    locationService
      .getPatientHomeLocation(currentUser.id)
      .then((loc) => setHomeLocation(loc))
      .catch((err) => console.warn('Error fetching location in settings:', err))
      .finally(() => setLoadingLocation(false));
  }, [currentUser?.id]);

  const handleUpdateLocation = async () => {
    if (!currentUser?.id) return;
    setUpdatingLocation(true);
    try {
      const coords = await locationService.requestBrowserCoordinates();
      const res = await locationService.savePatientHomeLocation(currentUser.id, coords);
      if (res.success && res.data) {
        setHomeLocation(res.data);
        setLocationToast('Home location saved successfully.');
        setTimeout(() => setLocationToast(''), 4000);
      } else {
        alert(res.error || 'Failed to update location.');
      }
    } catch (err: any) {
      console.warn('Location update error:', err);
      alert(
        err?.message ||
          'Unable to get location. Please enable location permissions in your browser and try again.'
      );
    } finally {
      setUpdatingLocation(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-sathi-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{t.nav.settings}</h1>
        </div>
        <p className="text-gray-600 text-sm sm:text-base">
          {currentLang === 'hi'
            ? 'अक्षर का आकार, भाषा, और बोलकर सुनाने की सेटिंग्स को अपनी सुविधा अनुसार बदलें।'
            : currentLang === 'as'
            ? 'আখৰৰ আকাৰ, ভাষা আৰু শব্দৰ সুবিধা নিজৰ সুবিধা অনুসৰি সলনি কৰক।'
            : 'Customize font sizes, high-contrast display, languages, and voice assistance.'}
        </p>
      </div>

      {/* Accessibility Preferences */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200 space-y-6">
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Eye className="w-5 h-5 text-sathi-600" />
          <span>{t.accessibility.title}</span>
        </h3>

        {/* Text Size */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <h4 className="font-bold text-gray-900 text-base">{t.accessibility.textSize}</h4>
            <p className="text-xs text-gray-500">
              {currentLang === 'hi' ? 'सुगम पढ़ने के लिए अक्षरों का आकार बढ़ाएं' : 'Increase typography size for effortless reading'}
            </p>
          </div>
          <FontScaler />
        </div>

        {/* High Contrast Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <h4 className="font-bold text-gray-900 text-base">{t.accessibility.highContrast}</h4>
            <p className="text-xs text-gray-500">
              {currentLang === 'hi' ? 'कमज़ोर दृष्टि के लिए गहरा काला और पीला कंट्रास्ट' : 'Deep dark background with high-contrast text'}
            </p>
          </div>
          <button
            onClick={toggleHighContrast}
            type="button"
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
              settings.highContrast
                ? 'bg-amber-400 text-gray-950 shadow-md'
                : 'bg-white border-2 border-gray-300 text-gray-700'
            }`}
          >
            {settings.highContrast ? 'Enabled (चालू)' : 'Disabled (बंद)'}
          </button>
        </div>

        {/* Sound Effects */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <h4 className="font-bold text-gray-900 text-base">{t.accessibility.soundEffects}</h4>
            <p className="text-xs text-gray-500">
              {currentLang === 'hi' ? 'खेल के दौरान मधुर स्वर व घंटियों की ध्वनि' : 'Gentle chimes and procedural audio cues'}
            </p>
          </div>
          <button
            onClick={toggleSound}
            type="button"
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
              settings.soundEffects
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white border-2 border-gray-300 text-gray-700'
            }`}
          >
            {settings.soundEffects ? 'Sound On' : 'Sound Off'}
          </button>
        </div>

        {/* Language Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <h4 className="font-bold text-gray-900 text-base">
              {currentLang === 'hi' ? 'प्राथमिक भाषा' : currentLang === 'as' ? 'মুখ্য ভাষা' : 'App Language'}
            </h4>
            <p className="text-xs text-gray-500">Hindi (हिन्दी), Assamese (অসমীয়া), or English</p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Profile & ABHA Identity Details */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200 space-y-4">
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          <span>Profile & Government Health ID</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
            <span className="text-gray-400 font-bold uppercase block text-[11px]">Full Name</span>
            <span className="font-extrabold text-gray-900 text-base">{currentUser.name}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
            <span className="text-gray-400 font-bold uppercase block text-[11px]">Preferred Calling Name</span>
            <span className="font-extrabold text-sathi-700 text-base">{currentUser.preferredName}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
            <span className="text-gray-400 font-bold uppercase block text-[11px]">ABHA Number</span>
            <span className="font-mono font-extrabold text-blue-900 text-base">{currentUser.abhaId || 'Not Linked'}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
            <span className="text-gray-400 font-bold uppercase block text-[11px]">PM-JAY Scheme ID</span>
            <span className="font-mono font-extrabold text-emerald-900 text-base">{currentUser.pmjayId || 'Not Registered'}</span>
          </div>
        </div>
      </div>

      {/* Patient Home Location Management */}
      <div className="bg-white p-6 rounded-3xl shadow-elder border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            <span>Home Location & Senior Safety Anchor</span>
          </h3>
          {homeLocation && (
            <span className="text-xs font-black px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved</span>
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Your home location is permanently associated with your authenticated Google Account in Supabase. It provides orientation during disorientation episodes and alerts designated caregivers.
        </p>

        {locationToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{locationToast}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <span>🏠</span>
              <span>
                {loadingLocation
                  ? 'Checking location...'
                  : homeLocation
                  ? homeLocation.locationName || homeLocation.locality || homeLocation.city || 'Home Coordinates Registered'
                  : 'No Home Location Set'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {homeLocation
                ? `Coordinates: ${homeLocation.latitude.toFixed(5)}° N, ${homeLocation.longitude.toFixed(5)}° E`
                : 'Click below to register your device coordinates as your home anchor.'}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {homeLocation ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-tactile transition-all cursor-pointer flex items-center gap-1.5 active:translate-y-0.5"
                >
                  <span>🗺️ View on Map</span>
                </button>
                <button
                  type="button"
                  onClick={handleUpdateLocation}
                  disabled={updatingLocation}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs border border-gray-300 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update Location'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleUpdateLocation}
                disabled={updatingLocation}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-tactile transition-all cursor-pointer flex items-center gap-2 active:translate-y-0.5 disabled:opacity-50"
              >
                {updatingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Detecting Location...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Set My Home Location</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OpenStreetMap Modal */}
      {showLocationModal && homeLocation && (
        <HomeLocationModal
          isOpen={showLocationModal}
          location={homeLocation}
          patientId={currentUser?.id}
          patientName={currentUser?.name}
          onClose={() => setShowLocationModal(false)}
          onLocationUpdated={(updated) => {
            setHomeLocation(updated);
            setLocationToast('Home location updated successfully.');
            setTimeout(() => setLocationToast(''), 4000);
          }}
        />
      )}
    </div>
  );
};
