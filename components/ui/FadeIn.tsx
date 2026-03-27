'use client';
import type { ReactNode } from 'react';
import { ScrollReveal } from './ScrollReveal';

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
    as?: 'div' | 'h2' | 'p' | 'span';
}

/**
 * Convenience wrapper around ScrollReveal for the most common animation:
 * fade-up (opacity 0 → 1, y 20 → 0).
 */
export function FadeIn({
    children,
    delay = 0,
    duration = 0.4,
    className = '',
    as = 'div',
}: FadeInProps) {
    return (
        <ScrollReveal from={{ opacity: 0, y: 20 }} delay={delay} duration={duration} className={className} as={as}>
            {children}
        </ScrollReveal>
    );
}
