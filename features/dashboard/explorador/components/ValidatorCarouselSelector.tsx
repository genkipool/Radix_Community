'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Check } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";

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
}

export function ValidatorCarouselSelector({
    options,
    selectedValues,
    onChange,
    className = '',
    placeholder = 'Buscar validadores...'
}: ValidatorCarouselSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const activeLabel = options[activeIndex]?.label || 'Validadores';

    const cycle = (direction: 'next' | 'prev') => {
        let nextIdx;
        if (direction === 'next') {
            nextIdx = (activeIndex + 1) % options.length;
        } else {
            nextIdx = (activeIndex - 1 + options.length) % options.length;
        }
        setActiveIndex(nextIdx);
    };

    const toggleCurrentActive = () => {
        const currentVal = options[activeIndex]?.value;
        if (!currentVal) return;
        toggleSelection(currentVal);
    };

    const toggleSelection = (val: string) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
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
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        opt.value.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`relative shrink-0 ${className}`} ref={containerRef}>
            <div className="flex items-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] shadow-sm overflow-hidden h-9 w-full">
                <button
                    type="button"
                    onClick={() => cycle('prev')}
                    className="p-2 w-10 flex items-center justify-center hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-r border-[var(--color-card-border)] shrink-0"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={toggleCurrentActive}
                    className={`flex-1 px-4 text-[13px] font-bold transition-colors text-center truncate ${selectedValues.includes(options[activeIndex]?.value) ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)] hover:text-[var(--color-primary)]'}`}
                    title="Pulsar para seleccionar/deseleccionar"
                >
                    {activeLabel}
                    {selectedValues.includes(options[activeIndex]?.value) && <Check className="inline-block size-3 ml-1 mb-0.5" />}
                </button>
                <button
                    type="button"
                    onClick={() => cycle('next')}
                    className="p-2 w-10 flex items-center justify-center hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-l border-[var(--color-card-border)] shrink-0"
                >
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); setSearchQuery(''); }}
                    className={`p-2 w-10 flex items-center justify-center transition-colors border-l border-[var(--color-card-border)] shrink-0 ${isOpen ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'}`}
                    title="Buscar validadores"
                >
                    <Search className="size-4" aria-hidden="true" />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
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
                            {filteredOptions.map(opt => {
                                const isSelected = selectedValues.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleSelection(opt.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        {isSelected && <Check className="size-3 shrink-0" />}
                                    </button>
                                );
                            })}
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
