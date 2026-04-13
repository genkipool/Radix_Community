'use client';
import React from 'react';
import { Rows3, Grid2x2, Grid3x3, Columns4 } from 'lucide-react';

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

    const Icon = () => {
        switch (columns) {
            case 1: return <Rows3 className="w-4 h-4" />;
            case 2: return <Grid2x2 className="w-4 h-4" />;
            case 3: return <Grid3x3 className="w-4 h-4" />;
            case 4: return <Columns4 className="w-4 h-4" />;
            default: return <Grid3x3 className="w-4 h-4" />;
        }
    };

    return (
        <div 
            className="flex items-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-sm hover:border-[var(--color-primary)]/40 transition-all overflow-hidden group/grid"
            title={`${columns} ${label || 'columns'}`}
        >
            <div 
                onClick={decrement}
                role="button"
                aria-label="Previous grid layout"
                className="pl-3 pr-1.5 py-2 cursor-pointer hover:text-[var(--color-primary)] transition-colors"
            >
                <Icon />
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
    );
}
