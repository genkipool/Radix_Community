'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";

export interface CarouselFilterOption {
    value: string | null;
    label: string;
}

interface CarouselFilterProps {
    options: CarouselFilterOption[];
    activeValue: string | null;
    onChange: (value: string | null) => void;
    className?: string;
    placeholder?: string;
}

export function CarouselFilter({
    options,
    activeValue,
    onChange,
    className = '',
    placeholder = 'Buscar...'
}: CarouselFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const currentIndex = options.findIndex(opt => opt.value === activeValue);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const activeLabel = options[safeIndex]?.label || '';

    const cycle = (direction: 'next' | 'prev') => {
        let nextIdx;
        if (direction === 'next') {
            nextIdx = (safeIndex + 1) % options.length;
        } else {
            nextIdx = (safeIndex - 1 + options.length) % options.length;
        }
        onChange(options[nextIdx].value);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`relative shrink-0 ${className}`} ref={containerRef}>
            <div className="flex items-center overflow-hidden h-9 w-full">
                <button
                    type="button"
                    onClick={() => cycle('prev')}
                    className="p-2 w-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors shrink-0 rounded-l-full"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); setSearchQuery(''); }}
                    className={`flex-1 px-4 text-[13px] font-bold transition-colors text-center truncate ${isOpen ? 'text-[var(--color-primary)]' : activeValue ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}
                >
                    {activeLabel}
                </button>
                <button
                    type="button"
                    onClick={() => cycle('next')}
                    className="p-2 w-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors shrink-0 rounded-r-full"
                >
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder={placeholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filteredOptions.map(opt => (
                                <button
                                    key={opt.value ?? 'all'}
                                    type="button"
                                    onClick={() => {
                                        if (activeValue === opt.value) {
                                            onChange(null);
                                        } else {
                                            onChange(opt.value);
                                        }
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${activeValue === opt.value ? 'bg-[var(--color-primary)] text-white font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            {filteredOptions.length === 0 && (
                                <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                                    No se encontraron resultados
                                </div>
                            )}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
