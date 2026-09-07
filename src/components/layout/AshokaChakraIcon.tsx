import React from 'react';

interface AshokaChakraIconProps {
  className?: string;
  size?: number;
}

export const AshokaChakraIcon: React.FC<AshokaChakraIconProps> = ({ className = '', size = 24 }) => {
  // 24 spokes of Ashoka Chakra
  const spokes = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`text-blue-800 shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ashoka Chakra emblem"
    >
      {/* Outer Ring */}
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" />
      {/* Inner Hub Ring */}
      <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="3" fill="currentColor" fillOpacity="0.15" />
      <circle cx="50" cy="50" r="3.5" fill="currentColor" />

      {/* 24 Spokes */}
      {spokes.map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = 50 + 46 * Math.cos(rad);
        const y2 = 50 + 46 * Math.sin(rad);
        return (
          <line
            key={idx}
            x1="50"
            y1="50"
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};
