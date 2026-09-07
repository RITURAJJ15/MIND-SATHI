import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'warm' | 'bordered';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const baseStyles = 'rounded-3xl p-5 sm:p-6 transition-all duration-200';

  const variantStyles = {
    default: 'bg-white shadow-elder border border-[#EDE7DF]',
    elevated: 'bg-white shadow-elder-hover border border-[#E5DFD5]',
    warm: 'bg-gradient-to-br from-[#FFFBF7] to-[#FAF3EB] shadow-elder border border-sathi-200',
    bordered: 'bg-white border-2 border-gray-200 hover:border-sathi-400',
  };

  return (
    <div className={twMerge(clsx(baseStyles, variantStyles[variant], className))} {...props}>
      {children}
    </div>
  );
};
