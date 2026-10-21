import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { SupportedLanguage } from '../../types/user';
import { LANGUAGE_META } from '../../data/translations';
import { Globe, ChevronDown, Check, X } from 'lucide-react';

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentMeta = LANGUAGE_META[currentLang] || LANGUAGE_META.en;
  const languageCodes = Object.keys(LANGUAGE_META) as SupportedLanguage[];

  const handleSelectLanguage = (code: SupportedLanguage) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  const renderLanguageItem = (code: SupportedLanguage) => {
    const meta = LANGUAGE_META[code];
    const isSelected = currentLang === code;
    return (
      <button
        key={code}
        onClick={() => handleSelectLanguage(code)}
        type="button"
        className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
          isSelected
            ? 'bg-amber-100 text-sathi-950 font-black ring-1 ring-amber-400/80 shadow-2xs'
            : 'text-stone-700 hover:bg-amber-50 hover:text-stone-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl shrink-0" role="img" aria-label={meta.label}>
            {meta.flag}
          </span>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-tight">
              {meta.nativeName}
            </div>
            <div className="text-[11px] text-gray-500 leading-tight">
              {meta.label} • <span className="text-amber-800 font-semibold">{meta.region}</span>
            </div>
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-sathi-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label="Select language"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300/80 text-amber-950 font-extrabold text-xs hover:bg-amber-100 transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        title="Change language / भाषा बदलें / ভাষা নিৰ্বাচন"
      >
        <Globe className="w-3.5 h-3.5 text-sathi-700 shrink-0" />
        <span className="text-xs">{currentMeta.flag}</span>
        <span className="font-bold">{currentMeta.nativeName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-amber-800 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Language Selection: Responsive Desktop Dropdown & Mobile Fixed Modal */}
      {isOpen && (
        <>
          {/* 1. Desktop Dropdown (>= 1024px) - Drops down right below the button with high z-index */}
          <div className="hidden lg:block absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border-2 border-amber-300 py-2 z-[100] ring-1 ring-black/5 animate-fade-in">
            <div className="px-4 py-2 border-b border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-sathi-800">
                  Choose Language / ভাষা নিৰ্বাচন
                </p>
                <p className="text-[11px] text-gray-500 font-medium">Regional & National Languages</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-84 overflow-y-auto p-1.5 space-y-1 divide-y-0">
              {languageCodes.map(renderLanguageItem)}
            </div>
          </div>

          {/* 2. Mobile/Tablet Modal Dialog (< 1024px) - Immune to scroll containers & drawer clipping */}
          <div className="lg:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 animate-fade-in">
            {/* Backdrop click to close */}
            <div
              className="absolute inset-0"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border-2 border-amber-400 p-4 max-h-[85vh] flex flex-col z-10 animate-slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-sathi-700">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 leading-tight">
                      Choose Language / ভাষা নিৰ্বাচন
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Regional & National Languages
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  type="button"
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto py-2 space-y-1.5 flex-1">
                {languageCodes.map(renderLanguageItem)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
