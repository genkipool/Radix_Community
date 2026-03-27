'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface ScrollRevealProps {
    children: React.ReactNode;
    /** Starting (hidden) state. Defaults to { opacity: 0, y: 20 }. */
    from?: Record<string, number>;
    delay?: number;
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
    as?: 'div' | 'section' | 'h2' | 'p' | 'span';
    /** IntersectionObserver threshold. Default 0.1 */
    threshold?: number;
}

/**
 * Derives the "visible" (final) state from a "from" (hidden) state.
 * opacity → 1, scale → 1, everything else (x, y) → 0.
 */
function deriveTarget(from: Record<string, number>): Record<string, number> {
    const to: Record<string, number> = {};
    for (const key of Object.keys(from)) {
        to[key] = key === 'opacity' || key === 'scale' ? 1 : 0;
    }
    return to;
}

/**
 * Scroll-triggered animation wrapper.
 *
 * - Elements **visible on mount** render instantly (no animation).
 * - Elements **below the fold** animate in when the user scrolls to them.
 * - Works on every page load — no localStorage gate.
 * - Does NOT animate on page load, reload, or client-side navigation.
 */
export function ScrollReveal({
    children,
    from = { opacity: 0, y: 20 },
    delay = 0,
    duration = 0.4,
    className = '',
    style,
    as = 'div',
    threshold = 0.1,
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [animState, setAnimState] = useState<'visible' | 'waiting' | 'entering'>('visible');

    useEffect(() => {
        const el = ref.current as HTMLElement | null;
        if (!el) return;

        // If element is already in viewport on mount → keep visible, skip animation
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
            setAnimState('visible');
            return;
        }

        // Below fold: hide (in the same paint frame) → observe for scroll
        const raf = requestAnimationFrame(() => {
            setAnimState('waiting');

            const io = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setAnimState('entering');
                        io.disconnect();
                    }
                },
                { threshold, rootMargin: '-40px 0px 0px 0px' },
            );
            io.observe(el);
        });

        return () => cancelAnimationFrame(raf);
    }, [threshold]);

    const Tag = motion[as] as typeof motion.div;
    const to = deriveTarget(from);

    const animate =
        animState === 'visible' ? to
            : animState === 'waiting' ? from
                : to;

    const transition =
        animState === 'waiting'
            ? { duration: 0 }
            : { delay, duration, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

    return (
        <Tag
            ref={ref}
            initial={to}
            animate={animate}
            transition={transition}
            className={className}
            style={style}
        >
            {children}
        </Tag>
    );
}
