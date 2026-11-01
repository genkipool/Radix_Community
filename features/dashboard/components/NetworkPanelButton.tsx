'use client';

import { Activity } from 'lucide-react';

const BASE = 'p-2 rounded-full border transition-all';
const ACTIVE = 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]';
const INACTIVE =
    'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40';

/** The id of the panel this button folds and unfolds. */
export const NETWORK_PANEL_ID = 'network-insights-panel';

/**
 * Folds the network panel in and out. One component for the desktop toolbar and
 * the narrow-screen control row, like the reading-mode button, so the two
 * cannot drift apart.
 */
export function NetworkPanelButton({
    open,
    onToggle,
    label,
    className = '',
}: {
    open: boolean;
    onToggle: () => void;
    label: string;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            title={label}
            aria-label={label}
            aria-expanded={open}
            aria-controls={NETWORK_PANEL_ID}
            className={`${BASE} ${open ? ACTIVE : INACTIVE} ${className}`}
        >
            <Activity className="size-4" />
        </button>
    );
}
