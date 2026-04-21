import React from 'react';
import { FadeIn } from '@/components/ui/FadeIn';

interface SectionHeaderProps {
    icon?: React.ReactNode;
    /** Badge text. If omitted or empty the pill is not rendered. */
    badge?: string;
    badgeColor?: string;
    badgeClassName?: string;
    title: string;
    titleAccent?: string;
    titleEnd?: string;
    subtitle?: string;
    gradient?: string;
    children?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    icon,
    badge,
    badgeColor,
    badgeClassName,
    title,
    titleAccent,
    titleEnd = '',
    subtitle,
    gradient = 'from-[var(--color-secondary)] to-[var(--color-primary)]',
    children,
}) => {
    const defaultBadge = badgeColor
        ? `bg-[${badgeColor}]/10 border-[${badgeColor}]/30 text-[${badgeColor}]`
        : 'bg-[var(--color-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]';

    return (
        <div className="text-center mb-16">
            {badge && (
                <FadeIn className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6 border ${badgeClassName || defaultBadge}`}>
                    {icon}
                    <span className="leading-none text-shadow-soft">{badge}</span>
                </FadeIn>
            )}

            <FadeIn as="h2" delay={0.05} className="text-4xl md:text-5xl font-bold text-[var(--color-text-main)] mb-6 tracking-tight">
                {title}
                {titleAccent && (
                    <>
                        <br />
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>
                            {titleAccent}
                        </span>
                    </>
                )}
                {titleEnd}
            </FadeIn>

            {subtitle && (
                <FadeIn as="p" delay={0.1} className="text-xl text-[var(--color-text-muted)] max-w-3xl mx-auto leading-8">
                    {subtitle}
                </FadeIn>
            )}

            {children && (
                <FadeIn delay={0.15}>
                    {children}
                </FadeIn>
            )}
        </div>
    );
};
