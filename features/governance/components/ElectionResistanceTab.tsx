'use client';

import React from 'react';
import { AlertTriangle, Award, CheckCircle2, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
    CURRENT_ATTACK_SHARES,
    CONTROL_SHARE,
    computeAttackDifficulty,
    computeConsensusResistance,
    computeConsensusStructuralRatio,
    computeGlobalResistanceScore,
    computeMethodResistance,
    resistanceLevelFromScore,
    type ConsensusAttackId,
    type ElectionConsensusSummary,
    type GlobalResistanceScore,
    type MethodAttackEval,
    type MethodKey,
    type MethodResistanceMetrics,
    type MethodResistanceReport,
    type MethodResult,
    type Resistance,
} from '../lib/votingMethods';
import { parseQuantile } from '../lib/majorityJudgment';
import type { HistoricalAttack } from '../lib/historicalMethods';
import { fill, formatPct } from '../lib/format';
import { RESISTANCE_STYLE, type CompareDict } from './ComparisonParts';
import {
    formatScoreValue,
    scoreBarTone,
    scoreChipTone,
    scoreTextTone,
} from './MethodScoresTable';

export { CURRENT_ATTACK_SHARES };

const LEVEL_CARD_TONE: Record<Resistance, { box: string; icon: string }> = {
    very_low: { box: 'border-red-500/30 bg-red-500/5', icon: 'text-red-500' },
    low: { box: 'border-orange-500/30 bg-orange-500/5', icon: 'text-orange-600 dark:text-orange-400' },
    medium: { box: 'border-yellow-500/30 bg-yellow-500/5', icon: 'text-yellow-600 dark:text-yellow-400' },
    high: { box: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5', icon: 'text-[var(--color-accent)]' },
};

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

function shareChipTone(share: number): string {
    if (share >= 0.7) return 'border-red-500/30 bg-red-500/8';
    if (share >= 0.3) return 'border-amber-500/30 bg-amber-500/8';
    return 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8';
}

function difficultyTextTone(score: number): string {
    if (score < 4) return 'text-red-500';
    if (score < 7) return 'text-amber-600 dark:text-amber-400';
    return 'text-[var(--color-accent)]';
}

function difficultyChipTone(score: number): string {
    if (score < 4) return 'border-red-500/30 bg-red-500/8';
    if (score < 7) return 'border-amber-500/30 bg-amber-500/8';
    return 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8';
}

function splitAttackTitle(raw: string): { name: string; detail: string | null } {
    const m = /^([^(]+?)\s*\((.+)\)$/.exec(raw.trim());
    if (!m) return { name: raw, detail: null };
    return { name: m[1].trim(), detail: m[2].trim() };
}

interface ResistanceScenarioCard {
    id: ConsensusAttackId;
    /** Pre-computed difficulty (historical average, consensus control); recomputed from `maxShare` when absent. */
    difficulty?: number;
    /** The attacker decides the result (more than half of the weight); defaults to `maxShare > CONTROL_SHARE`. */
    controls?: boolean;
    title: string;
    captures: string;
    blocked: string;
    maxShare: number;
}

/** Shared layout rendered across the 50-method consensus, current method, single-vote, and historical resistance tabs. */
function ResistanceReportView({
    resistanceLevel,
    structuralRatio,
    spread,
    levelLabel,
    intro1,
    intro2,
    tableNote,
    scenarios,
    nuancePositive,
    nuanceWarning,
    summary,
    scoreOverride,
    historicalTips,
    c,
    language,
}: {
    resistanceLevel: Resistance;
    structuralRatio?: number;
    /**
     * Historical view: the scores are the average of the per-vote scores, so they
     * are passed in instead of being recomputed from the averaged scenarios.
     */
    scoreOverride?: GlobalResistanceScore;
    /** Use the historical wording for the final score (average of per-vote scores). */
    historicalTips?: boolean;
    spread?: number | null;
    levelLabel: string;
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
    const levelStyle = RESISTANCE_STYLE[resistanceLevel];
    const LevelIcon = levelStyle.icon;
    const cardTone = LEVEL_CARD_TONE[resistanceLevel];
    const globalScore = scoreOverride ?? computeGlobalResistanceScore(scenarios, structuralRatio ?? resistanceLevel, spread);
    const fmtScore = (v: number) => formatScoreValue(v, language);
    const globalScoreStr = fmtScore(globalScore.score);
    const globalSybilStr = fmtScore(globalScore.structuralScore);
    const globalAttacksStr = fmtScore(globalScore.attackScore);
    const globalMinStr = fmtScore(globalScore.minDifficulty);
    const globalAvgStr = fmtScore(globalScore.avgDifficulty);
    const globalAvgShareStr = formatPct(globalScore.avgMaxShare, language);
    const globalTip = fill(c.election_resistance_global_score_tip ?? '', {
        score: globalScoreStr,
        sybil: globalSybilStr,
        attacks: globalAttacksStr,
        min: globalMinStr,
        avg: globalAvgStr,
        avgShare: globalAvgShareStr,
    });
    const decentScoreStr = globalScore.decentralisationScore !== null ? fmtScore(globalScore.decentralisationScore) : null;
    const finalScoreStr = globalScore.finalScore !== null ? fmtScore(globalScore.finalScore) : null;
    const spreadPctStr = spread != null && Number.isFinite(spread)
        ? formatPct(Math.min(1, Math.max(0, spread)), language)
        : null;

    const scoreCards: Array<{
        key: string;
        title: string;
        score: number;
        scoreStr: string;
        tip: string;
        breakdown: string;
        Icon: typeof ShieldCheck;
    }> = [
        {
            key: 'resistance',
            title: c.election_resistance_global_score_title ?? '',
            score: globalScore.score,
            scoreStr: globalScoreStr,
            tip: globalTip,
            breakdown: fill(c.election_resistance_global_score_breakdown ?? '', {
                sybil: globalSybilStr,
                attacks: globalAttacksStr,
                min: globalMinStr,
                avg: globalAvgStr,
                avgShare: globalAvgShareStr,
            }),
            Icon: ShieldCheck,
        },
    ];
    if (globalScore.decentralisationScore !== null && decentScoreStr && spreadPctStr) {
        scoreCards.push({
            key: 'decentralisation',
            title: c.election_resistance_decent_score_title ?? '',
            score: globalScore.decentralisationScore,
            scoreStr: decentScoreStr,
            tip: fill(c.election_resistance_decent_score_tip ?? '', {
                score: decentScoreStr,
                spreadPct: spreadPctStr,
            }),
            breakdown: fill(c.election_resistance_decent_score_breakdown ?? '', {
                spreadPct: spreadPctStr,
            }),
            Icon: Scale,
        });
    }
    if (globalScore.finalScore !== null && finalScoreStr && decentScoreStr) {
        scoreCards.push({
            key: 'final',
            title: c.election_resistance_final_score_title ?? '',
            score: globalScore.finalScore,
            scoreStr: finalScoreStr,
            tip: fill((historicalTips ? c.election_resistance_final_score_tip_hist : null) ?? c.election_resistance_final_score_tip ?? '', {
                score: finalScoreStr,
                resistance: globalScoreStr,
                decentralisation: decentScoreStr,
            }),
            breakdown: fill((historicalTips ? c.election_resistance_final_score_breakdown_hist : null) ?? c.election_resistance_final_score_breakdown ?? '', {
                resistance: globalScoreStr,
                decentralisation: decentScoreStr,
            }),
            Icon: Award,
        });
    }

    return (
        <div className="space-y-6">
            <section className={`rounded-2xl border p-4 space-y-3 ${cardTone.box}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-main)] flex items-center gap-2">
                        <LevelIcon className={`size-4 shrink-0 ${cardTone.icon}`} aria-hidden="true" />
                        {c.election_resistance_global_title ?? ''}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${levelStyle.cls}`}>
                        <LevelIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        {levelLabel}
                    </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{intro1}</p>
                {intro2 && <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{intro2}</p>}
            </section>

            <section className="space-y-3">
                <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                        {c.election_resistance_table_title ?? ''}
                    </h3>
                    <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{tableNote}</p>
                    <div className="space-y-1.5 pt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                        <p>
                            <span className="font-bold text-[var(--color-text-secondary)]">
                                {c.election_resistance_legend_share_title ?? ''}:{' '}
                            </span>
                            {c.election_resistance_legend_share_desc ?? ''}
                        </p>
                        <p>
                            <span className="font-bold text-[var(--color-text-secondary)]">
                                {c.election_resistance_legend_difficulty_title ?? ''}:{' '}
                            </span>
                            {c.election_resistance_legend_difficulty_desc ?? ''}
                        </p>
                        <p>
                            <span className="font-bold text-[var(--color-text-secondary)]">
                                {c.election_resistance_legend_global_title ?? ''}:{' '}
                            </span>
                            {c.election_resistance_legend_global_desc ?? ''}
                        </p>
                        {globalScore.decentralisationScore !== null && globalScore.finalScore !== null && (
                            <>
                                <p>
                                    <span className="font-bold text-[var(--color-text-secondary)]">
                                        {c.election_resistance_legend_decent_title ?? ''}:{' '}
                                    </span>
                                    {c.election_resistance_legend_decent_desc ?? ''}
                                </p>
                                <p>
                                    <span className="font-bold text-[var(--color-text-secondary)]">
                                        {c.election_resistance_legend_final_title ?? ''}:{' '}
                                    </span>
                                    {c.election_resistance_legend_final_desc ?? ''}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-2.5">
                    {scenarios.map((s, idx) => {
                        const pct = formatPct(s.maxShare, language);
                        const widthPct = s.maxShare > 0 ? Math.max(2, Math.min(100, s.maxShare * 100)) : 0;
                        const computedDifficulty = computeAttackDifficulty(s.id, s.maxShare);
                        const difficulty = s.difficulty !== undefined ? { ...computedDifficulty, score: s.difficulty } : computedDifficulty;
                        const difficultyScoreStr = difficulty.score.toLocaleString(language, { maximumFractionDigits: 1 });
                        const { name, detail } = splitAttackTitle(s.title);
                        const shareTip = fill(c.election_resistance_metric_share_tip ?? '', { pct });
                        const difficultyTip = fill(c.election_resistance_metric_difficulty_tip ?? '', {
                            score: difficultyScoreStr,
                            base: String(difficulty.base),
                            capital: String(difficulty.capital),
                            time: String(difficulty.time),
                            coord: String(difficulty.coordination),
                            pct,
                        });
                        return (
                            <div
                                key={s.id}
                                className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3.5 space-y-2.5"
                            >
                                <div className="space-y-2.5 pb-2.5 border-b border-[var(--color-card-border)]/60">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <span className="size-5 rounded-full bg-[var(--color-primary)]/12 border border-[var(--color-primary)]/30 font-mono text-[10px] font-black text-[var(--color-primary)] grid place-items-center shrink-0 mt-0.5 tabular-nums">
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-[var(--color-text-main)] leading-snug">
                                                {name}
                                            </p>
                                            {detail && (
                                                <p className="text-[11px] leading-snug text-[var(--color-text-muted)] mt-0.5">
                                                    {detail}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div
                                            title={shareTip}
                                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 cursor-help ${shareChipTone(s.maxShare)}`}
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] truncate">
                                                {c.election_resistance_metric_share_label ?? ''}
                                            </span>
                                            <span className={`font-mono text-xs font-black tabular-nums whitespace-nowrap ${textTone(s.maxShare)}`}>
                                                {pct}
                                            </span>
                                        </div>
                                        {(s.controls ?? s.maxShare > CONTROL_SHARE) && (
                                            <span className="col-span-2 order-last inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500">
                                                <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
                                                {c.election_resistance_metric_controls ?? ''}
                                            </span>
                                        )}
                                        <div
                                            title={difficultyTip}
                                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 cursor-help ${difficultyChipTone(difficulty.score)}`}
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] truncate">
                                                {c.election_resistance_metric_difficulty_label ?? ''}
                                            </span>
                                            <span className={`font-mono text-xs font-black tabular-nums whitespace-nowrap ${difficultyTextTone(difficulty.score)}`}>
                                                {difficultyScoreStr}/10
                                            </span>
                                        </div>
                                    </div>
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
                    {scoreCards.map(card => {
                        const CardIcon = card.Icon;
                        return (
                            <div key={card.key} className={`rounded-xl border p-3.5 space-y-2 ${scoreChipTone(card.score)}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-main)]">
                                        <CardIcon
                                            className={`size-4 shrink-0 ${scoreTextTone(card.score)}`}
                                            aria-hidden="true"
                                        />
                                        {card.title}
                                    </span>
                                    <span
                                        title={card.tip}
                                        className={`font-mono text-sm font-black tabular-nums whitespace-nowrap cursor-help ${scoreTextTone(card.score)}`}
                                    >
                                        {card.scoreStr}/10
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    {card.score > 0 && (
                                        <div
                                            className={`h-full rounded-full ${scoreBarTone(card.score)}`}
                                            style={{ width: `${Math.min(100, Math.max(2, card.score * 10))}%` }}
                                        />
                                    )}
                                </div>
                                <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] tabular-nums">
                                    {card.breakdown}
                                </p>
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
    gradeQuantile,
    c,
    language,
}: {
    consensus: ElectionConsensusSummary;
    methods: MethodResult[];
    gradeQuantile?: string | null;
    c: CompareDict;
    language: string;
}) {
    const quantile = parseQuantile(gradeQuantile);
    const raw = computeConsensusResistance(methods, consensus.methodWeights, quantile);
    const nStr = consensus.evaluatedMethods.toLocaleString(language);
    const cheapSybil = raw.find(s => s.id === 'cheap_sybil');
    const maxSingleVector = Math.max(0, ...raw.filter(s => s.id !== 'nation_state').map(s => s.maxShare));
    const structuralRatio = computeConsensusStructuralRatio(methods, consensus.methodWeights);
    // Scored with the control-aware share; the cards still show the raw weighted share.
    const consensusGlobal = computeGlobalResistanceScore(
        raw.map(s => ({ id: s.id, maxShare: s.scoringShare })),
        structuralRatio,
        consensus.weightedConcentration.spread,
    );
    const resistanceLevel = resistanceLevelFromScore(consensusGlobal.score);
    const dict = c as Record<string, unknown>;
    const levelLabel = ((c.resistance ?? {}) as Record<string, string>)[resistanceLevel] || '';
    const familiesDict = (c.families ?? {}) as Record<string, string>;
    const familyParams = {
        n: nStr,
        families: consensus.familyCount.toLocaleString(language),
        pct: formatPct(consensus.familyCount > 0 ? 1 / consensus.familyCount : 0, language),
    };

    const scenarios: ResistanceScenarioCard[] = raw.map(s => ({
        id: s.id,
        maxShare: s.maxShare,
        difficulty: computeAttackDifficulty(s.id, s.scoringShare).score,
        controls: s.scoringShare > CONTROL_SHARE,
        title: String(dict[`election_resistance_attack_${s.id}_title`] ?? ''),
        // Built from the computed per-method shares, so the text can never disagree with the figures.
        captures: fill(c.election_resistance_consensus_captures ?? '', {
            affected: s.affectedCount.toLocaleString(language),
            controlled: s.byFamily.reduce((sum, f) => sum + f.controlled, 0).toLocaleString(language),
            total: s.totalMethods.toLocaleString(language),
            families: s.byFamily
                .map(f => fill(c.election_resistance_consensus_family ?? '', {
                    family: familiesDict[f.family] ?? f.family,
                    affected: f.affected.toLocaleString(language),
                    total: f.total.toLocaleString(language),
                }))
                .join(' · '),
        }),
        blocked: fill(c.election_resistance_consensus_blocked ?? '', {
            blocked: (s.totalMethods - s.affectedCount).toLocaleString(language),
            total: s.totalMethods.toLocaleString(language),
        }),
    }));

    return (
        <ResistanceReportView
            resistanceLevel={resistanceLevel}
            structuralRatio={structuralRatio}
            spread={consensus.weightedConcentration.spread}
            levelLabel={levelLabel}
            intro1={fill(c.election_resistance_intro_1 ?? '', familyParams)}
            intro2={c.election_resistance_intro_2 ?? ''}
            tableNote={fill(c.election_resistance_table_note ?? '', familyParams)}
            scenarios={scenarios}
            scoreOverride={consensusGlobal}
            nuancePositive={fill(
                // Same test as the cards' "decides the result" marker.
                raw.filter(s => s.id !== 'nation_state').every(s => s.scoringShare <= CONTROL_SHARE)
                    ? (c.election_resistance_nuance_impose ?? '')
                    : (c.election_resistance_nuance_impose_high ?? ''),
                { maxSingle: formatPct(maxSingleVector, language) },
            )}
            nuanceWarning={fill(c.election_resistance_nuance_tie ?? '', { cheapSybil: formatPct(cheapSybil?.maxShare ?? 0, language) })}
            summary={fill(c.election_resistance_summary ?? '', {
                score: formatScoreValue(consensusGlobal.score, language),
                level: levelLabel.toLowerCase(),
                maxSingle: formatPct(maxSingleVector, language),
                cheapSybil: formatPct(cheapSybil?.maxShare ?? 0, language),
            })}
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
    const highLabel = ((c.resistance ?? {}) as Record<string, string>).high || '';
    const decCount = current.electionSummary?.decisiveQuantileCount ?? null;
    const totalVoters = current.counted;
    const quantilePct = formatPct(parseQuantile(gradeQuantile), language);

    const scenarios: ResistanceScenarioCard[] = CURRENT_ATTACK_SHARES.map(s => ({
        id: s.id,
        maxShare: s.maxShare,
        title: String(dict[`election_resistance_attack_${s.id}_title`] ?? ''),
        captures: fill(String(dict[`election_current_resistance_${s.id}_captures`] ?? ''), { quantilePct }),
        blocked: fill(String(dict[`election_current_resistance_${s.id}_blocked`] ?? ''), { quantilePct }),
    }));

    return (
        <ResistanceReportView
            resistanceLevel="high"
            spread={current.concentration.spread}
            levelLabel={highLabel}
            intro1={c.election_current_resistance_intro_1 ?? ''}
            intro2={fill(c.election_current_resistance_intro_2 ?? '', { quantilePct })}
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

/** Resistance tab for any of the 50 voting methods in both live and historical comparison views. */
export function MethodResistanceTab({
    methodKey,
    metrics,
    spread,
    methodRuleAttack,
    attackCostSentence,
    historical,
    c,
    language,
}: {
    methodKey: MethodKey;
    metrics: MethodResistanceMetrics;
    spread?: number | null;
    methodRuleAttack: string;
    attackCostSentence?: string | null;
    /** Historical view: per-attack shares and scores averaged vote by vote. */
    historical?: {
        attacks: HistoricalAttack[];
        scores: GlobalResistanceScore;
    };
    c: CompareDict;
    language: string;
}) {
    const baseReport = computeMethodResistance(methodKey, metrics, language);
    // Historical view: the average share and difficulty of each attack, explained with the
    // texts of the vote where it captured most (not of a fictitious average vote).
    const histById = new Map((historical?.attacks ?? []).map(a => [a.id, a]));
    const report: Omit<MethodResistanceReport, 'scenarios'> & { scenarios: Array<MethodAttackEval & { difficulty?: number; controls?: boolean; worstPrefix?: string }> } = historical
        ? {
            ...baseReport,
            params: {
                ...baseReport.params,
                maxVector: formatPct(Math.max(0, ...(historical.attacks).filter(a => a.id !== 'nation_state').map(a => a.avgShare)), language),
            },
            scenarios: baseReport.scenarios.map(s => {
                const h = histById.get(s.id);
                if (!h) return s;
                // Texts and figures of the worst vote, rebuilt in the reader's language; the bar shows the average.
                const worst = computeMethodResistance(methodKey, h.worst.metrics, language).scenarios.find(w => w.id === s.id) ?? s;
                return {
                    ...s,
                    maxShare: h.avgShare,
                    capturesKey: worst.capturesKey,
                    blockedKey: worst.blockedKey,
                    params: worst.params,
                    difficulty: h.difficulty,
                    // An average share cannot say whether the attacker decided any single vote.
                    controls: false,
                    worstPrefix: fill(c.method_res_hist_worst_prefix ?? '', { pct: formatPct(h.worst.maxShare, language) }),
                };
            }),
        }
        : baseReport;
    const dict = c as Record<string, unknown>;
    const levelLabel = ((c.resistance ?? {}) as Record<string, string>)[report.resistance] || report.resistance;
    const params = {
        ...report.params,
        ...(attackCostSentence ? { flipCost: attackCostSentence } : {}),
    };

    const scenarios: ResistanceScenarioCard[] = report.scenarios.map(s => ({
        id: s.id,
        maxShare: s.maxShare,
        difficulty: s.difficulty,
        controls: s.controls,
        title: String(dict[`election_resistance_attack_${s.id}_title`] ?? ''),
        captures: `${s.worstPrefix ? `${s.worstPrefix} ` : ''}${fill(String(dict[s.capturesKey] ?? ''), s.params)}`,
        blocked: fill(String(dict[s.blockedKey] ?? ''), s.params),
    }));

    return (
        <ResistanceReportView
            resistanceLevel={report.resistance}
            spread={spread}
            levelLabel={levelLabel}
            intro1={fill(String(dict[report.intro1Key] ?? ''), params)}
            intro2={methodRuleAttack}
            tableNote={fill(String(dict[report.tableNoteKey] ?? ''), params)}
            scenarios={scenarios}
            nuancePositive={fill(String(dict[report.nuancePositiveKey] ?? ''), params)}
            nuanceWarning={fill(String(dict[report.nuanceWarningKey] ?? ''), params)}
            summary={fill(String(dict[report.summaryKey] ?? ''), params)}
            scoreOverride={historical?.scores}
            historicalTips={Boolean(historical)}
            c={c}
            language={language}
        />
    );
}
