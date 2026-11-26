'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowLeftRight, Equal, ExternalLink, Target } from 'lucide-react';
import { concentrationLevel } from '../lib/votingMethods';
import type { HistoricalMethodRow } from '../lib/historicalMethods';
import { governanceItemPath } from '../lib/paths';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { ExplorerTable } from '@/features/dashboard/explorador/components/ExplorerTable';
import { MethodGuideTrigger } from './MethodGuideModal';
import {
    RESISTANCE_STYLE,
    tip, methodText, resistanceTooltip,
    OutcomeBadge, ComparisonCell, ConcentrationBar, FractionCell, SpreadMeterBar, DetailStatBox, ResistanceCallout,
    type CompareDict, type HistoricalDict, type Params,
} from './ComparisonParts';

export function HistoricalMethodItem({ row, c, h, params, pending, language, onOpenGuide }: {
    row: HistoricalMethodRow;
    c: CompareDict;
    h: HistoricalDict;
    params: Params;
    pending: boolean;
    language: string;
    onOpenGuide?: (row: HistoricalMethodRow) => void;
}) {
    const [open, setOpen] = useState(row.current);
    const panelId = useId();
    const { name, rule, attack } = methodText(c, row.key, params);
    const { icon: ResIcon, cls: resCls } = RESISTANCE_STYLE[row.resistance];
    const resLabel = ((c.resistance ?? {}) as Record<string, string>)[row.resistance] || row.resistance;
    const resTitle = resistanceTooltip(c, row.resistance, attack);
    const totalBallots = row.totalBallotsCounted + row.totalBallotsExcluded;
    const totalDecided = row.changedCount + row.sameCount;
    const spreadLevel = concentrationLevel({
        nakamoto: row.avgNakamoto === null ? null : Math.round(row.avgNakamoto),
        spread: row.avgSpread,
    });
    const levels = (c.levels ?? {}) as Record<string, string>;
    const spreadTitle = row.avgNakamoto !== null && row.avgSpread !== null && spreadLevel
        ? fill(h.tip_spread ?? '', {
            n: row.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 }),
            votes: row.votesEvaluated.toLocaleString(language),
            eff: row.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }),
            spread: formatPct(row.avgSpread, language),
            level: levels[spreadLevel] || spreadLevel,
        })
        : undefined;
    const xrdTitle = fill(h.tip_xrd ?? '', {
        total: formatXrd(row.totalEligibleXrd, language),
        votes: row.votesEvaluated.toLocaleString(language),
        avg: formatXrd(row.votesEvaluated > 0 ? row.totalEligibleXrd / row.votesEvaluated : 0, language),
    });

    return (
        <li className={`rounded-2xl border bg-[var(--color-card-bg)] transition-colors ${row.current ? 'border-[var(--color-primary)]/50 shadow-[0_0_0_1px_var(--color-primary)]/10' : 'border-[var(--color-card-border)]'}`}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                title={open ? tip(c, 'collapse') : tip(c, 'expand')}
                onClick={() => setOpen(o => !o)}
                className="w-full text-left p-4 sm:px-5 grid gap-x-4 gap-y-3 grid-cols-6 lg:gap-x-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.9fr)_16px] lg:items-center rounded-2xl hover:bg-[var(--color-surface)]/60 transition-colors"
            >
                <span className="col-span-6 lg:col-span-1 min-w-0 flex items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-bold text-[var(--color-text-main)]" title={name}>{name}</span>
                            {row.current && (
                                <span
                                    className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-black bg-[var(--color-primary)] text-white cursor-help"
                                    title={tip(c, 'badge_current')}
                                >
                                    {c.badge_current}
                                </span>
                            )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--color-text-muted)]" title={rule}>{rule}</span>
                    </span>
                    <ChevronDown className={`lg:hidden size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_changes ?? ''} pending={pending}>
                    {row.current ? (
                        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_current')}>{c.badge_reference}</span>
                    ) : row.changedCount > 0 ? (
                        <span
                            className="inline-flex items-center gap-1 font-mono text-xs font-black text-amber-600 dark:text-amber-400 cursor-help"
                            title={fill(h.tip_changes ?? '', {
                                n: row.changedCount.toLocaleString(language),
                                total: totalDecided.toLocaleString(language),
                                pct: totalDecided > 0 ? formatShare(row.changedCount / totalDecided, language) : '—',
                            })}
                        >
                            <ArrowLeftRight className="size-3 shrink-0" />
                            {row.changedCount}/{totalDecided}
                            <span className="font-normal text-[10px] text-[var(--color-text-muted)]">
                                ({totalDecided > 0 ? formatShare(row.changedCount / totalDecided, language) : '—'})
                            </span>
                        </span>
                    ) : (
                        <span
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] cursor-help"
                            title={fill(h.tip_changes_zero ?? '', { total: totalDecided.toLocaleString(language) })}
                        >
                            <Equal className="size-3 shrink-0" />0/{totalDecided}
                        </span>
                    )}
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_ballots ?? ''} pending={pending}>
                    <FractionCell
                        n={row.totalBallotsCounted}
                        of={totalBallots}
                        title={fill(h.tip_ballots ?? '', {
                            n: row.totalBallotsCounted.toLocaleString(language),
                            total: totalBallots.toLocaleString(language),
                            out: row.totalBallotsExcluded.toLocaleString(language),
                        })}
                        shareTitle={fill(h.tip_ballots_share ?? '', {
                            pct: totalBallots > 0 ? formatShare(row.totalBallotsCounted / totalBallots, language) : '—',
                            n: row.totalBallotsCounted.toLocaleString(language),
                            total: totalBallots.toLocaleString(language),
                        })}
                        language={language}
                    />
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_xrd ?? ''} pending={pending}>
                    <span className="font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums cursor-help" title={xrdTitle}>
                        {formatXrd(row.totalEligibleXrd, language)} XRD
                    </span>
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-3 lg:col-span-1" label={h.col_spread ?? ''} pending={pending}>
                    <SpreadMeterBar
                        nakamoto={row.avgNakamoto}
                        spread={row.avgSpread}
                        title={spreadTitle}
                        emptyTitle={tip(c, 'outcome_none') || c.outcome_none}
                        c={c}
                        language={language}
                        maxFractionDigits={1}
                    />
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-3 lg:col-span-1" label={c.col_resistance ?? ''} pending={false}>
                    <span className={`inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full border text-[11px] font-bold cursor-help ${resCls}`} title={resTitle}>
                        <ResIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{resLabel}</span>
                    </span>
                </ComparisonCell>

                <ChevronDown className={`hidden lg:block size-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && !pending && (
                <div id={panelId} className="border-t border-[var(--color-card-border)] pt-4">
                    <div className="grid gap-5 lg:grid-cols-2 px-4 sm:px-5 pb-5 pt-1">
                        <div className="flex flex-col gap-4 min-w-0">
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                                {rule}
                                {onOpenGuide && (
                                    <MethodGuideTrigger onClick={() => onOpenGuide(row)} label={h.guide_open ?? ''} />
                                )}
                            </p>
                            {row.votesEvaluated > 0 && (
                                <div className="flex-1 flex flex-col min-h-0">
                                    <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{c.detail_concentration}</p>
                                    <ConcentrationBar top1={row.avgTop1} top10={row.avgTop10} c={c} language={language} orientation="vertical" />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-4 min-w-0">
                            <div className="grid grid-cols-2 gap-2">
                                <DetailStatBox
                                    label={h.detail_votes ?? ''}
                                    title={fill(h.tip_detail_votes ?? '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                        total: (totalDecided || row.votesEvaluated).toLocaleString(language),
                                    })}
                                >
                                    {row.votesEvaluated.toLocaleString(language)}
                                </DetailStatBox>
                                <DetailStatBox
                                    label={h.detail_effective ?? ''}
                                    title={fill(h.tip_detail_effective ?? '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                    })}
                                >
                                    {row.avgEffective ? row.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }) : '—'}
                                </DetailStatBox>
                                <DetailStatBox
                                    label={h.col_xrd ?? ''}
                                    title={fill(h.tip_detail_xrd ?? '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                        total: formatXrd(row.totalEligibleXrd, language),
                                        avg: formatXrd(row.votesEvaluated > 0 ? row.totalEligibleXrd / row.votesEvaluated : 0, language),
                                    })}
                                >
                                    {formatXrd(row.totalEligibleXrd, language)} XRD
                                </DetailStatBox>
                                <DetailStatBox
                                    label={c.detail_spread ?? ''}
                                    title={fill(h.tip_detail_spread ?? '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                        pct: row.avgSpread === null ? '—' : formatPct(row.avgSpread, language),
                                    })}
                                >
                                    {row.avgSpread === null ? '—' : formatPct(row.avgSpread, language)}
                                </DetailStatBox>
                            </div>

                            {row.avgDecisiveCount !== null && row.avgDecisiveOf !== null && row.avgDecisiveXrd !== null && (
                                <p className="flex items-start gap-2 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                                    <Target className="size-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                                    <span>
                                        {fill(h.detail_decisive ?? '', {
                                            votes: row.decisiveVotesCount.toLocaleString(language),
                                            count: row.avgDecisiveCount.toLocaleString(language, { maximumFractionDigits: 1 }),
                                            of: row.avgDecisiveOf.toLocaleString(language, { maximumFractionDigits: 1 }),
                                            pct: row.avgDecisiveOf > 0 ? formatShare(row.avgDecisiveCount / row.avgDecisiveOf, language) : '—',
                                            xrd: formatXrd(row.avgDecisiveXrd, language),
                                            totalXrd: formatXrd(row.totalDecisiveXrd, language),
                                        })}
                                    </span>
                                </p>
                            )}

                            {row.changedEntries.length > 0 && (
                                <ExplorerTable
                                    compact
                                    title={fill(h.changed_list_title ?? '', { n: row.changedEntries.length.toLocaleString(language) })}
                                    icon={<ArrowLeftRight className="size-3 text-amber-500" />}
                                    headers={[
                                        { label: h.changed_col_vote ?? '', className: 'w-[44%]' },
                                        { label: h.changed_col_current ?? '', className: 'w-[28%]' },
                                        { label: h.changed_col_method ?? '', className: 'w-[28%]' },
                                    ]}
                                >
                                    {row.changedEntries.map(changed => {
                                        const { entry } = changed;
                                        const label = entry.item.title || `#${entry.id}`;
                                        return (
                                            <tr key={`${entry.systemKey}-${entry.kind}-${entry.id}`} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-[var(--color-surface)]/40 transition-colors">
                                                <td className="py-1.5 px-2 min-w-0">
                                                    <Link
                                                        href={`/${language}${governanceItemPath(entry.systemKey, entry.kind, entry.id)}?tab=compare`}
                                                        title={label}
                                                        className="inline-flex items-center gap-1 max-w-full text-[11px] font-semibold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors"
                                                    >
                                                        <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">#{entry.id}</span>
                                                        <span className="truncate">{label}</span>
                                                        <ExternalLink className="size-2.5 shrink-0 text-[var(--color-text-muted)]" />
                                                    </Link>
                                                </td>
                                                <td className="py-1.5 px-2 min-w-0">
                                                    {changed.currentSeats ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                                                            {fill(c.election_seats_pill ?? '', {
                                                                n: changed.currentSeats.elected.toLocaleString(language),
                                                                total: changed.currentSeats.total.toLocaleString(language),
                                                            })}
                                                        </span>
                                                    ) : (
                                                        <OutcomeBadge
                                                            compact
                                                            outcome={changed.currentOutcome}
                                                            winnerLabel={changed.currentWinner}
                                                            counted={1}
                                                            c={c}
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2 min-w-0 text-right">
                                                    {changed.methodSeats && changed.seatsChanged ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                            {fill(
                                                                changed.seatsChanged === 1 ? (c.election_changes_one ?? '') : (c.election_changes_many ?? ''),
                                                                { n: changed.seatsChanged.toLocaleString(language) },
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <OutcomeBadge
                                                            compact
                                                            outcome={changed.methodOutcome}
                                                            winnerLabel={changed.methodWinner}
                                                            counted={changed.methodCounted}
                                                            c={c}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </ExplorerTable>
                            )}
                        </div>

                        <ResistanceCallout
                            resistance={row.resistance}
                            pill={(
                                <span className={`inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full border text-[11px] font-bold cursor-help ${resCls}`} title={resTitle}>
                                    <ResIcon className="size-3.5 shrink-0" /><span className="truncate">{resLabel}</span>
                                </span>
                            )}
                        >
                            <p className="min-w-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                                <span className="font-bold text-[var(--color-text-main)]">{c.detail_attack}: </span>{attack}
                            </p>
                        </ResistanceCallout>
                    </div>
                </div>
            )}
        </li>
    );
}
