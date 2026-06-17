'use client';

import { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface OptionButtonItem<T extends string> {
  value: T;
  label: string;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Native tooltip explaining what the option does */
  title?: string;
}

// Discriminatable props for single vs multiple selection
export type OptionButtonsProps<T extends string> = {
  options: OptionButtonItem<T>[];
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  layout?: 'wrap' | 'grid';
  hideCheck?: boolean;
} & (
  | { multiple: true; value: T[]; onChange: (value: T[]) => void }
  | { multiple?: false; value: T | null; onChange: (value: T) => void }
);

/**
 * Selectable button group — the console's replacement for dropdown selects.
 */
export function OptionButtons<T extends string>(props: OptionButtonsProps<T>) {
  const { options, size = 'md', disabled = false, className = '', buttonClassName = '', layout = 'wrap', hideCheck = false, multiple } = props;

  const handleToggle = (optValue: T) => {
    if (multiple) {
      const { value, onChange } = props;
      if (value.includes(optValue)) {
        onChange(value.filter((v) => v !== optValue));
      } else {
        onChange([...value, optValue]);
      }
    } else {
      props.onChange(optValue);
    }
  };

  const containerClass = layout === 'grid' 
    ? `grid gap-2 ${className}`
    : `flex flex-wrap gap-3 ${className}`;

  return (
    <div className={containerClass}>
      {options.map((opt) => {
        const isActive = multiple ? props.value.includes(opt.value) : opt.value === props.value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            onClick={() => handleToggle(opt.value)}
            aria-pressed={isActive}
            title={opt.title}
            className={[
              'flex flex-1 justify-center items-center gap-2 rounded-xl border font-semibold transition-all duration-150 cursor-pointer',
              layout === 'wrap' ? 'min-w-[120px]' : 'min-w-0 w-full',
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95',
              buttonClassName,
            ].join(' ')}
            style={{
              background: isActive ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-surface)',
              borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className={layout === 'grid' ? "text-center whitespace-normal leading-tight break-words" : "text-left whitespace-nowrap overflow-hidden text-ellipsis"}>
              {opt.label}
              {opt.description && (
                <span className={`block text-[11px] font-normal opacity-80 ${layout === 'grid' ? 'whitespace-normal' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>{opt.description}</span>
              )}
            </span>
            {!hideCheck && <Check className={`shrink-0 ${size === 'sm' ? 'size-3' : 'size-3.5'} ${isActive ? 'opacity-100' : 'opacity-0 max-w-0 overflow-hidden'}`} />}
          </button>
        );
      })}
    </div>
  );
}
