'use client';

import { ChevronsUpDown } from 'lucide-react';
import { AutoCollapseToggle } from './AutoCollapseToggle';

// SVG icons (no emojis)
const GridViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

const ListViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor"/>
    <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor"/>
    <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/>
  </svg>
);

const TheaterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {/* Cinema screen */}
    <rect x="1" y="2" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    {/* Film strip holes */}
    <circle cx="3" cy="4" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="11" cy="4" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="3" cy="8" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="11" cy="8" r="0.7" fill="currentColor" opacity="0.6"/>
    {/* Play triangle */}
    <path d="M5.5 4.8L8.8 7L5.5 9.2V4.8Z" fill="currentColor"/>
    {/* Seat row */}
    <path d="M2 12.5h2.5M5.5 12.5H8M9 12.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const ExitTheaterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {/* Cinema screen (filled to show active) */}
    <rect x="1" y="2" width="12" height="8" rx="1.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.3"/>
    {/* Film strip holes */}
    <circle cx="3" cy="4" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="11" cy="4" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="3" cy="8" r="0.7" fill="currentColor" opacity="0.6"/>
    <circle cx="11" cy="8" r="0.7" fill="currentColor" opacity="0.6"/>
    {/* X icon (exit) */}
    <path d="M5.2 4.8L8.8 8.4M8.8 4.8L5.2 8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Seat row */}
    <path d="M2 12.5h2.5M5.5 12.5H8M9 12.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

interface SidebarControlsProps {
    hasAnyExpanded: boolean;
    autoCollapse: boolean;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onAutoCollapseChange: (v: boolean) => void;
    collapseAllLabel?: string;
    expandAllLabel?: string;
    autoCollapseActiveTitle?: string;
    autoCollapseInactiveTitle?: string;
    // New
    gridView?: boolean;
    onGridViewToggle?: () => void;
    gridViewTitle?: string;
    theaterMode?: boolean;
    onTheaterModeToggle?: () => void;
    theaterModeTitle?: string;
}

export function SidebarControls({
    hasAnyExpanded,
    autoCollapse,
    onExpandAll,
    onCollapseAll,
    onAutoCollapseChange,
    collapseAllLabel = 'Collapse all',
    expandAllLabel = 'Expand all',
    autoCollapseActiveTitle = 'Auto-collapse on',
    autoCollapseInactiveTitle = 'Auto-collapse off',
    gridView = false,
    onGridViewToggle,
    gridViewTitle = 'Grid view',
    theaterMode = false,
    onTheaterModeToggle,
    theaterModeTitle = 'Theater mode',
}: SidebarControlsProps) {
    const iconBtnStyle = (active: boolean) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '32px', height: '32px', borderRadius: '8px',
        background: active ? 'var(--color-primary)' : 'var(--color-surface)',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
        color: active ? 'var(--color-bg)' : 'var(--color-text-muted)',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease',
    } as React.CSSProperties);

    return (
        <div className="flex items-center gap-2">
            {/* Expand/Collapse all */}
            <button
                onClick={hasAnyExpanded ? onCollapseAll : onExpandAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex-1"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-card-border)'; }}
                title={hasAnyExpanded ? collapseAllLabel : expandAllLabel}
            >
                <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" />
                <span>{hasAnyExpanded ? collapseAllLabel : expandAllLabel}</span>
            </button>

            <AutoCollapseToggle
                autoCollapse={autoCollapse}
                onToggle={onAutoCollapseChange}
                activeTitle={autoCollapseActiveTitle}
                inactiveTitle={autoCollapseInactiveTitle}
            />

            {/* Grid view toggle */}
            {onGridViewToggle && (
                <button
                    onClick={onGridViewToggle}
                    style={iconBtnStyle(gridView)}
                    title={gridViewTitle}
                >
                    {gridView ? <ListViewIcon /> : <GridViewIcon />}
                </button>
            )}

            {/* Theater mode */}
            {onTheaterModeToggle && (
                <button
                    onClick={onTheaterModeToggle}
                    style={iconBtnStyle(theaterMode)}
                    title={theaterModeTitle}
                >
                    {theaterMode ? <ExitTheaterIcon /> : <TheaterIcon />}
                </button>
            )}
        </div>
    );
}
