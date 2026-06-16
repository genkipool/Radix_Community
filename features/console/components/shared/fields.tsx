'use client';

import { ReactNode } from 'react';

/* ─── Field shell (label + control + hint/error) ──────────────────────────── */

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Element rendered to the right of the label (e.g. a lock toggle) */
  labelEnd?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, labelEnd, children, className = '' }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || labelEnd) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </span>
          )}
          {labelEnd}
        </div>
      )}
      <div className="relative flex flex-col">
        {children}
        <div className="absolute top-full left-0 mt-1 w-full">
          {error ? (
            <p className="text-[11px] leading-tight font-medium text-red-500">{error}</p>
          ) : hint ? (
            <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const controlClass =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors ' +
  'focus:border-[var(--color-primary)] disabled:opacity-50';

const controlStyle = {
  background: 'var(--color-surface)',
  borderColor: 'var(--color-card-border)',
  color: 'var(--color-text-main)',
} as const;

/* ─── Text input ──────────────────────────────────────────────────────────── */

interface TextFieldProps extends Omit<FieldShellProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'number';
  trailing?: ReactNode;
  id?: string;
  maxLength?: number;
}

export function TextField({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
  trailing,
  id,
  maxLength,
  ...shell
}: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} ${trailing ? 'pr-16' : ''} ${shell.error ? '!border-red-500' : ''}`}
          style={{ ...controlStyle, ...(shell.error ? { borderColor: '#ef4444' } : {}) }}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
    </FieldShell>
  );
}

/* ─── Textarea ────────────────────────────────────────────────────────────── */

interface TextAreaFieldProps extends Omit<FieldShellProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  mono?: boolean;
  id?: string;
  maxLength?: number;
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  mono = false,
  id,
  maxLength,
  ...shell
}: TextAreaFieldProps) {
  return (
    <FieldShell {...shell}>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} resize-y leading-relaxed ${mono ? 'font-mono text-xs' : ''} ${shell.error ? '!border-red-500' : ''}`}
          style={{ ...controlStyle, ...(shell.error ? { borderColor: '#ef4444' } : {}) }}
        />
        {maxLength && (
          <div className="absolute bottom-3 right-3 text-[10px] pointer-events-none opacity-50" style={{ color: 'var(--color-text-main)' }}>
            {value.length}/{maxLength}
          </div>
        )}
      </div>
    </FieldShell>
  );
}

/* ─── Native select (only for long dynamic lists) ─────────────────────────── */

interface SelectFieldProps extends Omit<FieldShellProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  ...shell
}: SelectFieldProps) {
  return (
    <FieldShell {...shell}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} cursor-pointer appearance-none`}
        style={controlStyle}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
