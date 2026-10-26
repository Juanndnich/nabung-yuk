import React from 'react';
import { formatRupiah, parseRupiah } from '../domain/accounting';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = 'Rp0',
  className = '',
  disabled = false,
  autoFocus = false,
  id,
}) => {
  const displayValue = value > 0 ? formatRupiah(value) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseRupiah(raw);
    onChange(parsed);
  };

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 text-lg font-bold rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-pink-400 tabular-nums transition-all ${className}`}
      />
    </div>
  );
};
