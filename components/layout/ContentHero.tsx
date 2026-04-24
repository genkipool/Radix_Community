import React from 'react';
import { GlowBlob } from '@/components/ui/GlowBlob';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface BadgeConfig {
    icon?: React.ReactNode;
    text: string;
    className?: string;
}

interface ContentHeroProps {
    brandName?: string;
    title: string;
    subtitle?: React.ReactNode;
    gradient?: string;
    heroPadding?: string;
    badge?: BadgeConfig;
    actions?: React.ReactNode;
    /** Content rendered directly below the hero section (replaces PageHeader wrapper) */
    children?: React.ReactNode;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function ContentHero({
    brandName = 'Radix',
    title,
    subtitle,
    gradient = 'from-[var(--color-accent)] to-[var(--color-primary)]',
    heroPadding = 'pt-32 pb-16',
    badge,
    actions,
    children,
}: ContentHeroProps) {
    return (
        <div className="w-full flex flex-col">
            <section className={`${heroPadding} relative overflow-hidden`}>
                <GlowBlob color="var(--color-primary)" position="top-left" size={400} opacity={0.15} blur={150} />
                <GlowBlob color="var(--color-accent)" position="bottom-right" size={350} opacity={0.15} blur={120} />

                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">

                        {badge && (
                            <div className={`inline-flex items-center gap-2 px-4 h-8 rounded-full text-sm font-medium mb-8 border shadow-sm ${badge.className ?? 'bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}>
                                {badge.icon}
                                <span className="leading-none">{badge.text}</span>
                            </div>
                        )}

                        <h1 className="text-5xl md:text-7xl font-bold text-[var(--color-text-main)] mb-6 tracking-tight">
                            {brandName}{brandName ? ' ' : ''}
                            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>
                                {title}
                            </span>
                        </h1>

                        {subtitle && (
                            <div className="text-base md:text-lg text-[var(--color-text-muted)] max-w-4xl mx-auto leading-relaxed">
                                {subtitle}
                            </div>
                        )}

                        {actions && <div className="mt-10">{actions}</div>}
                    </div>
                </div>
            </section>

            {children && <div className="w-full">{children}</div>}
        </div>
    );
}
