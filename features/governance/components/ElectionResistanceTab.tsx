'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
    CURRENT_ATTACK_SHARES,
    computeConsensusResistance,
    type ConsensusAttackId,
    type ElectionConsensusSummary,
    type MethodResult,
} from '../lib/votingMethods';
import { parseQuantile } from '../lib/majorityJudgment';
import { fill, formatPct } from '../lib/format';
import { RESISTANCE_STYLE, type CompareDict } from './ComparisonParts';

export { CURRENT_ATTACK_SHARES };

function barTone(share: number): string {
    if (share >= 0.7) return 'bg-red-500';
    if (share >= 0.3) return 'bg-amber-500';
    return 'bg-[var(--color-accent)]';
}

function textTone(share: number): string {
    if (share >= 0.7) return 'text-red-500';
    if (share >= 0.3) return 'text-amber-600 dark:text-amber-400';
    return 'text-[var(--color-accent)]';
}

interface ResistanceScenarioCard {
    id: ConsensusAttackId;
    title: string;
    captures: string;
    blocked: string;
    maxShare: number;
}

/** Shared layout rendered by both the 50-method consensus and 1 XRD = 1 vote resistance tabs. */
function ResistanceReportView({
    highLabel,
    intro1,
    intro2,
    tableNote,
    scenarios,
    nuancePositive,
    nuanceWarning,
    summary,
    c,
    language,
}: {
    highLabel: string;
    intro1: string;
    intro2: string;
    tableNote: string;
    scenarios: ResistanceScenarioCard[];
    nuancePositive: string;
    nuanceWarning: string;
    summary: string;
    c: CompareDict;
    language: string;
}) {
    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-main)] flex items-center gap-2">
                        <ShieldCheck className="size-4 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                        {c.election_resistance_global_title ?? ''}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${RESISTANCE_STYLE.high.cls}`}>
                        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                        {highLabel}
                    </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{intro1}</p>
                <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{intro2}</p>
            </section>

            <section className="space-y-3">
                <div className="space-y-1">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                        {c.election_resistance_table_title ?? ''}
                    </h3>
                    <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{tableNote}</p>
                </div>

                <div className="space-y-2.5">
                    {scenarios.map((s, idx) => {
                        const pct = formatPct(s.maxShare, language);
                        const widthPct = s.maxShare > 0 ? Math.max(2, Math.min(100, s.maxShare * 100)) : 0;
                        return (
                            <div
                                key={s.id}
                                className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3.5 space-y-2"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-bold text-[var(--color-text-main)] leading-snug">
                                        <span className="font-mono text-[var(--color-primary)] mr-1.5">{idx + 1}.</span>
                                        {s.title}
                                    </p>
                                    <span className={`shrink-0 font-mono text-xs font-black tabular-nums ${textTone(s.maxShare)}`}>
                                        {pct}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    {widthPct > 0 && (
                                        <div
                                            className={`h-full rounded-full ${barTone(s.maxShare)}`}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 text-[11px] leading-relaxed pt-0.5">
                                    <p className="text-[var(--color-text-secondary)]">
                                        <span className="font-bold text-[var(--color-text-main)]">
                                            {c.election_resistance_col_captures ?? ''}:{' '}
                                        </span>
                                        {s.captures}
                                    </p>
                                    <p className="text-[var(--color-text-muted)]">
                                        <span className="font-bold text-[var(--color-text-secondary)]">
                                            {c.election_resistance_col_blocked ?? ''}:{' '}
                                        </span>
                                        {s.blocked}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    {c.election_resistance_nuance_title ?? ''}
                </h3>
                <ul className="space-y-2 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                        <span>{nuancePositive}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <ShieldAlert className="size-3.5 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                        <span>{nuanceWarning}</span>
                    </li>
                </ul>
                <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)] pt-1 border-t border-amber-500/20">
                    {summary}
                </p>
            </section>
        </div>
    );
}

/** Resistance tab inside the Consensus side panel (live weights across all 50 methods). */
export function ElectionResistanceTab({
    consensus,
    methods,
    c,
    language,
}: {
    consensus: ElectionConsensusSummary;
    methods: MethodResult[];
    c: CompareDict;
    language: string;
}) {
    const raw = computeConsensusResistance(methods, consensus.methodWeights);
    const nStr = consensus.evaluatedMethods.toLocaleString(language);
    const cheapSybil = raw.find(s => s.id === 'cheap_sybil');
    const splitWhale = raw.find(s => s.id === 'split_whale');
    const veteranWhale = raw.find(s => s.id === 'veteran_whale');
    const maxSingleVector = Math.max(splitWhale?.maxShare ?? 0, veteranWhale?.maxShare ?? 0);
    const dict = c as Record<string, unknown>;
    const highLabel = ((c.resistance ?? {}) as Record<string, string>).high || 'High';

    const scenarios: ResistanceScenarioCard[] = raw.map(s => ({
        id: s.id,
        maxShare: s.maxShare,
        title: String(dict[`election_resistance_attack_${s.id}_title`] ?? ''),
        captures: String(dict[`election_resistance_attack_${s.id}_captures`] ?? ''),
        blocked: String(dict[`election_resistance_attack_${s.id}_blocked`] ?? ''),
    }));

    return (
        <ResistanceReportView
            highLabel={highLabel}
            intro1={fill(c.election_resistance_intro_1 ?? '', { n: nStr })}
            intro2={c.election_resistance_intro_2 ?? ''}
            tableNote={fill(c.election_resistance_table_note ?? '', { n: nStr })}
            scenarios={scenarios}
            nuancePositive={fill(c.election_resistance_nuance_impose ?? '', { maxSingle: formatPct(maxSingleVector, language) })}
            nuanceWarning={fill(c.election_resistance_nuance_tie ?? '', { cheapSybil: formatPct(cheapSybil?.maxShare ?? 0, language) })}
            summary={fill(c.election_resistance_summary ?? '', { cheapSybil: formatPct(cheapSybil?.maxShare ?? 0, language) })}
            c={c}
            language={language}
        />
    );
}

/** Resistance tab for the Current Method (1 XRD = 1 vote) side panel. */
export function ElectionCurrentResistanceTab({
    current,
    gradeQuantile,
    c,
    language,
}: {
    current: MethodResult;
    gradeQuantile?: string | null;
    c: CompareDict;
    language: string;
}) {
    const dict = c as Record<string, unknown>;
    const highLabel = ((c.resistance ?? {}) as Record<string, string>).high || 'High';
    const decCount = current.electionSummary?.decisiveQuantileCount ?? null;
    const totalVoters = current.counted;
    const quantilePct = formatPct(parseQuantile(gradeQuantile), language);

    const scenarios: ResistanceScenarioCard[] = CURRENT_ATTACK_SHARES.map(s => ({
        id: s.id,
        maxShare: s.maxShare,
        title: String(dict[`election_resistance_attack_${s.id}_title`] ?? ''),
        captures: String(dict[`election_current_resistance_${s.id}_captures`] ?? ''),
        blocked: String(dict[`election_current_resistance_${s.id}_blocked`] ?? ''),
    }));

    return (
        <ResistanceReportView
            highLabel={highLabel}
            intro1={c.election_current_resistance_intro_1 ?? ''}
            intro2={c.election_current_resistance_intro_2 ?? ''}
            tableNote={c.election_current_resistance_table_note ?? ''}
            scenarios={scenarios}
            nuancePositive={c.election_current_resistance_nuance_sybil ?? ''}
            nuanceWarning={fill(c.election_current_resistance_nuance_whale ?? '', {
                count: (decCount ?? 0).toLocaleString(language),
                total: totalVoters.toLocaleString(language),
                pct: formatPct(totalVoters > 0 && decCount != null ? decCount / totalVoters : 0, language),
                quantilePct,
            })}
            summary={c.election_current_resistance_summary ?? ''}
            c={c}
            language={language}
        />
    );
}
