'use client';

import { Plus, X } from 'lucide-react';
import { FieldShell } from './fields';

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel: string;
  disabled?: boolean;
  error?: string;
}

/** Editable list of string values (claimed entities, websites, dApp definitions). */
export function StringListField({
  label,
  values,
  onChange,
  placeholder,
  addLabel,
  disabled,
  error,
}: StringListFieldProps) {
  return (
    <FieldShell label={label} error={error}>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
              className="flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-50"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label={`${label} — remove ${index + 1}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...values, ''])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus className="size-3.5" />
          {addLabel}
        </button>
      </div>
    </FieldShell>
  );
}
