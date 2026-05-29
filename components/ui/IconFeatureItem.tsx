
import type { ReactNode } from 'react';

/**
 * Icon + Title + Description feature row. Used in Wallet section features,
 * DeveloperExperience cards, etc.
 */
export function IconFeatureItem({ icon, title, description, iconClassName }: {
    icon: ReactNode;
    title: string;
    description: string;
    iconClassName?: string;
}) {
    return (
        <div className="flex gap-4">
            <div className={`flex-shrink-0 size-12 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] flex items-center justify-center ${iconClassName ?? ''}`}>
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">{title}</h3>
                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{description}</p>
            </div>
        </div>
    );
}
