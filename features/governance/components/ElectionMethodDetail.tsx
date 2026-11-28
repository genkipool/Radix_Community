'use client';

import React from 'react';
import { ArrowLeftRight, ArrowRight, Users } from 'lucide-react';
import type { ElectionMethodSummary } from '../lib/votingMethods';
import { bandHint } from '../lib/majorityJudgment';
import { fill, formatPct, formatXrd } from '../lib/format';
import type { G } from './GovernanceBadges';
import type { CompareDict } from './ComparisonParts';
import { ExplorerTable } from '@/features/dashboard/explorador/components/ExplorerTable';

/** Elected council list for one voting method inside `ComparisonMethodRow`. */
export function ElectionCouncilList({
    election,
    c,
    g,
    language,
}: {
    election: ElectionMethodSummary;
    c: CompareDict;
    g: G;
    language: string;
}) {
    const mjGrades = g.mj?.grades ?? [];
    const enteredSet = new Set(election.entered);

    return (
        <div>
            <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                {fill(c.election_detail_council ?? '', {
                    n: election.elected.length.toLocaleString(language),
                    total: election.seatCount.toLocaleString(language),
                })}
            </p>
            {election.elected.length > 0 ? (
                <ul className="space-y-1.5">
                    {election.elected.map(cand => {
                        const isNew = enteredSet.has(cand.label);
                        return (
                            <li
                                key={cand.id}
                                className={`grid grid-cols-[2rem_minmax(0,1fr)_5.25rem_3.75rem_4.5rem] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                    isNew
                                        ? 'border-amber-500/35 bg-amber-500/5'
                                        : 'border-[var(--color-card-border)] bg-[var(--color-surface)]/50'
                                }`}
                            >
                                <span className="font-mono text-[11px] font-bold text-[var(--color-primary)] tabular-nums">
                                    #{cand.rank}
                                </span>
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-[var(--color-text-main)] truncate">
                                        {cand.label}
                                    </span>
                                    {isNew && (
                                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                            {c.election_entered_badge ?? ''}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[11px] font-semibold text-[var(--color-accent)] text-right whitespace-nowrap">
                                    {mjGrades[cand.qualifyingGrade] ?? String(cand.qualifyingGrade)}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums text-right whitespace-nowrap">
                                    {formatXrd(cand.qualifyingXrd, language)}
                                </span>
                                <span
                                    className="justify-self-end inline-flex items-center justify-center h-5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-2 font-mono text-[10px] font-bold text-[var(--color-text-secondary)] whitespace-nowrap cursor-help"
                                    title={`${bandHint(g.mj, cand.band) ?? ''} (${formatPct(cand.p, language)} / ${formatPct(cand.q, language)})`}
                                >
                                    <span className="leading-none translate-y-[1px]">{fill(g.mj?.band_short ?? '', { band: cand.band })}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-xs text-[var(--color-text-muted)]">{c.election_no_elected ?? ''}</p>
            )}
        </div>
    );
}

/** Remaining (non-elected) candidates table for the current method (`1 XRD = 1 vote`). */
export function ElectionRestTable({
    election,
    c,
    g,
    language,
}: {
    election: ElectionMethodSummary;
    c: CompareDict;
    g: G;
    language: string;
}) {
    const mjGrades = g.mj?.grades ?? [];
    const electedIds = new Set(election.elected.map(e => e.id));
    const rest = election.standings.filter(cand => !electedIds.has(cand.id));
    if (rest.length === 0) return null;

    return (
        <ExplorerTable
            compact
            title={fill(c.election_rest_table_title ?? '', { n: rest.length.toLocaleString(language) })}
            icon={<Users className="size-3 text-[var(--color-primary)]" />}
            headers={[
                { label: '#', className: 'w-[12%]' },
                { label: c.election_col_candidate ?? '', className: 'w-[40%]' },
                { label: c.election_col_grade ?? '', className: 'w-[28%]' },
                { label: c.election_col_band ?? '', className: 'w-[20%]' },
            ]}
        >
            {rest.map(cand => (
                <tr key={`rest-${cand.id}`} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-[var(--color-surface)]/40 transition-colors">
                    <td className="py-1.5 px-2 font-mono text-[11px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{cand.rank}
                    </td>
                    <td className="py-1.5 px-2 font-semibold text-[var(--color-text-main)] truncate" title={cand.label}>
                        {cand.label}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold ${cand.electable ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                            {mjGrades[cand.qualifyingGrade] ?? String(cand.qualifyingGrade)}
                        </span>
                        <span className="ml-1.5 font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums">
                            {formatXrd(cand.qualifyingXrd, language)}
                        </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                        <span
                            className="inline-flex items-center justify-center h-5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-2 font-mono text-[10px] font-bold text-[var(--color-text-secondary)] cursor-help"
                            title={`${bandHint(g.mj, cand.band) ?? ''} (${formatPct(cand.p, language)} / ${formatPct(cand.q, language)})`}
                        >
                            <span className="text-box-cap leading-none">{fill(g.mj?.band_short ?? '', { band: cand.band })}</span>
                        </span>
                    </td>
                </tr>
            ))}
        </ExplorerTable>
    );
}

/** Seat changes vs `1 XRD = 1 vote` table (dropped, entered, tied at cutoff). */
export function ElectionChangesTable({
    election,
    c,
    g,
}: {
    election: ElectionMethodSummary;
    c: CompareDict;
    g: G;
}) {
    if (election.left.length === 0 && election.entered.length === 0 && election.tiedAtCutoff.length === 0) {
        return null;
    }

    return (
        <ExplorerTable
            compact
            title={c.election_changes_table_title ?? ''}
            icon={<ArrowLeftRight className="size-3 text-amber-500" />}
            headers={[
                { label: c.election_col_candidate ?? '', className: 'w-[46%]' },
                { label: c.election_col_position ?? '', className: 'w-[24%]' },
                { label: c.election_col_change ?? '', className: 'w-[30%]' },
            ]}
        >
            {(election.leftDetails ?? election.left.map((label, idx) => ({
                id: -idx - 1,
                label,
                currentRank: 0,
                methodRank: election.standings.find(s => s.label === label)?.rank ?? 0,
            }))).map(item => (
                <tr key={`left-${item.label}`} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-[var(--color-surface)]/40 transition-colors">
                    <td className="py-1.5 px-2 font-semibold text-[var(--color-text-main)] truncate">{item.label}</td>
                    <td className="py-1.5 px-2 font-mono text-[11px] font-bold text-[var(--color-text-secondary)] whitespace-nowrap tabular-nums">
                        {item.currentRank > 0 && item.methodRank > 0 ? (
                            <span className="inline-flex items-center gap-1 leading-none">
                                <span className="text-box-cap leading-none">#{item.currentRank}</span>
                                <ArrowRight className="size-3 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                <span className="text-box-cap leading-none">#{item.methodRank}</span>
                            </span>
                        ) : item.methodRank > 0 ? (
                            <span className="text-box-cap leading-none">#{item.methodRank}</span>
                        ) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                        <span className="inline-flex items-center justify-center h-5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <span className="text-box-cap leading-none">{c.election_left_badge ?? ''}</span>
                        </span>
                    </td>
                </tr>
            ))}
            {(election.enteredDetails ?? election.entered.map((label, idx) => ({
                id: -idx - 1,
                label,
                currentRank: 0,
                methodRank: election.standings.find(s => s.label === label)?.rank ?? 0,
            }))).map(item => (
                <tr key={`entered-${item.label}`} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-[var(--color-surface)]/40 transition-colors">
                    <td className="py-1.5 px-2 font-semibold text-[var(--color-text-main)] truncate">{item.label}</td>
                    <td className="py-1.5 px-2 font-mono text-[11px] font-bold text-[var(--color-accent)] whitespace-nowrap tabular-nums">
                        {item.currentRank > 0 && item.methodRank > 0 ? (
                            <span className="inline-flex items-center gap-1 leading-none">
                                <span className="text-box-cap leading-none text-[var(--color-text-muted)]">#{item.currentRank}</span>
                                <ArrowRight className="size-3 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                <span className="text-box-cap leading-none">#{item.methodRank}</span>
                            </span>
                        ) : item.methodRank > 0 ? (
                            <span className="text-box-cap leading-none">#{item.methodRank}</span>
                        ) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                        <span className="inline-flex items-center justify-center h-5 rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 text-[10px] font-bold text-[var(--color-accent)]">
                            <span className="text-box-cap leading-none">{c.election_entered_badge ?? ''}</span>
                        </span>
                    </td>
                </tr>
            ))}
            {election.tiedAtCutoff.map(cand => (
                <tr key={`tied-${cand.id}`} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-[var(--color-surface)]/40 transition-colors">
                    <td className="py-1.5 px-2 font-semibold text-[var(--color-text-main)] truncate">{cand.label}</td>
                    <td className="py-1.5 px-2 font-mono text-[11px] font-bold text-[var(--color-primary)] whitespace-nowrap tabular-nums">
                        #{cand.rank}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                        <span className="inline-flex items-center justify-center h-5 rounded-full border border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10 px-2 text-[10px] font-bold text-[var(--color-primary)]">
                            <span className="text-box-cap leading-none">{g.mj?.outcome_tied ?? ''}</span>
                        </span>
                    </td>
                </tr>
            ))}
        </ExplorerTable>
    );
}
