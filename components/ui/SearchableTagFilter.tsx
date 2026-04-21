'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchableTagFilterProps {
    tags: string[];
    activeTag: string | null;
    onSelect: (tag: string | null) => void;
    allLabel: string;
    tagLabels?: Record<string, string>;
    placeholder?: string;
    className?: string;
    hideAll?: boolean;
    width?: string;
}

export function SearchableTagFilter({
    tags,
    activeTag,
    onSelect,
    allLabel,
    tagLabels,
    placeholder = 'Search tags...',
    className = '',
    hideAll = false,
    width = 'w-[280px]',
}: SearchableTagFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const getLabel = (tag: string) => tagLabels?.[tag] || tag;

    const cycle = (direction: 'next' | 'prev') => {
        const allOptions = hideAll ? tags : [null, ...tags];
        let nextIdx;

        if (activeTag === null) {
            nextIdx = direction === 'next' ? 0 : allOptions.length - 1;
        } else {
            const currentIdx = allOptions.indexOf(activeTag);
            nextIdx = direction === 'next'
                ? (currentIdx + 1) % allOptions.length
                : (currentIdx - 1 + allOptions.length) % allOptions.length;
        }
        
        onSelect(allOptions[nextIdx]);
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

    const filteredTags = tags.filter(t =>
        getLabel(t).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`relative ${width} shrink-0 ${className}`} ref={containerRef}>
            <div className="flex items-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] shadow-sm overflow-hidden h-9 w-full">
                {/* Prev */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cycle('prev'); }}
                    className="p-2 w-10 flex items-center justify-center hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-r border-[var(--color-card-border)] shrink-0"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Main Label/Toggle */}
                <button
                    type="button"
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (activeTag) {
                            onSelect(null);
                        } else {
                            onSelect(tags[0]);
                        }
                    }}
                    className={`flex-1 px-4 text-[13px] font-bold transition-colors text-center truncate ${activeTag ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)] transition-colors'}`}
                >
                    {activeTag ? getLabel(activeTag) : allLabel}
                </button>

                {/* Next */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cycle('next'); }}
                    className="p-2 w-10 flex items-center justify-center hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-l border-[var(--color-card-border)] shrink-0"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* Search Toggle */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); setSearchQuery(''); }}
                    className={`p-2 w-10 flex items-center justify-center transition-colors border-l border-[var(--color-card-border)] shrink-0 ${isOpen ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]'}`}
                    title={placeholder}
                >
                    <Search className="w-4 h-4" />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                <input
                                    id="tag-filter-input"
                                    name="tag-filter"
                                    type="text"
                                    autoFocus
                                    placeholder={placeholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {!hideAll && (
                                <button
                                    type="button"
                                    onClick={() => { onSelect(null); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${activeTag === null ? 'bg-[var(--color-primary)] text-white font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                >
                                    {allLabel}
                                </button>
                            )}
                            {filteredTags.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => { onSelect(tag); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${activeTag === tag ? 'bg-[var(--color-primary)] text-white font-bold' : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'}`}
                                >
                                    {getLabel(tag)}
                                </button>
                            ))}
                            {filteredTags.length === 0 && (
                                <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                                    No tags found
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
