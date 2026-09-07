import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none tactile-btn cursor-pointer';

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm min-h-[44px] gap-2',
    md: 'px-6 py-3 text-base min-h-[52px] gap-2.5',
    lg: 'px-7 py-3.5 text-lg min-h-[58px] gap-3',
    xl: 'px-8 py-4 text-xl min-h-[66px] gap-3.5',
  };

  const variantStyles = {
    primary: 'bg-sathi-600 hover:bg-sathi-700 text-white shadow-tactile border border-sathi-700',
    secondary: 'bg-sage-600 hover:bg-sage-700 text-white shadow-tactile border border-sage-700',
    outline: 'bg-white hover:bg-sathi-50 text-gray-800 border-2 border-gray-300 hover:border-sathi-500 shadow-sm',
    ghost: 'bg-transparent hover:bg-black/5 text-gray-700 hover:text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-tactile border border-red-700',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
