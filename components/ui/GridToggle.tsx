'use client';
import React from 'react';
import { Rows3, Grid2x2, Grid3x3 } from 'lucide-react';

const Grid4x3Icon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M3 15h18" />
        <path d="M7.5 3v18" />
        <path d="M12 3v18" />
        <path d="M16.5 3v18" />
    </svg>
);

interface GridToggleProps {
    columns: number;
    onChange: (cols: number) => void;
    label?: string;
    min?: number;
    max?: number;
}

/**
 * Reusable component to toggle between columns with optional constraints.
 */
export function GridToggle({ columns, onChange, label, min = 1, max = 8 }: GridToggleProps) {
    const increment = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = columns >= max ? min : columns + 1;
        onChange(next);
    };

    const decrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = columns <= min ? max : columns - 1;
        onChange(next);
    };

    const renderIcon = () => {
        switch (columns) {
            case 1: return <Rows3 className="w-4 h-4" />;
            case 2: return <Grid2x2 className="w-4 h-4" />;
            case 3: return <Grid3x3 className="w-4 h-4" />;
            case 4: return <Grid4x3Icon className="w-4 h-4" />;
            default: return <Grid4x3Icon className="w-4 h-4" />;
        }
    };

    // Derived states for mobile
    const isMobileGrid1 = columns < 4;
    const mobileToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(isMobileGrid1 ? 4 : 3);
    };

    return (
        <>
            {/* Desktop variant */}
            <div 
                className="hidden sm:flex items-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-sm hover:border-[var(--color-primary)]/40 transition-all overflow-hidden group/grid"
                title={`${columns} ${label || 'columns'}`}
            >
                <div 
                    onClick={decrement}
                    role="button"
                    aria-label="Previous grid layout"
                    className="pl-3 pr-1.5 py-2 cursor-pointer hover:text-[var(--color-primary)] transition-colors"
                >
                    {renderIcon()}
                </div>
                <div 
                    onClick={increment}
                    role="button"
                    aria-label="Next grid layout"
                    className="pl-1.5 pr-3 py-2 cursor-pointer border-l border-[var(--color-card-border)]/30 hover:text-[var(--color-primary)] transition-colors"
                >
                    <span className="text-xs font-black w-3 text-center block">{columns}</span>
                </div>
            </div>

            {/* Mobile variant */}
            <div 
                className="flex sm:hidden items-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-sm hover:border-[var(--color-primary)]/40 transition-all overflow-hidden cursor-pointer"
                onClick={mobileToggle}
                title={`Mobile Grid ${isMobileGrid1 ? 1 : 2}`}
            >
                <div className="pl-3 pr-1.5 py-2">
                    {isMobileGrid1 ? <Rows3 className="w-4 h-4" /> : <Grid2x2 className="w-4 h-4" />}
                </div>
                <div className="pl-1.5 pr-3 py-2 border-l border-[var(--color-card-border)]/30">
                    <span className="text-xs font-black w-3 text-center block">{isMobileGrid1 ? 1 : 2}</span>
                </div>
            </div>
        </>
    );
}
