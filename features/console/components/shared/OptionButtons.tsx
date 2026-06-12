'use client';

import { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface OptionButtonItem<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Native tooltip explaining what the option does */
  title?: string;
}

interface OptionButtonsProps<T extends string> {
  options: OptionButtonItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Compact pills vs. larger descriptive cards */
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/**
 * Selectable button group — the console's replacement for dropdown selects.
 */
export function OptionButtons<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  className = '',
}: OptionButtonsProps<T>) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            title={opt.title}
            className={[
              'flex flex-1 justify-center items-center gap-2 rounded-xl border font-semibold transition-all duration-150 cursor-pointer',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95',
            ].join(' ')}
            style={{
              background: isActive ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-surface)',
              borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            {opt.icon}
            <span className="text-left">
              {opt.label}
              {opt.description && (
                <span className="block text-[11px] font-normal opacity-80">{opt.description}</span>
              )}
            </span>
            {isActive && <Check className={size === 'sm' ? 'size-3' : 'size-3.5'} />}
          </button>
        );
      })}
    </div>
  );
}
