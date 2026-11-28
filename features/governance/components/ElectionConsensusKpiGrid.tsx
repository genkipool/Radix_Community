'use client';

import React, { useState } from 'react';
import { ChevronDown, Crown, Scale } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Portal } from '@/components/ui/Portal';
import { SelectPopup, SelectPopupEmpty, SelectPopupRow } from '@/components/ui/SelectPopup';
import { usePickerPopup } from '@/hooks/usePickerPopup';
import type {
    ElectionConsensusSummary,
    ElectionMethodSummary,
    MethodKey,
    MethodResult,
} from '../lib/votingMethods';
import { bandHint, gradeLabel } from '../lib/majorityJudgment';
import { fill, formatPct, formatXrd } from '../lib/format';
import { matchesMethodQuery, methodText, ruleParams, type CompareDict } from '../lib/comparisonUtils';
import type { G } from './GovernanceBadges';
import { FAMILY_ICON } from './ComparisonParts';
import { GradeDistributionBar } from './ElectionSection';
import { MethodGuideTrigger } from './MethodGuideModal';
import { formatScoreValue, scoreTextTone, type MethodScoreTableEntry } from './MethodScoresTable';

/** Reusable 2-row × 7-column card grid for the weighted 50-method consensus standings. */
export function ElectionConsensusCandidateCards({
    consensus,
    c,
    g,
    language,
}: {
    consensus: ElectionConsensusSummary;
    c: CompareDict;
    g: G;
    language: string;
}) {
    const mj = g.mj;
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {consensus.candidates.map(cand => {
                const pct = Math.min(100, Math.max(0, cand.consensusShare * 100));
                const avgRankStr = cand.avgRank.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const tooltip = fill(c.election_consensus_card_tip ?? '', {
                    name: cand.label,
                    rank: String(cand.consensusRank),
                    pct: formatPct(cand.consensusShare, language),
                    elected: cand.electedCount.toLocaleString(language),
                    total: cand.evaluatedMethods.toLocaleString(language),
                    avgRank: avgRankStr,
                    grade: gradeLabel(mj, cand.modalGrade),
                    current: cand.currentRank != null ? `#${cand.currentRank}` : '—',
                });
                const entered = cand.changedFromCurrent && cand.inSeats;
                const dropped = cand.changedFromCurrent && !cand.inSeats;
                return (
                    <div
                        key={cand.id}
                        title={tooltip}
                        className={`min-w-0 flex flex-col justify-between gap-2 rounded-2xl border p-3 transition-colors ${
                            entered
                                ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10'
                                : dropped
                                    ? 'border-amber-500/50 bg-amber-500/10'
                                    : cand.inSeats
                                        ? 'border-[var(--color-primary)]/35 bg-[var(--color-card-bg)]'
                                        : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)]'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span className="truncate text-xs font-bold text-[var(--color-text-main)]">
                                {cand.label}
                            </span>
                            <span className={`shrink-0 font-mono text-[10px] font-bold ${
                                entered
                                    ? 'text-[var(--color-accent)]'
                                    : dropped
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : cand.inSeats
                                            ? 'text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)]'
                            }`}>
                                #{cand.consensusRank}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className={`text-sm font-black font-mono leading-none tabular-nums ${
                                    dropped
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : cand.inSeats
                                            ? 'text-[var(--color-accent)]'
                                            : 'text-[var(--color-text-main)]'
                                }`}>
                                    {formatPct(cand.consensusShare, language)}
                                </span>
                                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] truncate">
                                    {gradeLabel(mj, cand.modalGrade)}
                                </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <span
                                    className={`block h-full rounded-full transition-all ${
                                        dropped
                                            ? 'bg-amber-500/80'
                                            : cand.inSeats
                                                ? 'bg-[var(--color-accent)]'
                                                : 'bg-[var(--color-primary)]/60'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                            <span className="truncate">
                                {cand.electedCount}/{cand.evaluatedMethods}
                            </span>
                            <span className="shrink-0 font-bold text-[var(--color-text-secondary)]">
                                Ø #{avgRankStr}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Reusable 2-row × 7-column candidate card grid for any single Majority Judgment voting method. */
export function ElectionMethodCandidatesGrid({
    summary,
    gradeQuantile,
    c,
    g,
    language,
}: {
    summary: ElectionMethodSummary;
    gradeQuantile?: string | null;
    c: CompareDict;
    g: G;
    language: string;
}) {
    const mj = g.mj;
    const quantile = gradeQuantile ?? '3/5';
    const minGradeLabel = gradeLabel(mj, summary.minimumMedianGrade);
    const enteredSet = new Set(summary.entered);
    const leftSet = new Set(summary.left);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {summary.standings.map(cand => {
                const elected = cand.outcome === 'elected';
                const tiedAtCutoff = cand.outcome === 'tied';
                const belowFloor = !cand.electable;
                const entered = enteredSet.has(cand.label);
                const dropped = !tiedAtCutoff && leftSet.has(cand.label);
                const totalPower = cand.histogram.reduce((acc, v) => acc + v, 0);

                const statusReason = entered
                    ? fill(c.election_card_entered_tip ?? '', { seats: String(summary.seatCount) })
                    : tiedAtCutoff
                        ? (c.election_card_tied_tip ?? '')
                        : belowFloor
                            ? fill(c.election_card_below_min_tip ?? '', { minGrade: minGradeLabel })
                            : dropped
                                ? fill(c.election_card_dropped_tip ?? '', { seats: String(summary.seatCount) })
                                : elected
                                    ? fill(mj?.elected_crown_tip ?? mj?.outcome_elected ?? '', { seats: String(summary.seatCount) })
                                    : '';
                const cardTitle = statusReason
                    ? `${cand.label} · #${cand.rank} · ${gradeLabel(mj, cand.qualifyingGrade)} — ${statusReason}`
                    : `${cand.label} · #${cand.rank} · ${gradeLabel(mj, cand.qualifyingGrade)}`;

                return (
                    <div
                        key={cand.id}
                        title={cardTitle}
                        className={`min-w-0 flex flex-col justify-between gap-2 rounded-2xl border p-3 transition-colors ${
                            entered
                                ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10'
                                : tiedAtCutoff
                                    ? 'border-dashed border-sky-500/60 bg-sky-500/8'
                                    : dropped
                                        ? 'border-amber-500/50 bg-amber-500/10'
                                        : elected
                                            ? 'border-[var(--color-primary)]/35 bg-[var(--color-card-bg)]'
                                            : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)]'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span className="truncate text-xs font-bold text-[var(--color-text-main)]">
                                {cand.label}
                            </span>
                            <span className={`shrink-0 font-mono text-[10px] font-bold ${
                                entered
                                    ? 'text-[var(--color-accent)]'
                                    : tiedAtCutoff
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : dropped
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : elected
                                                ? 'text-[var(--color-primary)]'
                                                : 'text-[var(--color-text-muted)]'
                            }`}>
                                #{cand.rank}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                                <span className={`block truncate text-sm font-black leading-none ${
                                    tiedAtCutoff
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : dropped
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : cand.electable
                                                ? 'text-[var(--color-accent)]'
                                                : 'text-[var(--color-text-main)]'
                                }`}>
                                    {gradeLabel(mj, cand.qualifyingGrade)}
                                </span>
                                {elected ? (
                                    <span
                                        className="inline-flex shrink-0 cursor-help"
                                        title={fill(mj?.elected_crown_tip ?? mj?.outcome_elected ?? '', { seats: String(summary.seatCount) })}
                                    >
                                        <Crown className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                                    </span>
                                ) : tiedAtCutoff ? (
                                    <span
                                        className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 cursor-help"
                                        title={c.election_card_tied_tip ?? ''}
                                    >
                                        {mj?.outcome_tied ?? ''}
                                    </span>
                                ) : belowFloor ? (
                                    <span
                                        className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 cursor-help"
                                        title={fill(c.election_card_below_min_tip ?? '', { minGrade: minGradeLabel })}
                                    >
                                        {c.election_card_below_min_badge ?? ''}
                                    </span>
                                ) : null}
                            </div>
                            <GradeDistributionBar
                                histogram={cand.histogram}
                                totalPower={totalPower}
                                quantile={quantile}
                                mj={mj}
                                language={language}
                                heightClass="h-1.5"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                            <span className="truncate">{formatXrd(cand.qualifyingXrd, language)}</span>
                            <span
                                className="shrink-0 font-bold text-[var(--color-text-secondary)] cursor-help"
                                title={bandHint(mj, cand.band)}
                            >
                                {cand.band}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * 2-row × 7-column consensus KPI strip across all 50 voting methods
 * with a searchable `SelectPopup` on the title to switch between weighted consensus and any individual method.
 */
export function ElectionConsensusKpiGrid({
    consensus,
    methods,
    scoreRows,
    selectedKey = 'consensus',
    onSelectKey,
    gradeQuantile,
    c,
    g,
    language,
    onOpenGuide,
}: {
    consensus: ElectionConsensusSummary;
    methods?: MethodResult[];
    scoreRows?: readonly MethodScoreTableEntry[];
    selectedKey?: MethodKey | 'consensus';
    onSelectKey?: (key: MethodKey | 'consensus') => void;
    gradeQuantile?: string | null;
    c: CompareDict;
    g: G;
    language: string;
    onOpenGuide?: (key: MethodKey | 'consensus') => void;
}) {
    const { open, show, close, buttonRef, popupRef, layoutFor } = usePickerPopup();
    const [query, setQuery] = useState('');
    const layout = layoutFor(420, 'left');

    const params = ruleParams(language);
    const familiesDict = (c.families ?? {}) as Record<string, string>;
    const consensusTitle = fill(c.election_consensus_title ?? '', {
        n: consensus.evaluatedMethods.toLocaleString(language),
    });

    const selectedMethod = selectedKey !== 'consensus'
        ? methods?.find(m => m.key === selectedKey && m.electionSummary)
        : undefined;
    const selectedText = selectedMethod ? methodText(c, selectedMethod.key, params) : null;
    const ActiveIcon = selectedMethod ? FAMILY_ICON[selectedMethod.family] : Scale;
    const activeTitle = selectedText ? selectedText.name : consensusTitle;
    const activeHint = selectedText ? selectedText.rule : (c.election_consensus_hint ?? '');

    const canPick = Boolean(methods && methods.length > 0 && onSelectKey);
    const scoreByKey = new Map((scoreRows ?? []).map(r => [r.key, r.finalScore]));
    const trimmedQuery = query.trim().toLowerCase();
    const showConsensusOption = !trimmedQuery
        || consensusTitle.toLowerCase().includes(trimmedQuery)
        || (c.election_consensus_picker_consensus_sub ?? '').toLowerCase().includes(trimmedQuery);
    const filteredMethods = (methods ?? [])
        .filter(m => Boolean(m.electionSummary))
        .filter(m => matchesMethodQuery(c, {
            key: m.key,
            family: m.family,
            resistance: m.resistance,
            spread: m.concentration.spread,
            nakamoto: m.concentration.nakamoto,
        }, params, query));

    const handlePick = (key: MethodKey | 'consensus') => {
        onSelectKey?.(key);
        close();
        setQuery('');
    };

    const renderScoreTrailing = (key: MethodKey | 'consensus') => {
        const val = scoreByKey.get(key);
        if (val == null) return undefined;
        return (
            <span className={`font-mono text-[11px] font-bold tabular-nums ${scoreTextTone(val)}`}>
                {formatScoreValue(val, language)}/10
            </span>
        );
    };

    return (
        <section aria-labelledby="election-consensus-heading" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 id="election-consensus-heading" className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-main)]">
                    {canPick ? (
                        <button
                            ref={buttonRef}
                            type="button"
                            aria-expanded={open}
                            aria-haspopup="dialog"
                            title={c.election_consensus_picker_open_tip ?? ''}
                            onClick={() => (open ? close() : show())}
                            className="inline-flex items-center gap-2 text-left rounded-lg py-0.5 pr-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                        >
                            <ActiveIcon className="size-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                            <span>{activeTitle}</span>
                            <ChevronDown
                                className={`size-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform ${open ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
                                aria-hidden="true"
                            />
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <Scale className="size-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                            <span>{activeTitle}</span>
                        </span>
                    )}
                    {onOpenGuide && (
                        <MethodGuideTrigger
                            onClick={() => onOpenGuide(selectedMethod ? selectedMethod.key : 'consensus')}
                            label={c.election_consensus_guide_open ?? ''}
                        />
                    )}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                    {activeHint}
                </p>
            </div>

            {canPick && (
                <Portal>
                    <AnimatePresence>
                        {open && (
                            <SelectPopup
                                ref={popupRef}
                                title={c.election_consensus_picker_title ?? ''}
                                closeLabel={c.election_consensus_picker_close ?? ''}
                                onClose={() => {
                                    close();
                                    setQuery('');
                                }}
                                direction={layout.direction}
                                style={{
                                    ...layout.style,
                                    height: 'auto',
                                    maxHeight: layout.style.height,
                                }}
                                search={{
                                    value: query,
                                    onChange: setQuery,
                                    placeholder: c.search_placeholder ?? '',
                                    autoFocus: true,
                                    clearLabel: c.search_clear ?? '',
                                }}
                            >
                                {showConsensusOption && (
                                    <SelectPopupRow
                                        selected={!selectedMethod}
                                        label={consensusTitle}
                                        sublabel={c.election_consensus_picker_consensus_sub ?? ''}
                                        icon={<Scale className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
                                        trailing={renderScoreTrailing('consensus')}
                                        onClick={() => handlePick('consensus')}
                                    />
                                )}
                                {filteredMethods.map(m => {
                                    const text = methodText(c, m.key, params);
                                    const FamilyIcon = FAMILY_ICON[m.family];
                                    const familyLabel = familiesDict[m.family] ?? m.family;
                                    return (
                                        <SelectPopupRow
                                            key={m.key}
                                            selected={selectedMethod?.key === m.key}
                                            label={text.name}
                                            sublabel={`${familyLabel} · ${text.rule}`}
                                            icon={<FamilyIcon className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
                                            trailing={renderScoreTrailing(m.key)}
                                            onClick={() => handlePick(m.key)}
                                        />
                                    );
                                })}
                                {!showConsensusOption && filteredMethods.length === 0 && (
                                    <SelectPopupEmpty>{c.election_consensus_picker_empty ?? ''}</SelectPopupEmpty>
                                )}
                            </SelectPopup>
                        )}
                    </AnimatePresence>
                </Portal>
            )}

            {selectedMethod && selectedMethod.electionSummary ? (
                <ElectionMethodCandidatesGrid
                    summary={selectedMethod.electionSummary}
                    gradeQuantile={gradeQuantile}
                    c={c}
                    g={g}
                    language={language}
                />
            ) : (
                <ElectionConsensusCandidateCards
                    consensus={consensus}
                    c={c}
                    g={g}
                    language={language}
                />
            )}
        </section>
    );
}
