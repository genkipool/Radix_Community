import React from 'react';

interface TokenBadgeProps {
    children: React.ReactNode;
    className?: string;
}

export function TokenBadge({ children, className = '' }: TokenBadgeProps) {
    return (
        <span
            className={`inline-flex items-center justify-center px-1.5 py-1 rounded border text-[9px] font-mono font-semibold leading-none align-middle box-border shrink-0 text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 ${className}`}
        >
            <span className="mt-[1px]">{children}</span>
        </span>
    );
}
