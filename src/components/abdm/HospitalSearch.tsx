import React, { useState } from 'react';
import { EmpanelledHospital } from '../../types/abdm';
import { abdmService } from '../../services/abdmService';
import { useLanguage } from '../../hooks/useLanguage';
import { Search, MapPin, Phone, Building2, CheckCircle2, Filter } from 'lucide-react';

export const HospitalSearch: React.FC = () => {
  const { currentLang } = useLanguage();
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const cities = ['All', ...abdmService.getCities()];
  const specialties = ['All', ...abdmService.getSpecialties()];

  const hospitals: EmpanelledHospital[] = abdmService.searchHospitals({
    city: selectedCity,
    specialty: selectedSpecialty,
    query: searchQuery,
  });

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-elder border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-700" />
            <span>{currentLang === 'hi' ? 'आयुष्मान संबद्ध अस्पताल खोजें' : currentLang === 'as' ? 'আয়ুষ্মান তালিকাভুক্ত চিকিৎসালয়' : 'Find PM-JAY Empanelled Hospitals'}</span>
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {currentLang === 'hi' ? 'वरिष्ठ नागरिकों के लिए निःशुल्क उपचार उपलब्ध केंद्र' : currentLang === 'as' ? 'জ্যেষ্ঠ নাগৰিকৰ বাবে বিনামূলীয়া চিকিৎসা কেন্দ্ৰ' : 'Cashless geriatric & specialized care under Ayushman Bharat'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Search query */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={currentLang === 'hi' ? 'अस्पताल का नाम या पता...' : currentLang === 'as' ? 'চিকিৎসালয়ৰ নাম...' : 'Search hospital name...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none text-sm"
          />
        </div>

        {/* City Select */}
        <div>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full p-2.5 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none text-sm font-semibold text-gray-700 cursor-pointer"
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === 'All' ? (currentLang === 'hi' ? 'सभी शहर (All Cities)' : currentLang === 'as' ? 'সকলো চহৰ' : 'All Cities') : city}
              </option>
            ))}
          </select>
        </div>

        {/* Specialty Select */}
        <div>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="w-full p-2.5 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none text-sm font-semibold text-gray-700 cursor-pointer"
          >
            {specialties.map((spec) => (
              <option key={spec} value={spec}>
                {spec === 'All' ? (currentLang === 'hi' ? 'सभी विभाग (All Specialties)' : currentLang === 'as' ? 'সকলো বিভাগ' : 'All Specialties') : spec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hospital List Cards */}
      <div className="space-y-4">
        {hospitals.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {currentLang === 'hi' ? 'कोई अस्पताल नहीं मिला' : currentLang === 'as' ? 'কোনো চিকিৎসালয় পোৱা নগ\'ল' : 'No matching hospitals found.'}
          </div>
        ) : (
          hospitals.map((hosp) => (
            <div
              key={hosp.id}
              className="p-5 rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-gray-50/50 hover:bg-white transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    hosp.category === 'Government'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {hosp.category}
                  </span>
                  {hosp.hasGeriatricWard && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                      ✓ {currentLang === 'hi' ? 'वृद्धावस्था वार्ड' : currentLang === 'as' ? 'জ্যেষ্ঠ ৱাৰ্ড' : 'Geriatric Ward'}
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-bold text-gray-900 truncate">{hosp.name}</h4>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{hosp.address}, {hosp.city} ({hosp.distance})</span>
                </p>

                <div className="flex flex-wrap gap-1 mt-2.5">
                  {hosp.specialties.map((s, idx) => (
                    <span key={idx} className="text-[11px] font-medium bg-white text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Contact */}
              <div className="shrink-0 flex flex-col sm:items-end gap-1.5 border-t sm:border-t-0 pt-3 sm:pt-0">
                <div className="text-xs text-gray-600">
                  PM-JAY Desk: <strong className="text-blue-900">{hosp.pmjayDeskPhone}</strong>
                </div>
                <a
                  href={`tel:${hosp.pmjayDeskPhone}`}
                  className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{currentLang === 'hi' ? 'आयुष्मान मित्र से बात करें' : currentLang === 'as' ? 'আয়ুষ্মান মিত্ৰক ফোন কৰক' : 'Call Ayushman Mitra'}</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
