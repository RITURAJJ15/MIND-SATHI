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
    <div className="inline-flex items-center p-0.5 rounded-lg">
      {options.map((opt) => {
        const isActive = settings.fontSize === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setFontSize(opt.key)}
            title={opt.title}
            type="button"
            className={`px-2 py-1 rounded-md text-xs font-black transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-gray-800 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
