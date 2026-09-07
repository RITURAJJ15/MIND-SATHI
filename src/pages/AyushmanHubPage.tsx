import React, { useState } from 'react';
import { AbhaCardView } from '../components/abdm/AbhaCardView';
import { HospitalSearch } from '../components/abdm/HospitalSearch';
import { useLanguage } from '../hooks/useLanguage';
import { useSpeech } from '../hooks/useSpeech';
import { VoicePromptButton } from '../components/common/VoicePromptButton';
import { Building, ShieldCheck, HeartPulse, Search, Info, CheckCircle2 } from 'lucide-react';

export const AyushmanHubPage: React.FC = () => {
  const { currentLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'card' | 'hospitals' | 'guide'>('card');

  const intro = currentLang === 'hi'
    ? 'आयुष्मान भारत प्रधानमंत्री जन आरोग्य योजना (PM-JAY) के तहत 70 वर्ष और उससे अधिक आयु के सभी वरिष्ठ नागरिकों को ₹5 लाख तक का निःशुल्क उपचार उपलब्ध है।'
    : currentLang === 'as'
    ? 'আয়ুষ্মান ভাৰতৰ অধীনত ৭০ বছৰ বা ততোধিক বয়সৰ সকলো জ্যেষ্ঠ নাগৰিকৰ বাবে ৫ লাখ টকা পৰ্যন্ত বিনামূলীয়া চিকিৎসা উপলব্ধ।'
    : 'Under Ayushman Bharat PM-JAY, all senior citizens aged 70+ receive universal health coverage of up to ₹5 Lakhs per year.';

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-elder">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-widest font-extrabold bg-amber-400 text-blue-950 px-2.5 py-0.5 rounded">
                GOVERNMENT OF INDIA SCHEME
              </span>
              <VoicePromptButton text={intro} size="sm" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight mt-1">
              {currentLang === 'hi' ? 'आयुष्मान भारत एवं ABHA स्वास्थ्य केंद्र' : currentLang === 'as' ? 'আয়ুষ্মান ভাৰত আৰু ABHA স্বাস্থ্য কেন্দ্ৰ' : 'Ayushman Bharat & ABDM Health Hub'}
            </h1>
            <p className="text-blue-200 text-sm sm:text-base max-w-2xl mt-2 leading-relaxed font-medium">
              {intro}
            </p>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('card')}
            type="button"
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'card'
                ? 'bg-amber-400 text-blue-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {currentLang === 'hi' ? 'डिजिटल ABHA व PM-JAY कार्ड' : currentLang === 'as' ? 'ডিজিটেল ABHA কাৰ্ড' : 'Digital ABHA & PM-JAY Card'}
          </button>

          <button
            onClick={() => setActiveTab('hospitals')}
            type="button"
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'hospitals'
                ? 'bg-amber-400 text-blue-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {currentLang === 'hi' ? 'अस्पताल खोजें (Hospital Directory)' : currentLang === 'as' ? 'চিকিৎসালয় বিচাৰক' : 'Find Empanelled Hospitals'}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            type="button"
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-amber-400 text-blue-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {currentLang === 'hi' ? '70+ पात्रता एवं लाभ मार्गदर्शिका' : currentLang === 'as' ? '৭০+ সুবিধাৰ নিৰ্দেশিকা' : 'Senior 70+ Benefits Guide'}
          </button>
        </div>
      </div>

      {/* Tab 1: ABHA Digital Card */}
      {activeTab === 'card' && <AbhaCardView />}

      {/* Tab 2: Hospital Search */}
      {activeTab === 'hospitals' && <HospitalSearch />}

      {/* Tab 3: Benefits Guide */}
      {activeTab === 'guide' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-elder border border-gray-200 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-gray-900">
                {currentLang === 'hi' ? '70 वर्ष से अधिक आयु के वरिष्ठ नागरिकों के लिए योजना लाभ' : currentLang === 'as' ? '৭০ বছৰৰ উৰ্ধৰ জ্যেষ্ঠ নাগৰিকৰ সুবিধা' : 'Universal Senior 70+ Ayushman Guidelines'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Approved by the Union Cabinet • Effective across all States and Union Territories
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 space-y-2">
              <h4 className="font-extrabold text-emerald-950 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <span>No Income Bar (आय सीमा नहीं)</span>
              </h4>
              <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
                All Indian citizens aged 70 and above are eligible, regardless of socioeconomic status or family income.
              </p>
            </div>

            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 space-y-2">
              <h4 className="font-extrabold text-blue-950 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-700" />
                <span>Exclusive ₹5 Lakh Top-Up Cover</span>
              </h4>
              <p className="text-xs sm:text-sm text-blue-900 leading-relaxed">
                Senior citizens receive a distinct ₹5 Lakh cover dedicated exclusively to their healthcare, not shared with younger family members.
              </p>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-2">
              <h4 className="font-extrabold text-amber-950 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-700" />
                <span>Pre-existing Conditions Covered</span>
              </h4>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                All pre-existing medical conditions (hypertension, diabetes, joint disorders, cognitive neurological care) are covered from Day 1.
              </p>
            </div>

            <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 space-y-2">
              <h4 className="font-extrabold text-purple-950 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-700" />
                <span>Aadhaar-based Instant e-KYC</span>
              </h4>
              <p className="text-xs sm:text-sm text-purple-900 leading-relaxed">
                Enrollment requires only Aadhaar with age 70+ verification. New golden cards are generated instantly through Ayushman App or portal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
