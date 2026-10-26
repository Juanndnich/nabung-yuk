import React from 'react';
import { soundService, SoundEffectType } from '../services/audio';

export interface SoundButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  sound?: SoundEffectType;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const SoundButton: React.FC<SoundButtonProps> = ({
  sound = 'click',
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled,
  children,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      soundService.play(sound);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all select-none rounded-xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary:
      'bg-[var(--text-primary)] text-[var(--bg-page)] border border-[var(--border-color)] hover:opacity-90 shadow-2xs focus:ring-[var(--color-secondary)]',
    secondary:
      'bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card)]',
    outline:
      'border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]',
    ghost:
      'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-2xs',
  }[variant];

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 min-h-[38px] gap-1.5',
    md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
    lg: 'text-base px-5 py-3 min-h-[48px] gap-2.5',
    icon: 'p-2.5 min-h-[44px] min-w-[44px]',
  }[size];

  return (
    <button
      {...props}
      disabled={disabled}
      onClick={handleClick}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </button>
  );
};
