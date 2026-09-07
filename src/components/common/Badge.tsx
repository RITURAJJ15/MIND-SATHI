import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'saffron' | 'sage' | 'blue' | 'gold' | 'gray';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'saffron',
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full';

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3.5 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const variantStyles = {
    saffron: 'bg-sathi-100 text-sathi-900 border border-sathi-300 font-semibold',
    sage: 'bg-sage-100 text-sage-900 border border-sage-300 font-semibold',
    blue: 'bg-blue-100 text-blue-900 border border-blue-300 font-semibold',
    gold: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
    gray: 'bg-gray-100 text-gray-800 border border-gray-300',
  };

  return (
    <span className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))} {...props}>
      {children}
    </span>
  );
};
