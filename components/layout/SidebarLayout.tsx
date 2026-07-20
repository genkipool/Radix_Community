'use client';

import { ReactNode } from 'react';

interface SidebarLayoutProps {
    /** The top graphic/header part of the sidebar (e.g., SidebarGraphic) */
    header?: ReactNode;
    /** The search bar component */
    searchBar?: ReactNode;
    /** The control buttons (expand, collapse, view toggles) */
    controls?: ReactNode;
    /** The main scrollable content (cards, categories, etc.) */
    children: ReactNode;
    /** Optional height adjustment (e.g., to account for a header) */
    heightOffset?: number;
    /** Optional extra styles for the sidebar container */
    className?: string;
    /** Callback for when the header/graphic is clicked */
    onHeaderClick?: () => void;
    /** Accessibility label for the header area */
    headerAriaLabel?: string;
}

export default function SidebarLayout({
    header,
    searchBar,
    controls,
    children,
    heightOffset = 80,
    className = '',
    onHeaderClick,
    headerAriaLabel,
}: SidebarLayoutProps) {
    const sidebarInner = (
        <>
            {/* Sticky Header Section */}
            <div className="sticky top-0 z-20" style={{ background: 'var(--color-bg)' }}>
                {header && (
                    <button
                        type="button"
                        className="w-full relative overflow-hidden cursor-pointer active:scale-100 transition-transform duration-200 text-left"
                        onClick={onHeaderClick}
                        aria-label={headerAriaLabel}
                    >
                        {header}
                        <div
                            className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                            style={{ background: 'linear-gradient(to top, var(--color-bg), transparent)' }}
                        />
                    </button>
                )}

                {/* Search & Controls */}
                {(searchBar || controls) && (
                    <div className="px-5 pt-3 pb-3 space-y-3">
                        {searchBar && <div>{searchBar}</div>}
                        {controls && <div>{controls}</div>}
                    </div>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 px-5 pb-8">
                {children}
            </div>
        </>
    );

    return (
        <aside
            className={`hidden md:flex w-full md:w-96 flex-col border-r shrink-0 cursor-pointer ${className}`}
            style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-card-border)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor: 'pointer',
            }}
            onDragStart={e => e.preventDefault()}
        >
            {/* Desktop only: internal scroll + sticky. The sidebar is hidden
                entirely on mobile (the <aside> above is `hidden md:flex`). */}
            <div
                className={`flex flex-col overflow-y-auto md:sticky md:top-${heightOffset / 4}`}
                style={{ height: `calc(100vh - ${heightOffset}px)`, scrollbarWidth: 'none' }}
            >
                {sidebarInner}
            </div>
        </aside>
    );
}
