'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence } from "motion/react";
import { useLanguage } from '@/context/LanguageContext';
import { SelectPopup, SelectPopupEmpty, SelectPopupRow, selectedFirst } from './SelectPopup';

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

const EMPTY_VALUES: string[] = [];

export function CarouselFilter({
    options,
    activeValues = EMPTY_VALUES,
    onChange,
    className = '',
    placeholder: placeholderProp,
    title: titleProp,
    filterText: filterTextProp,
    multiSelectLabel: multiSelectLabelProp,
    isRelative = true
}: CarouselFilterProps) {
    const { t } = useLanguage();
    const ui = t.ui;
    // The address filter is what it is used for; the dictionary gives its words.
    const title = titleProp ?? t.nav.filter_addresses;
    const filterText = filterTextProp ?? t.nav.filter;
    const multiSelectLabel = multiSelectLabelProp ?? t.nav.selected;
    const placeholder = placeholderProp ?? ui.search;
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tempValues, setTempValues] = useState<string[]>(activeValues);
    const containerRef = useRef<HTMLDivElement>(null);

    // tempValues are synced when the popup is opened.

    let activeLabel = '';
    if (activeValues.length === 0) {
        if (options.length === 1 && options[0].value !== null) {
            activeLabel = options[0].label;
        } else if (options.length === 0) {
            activeLabel = placeholder;
        } else {
            activeLabel = options.find(o => o.value === null)?.label || ui.all;
        }
    } else if (activeValues.length === 1) {
        const foundOption = options.find(o => o.value === activeValues[0]);
        if (foundOption) {
            activeLabel = foundOption.label;
        } else if (options.length === 1 && options[0].value !== null) {
            activeLabel = options[0].label;
        } else if (options.length === 0) {
            activeLabel = placeholder;
        } else {
            activeLabel = options.find(o => o.value === null)?.label || ui.all;
        }
    } else {
        const firstOption = options.find(o => o.value === activeValues[0]);
        activeLabel = firstOption ? firstOption.label : `${activeValues.length} ${multiSelectLabel}`;
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

    // "All" stays on top, then what was applied when the popup opened.
    const allOption = options.filter(o => o.value === null);
    const sortedOptions = [...allOption, ...selectedFirst(options.filter(o => o.value !== null), activeValues, o => o.value)];

    const filteredOptions = sortedOptions.filter(opt =>
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
                    <SelectPopup
                        title={title}
                        onClose={() => setIsOpen(false)}
                        closeLabel={ui.close}
                        search={{ value: searchQuery, onChange: setSearchQuery, placeholder }}
                        footer={{ label: filterText, onClick: handleFilter }}
                        listClassName="max-h-60"
                        className="absolute left-0 right-0 top-full mt-2 w-full z-50"
                    >
                        {filteredOptions.map(opt => (
                            <SelectPopupRow
                                key={opt.value ?? 'all'}
                                selected={opt.value === null ? tempValues.length === 0 : tempValues.includes(opt.value)}
                                onClick={() => toggleOption(opt.value)}
                                label={opt.label}
                            />
                        ))}
                        {filteredOptions.length === 0 && <SelectPopupEmpty>{ui.no_results}</SelectPopupEmpty>}
                    </SelectPopup>
                )}
            </AnimatePresence>
        </div>
    );
}
