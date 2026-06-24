'use client';

import { forwardRef } from 'react';
import { cn, haptic } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'gradient-brand text-white shadow-lg shadow-accent/20 hover:shadow-accent/30',
  secondary: 'bg-white/8 text-white border border-white/10 hover:bg-white/12',
  ghost: 'bg-transparent text-white/70 hover:bg-white/5 hover:text-white',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', fullWidth, loading, disabled, onClick, className, children, ...rest },
  ref,
) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    haptic('light');
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_STYLES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
});
