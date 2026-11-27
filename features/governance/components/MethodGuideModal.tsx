'use client';

import React, { useState } from 'react';
import { X, Info, Scale } from 'lucide-react';
import { SidePanelModal } from '@/components/shared/SidePanelModal';
import { SidePanelControls } from '@/components/shared/SidePanelControls';
import { useSidePanelControls } from '@/components/shared/hooks/useSidePanelControls';
import { useLanguage } from '@/context/LanguageContext';
import type { ElectionConsensusSummary, MethodResult } from '../lib/votingMethods';
import type { HistoricalMethodRow } from '../lib/historicalMethods';
import { gradeLabel, parseQuantile } from '../lib/majorityJudgment';
import { fill, formatPct, formatXrd } from '../lib/format';
import type { G } from './GovernanceBadges';
import type { CompareDict, HistoricalDict } from './ComparisonParts';
import { ElectionConclusionsTab } from './ElectionConclusionsTab';
import { ElectionCurrentConclusionsTab } from './ElectionCurrentConclusionsTab';
import { ElectionCurrentResistanceTab, ElectionResistanceTab } from './ElectionResistanceTab';

export type MethodGuideTarget =
    | {
        mode: 'single';
        method: MethodResult;
        quorum: number | null;
        threshold: number | null;
        gradeQuantile?: string | null;
    }
    | {
        mode: 'historical';
        row: HistoricalMethodRow;
        totalVotes: number;
    }
    | {
        mode: 'consensus';
        consensus: ElectionConsensusSummary;
        current: MethodResult;
        methods: MethodResult[];
        voterPowers: number[];
        quorum: number | null;
        gradeQuantile?: string | null;
    }
    | {
        mode: 'current-election';
        consensus: ElectionConsensusSummary;
        current: MethodResult;
        methods: MethodResult[];
        voterPowers: number[];
        quorum: number | null;
        gradeQuantile?: string | null;
    };

interface MethodGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    target: MethodGuideTarget | null;
    methodName: string;
    methodRule: string;
    c: CompareDict;
    h?: HistoricalDict;
    g: G;
    language: string;
}

interface LiveMetric {
    label: string;
    value: React.ReactNode;
    full?: boolean;
}

/** Inline info icon button placed right after a method's rule text to open its calculation guide. */
export function MethodGuideTrigger({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="inline-flex items-center justify-center ml-1.5 p-0.5 rounded-full text-[var(--color-primary)] hover:bg-[var(--color-primary)]/12 transition-colors align-middle cursor-pointer"
        >
            <Info className="size-3.5" />
        </button>
    );
}

/**
 * Right-side guide drawer (matching the Console's ToolInfoModal) that explains
 * step-by-step how a voting method is calculated, cleanly separated by context:
 *   1) Majority Judgment elections (quantile + Bands A/B/C + seat cutoff)
 *   2) Standard proposals & temperature checks (weighted sum + XRD quorum + threshold)
 *   3) Historical comparison (vote-by-vote simulation + aggregate metrics)
 */
export function MethodGuideModal({
    isOpen,
    onClose,
    target,
    methodName,
    methodRule,
    c,
    h = {},
    g,
    language,
}: MethodGuideModalProps) {
    const { t } = useLanguage();
    const navT = (t.nav ?? {}) as Record<string, string | undefined>;
    const mj = g.mj;
    const [activeTab, setActiveTab] = useState<'guide' | 'conclusions' | 'resistance'>('guide');

    const {
        isPinned,
        togglePin,
        handlePiP,
        handlePopupWindow,
        externalWindow,
        closeExternalWindow,
        resetPin,
    } = useSidePanelControls('governanceMethodGuidePinned');

    const handleClose = () => {
        setActiveTab('guide');
        resetPin();
        closeExternalWindow();
        onClose();
    };

    const singleMethod = target?.mode === 'single'
        ? target.method
        : target?.mode === 'current-election'
            ? target.current
            : null;
    const election = singleMethod?.electionSummary ?? null;
    const historicalRow = target?.mode === 'historical' ? target.row : null;
    const consensusTarget = target?.mode === 'consensus' ? target.consensus : null;
    const hasThreeTabs = target?.mode === 'consensus' || target?.mode === 'current-election';

    const guideKind: 'election' | 'standard' | 'historical' | 'consensus' | null = !target
        ? null
        : target.mode === 'historical'
            ? 'historical'
            : target.mode === 'consensus'
                ? 'consensus'
                : election
                    ? 'election'
                    : 'standard';

    const methodKey = singleMethod?.key ?? historicalRow?.key ?? null;
    const isDoubleMajority = methodKey === 'double_majority' || methodKey === 'double_majority_sybil';

    let kicker = '';
    let intro = '';
    let doubleMajorityNote: string | null = null;
    let steps: string[] = [];
    let liveMetrics: LiveMetric[] = [];

    if (guideKind === 'election' && singleMethod && election && (target?.mode === 'single' || target?.mode === 'current-election')) {
        const totalVoters = singleMethod.counted + singleMethod.excluded;
        const minGradeName = gradeLabel(mj, election.minimumMedianGrade);
        const quantileRaw = target.gradeQuantile || '3/5';
        const quantilePct = formatPct(parseQuantile(quantileRaw), language);
        const topCandidate = election.standings[0] ?? null;
        kicker = c.election_guide_kicker ?? '';
        intro = c.election_guide_intro ?? '';
        if (isDoubleMajority) {
            doubleMajorityNote = fill(c.election_guide_double_majority ?? '', { minGrade: minGradeName });
        }
        steps = [
            fill(c.election_guide_step1 ?? '', {
                counted: singleMethod.counted.toLocaleString(language),
                total: totalVoters.toLocaleString(language),
                eff: singleMethod.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                nakamoto: singleMethod.concentration.nakamoto !== null ? singleMethod.concentration.nakamoto.toLocaleString(language) : '—',
            }),
            fill(c.election_guide_step2 ?? '', {
                counted: singleMethod.counted.toLocaleString(language),
                quantile: quantileRaw,
                quantilePct,
            }),
            c.election_guide_step3 ?? '',
            fill(c.election_guide_step4 ?? '', {
                minGrade: minGradeName,
                seats: election.seatCount.toLocaleString(language),
            }),
        ];
        liveMetrics = [
            {
                label: c.election_guide_live_seats ?? '',
                value: `${election.elected.length.toLocaleString(language)}/${election.seatCount.toLocaleString(language)}`,
            },
            {
                label: c.detail_spread ?? '',
                value: singleMethod.concentration.spread !== null ? formatPct(singleMethod.concentration.spread, language) : '—',
            },
            ...(topCandidate ? [{
                label: c.election_guide_live_leader ?? '',
                full: true,
                value: (
                    <span className="flex flex-wrap items-center gap-2 font-sans font-semibold text-[var(--color-text-main)]">
                        <span>#{topCandidate.rank} {topCandidate.label}</span>
                        <span className="text-[var(--color-accent)]">{gradeLabel(mj, topCandidate.qualifyingGrade)}</span>
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                            ({fill(mj?.band_short ?? '', { band: topCandidate.band })} · {formatPct(topCandidate.p, language)} / {formatPct(topCandidate.q, language)})
                        </span>
                    </span>
                ),
            }] : []),
        ];
    } else if (guideKind === 'standard' && singleMethod && target?.mode === 'single') {
        const totalVoters = singleMethod.counted + singleMethod.excluded;
        const thresholdText = target.threshold !== null ? formatPct(target.threshold, language) : '—';
        const outcomeLabel = singleMethod.counted === 0
            ? (c.outcome_none ?? '')
            : singleMethod.outcome === 'approved'
                ? (c.outcome_approved ?? '')
                : singleMethod.outcome === 'rejected'
                    ? (c.outcome_rejected ?? '')
                    : singleMethod.outcome === 'no_quorum'
                        ? (c.outcome_no_quorum ?? '')
                        : (singleMethod.winner?.label ?? '—');
        kicker = c.standard_guide_kicker ?? '';
        intro = c.standard_guide_intro ?? '';
        if (isDoubleMajority && target.threshold !== null) {
            doubleMajorityNote = fill(c.standard_guide_double_majority ?? '', { threshold: thresholdText });
        }
        steps = [
            fill(c.standard_guide_step1 ?? '', {
                counted: singleMethod.counted.toLocaleString(language),
                total: totalVoters.toLocaleString(language),
                eff: singleMethod.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                nakamoto: singleMethod.concentration.nakamoto !== null ? singleMethod.concentration.nakamoto.toLocaleString(language) : '—',
            }),
            c.standard_guide_step2 ?? '',
            target.quorum !== null
                ? fill(c.standard_guide_step3 ?? '', {
                    xrd: formatXrd(singleMethod.eligibleXrd, language),
                    quorum: formatXrd(target.quorum, language),
                })
                : fill(c.standard_guide_step3_no_quorum ?? '', {
                    xrd: formatXrd(singleMethod.eligibleXrd, language),
                }),
            target.threshold !== null
                ? fill(c.standard_guide_step4 ?? '', { threshold: thresholdText })
                : (c.standard_guide_step4_no_threshold ?? ''),
        ];
        liveMetrics = [
            { label: c.col_result ?? '', value: <span className="font-sans truncate block">{outcomeLabel}</span> },
            {
                label: c.col_support ?? '',
                value: singleMethod.approvalShare !== null
                    ? formatPct(singleMethod.approvalShare, language)
                    : singleMethod.winner
                        ? formatPct(singleMethod.winner.share, language)
                        : '—',
            },
            { label: c.detail_quorum ?? '', value: `${formatXrd(singleMethod.eligibleXrd, language)} XRD` },
            {
                label: c.detail_spread ?? '',
                value: singleMethod.concentration.spread !== null ? formatPct(singleMethod.concentration.spread, language) : '—',
            },
        ];
    } else if (guideKind === 'historical' && historicalRow && target?.mode === 'historical') {
        const totalDecided = historicalRow.changedCount + historicalRow.sameCount;
        kicker = h.guide_kicker ?? '';
        intro = h.guide_intro ?? '';
        steps = [
            fill(h.guide_step1 ?? '', {
                totalVotes: target.totalVotes.toLocaleString(language),
                evaluated: historicalRow.votesEvaluated.toLocaleString(language),
                ballots: historicalRow.totalBallotsCounted.toLocaleString(language),
            }),
            historicalRow.current
                ? fill(h.guide_step2_reference ?? '', {
                    totalVotes: target.totalVotes.toLocaleString(language),
                })
                : fill(h.guide_step2 ?? '', {
                    changed: historicalRow.changedCount.toLocaleString(language),
                    decided: (totalDecided || historicalRow.votesEvaluated).toLocaleString(language),
                }),
            fill(h.guide_step3 ?? '', {
                nakamoto: historicalRow.avgNakamoto !== null ? historicalRow.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 }) : '—',
                spread: historicalRow.avgSpread !== null ? formatPct(historicalRow.avgSpread, language) : '—',
                valid: historicalRow.validVotesCount.toLocaleString(language),
                totalVotes: target.totalVotes.toLocaleString(language),
            }),
            h.guide_step4 ?? '',
        ];
        liveMetrics = [
            { label: h.detail_votes ?? '', value: historicalRow.votesEvaluated.toLocaleString(language) },
            {
                label: h.col_changes ?? '',
                value: historicalRow.current ? (c.badge_reference ?? '') : historicalRow.changedCount.toLocaleString(language),
            },
            {
                label: h.col_spread ?? '',
                value: historicalRow.avgSpread !== null ? formatPct(historicalRow.avgSpread, language) : '—',
            },
            {
                label: c.detail_quorum ?? '',
                value: `${historicalRow.validVotesCount.toLocaleString(language)}/${target.totalVotes.toLocaleString(language)}`,
            },
        ];
    } else if (guideKind === 'consensus' && consensusTarget) {
        const nStr = consensusTarget.evaluatedMethods.toLocaleString(language);
        const seatsChanged = consensusTarget.candidates.filter(cand => cand.inSeats && cand.changedFromCurrent).length;
        kicker = c.election_consensus_guide_kicker ?? '';
        intro = fill(c.election_consensus_guide_intro ?? '', { n: nStr });
        steps = [
            c.election_consensus_guide_step1 ?? '',
            fill(c.election_consensus_guide_step2 ?? '', { n: nStr }),
            fill(c.election_consensus_guide_step3 ?? '', { n: nStr }),
            fill(c.election_consensus_guide_step4 ?? '', { n: nStr }),
            fill(c.election_consensus_guide_step5 ?? '', { n: nStr }),
        ];
        liveMetrics = [
            { label: c.col_method ?? '', value: nStr },
            { label: c.fact_seats ?? '', value: consensusTarget.seatCount.toLocaleString(language) },
            { label: c.election_consensus_live_families ?? '', value: '25 % × 4' },
            {
                label: c.election_consensus_live_changed ?? '',
                value: seatsChanged === 0
                    ? fill(c.election_same_seats ?? '', { n: consensusTarget.seatCount.toLocaleString(language) })
                    : fill(seatsChanged === 1 ? (c.election_changes_one ?? '') : (c.election_changes_many ?? ''), {
                        n: seatsChanged.toLocaleString(language),
                    }),
            },
        ];
    }

    return (
        <SidePanelModal
            isOpen={isOpen && Boolean(target)}
            onClose={handleClose}
            isStandalone={Boolean(externalWindow)}
            isPinned={isPinned}
            portalTarget={externalWindow ? externalWindow.document.body : undefined}
        >
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-primary)]/20">
                            <Info className="size-5 text-white" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">
                                {kicker}
                            </p>
                            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-main)] truncate">
                                {methodName}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <SidePanelControls
                            isPinned={isPinned}
                            togglePin={togglePin}
                            handlePiP={handlePiP}
                            handlePopupWindow={handlePopupWindow}
                            pinText={navT.wallet_pin_sidebar ?? ''}
                            unpinText={navT.wallet_pin_sidebar_remove ?? ''}
                            pipText={navT.wallet_picture_in_picture ?? ''}
                            popupText={navT.wallet_popup_window ?? ''}
                        />
                        <button
                            type="button"
                            onClick={handleClose}
                            aria-label={c.election_guide_close ?? ''}
                            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300 cursor-pointer"
                        >
                            <X strokeWidth={2} className="size-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-8 py-5 custom-scrollbar">
                    {hasThreeTabs && (
                        <div role="tablist" className="mb-7 flex flex-nowrap items-center gap-2 border-b border-[var(--color-card-border)]">
                            {([
                                ['guide', c.election_consensus_tab_guide ?? ''],
                                ['conclusions', c.election_consensus_tab_conclusions ?? ''],
                                ['resistance', c.election_consensus_tab_resistance ?? ''],
                            ] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === key}
                                    onClick={() => setActiveTab(key)}
                                    className="relative flex-1 pb-2.5 text-center text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                                    style={{ color: activeTab === key ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
                                >
                                    {label}
                                    {activeTab === key && (
                                        <span
                                            className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                                            style={{ background: 'linear-gradient(to right, var(--color-accent), var(--color-primary))' }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {target?.mode === 'consensus' && activeTab === 'conclusions' ? (
                        <ElectionConclusionsTab
                            consensus={target.consensus}
                            current={target.current}
                            methods={target.methods}
                            voterPowers={target.voterPowers}
                            quorum={target.quorum}
                            gradeQuantile={target.gradeQuantile}
                            c={c}
                            language={language}
                        />
                    ) : target?.mode === 'consensus' && activeTab === 'resistance' ? (
                        <ElectionResistanceTab
                            consensus={target.consensus}
                            methods={target.methods}
                            c={c}
                            language={language}
                        />
                    ) : target?.mode === 'current-election' && activeTab === 'conclusions' ? (
                        <ElectionCurrentConclusionsTab
                            consensus={target.consensus}
                            current={target.current}
                            methods={target.methods}
                            voterPowers={target.voterPowers}
                            quorum={target.quorum}
                            gradeQuantile={target.gradeQuantile}
                            c={c}
                            language={language}
                        />
                    ) : target?.mode === 'current-election' && activeTab === 'resistance' ? (
                        <ElectionCurrentResistanceTab
                            current={target.current}
                            gradeQuantile={target.gradeQuantile}
                            c={c}
                            language={language}
                        />
                    ) : (
                        <div className="space-y-7">
                        <div className="space-y-2">
                            <p className="text-[14px] leading-relaxed font-semibold text-[var(--color-text-main)]">
                                {methodRule}
                            </p>
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                                {intro}
                            </p>
                        </div>

                        {doubleMajorityNote && (
                            <div className="flex gap-2.5 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                                <Scale className="size-4 shrink-0 mt-0.5 text-[var(--color-primary)]" />
                                <p>{doubleMajorityNote}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                {c.election_guide_steps_title ?? ''}
                            </h3>
                            <ol className="space-y-4">
                                {steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <span className="mt-0.5 grid place-items-center size-6 rounded-full bg-[var(--color-primary)]/12 border border-[var(--color-primary)]/30 font-mono text-[11px] font-black text-[var(--color-primary)] shrink-0">
                                            {idx + 1}
                                        </span>
                                        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                                            {step}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {liveMetrics.length > 0 && (
                            <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-4 space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                    {c.election_guide_live_title ?? ''}
                                </h3>
                                <dl className="grid grid-cols-2 gap-3 text-xs">
                                    {liveMetrics.map((m, idx) => (
                                        <div key={idx} className={m.full ? 'col-span-2' : undefined}>
                                            <dt className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                                                {m.label}
                                            </dt>
                                            <dd className="mt-0.5 font-mono font-bold text-[var(--color-text-main)]">
                                                {m.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
        </SidePanelModal>
    );
}
