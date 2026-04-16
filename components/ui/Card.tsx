'use client';
import type { ReactNode } from 'react';
import { type HTMLMotionProps, motion } from 'motion/react';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children?: ReactNode;
    hoverEffect?: boolean;
    innerClassName?: string;
}

export function Card({ children, className = '', innerClassName = '', hoverEffect = true, ...props }: CardProps) {
    return (
        <motion.div
            whileHover={hoverEffect ? { boxShadow: '0 10px 30px rgba(0,0,0,0.1)' } : {}}
            className={`bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 ${className} relative overflow-hidden`}
            {...props}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-primary)_0%,transparent_100%)] opacity-[0.03] pointer-events-none" />
            <div className={`relative z-10 w-full h-full ${innerClassName}`}>{children}</div>

        </motion.div>
    );
}
