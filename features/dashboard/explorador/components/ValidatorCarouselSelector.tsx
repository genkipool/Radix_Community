'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Landmark } from 'lucide-react';
import { AnimatePresence } from "motion/react";
import { SelectPopup, SelectPopupEmpty, SelectPopupRow, selectedFirst } from '@/components/ui/SelectPopup';
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
    // Until the arrows are used it shows the first selected validator, so a
    // selection made elsewhere (a link, the popup) is what the bar reads.
    const [cycledIndex, setCycledIndex] = useState<number | null>(null);
    const activeIndex = cycledIndex ?? Math.max(0, options.findIndex(o => selectedValues.includes(o.value)));
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
        setCycledIndex(nextIdx);
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


    const filteredOptions = selectedFirst(
        options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.value.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        initialSelectedValues,
        opt => opt.value,
    );

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
                    <SelectPopup
                        title={headerTitle || 'Seleccionar validador'}
                        onClose={() => setIsOpen(false)}
                        closeLabel="Cerrar"
                        search={{
                            value: searchQuery,
                            onChange: setSearchQuery,
                            placeholder: placeholder || (tt?.account_summary?.search_validators_placeholder || 'Search validators...'),
                        }}
                        footer={{
                            label: footerActionText || 'Añadir',
                            onClick: () => {
                                onChange(tempValues);
                                if (onFooterAction) onFooterAction();
                                else setIsOpen(false);
                            },
                        }}
                        listClassName="max-h-60"
                        direction={popupDirection}
                        className={`absolute left-0 right-0 ${popupDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-full z-50`}
                    >
                        {filteredOptions.map(opt => (
                            <SelectPopupRow
                                key={opt.value}
                                selected={tempValues.includes(opt.value)}
                                onClick={() => toggleSelection(opt.value)}
                                title={opt.value}
                                icon={
                                    <span className="size-4 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                                        {opt.iconUrl ? (
                                            <SafeImage src={opt.iconUrl} alt={opt.label} fallbackName={opt.label} className="w-full h-full object-cover" />
                                        ) : (
                                            <Landmark className="size-2.5 text-[var(--color-text-muted)]" />
                                        )}
                                    </span>
                                }
                                label={opt.label}
                            />
                        ))}
                        {filteredOptions.length === 0 && (
                            <SelectPopupEmpty>{tt?.account_summary?.no_results || 'No results found'}</SelectPopupEmpty>
                        )}
                    </SelectPopup>
                )}
            </AnimatePresence>
        </div>
    );
}
