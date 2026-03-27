'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    debounceMs?: number;
    /**
     * 'default' — full-width hero search bar (used in Blog, Forum, Dashboard)
     * 'sidebar' — compact inline variant (used inside sidebar panels)
     */
    variant?: 'default' | 'sidebar';
    className?: string;
}

export function SearchBar({
    value,
    onChange,
    placeholder,
    debounceMs = 150,
    variant = 'default',
    className = '',
}: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { setLocalValue(value); }, [value]);

    const handleChange = (v: string) => {
        setLocalValue(v);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onChange(v), debounceMs);
    };

    const handleClear = () => {
        setLocalValue('');
        clearTimeout(timerRef.current);
        onChange('');
    };

    useEffect(() => () => clearTimeout(timerRef.current), []);

    /* ── Sidebar variant ── */
    if (variant === 'sidebar') {
        return (
            <div className={`relative ${className}`}>
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                    type="text"
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm focus:outline-none transition-all font-medium"
                    style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-card-border)',
                        color: 'var(--color-text-main)',
                    }}
                    placeholder={placeholder}
                    value={localValue}
                    onChange={e => handleChange(e.target.value)}
                />
                {localValue && (
                    <button
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-text-muted)' }}
                        aria-label="Clear search"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
        );
    }

    /* ── Default (hero) variant ── */
    return (
        <div className={`flex justify-center flex-col items-center ${className}`}>
            <div className="relative w-full max-w-3xl group">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-accent)]/5 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-0 transition-opacity duration-500" />
                <div className="relative flex items-center px-6 bg-[var(--color-surface)]/80 backdrop-blur-xl border border-[var(--color-card-border)] rounded-2xl shadow-sm transition-all duration-300">
                    <Search className="w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" />
                    <input
                        type="text"
                        value={localValue}
                        onChange={e => handleChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 md:py-4 bg-transparent border-none text-base focus:outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text-main)]"
                    />
                    {localValue && (
                        <button
                            onClick={handleClear}
                            className="mr-5 p-2 rounded-full hover:bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
