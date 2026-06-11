'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, X, Check } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";

export interface CarouselFilterOption {
    value: string | null;
    label: string;
}

interface CarouselFilterProps {
    options: CarouselFilterOption[];
    activeValues?: string[];
    onChange?: (values: string[]) => void;
    className?: string;
    placeholder?: string;
    title?: string;
    filterText?: string;
    multiSelectLabel?: string;
    isRelative?: boolean;
}

export function CarouselFilter({
    options,
    activeValues = [],
    onChange,
    className = '',
    placeholder = 'Buscar...',
    title = 'Filtrar direcciones',
    filterText = 'Filtrar',
    multiSelectLabel = 'seleccionadas',
    isRelative = true
}: CarouselFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tempValues, setTempValues] = useState<string[]>(activeValues);
    const containerRef = useRef<HTMLDivElement>(null);

    // tempValues are synced when the popup is opened.

    let activeLabel = '';
    if (activeValues.length === 0) {
        activeLabel = options.find(o => o.value === null)?.label || 'Todas';
    } else if (activeValues.length === 1) {
        activeLabel = options.find(o => o.value === activeValues[0])?.label || '1';
    } else {
        activeLabel = `${activeValues.length} ${multiSelectLabel}`;
    }

    const cycle = (direction: 'next' | 'prev') => {
        // If multiple are selected, cycling doesn't make much sense, but we can cycle the "first" selected item or just clear.
        // Let's treat cycle as cycling through single options and clearing multi-select.
        const currentSingleIndex = activeValues.length === 1 ? options.findIndex(opt => opt.value === activeValues[0]) : 0;
        const safeIndex = currentSingleIndex === -1 ? 0 : currentSingleIndex;
        let nextIdx;
        if (direction === 'next') {
            nextIdx = (safeIndex + 1) % options.length;
        } else {
            nextIdx = (safeIndex - 1 + options.length) % options.length;
        }
        const nextVal = options[nextIdx].value;
        if (onChange) {
            onChange(nextVal ? [nextVal] : []);
        }
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

    const toggleOption = (val: string | null) => {
        if (val === null) {
            setTempValues([]);
        } else {
            if (tempValues.includes(val)) {
                setTempValues(tempValues.filter(v => v !== val));
            } else {
                setTempValues([...tempValues, val]);
            }
        }
    };

    const handleFilter = () => {
        if (onChange) {
            onChange(tempValues);
        }
        setIsOpen(false);
    };

    return (
        <div className={`${isRelative ? 'relative' : ''} shrink-0 ${className}`} ref={containerRef}>
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
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        const nextIsOpen = !isOpen;
                        if (nextIsOpen) {
                            setTempValues(activeValues);
                        }
                        setIsOpen(nextIsOpen); 
                        setSearchQuery(''); 
                    }}
                    className={`flex-1 px-4 text-[13px] font-bold transition-colors text-center truncate ${isOpen || activeValues.length > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}
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
                        className="absolute left-0 right-0 top-full mt-2 w-full rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50 flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider">{title}</span>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-colors shrink-0 ml-2"
                                title="Cerrar"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder={placeholder}
                                    aria-label={placeholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filteredOptions.map(opt => {
                                const isSelected = opt.value === null ? tempValues.length === 0 : tempValues.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value ?? 'all'}
                                        type="button"
                                        onClick={() => toggleOption(opt.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group ${isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                    >
                                        <span className={`truncate ${isSelected ? '' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{opt.label}</span>
                                        {isSelected && <Check className="size-4 shrink-0 ml-2" strokeWidth={2} />}
                                    </button>
                                );
                            })}
                            {filteredOptions.length === 0 && (
                                <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                                    No se encontraron resultados
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <button
                                type="button"
                                onClick={handleFilter}
                                className="w-full flex items-center justify-center py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-colors"
                            >
                                {filterText}
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
