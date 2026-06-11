'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Check, X, Landmark } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { SafeImage } from '@/components/ui/SafeImage';
import type { TranslationsT } from '@/features/dashboard/types';

export interface ValidatorOption {
    value: string;
    label: string;
    iconUrl?: string;
}

interface ValidatorCarouselSelectorProps {
    options: ValidatorOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    className?: string;
    placeholder?: string;
    locale?: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    headerTitle?: string;
    footerActionText?: string;
    onFooterAction?: () => void;
}

export function ValidatorCarouselSelector({
    options,
    selectedValues,
    onChange,
    className = '',
    placeholder,
    locale: _locale,
    tt,
    headerTitle,
    footerActionText,
    onFooterAction
}: ValidatorCarouselSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [popupDirection, setPopupDirection] = useState<'down' | 'up'>('down');
    const [tempValues, setTempValues] = useState<string[]>(selectedValues);

    const activeLabel = options[activeIndex]?.label || (tt?.account_summary?.validators_label || 'Validators');

    const cycle = (direction: 'next' | 'prev') => {
        let nextIdx;
        if (direction === 'next') {
            nextIdx = (activeIndex + 1) % options.length;
        } else {
            nextIdx = (activeIndex - 1 + options.length) % options.length;
        }
        setActiveIndex(nextIdx);
    };

    const toggleSelection = (val: string) => {
        if (tempValues.includes(val)) {
            setTempValues(tempValues.filter(v => v !== val));
        } else {
            setTempValues([...tempValues, val]);
        }
    };

    const [initialSelectedValues, setInitialSelectedValues] = useState<string[]>([]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const filteredOptions = [...options]
        .filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
            opt.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const aSelected = initialSelectedValues.includes(a.value);
            const bSelected = initialSelectedValues.includes(b.value);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
        });

    return (
        <div className={`relative shrink-0 ${className}`} ref={containerRef}>
            <div className="flex items-center overflow-hidden h-9 w-full">
                <button
                    type="button"
                    onClick={() => cycle('prev')}
                    aria-label="Anterior"
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
                            setInitialSelectedValues(selectedValues);
                            setTempValues(selectedValues);
                        }
                        setIsOpen(nextIsOpen);
                        setSearchQuery('');
                        if (nextIsOpen && containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceAbove = rect.top;
                            if (spaceBelow < 350 && spaceAbove > spaceBelow) {
                                setPopupDirection('up');
                            } else {
                                setPopupDirection('down');
                            }
                        }
                    }}
                    className={`flex-1 px-4 text-[13px] font-bold transition-colors text-center truncate ${isOpen ? 'text-[var(--color-primary)]' : selectedValues.includes(options[activeIndex]?.value) ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}
                >
                    {activeLabel}
                    {selectedValues.includes(options[activeIndex]?.value) && <Check className="inline-block size-3 ml-1 mb-0.5" />}
                </button>
                <button
                    type="button"
                    onClick={() => cycle('next')}
                    aria-label="Siguiente"
                    className="p-2 w-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors shrink-0 rounded-r-full"
                >
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        initial={{ opacity: 0, y: popupDirection === 'up' ? -8 : 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: popupDirection === 'up' ? -8 : 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute left-0 right-0 ${popupDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-full rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden`}
                    >
                        <div className="flex items-center justify-between p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/80">
                            <span className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider leading-none">
                                {headerTitle || 'Seleccionar validador'}
                            </span>
                            <button 
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Cerrar"
                                className="size-6 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-colors"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    aria-label="Buscar validadores"
                                    placeholder={placeholder || (tt?.account_summary?.search_validators_placeholder || 'Search validators...')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filteredOptions.map(opt => {
                                const isSelected = tempValues.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleSelection(opt.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="size-4 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                                                {opt.iconUrl ? (
                                                    <SafeImage src={opt.iconUrl} alt={opt.label} fallbackName={opt.label} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Landmark className="size-2.5 text-[var(--color-text-muted)]" />
                                                )}
                                            </div>
                                            <span className="truncate">{opt.label}</span>
                                        </div>
                                        {isSelected && <Check className="size-3 shrink-0" />}
                                    </button>
                                );
                            })}
                            {filteredOptions.length === 0 && (
                                <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                                    {tt?.account_summary?.no_results || 'No results found'}
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(tempValues);
                                    if (onFooterAction) onFooterAction();
                                    else setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-center py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-colors"
                            >
                                {footerActionText || 'Añadir'}
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
