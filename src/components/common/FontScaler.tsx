import React from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';

export const FontScaler: React.FC = () => {
  const { settings, setFontSize } = useAccessibility();

  const options: { key: 'normal' | 'large' | 'extralarge'; label: string; title: string }[] = [
    { key: 'normal', label: 'A', title: 'Normal text' },
    { key: 'large', label: 'A+', title: 'Large text' },
    { key: 'extralarge', label: 'A++', title: 'Extra large text' },
  ];

  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-300">
      {options.map((opt) => {
        const isActive = settings.fontSize === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setFontSize(opt.key)}
            title={opt.title}
            type="button"
            className={`px-2.5 py-1 rounded-xl font-bold transition-all duration-150 cursor-pointer ${
              opt.key === 'normal' ? 'text-xs' : opt.key === 'large' ? 'text-sm' : 'text-base'
            } ${
              isActive
                ? 'bg-gray-800 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
