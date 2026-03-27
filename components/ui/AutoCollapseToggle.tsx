'use client';

import React from 'react';
import { Magnet } from 'lucide-react';

interface AutoCollapseToggleProps {
    autoCollapse: boolean;
    onToggle: (v: boolean) => void;
    activeTitle?: string;
    inactiveTitle?: string;
    className?: string;
    size?: 'sm' | 'md';
}

export function AutoCollapseToggle({
    autoCollapse,
    onToggle,
    activeTitle = 'Auto-collapse on',
    inactiveTitle = 'Auto-collapse off',
    className = '',
    size = 'md',
}: AutoCollapseToggleProps) {
    const isMd = size === 'md';
    
    const style: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isMd ? '32px' : '28px',
        height: isMd ? '32px' : '28px',
        borderRadius: '8px',
        background: autoCollapse ? 'var(--color-primary)' : 'var(--color-surface)',
        border: `1px solid ${autoCollapse ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
        color: autoCollapse ? 'var(--color-bg)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 0.15s ease',
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggle(!autoCollapse);
            }}
            style={style}
            className={className}
            title={autoCollapse ? activeTitle : inactiveTitle}
            aria-pressed={autoCollapse}
        >
            <Magnet className={isMd ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </button>
    );
}
