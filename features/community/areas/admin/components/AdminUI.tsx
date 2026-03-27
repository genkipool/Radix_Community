'use client';

import { ChevronDown, AlertCircle } from 'lucide-react';

export const inputStyle = {
    background: 'var(--color-surface)',
    color: 'var(--color-text-main)',
    border: '1px solid var(--color-card-border)',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
} as const;

export function AdminFormField({ label, required, error, children, hint }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}>
                {label}{required && <span className="ml-1" style={{ color: '#ef4444' }}>*</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
            )}
            {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#ef4444' }}>
                    <AlertCircle className="w-3 h-3" />{error}
                </p>
            )}
        </div>
    );
}

export function AdminSelectInput({ value, onChange, children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                className={className}
                style={{ ...inputStyle, appearance: 'none', paddingRight: '2.5rem' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-card-border)'; }}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }} />
        </div>
    );
}

export function AdminTextInput({ prefix, className = '', ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { prefix?: React.ReactNode }) {
    return (
        <div className="relative">
            {prefix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--color-text-muted)' }}>{prefix}</span>
            )}
            <input
                className={className}
                style={{ ...inputStyle, paddingLeft: prefix ? '2.5rem' : '14px' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-card-border)'; }}
                {...props}
            />
        </div>
    );
}

export function AdminTextArea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            className={className}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-card-border)'; }}
            {...props}
        />
    );
}
