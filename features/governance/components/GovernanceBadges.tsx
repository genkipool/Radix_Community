import React from 'react';
import { FileText, Thermometer, CircleDot, Clock, Lock } from 'lucide-react';
import type { Dictionary } from '@/types/i18n';
import type { GovernanceItemKind, VotingPhase } from '../lib/governanceVotes';

export type G = Partial<Dictionary['governance']>;

const PHASE_STYLE: Record<VotingPhase, string> = {
    open: 'text-[var(--color-accent)] border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10',
    upcoming: 'text-[var(--color-secondary)] border-[var(--color-secondary)]/35 bg-[var(--color-secondary)]/10',
    closed: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]',
    unknown: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]',
};

const PHASE_ICON: Record<VotingPhase, typeof CircleDot> = { open: CircleDot, upcoming: Clock, closed: Lock, unknown: Lock };

/** Open / upcoming / closed, always as a word next to the colour. */
export function PhasePill({ phase, g }: { phase: VotingPhase; g: G }) {
    const Icon = PHASE_ICON[phase];
    const label = { open: g.status_open || 'Open', upcoming: g.status_upcoming || 'Upcoming', closed: g.status_closed || 'Closed', unknown: '—' }[phase];
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PHASE_STYLE[phase]}`}>
            <Icon className={`size-3 ${phase === 'open' ? 'animate-pulse' : ''}`} />
            {label}
        </span>
    );
}

/** Formal proposal or temperature check. */
export function KindPill({ kind, g }: { kind: GovernanceItemKind; g: G }) {
    const isProposal = kind === 'proposal';
    const Icon = isProposal ? FileText : Thermometer;
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Icon className="size-3" />
            {isProposal ? (g.vote?.kind_proposal || 'Formal proposal') : (g.vote?.kind_temperature_check || 'Temperature check')}
        </span>
    );
}
