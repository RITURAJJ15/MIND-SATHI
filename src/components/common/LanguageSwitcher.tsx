import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { SupportedLanguage } from '../../types/user';
import { LANGUAGE_META } from '../../data/translations';
import { Globe, ChevronDown, Check } from 'lucide-react';

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentLang, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMeta = LANGUAGE_META[currentLang] || LANGUAGE_META.en;

  // Quick primary codes
  const quickCodes: SupportedLanguage[] = ['en', 'hi', 'as', 'bn'];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {compact ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          aria-label="Select language"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 font-bold text-xs hover:bg-amber-100 transition-colors cursor-pointer"
        >
          <span>{currentMeta.flag}</span>
          <span className="font-semibold">{currentMeta.nativeName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-amber-800" />
        </button>
      ) : (
        <div className="flex items-center gap-1 bg-amber-50/90 p-1 rounded-2xl border border-amber-300/80 shadow-xs">
          <Globe className="w-4 h-4 ml-2 mr-1 text-sathi-700 shrink-0" />
          
          {/* Top 3 Quick Pills */}
          <div className="hidden xl:flex items-center gap-1">
            {quickCodes.map((code) => {
              const meta = LANGUAGE_META[code];
              const isActive = currentLang === code;
              return (
                <button
                  key={code}
                  onClick={() => changeLanguage(code)}
                  type="button"
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sathi-600 text-white shadow-xs'
                      : 'text-gray-700 hover:bg-amber-100/70'
                  }`}
                >
                  {meta.nativeName}
                </button>
              );
            })}
          </div>

          {/* Dropdown button for all 9 languages */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-xs font-bold text-gray-800 hover:bg-amber-50 transition-colors cursor-pointer"
            title="All Northeast & National Languages"
          >
            <span className="truncate max-w-[90px]">{currentMeta.nativeName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          </button>
        </div>
      )}

      {/* Language Selection Modal / Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-amber-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-black uppercase tracking-wider text-sathi-800">Choose Language / ভাষা নিৰ্বাচন</p>
            <p className="text-[11px] text-gray-500">Northeast & National Languages</p>
          </div>
          
          <div className="max-h-80 overflow-y-auto py-1">
            {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((code) => {
              const meta = LANGUAGE_META[code];
              const isSelected = currentLang === code;
              return (
                <button
                  key={code}
                  onClick={() => {
                    changeLanguage(code);
                    setIsOpen(false);
                  }}
                  type="button"
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-amber-50/80 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-100/70 font-black text-sathi-900' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{meta.flag}</span>
                    <div>
                      <div className="text-sm font-bold text-gray-900 leading-tight">
                        {meta.nativeName}
                      </div>
                      <div className="text-[11px] text-gray-500 leading-tight">
                        {meta.label} • <span className="text-amber-700 font-medium">{meta.region}</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-sathi-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
