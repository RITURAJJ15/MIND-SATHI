import React from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLanguage } from '../hooks/useLanguage';
import { useAccessibility } from '../hooks/useAccessibility';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { FontScaler } from '../components/common/FontScaler';
import { Settings, Eye, Volume2, ShieldCheck, User, RefreshCcw } from 'lucide-react';

export const ProfileSettingsPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { currentLang, t } = useLanguage();
  const { settings, setFontSize, toggleHighContrast, toggleSound } = useAccessibility();

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
    </div>
  );
};
