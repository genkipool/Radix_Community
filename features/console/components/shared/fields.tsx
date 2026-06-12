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
    <div className={`flex flex-col gap-4 ${className}`}>
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
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
      ) : null}
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
}

export function TextField({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
  trailing,
  id,
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
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} ${trailing ? 'pr-16' : ''}`}
          style={controlStyle}
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
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  mono = false,
  id,
  ...shell
}: TextAreaFieldProps) {
  return (
    <FieldShell {...shell}>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} resize-y leading-relaxed ${mono ? 'font-mono text-xs' : ''}`}
        style={controlStyle}
      />
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
