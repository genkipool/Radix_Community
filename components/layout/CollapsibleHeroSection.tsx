'use client';

import { ReactNode } from 'react';
import { m } from "motion/react";

interface CollapsibleHeroSectionProps {
    /** When true both hero and grid slide up and disappear */
    collapsed: boolean;
    /** The ContentHero block */
    hero: ReactNode;
    /** The featured cards / grid block below the hero */
    grid: ReactNode;
    /** Extra class applied to the grid motion wrapper (default: centered full-width container) */
    gridClassName?: string;
}

/**
 * Wraps a hero + featured-cards layout with shared collapse/expand animations.
 * Used by FeaturedDocsHero and GamesHero to avoid duplicating motion props.
 */
export function CollapsibleHeroSection({
    collapsed,
    hero,
    grid,
    gridClassName = 'max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 w-full',
}: CollapsibleHeroSectionProps) {
    return (
        <m.div
            initial={false}
            animate={
                collapsed
                    ? { height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }
                    : { height: 'auto', opacity: 1, overflow: 'visible', pointerEvents: 'auto' }
            }
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="w-full flex flex-col"
        >
            {/* Hero header — Unified in a single motion container to stay static at the top */}
            <div className="w-full">
                {hero}
            </div>

            {/* Featured grid — Combined with hero to avoid relative shifts during collapse */}
            <div className={gridClassName} style={{ marginTop: 8, marginBottom: 48 }}>
                {grid}
            </div>
        </m.div>
    );
}
