'use client';

import React, { useId, useState } from 'react';
import {
    ChevronDown, Info, Loader2, Equal, ArrowLeftRight, Target, Crown,
} from 'lucide-react';
import { concentrationLevel, type MethodResult } from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { TONE } from './VoteParts';
import type { G } from './GovernanceBadges';
import { MethodGuideTrigger } from './MethodGuideModal';
import { ElectionChangesTable, ElectionCouncilList, ElectionRestTable } from './ElectionMethodDetail';
import {
    RESISTANCE_STYLE,
    tip, methodText, resistanceTooltip, formatAttackCost,
    OutcomeBadge, ComparisonCell, ConcentrationBar, FractionCell, SpreadMeterBar, DetailStatBox, ResistanceCallout,
    type CompareDict, type Params,
} from './ComparisonParts';

type C = CompareDict;

function addressesText(c: C, n: number, language: string): string {
    return fill(n === 1 ? (c.address_one ?? '') : (c.address_many ?? ''), { n: n.toLocaleString(language) });
}

function ResistancePill({ r, c, attack, language }: { r: MethodResult; c: C; attack: string; language: string }) {
    const { icon: Icon, cls } = RESISTANCE_STYLE[r.resistance];
    const label = ((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance;
    const title = resistanceTooltip(c, r.resistance, attack, `${c.resistance_here ?? ''}: ${formatAttackCost(r.attack, r.eligibleXrd, c, language)}`);
    return (
        <span
            className={`inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full border text-[11px] font-bold cursor-help ${cls}`}
            title={title}
        >
            <Icon className="size-3.5 shrink-0" /><span className="truncate">{label}</span>
        </span>
    );
}

function OutcomePill({ r, c, language }: { r: MethodResult; c: C; language: string }) {
    if (r.electionSummary && r.counted > 0) {
        const { elected, seatCount } = r.electionSummary;
        const label = fill(c.election_seats_pill ?? '', {
            n: elected.length.toLocaleString(language),
            total: seatCount.toLocaleString(language),
        });
        const title = elected.length > 0
            ? elected.map(cand => `#${cand.rank} ${cand.label}`).join(' · ')
            : (c.election_no_elected ?? '');
        const cls = elected.length > 0
            ? 'text-[var(--color-primary)] border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10'
            : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]';
        return (
            <span
                className={`inline-flex items-center gap-1.5 max-w-full rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-help ${cls}`}
                title={title}
            >
                <Crown className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
            </span>
        );
    }
    return <OutcomeBadge outcome={r.outcome} winnerLabel={r.winner?.label ?? null} counted={r.counted} c={c} />;
}

/** Share in favour with the pass line; on a ballot with no sides, the winner's share; on an election, council overlap with 1 XRD = 1 vote. */
function SupportMeter({ r, c, threshold, language }: { r: MethodResult; c: C; threshold: number | null; language: string }) {
    if (r.counted === 0) return <span className="text-xs text-[var(--color-text-muted)] cursor-help" title={tip(c, 'outcome_none') || c.outcome_none}>—</span>;
    if (r.electionSummary) {
        const total = Math.max(1, r.electionSummary.seatCount);
        const matched = r.current
            ? r.electionSummary.elected.length
            : Math.max(0, total - (r.electionSummary.seatsChanged ?? 0));
        const ratio = matched / total;
        const ok = r.current || (r.electionSummary.seatsChanged ?? 0) === 0;
        const title = fill(c.election_overlap_tip ?? '', {
            matched: matched.toLocaleString(language),
            total: total.toLocaleString(language),
            pct: formatPct(ratio, language),
        });
        return (
            <span className="flex flex-col gap-1.5 w-full cursor-help" title={title}>
                <span className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums">
                        {matched.toLocaleString(language)}/{total.toLocaleString(language)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums">
                        {formatPct(ratio, language)}
                    </span>
                </span>
                <span className="relative h-2 rounded-full bg-[var(--color-card-border)]">
                    <span
                        className={`absolute inset-y-0 left-0 rounded-full ${ok ? TONE.positive.bar : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(1, ratio) * 100}%` }}
                    />
                </span>
            </span>
        );
    }
    const hasSides = r.approvalShare !== null;
    const ratio = hasSides ? r.approvalShare ?? 0 : r.winner?.share ?? 0;
    const ok = hasSides ? threshold === null || ratio >= threshold : true;
    const title = hasSides
        ? tip(c, 'support', { pct: formatPct(ratio, language), threshold: threshold === null ? '—' : formatPct(threshold, language) })
        : tip(c, 'support_winner', { pct: formatPct(ratio, language), label: r.winner?.label ?? '' });
    const showThreshold = hasSides && threshold !== null;
    return (
        <span className="flex flex-col gap-1.5 w-full cursor-help" title={title}>
            <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums">{formatPct(ratio, language)}</span>
                {showThreshold && (
                    <span className="inline-flex items-baseline gap-1 text-[10px] text-[var(--color-text-muted)] tabular-nums" title={tip(c, 'threshold_mark', { pct: formatPct(threshold, language) })}>
                        <span className="self-center w-0.5 h-2.5 rounded-full bg-[var(--color-text-main)]" aria-hidden />
                        <span>{fill(c.threshold_short ?? '', { pct: formatPct(threshold, language) })}</span>
                    </span>
                )}
            </span>
            <span className="relative h-2 rounded-full bg-[var(--color-card-border)]">
                <span className={`absolute inset-y-0 left-0 rounded-full ${ok ? TONE.positive.bar : TONE.negative.bar}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                {showThreshold && (
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${threshold * 100}% - 1px)` }} aria-hidden />
                )}
            </span>
        </span>
    );
}

/** Voters controlling half the weight, against the most possible (everyone weighing the same). */
function SpreadMeter({ r, c, language }: { r: MethodResult; c: C; language: string }) {
    const { nakamoto, spread } = r.concentration;
    const level = concentrationLevel(r.concentration);
    const levels = (c.levels ?? {}) as Record<string, string>;
    const title = nakamoto !== null && spread !== null && level
        ? tip(c, 'nakamoto', {
            n: nakamoto.toLocaleString(language), of: r.counted.toLocaleString(language), share: formatPct(nakamoto / r.counted, language),
            eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), spread: formatPct(spread, language), level: levels[level] || level,
        })
        : undefined;
    return <SpreadMeterBar nakamoto={nakamoto} spread={spread} title={title} emptyTitle={tip(c, 'outcome_none') || c.outcome_none} c={c} language={language} />;
}

/** Everything behind one rule's figures. */
function MethodDetail({ r, c, g, rule, attack, quorum, threshold, language, onOpenGuide }: {
    r: MethodResult;
    c: C;
    g: G;
    rule: string;
    attack: string;
    quorum: number | null;
    threshold: number | null;
    language: string;
    onOpenGuide?: () => void;
}) {
    const d = r.decisive;
    const decisiveShare = r.rows.filter(x => x.tone !== 'neutral').reduce((sum, x) => sum + x.share, 0);
    const thresholdMark = threshold !== null && r.approvalShare !== null && decisiveShare > 0 ? threshold * decisiveShare : null;
    const sideLabel = d ? { for: c.side_for ?? '', against: c.side_against ?? '', winner: c.side_winner ?? '' }[d.side] : '';
    const election = r.electionSummary;
    return (
        <div className="grid gap-5 lg:grid-cols-2 px-4 sm:px-5 pb-5 pt-1">
            <div className="flex flex-col justify-between gap-4 min-w-0">
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {rule}
                    {onOpenGuide && (
                        <MethodGuideTrigger
                            onClick={onOpenGuide}
                            label={election ? (c.election_guide_open ?? '') : (c.standard_guide_open ?? '')}
                        />
                    )}
                </p>
                {r.counted > 0 && election ? (
                    <ElectionCouncilList election={election} c={c} g={g} language={language} />
                ) : r.counted > 0 ? (
                    <div>
                        <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{c.detail_split ?? ''}</p>
                        <ul className="space-y-2">
                            {r.rows.filter(x => x.power > 0 || x.tone !== 'neutral').map(x => (
                                <li key={x.key}>
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className={`font-semibold truncate ${TONE[x.tone].text}`}>{x.label}</span>
                                        <span className="flex items-baseline gap-2 shrink-0">
                                            {x.tone === 'positive' && thresholdMark !== null && threshold !== null && (
                                                <span className="inline-flex items-baseline gap-1 mr-1 text-[10px] text-[var(--color-text-muted)] tabular-nums cursor-help" title={tip(c, 'threshold_mark', { pct: formatPct(threshold, language) })}>
                                                    <span className="self-center w-0.5 h-2.5 rounded-full bg-[var(--color-text-main)]" aria-hidden />
                                                    <span>{fill(c.threshold_short ?? '', { pct: formatPct(threshold, language) })}</span>
                                                </span>
                                            )}
                                            <span className="text-[11px] text-[var(--color-text-muted)]">{addressesText(c, r.addressesByChoice[x.key] ?? 0, language)}</span>
                                            <span className="font-mono font-bold text-[var(--color-text-main)] w-[4.25rem] text-right whitespace-nowrap tabular-nums">{formatPct(x.share, language)}</span>
                                        </span>
                                    </div>
                                    <div className="relative mt-1 h-1.5 rounded-full bg-[var(--color-card-border)]">
                                        <div className={`h-full rounded-full ${TONE[x.tone].bar}`} style={{ width: `${x.share * 100}%` }} />
                                        {x.tone === 'positive' && thresholdMark !== null && (
                                            <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${Math.min(1, thresholdMark) * 100}% - 1px)` }} aria-hidden />
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {r.headcountShare !== null && (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                {fill(c.detail_headcount ?? '', { pct: formatPct(r.headcountShare, language) })}
                            </p>
                        )}
                    </div>
                ) : null}
                {r.counted > 0 && (
                    <div>
                        <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{c.detail_concentration ?? ''}</p>
                        <ConcentrationBar top1={r.concentration.top1} top10={r.concentration.top10} c={c} language={language} />
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-between gap-4 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                    <DetailStatBox label={c.detail_counted ?? ''} title={tip(c, 'detail_counted')}>
                        {r.counted.toLocaleString(language)}/{(r.counted + r.excluded).toLocaleString(language)}
                        {r.excluded > 0 && (
                            <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                                {fill(r.excluded === 1 ? (c.detail_excluded_one ?? '') : (c.detail_excluded ?? ''), { n: r.excluded.toLocaleString(language) })}
                            </span>
                        )}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_effective ?? ''} title={tip(c, 'detail_effective', { n: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), of: r.counted.toLocaleString(language) })}>
                        {r.concentration.effective ? (
                            <>
                                {r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 })}
                                <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">{fill(c.of_n ?? '', { n: r.counted.toLocaleString(language) })}</span>
                            </>
                        ) : '—'}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_quorum ?? ''} title={tip(c, 'detail_quorum')}>
                        {quorum === null ? '—' : (
                            <span className={r.quorumMet ? 'text-[var(--color-accent)]' : 'text-amber-600 dark:text-amber-400'}>
                                {fill(c.detail_quorum_value ?? '', { xrd: formatXrd(r.eligibleXrd, language), quorum: formatXrd(quorum, language) })}
                            </span>
                        )}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_spread ?? ''} title={tip(c, 'detail_spread')}>
                        {r.concentration.spread === null ? '—' : fill(c.detail_spread_value ?? '', {
                            pct: formatPct(r.concentration.spread, language),
                            eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                            of: r.counted.toLocaleString(language),
                        })}
                    </DetailStatBox>
                </div>
                {/* Current method always shows the full standing; methods that keep the same council show it too
                    instead of leaving the right column with only the changes table (which renders nothing here). */}
                {election && (r.current || r.sameAsCurrent === true) && (
                    <ElectionRestTable election={election} c={c} g={g} language={language} />
                )}
                {election && (
                    <ElectionChangesTable election={election} c={c} g={g} />
                )}
                {d ? (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Target className="size-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                        <span>{fill(c.detail_decisive ?? '', {
                            count: d.count.toLocaleString(language),
                            of: r.counted.toLocaleString(language),
                            pct: r.counted > 0 ? formatShare(d.count / r.counted, language) : '—',
                            side: sideLabel,
                            xrd: formatXrd(d.xrd, language),
                        })}</span>
                    </p>
                ) : (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Info className="size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                        <span>{r.counted === 0 ? c.detail_nobody : election ? (c.election_decisive_note ?? '') : c.detail_no_quorum}</span>
                    </p>
                )}
            </div>
            <ResistanceCallout resistance={r.resistance} pill={<ResistancePill r={r} c={c} attack={attack} language={language} />}>
                <div className="min-w-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    <p><span className="font-bold text-[var(--color-text-main)]">{c.detail_attack ?? ''}: </span>{attack}</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-main)]">{election && !r.attack ? (c.election_attack_note ?? '') : formatAttackCost(r.attack, r.eligibleXrd, c, language)}</p>
                </div>
            </ResistanceCallout>
        </div>
    );
}

/** One expandable row in the single-vote voting methods comparison table. */
export function MethodRow({ r, c, g, params, threshold, quorum, ageLoading, language, onOpenGuide, rowId, focusNonce = 0 }: {
    r: MethodResult;
    c: C;
    g: G;
    params: Params;
    threshold: number | null;
    quorum: number | null;
    ageLoading: boolean;
    language: string;
    onOpenGuide?: (r: MethodResult) => void;
    rowId?: string;
    focusNonce?: number;
}) {
    const [open, setOpen] = useState(r.current);
    const [seenFocus, setSeenFocus] = useState(0);
    if (focusNonce > 0 && focusNonce !== seenFocus) {
        setSeenFocus(focusNonce);
        if (!open) setOpen(true);
    }
    const panelId = useId();
    const { name, rule, attack } = methodText(c, r.key, params);
    const pending = r.needsAge && ageLoading;
    const d = r.decisive;
    const election = r.electionSummary;
    const electionChangesLabel = election && (election.seatsChanged ?? 0) > 0
        ? fill(
            election.seatsChanged === 1 ? (c.election_changes_one ?? '') : (c.election_changes_many ?? ''),
            { n: (election.seatsChanged ?? 0).toLocaleString(language) },
        )
        : null;
    const electionSameLabel = election
        ? fill(c.election_same_seats ?? '', { n: election.elected.length.toLocaleString(language) })
        : null;
    return (
        <li id={rowId} className={`scroll-mt-24 rounded-2xl border bg-[var(--color-card-bg)] transition-colors ${r.current ? 'border-[var(--color-primary)]/50 shadow-[0_0_0_1px_var(--color-primary)]/10' : 'border-[var(--color-card-border)]'}`}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                title={open ? tip(c, 'collapse') : tip(c, 'expand')}
                onClick={() => setOpen(o => !o)}
                className="w-full text-left p-4 sm:px-5 grid gap-x-4 gap-y-3 grid-cols-6 lg:gap-x-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_16px] lg:items-center rounded-2xl hover:bg-[var(--color-surface)]/60 transition-colors"
            >
                <span className="col-span-6 lg:col-span-1 min-w-0 flex items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-bold text-[var(--color-text-main)]" title={name}>{name}</span>
                            {r.current && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-black bg-[var(--color-primary)] text-white cursor-help" title={tip(c, 'badge_current')}>{c.badge_current ?? ''}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--color-text-muted)]" title={rule}>{rule}</span>
                    </span>
                    <ChevronDown className={`lg:hidden size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>

                <span className="col-span-3 sm:col-span-2 lg:col-span-1 min-w-0 flex flex-col gap-1 self-center">
                    <span className="flex items-center h-7 min-w-0">
                        {pending ? (
                            <span className="inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full bg-[var(--color-surface)] text-[11px] text-[var(--color-text-muted)]" title={c.age_pending ?? ''}>
                                <Loader2 className="size-3.5 shrink-0 animate-spin" /><span className="truncate">{c.age_pending ?? ''}</span>
                            </span>
                        ) : <OutcomePill r={r} c={c} language={language} />}
                    </span>
                    <span className="flex items-center h-4 min-w-0">
                        {r.current ? (
                            <span className="truncate text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_current')}>{c.badge_reference ?? ''}</span>
                        ) : !pending && r.sameAsCurrent === false ? (
                            <span className="inline-flex items-center gap-1 truncate text-[9px] uppercase tracking-wider font-black text-amber-600 dark:text-amber-400 cursor-help" title={tip(c, 'badge_changes')}>
                                <ArrowLeftRight className="size-2.5 shrink-0" />{electionChangesLabel ?? c.badge_changes ?? ''}
                            </span>
                        ) : !pending && r.sameAsCurrent === true ? (
                            <span className="inline-flex items-center gap-1 truncate text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_same')}>
                                <Equal className="size-2.5 shrink-0" />{electionSameLabel ?? c.badge_same ?? ''}
                            </span>
                        ) : null}
                    </span>
                </span>
                <ComparisonCell className="col-span-6 sm:col-span-2 lg:col-span-1" label={election ? (c.col_overlap ?? '') : (c.col_support ?? '')} pending={pending}>
                    <SupportMeter r={r} c={c} threshold={threshold} language={language} />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_counted ?? ''} pending={pending}>
                    <FractionCell
                        n={r.counted}
                        of={r.counted + r.excluded}
                        title={tip(c, 'counted', { n: r.counted.toLocaleString(language), out: r.excluded.toLocaleString(language) })}
                        shareTitle={tip(c, 'counted_share', {
                            pct: formatShare(r.counted / Math.max(1, r.counted + r.excluded), language),
                            n: r.counted.toLocaleString(language), of: (r.counted + r.excluded).toLocaleString(language),
                        })}
                        language={language}
                    />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_nakamoto ?? ''} pending={pending}>
                    <SpreadMeter r={r} c={c} language={language} />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_decisive ?? ''} pending={pending}>
                    {d ? (
                        <FractionCell
                            n={d.count}
                            of={d.of}
                            title={tip(c, 'decisive', { count: d.count.toLocaleString(language), of: d.of.toLocaleString(language), xrd: formatXrd(d.xrd, language) })}
                            shareTitle={tip(c, 'decisive_share', { pct: formatShare(d.count / Math.max(1, d.of), language), n: d.count.toLocaleString(language), of: d.of.toLocaleString(language) })}
                            language={language}
                        />
                    ) : <span className="text-xs text-[var(--color-text-muted)] cursor-help" title={r.counted === 0 ? c.detail_nobody : c.detail_no_quorum}>—</span>}
                </ComparisonCell>
                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1 row-start-2 col-start-4 sm:row-auto sm:col-auto" label={c.col_resistance ?? ''} pending={false}>
                    <ResistancePill r={r} c={c} attack={attack} language={language} />
                </ComparisonCell>
                <ChevronDown className={`hidden lg:block size-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !pending && (
                <div id={panelId} className="border-t border-[var(--color-card-border)] pt-4">
                    <MethodDetail
                        r={r}
                        c={c}
                        g={g}
                        rule={rule}
                        attack={attack}
                        quorum={quorum}
                        threshold={threshold}
                        language={language}
                        onOpenGuide={onOpenGuide ? () => onOpenGuide(r) : undefined}
                    />
                </div>
            )}
        </li>
    );
}
