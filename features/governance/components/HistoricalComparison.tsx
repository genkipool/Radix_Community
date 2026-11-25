'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
    History, Coins, Users, Layers, Hourglass, ChevronDown, BadgeCheck, XCircle,
    ArrowLeftRight, Equal, ExternalLink, Info, PieChart, Target, Crown, Network, Gauge, TriangleAlert,
} from 'lucide-react';
import { GOVERNANCE_SYSTEMS, systemByKey } from '../config/systems';
import type { GovernanceEntry } from '../types';
import type { GovernanceItemKind } from '../lib/governanceVotes';
import { apiFetchGovernanceTally } from '../services/governanceApi';
import { tallyKey } from '../hooks/useGovernanceTally';
import { slidingWindowEnabled, toMethodVoters, useAccountAges } from '../hooks/useAccountAges';
import { METHODS, concentrationLevel, type MethodFamily } from '../lib/votingMethods';
import { aggregateHistoricalMethods, type HistoricalMethodRow } from '../lib/historicalMethods';
import { governanceItemPath } from '../lib/paths';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { ExplorerTable } from '@/features/dashboard/explorador/components/ExplorerTable';
import { Segmented, stanceResolver, type G } from './GovernanceBadges';
import { useRegisterTabExport, type RegisterTabExport } from './JsonExportPill';
import {
    RESISTANCE_STYLE,
    ruleParams, tip, methodText, matchesMethodQuery, resistanceTooltip, formatBalanceHint, nextSort, sortComparisonRows,
    OutcomeBadge, ComparisonTile, ComparisonCell, ConcentrationBar, FamilyFilterBar, MethodSearchInput, SortableHeaderButton, ComparisonGlossary,
    ProgressBar, FractionCell, SpreadMeterBar, DetailStatBox, FactTile, ResistanceCallout, GroupedMethodList,
    type CompareDict, type HistoricalDict, type Params, type SortState,
} from './ComparisonParts';

type ScopeKind = 'all' | GovernanceItemKind;

const TALLY_PARALLEL = 3;

function HistoricalMethodItem({ row, c, h, params, pending, language }: {
    row: HistoricalMethodRow;
    c: CompareDict;
    h: HistoricalDict;
    params: Params;
    pending: boolean;
    language: string;
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
        ? fill(h.tip_spread || '', {
            n: row.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 }),
            votes: row.votesEvaluated.toLocaleString(language),
            eff: row.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }),
            spread: formatPct(row.avgSpread, language),
            level: levels[spreadLevel] || spreadLevel,
        })
        : undefined;
    const xrdTitle = fill(h.tip_xrd || '', {
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

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_changes || ''} pending={pending}>
                    {row.current ? (
                        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_current')}>{c.badge_reference}</span>
                    ) : row.changedCount > 0 ? (
                        <span
                            className="inline-flex items-center gap-1 font-mono text-xs font-black text-amber-600 dark:text-amber-400 cursor-help"
                            title={fill(h.tip_changes || '', {
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
                            title={fill(h.tip_changes_zero || '', { total: totalDecided.toLocaleString(language) })}
                        >
                            <Equal className="size-3 shrink-0" />0/{totalDecided}
                        </span>
                    )}
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_ballots || ''} pending={pending}>
                    <FractionCell
                        n={row.totalBallotsCounted}
                        of={totalBallots}
                        title={fill(h.tip_ballots || '', {
                            n: row.totalBallotsCounted.toLocaleString(language),
                            total: totalBallots.toLocaleString(language),
                            out: row.totalBallotsExcluded.toLocaleString(language),
                        })}
                        shareTitle={fill(h.tip_ballots_share || '', {
                            pct: totalBallots > 0 ? formatShare(row.totalBallotsCounted / totalBallots, language) : '—',
                            n: row.totalBallotsCounted.toLocaleString(language),
                            total: totalBallots.toLocaleString(language),
                        })}
                        language={language}
                    />
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1" label={h.col_xrd || ''} pending={pending}>
                    <span className="font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums cursor-help" title={xrdTitle}>
                        {formatXrd(row.totalEligibleXrd, language)} XRD
                    </span>
                </ComparisonCell>

                <ComparisonCell className="col-span-3 sm:col-span-3 lg:col-span-1" label={h.col_spread || ''} pending={pending}>
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

                <ComparisonCell className="col-span-3 sm:col-span-3 lg:col-span-1" label={c.col_resistance || ''} pending={false}>
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
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{rule}</p>
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
                                    label={h.detail_votes || ''}
                                    title={fill(h.tip_detail_votes || '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                        total: (totalDecided || row.votesEvaluated).toLocaleString(language),
                                    })}
                                >
                                    {row.votesEvaluated.toLocaleString(language)}
                                </DetailStatBox>
                                <DetailStatBox
                                    label={h.detail_effective || ''}
                                    title={fill(h.tip_detail_effective || '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                    })}
                                >
                                    {row.avgEffective ? row.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }) : '—'}
                                </DetailStatBox>
                                <DetailStatBox
                                    label={h.col_xrd || ''}
                                    title={fill(h.tip_detail_xrd || '', {
                                        votes: row.votesEvaluated.toLocaleString(language),
                                        total: formatXrd(row.totalEligibleXrd, language),
                                        avg: formatXrd(row.votesEvaluated > 0 ? row.totalEligibleXrd / row.votesEvaluated : 0, language),
                                    })}
                                >
                                    {formatXrd(row.totalEligibleXrd, language)} XRD
                                </DetailStatBox>
                                <DetailStatBox
                                    label={c.detail_spread || ''}
                                    title={fill(h.tip_detail_spread || '', {
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
                                        {fill(h.detail_decisive || '', {
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
                                    title={fill(h.changed_list_title || '', { n: row.changedEntries.length.toLocaleString(language) })}
                                    icon={<ArrowLeftRight className="size-3 text-amber-500" />}
                                    headers={[
                                        { label: h.changed_col_vote || '', className: 'w-[44%]' },
                                        { label: h.changed_col_current || '', className: 'w-[28%]' },
                                        { label: h.changed_col_method || '', className: 'w-[28%]' },
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
                                                    <OutcomeBadge
                                                        compact
                                                        outcome={changed.currentOutcome}
                                                        winnerLabel={changed.currentWinner}
                                                        counted={1}
                                                        c={c}
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 min-w-0 text-right">
                                                    <OutcomeBadge
                                                        compact
                                                        outcome={changed.methodOutcome}
                                                        winnerLabel={changed.methodWinner}
                                                        counted={changed.methodCounted}
                                                        c={c}
                                                    />
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

/**
 * Historical comparison across all governance proposals and temperature checks,
 * sharing its visual primitives with `MethodsComparison`.
 */
export function HistoricalComparison({ entries, g, language, now, onRegisterExport }: {
    entries: GovernanceEntry[];
    g: G;
    language: string;
    now: number;
    onRegisterExport?: RegisterTabExport;
}) {
    const c: CompareDict = g.compare ?? {};
    const h: HistoricalDict = g.historical ?? {};
    const stanceLabel = stanceResolver(g);
    const [kind, setKind] = useState<ScopeKind>('all');
    const [systemFilter, setSystemFilter] = useState<string>('all');
    const [family, setFamily] = useState<MethodFamily | 'all'>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortState>(null);

    const scopedEntries = entries.filter(e => {
        const sys = systemByKey(e.systemKey);
        if (!sys || sys.network !== 'mainnet') return false;
        if (kind !== 'all' && e.kind !== kind) return false;
        if (systemFilter !== 'all' && e.systemKey !== systemFilter) return false;
        return true;
    });

    const client = useQueryClient();
    const tallyKeys = scopedEntries.map(e => {
        const sys = systemByKey(e.systemKey)!;
        return tallyKey({ component: sys.component, kind: e.kind, itemId: e.id, voters: true });
    });
    const canRunTally = slidingWindowEnabled(client, tallyKeys, TALLY_PARALLEL);

    const tallyQueries = useQueries({
        queries: scopedEntries.map((e, i) => {
            const sys = systemByKey(e.systemKey)!;
            return {
                queryKey: tallyKeys[i],
                queryFn: () => apiFetchGovernanceTally({ component: sys.component, type: e.kind, id: e.id, voters: true }),
                enabled: canRunTally(i),
                staleTime: 5 * 60_000,
                retry: 3,
                retryDelay: (attempt: number) => Math.min(8_000, 1_000 * 2 ** attempt),
            };
        }),
    });

    const loadedTallies = tallyQueries.filter(q => q.status === 'success' || q.status === 'error').length;
    const talliesDone = loadedTallies >= scopedEntries.length;

    const allUniqueAccounts: string[] = [];
    const seen = new Set<string>();
    let latestStart = 0;
    tallyQueries.forEach((q, i) => {
        const start = scopedEntries[i]?.item.start ?? 0;
        if (start > latestStart) latestStart = start;
        for (const v of q.data?.voters ?? []) {
            if (v.votePower !== null && Number(v.votePower) > 0 && !seen.has(v.account)) {
                seen.add(v.account);
                allUniqueAccounts.push(v.account);
            }
        }
    });

    const historyAt = latestStart > 0 ? latestStart : now;
    const ages = useAccountAges(allUniqueAccounts, 'mainnet', historyAt, talliesDone && allUniqueAccounts.length > 0);

    const voteInputs = scopedEntries.flatMap((entry, i) => {
        const rows = tallyQueries[i]?.data?.voters ?? [];
        const counted = rows.filter(v => v.votePower !== null && Number(v.votePower) > 0);
        if (counted.length === 0) return [];
        return [{ entry, voters: toMethodVoters(counted, ages), stanceLabel }];
    });

    const summary = aggregateHistoricalMethods(voteInputs, ages.done);
    const params = ruleParams(language);
    const current = summary.methods.find(m => m.current);
    const shown = summary.methods.filter(m =>
        (family === 'all' || m.family === family)
        && matchesMethodQuery(c, {
            key: m.key,
            family: m.family,
            resistance: m.resistance,
            spread: m.avgSpread,
            nakamoto: m.avgNakamoto,
            extra: [
                m.current ? c.badge_current : m.changedCount > 0 ? c.badge_changes : c.badge_same,
            ],
        }, params, query));
    const sortedShown = sortComparisonRows(shown, sort, r => r.avgSpread, r => r.resistance);

    useRegisterTabExport(onRegisterExport, () => ({
        tab: 'historical',
        exportedAt: new Date().toISOString(),
        filters: { kind, systemFilter, family, query, sort },
        progress: {
            loadedTallies,
            totalVotes: scopedEntries.length,
            talliesDone,
            agesLoaded: ages.loaded,
            agesTotal: ages.total,
            agesDone: ages.done,
        },
        summary,
        entries: scopedEntries.map(e => ({
            systemKey: e.systemKey,
            kind: e.kind,
            id: e.id,
            title: e.item.title,
            start: e.item.start,
            deadline: e.item.deadline,
        })),
        shownMethodKeys: sortedShown.map(m => m.key),
    }));
    const name = (m: HistoricalMethodRow) => methodText(c, m.key, params).name;
    const balanceHint = (m: HistoricalMethodRow) => formatBalanceHint(
        c,
        m.resistance,
        m.avgNakamoto,
        summary.votesAnalyzed > 0 ? Math.round(m.totalBallotsCounted / summary.votesAnalyzed) : 0,
        m.avgSpread,
        language,
        1,
    );
    const effectiveHint = (m: HistoricalMethodRow) => fill(h.kpi_effective_hint || '', {
        resistance: (((c.resistance ?? {}) as Record<string, string>)[m.resistance] || m.resistance).toLowerCase(),
        pct: formatPct(m.avgSpread ?? 0, language),
        valid: m.validVotesCount.toLocaleString(language),
        total: summary.votesAnalyzed.toLocaleString(language),
    });

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 sm:p-7">
                <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl" aria-hidden />
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="min-w-0 flex flex-col justify-between gap-5">
                        <div className="min-w-0">
                            <span className="grid place-items-center size-12 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                <History className="size-6" />
                            </span>
                            <h2 className="mt-4 text-xl md:text-2xl font-black text-[var(--color-text-main)]">{h.heading}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{h.intro}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Segmented<ScopeKind>
                                    label={g.filter_kind || ''}
                                    value={kind}
                                    onChange={setKind}
                                    options={[
                                        { value: 'all', label: g.kind_all || '' },
                                        { value: 'proposal', label: g.kind_proposal || '' },
                                        { value: 'temperature_check', label: g.kind_temperature_check || '' },
                                    ]}
                                />
                                {GOVERNANCE_SYSTEMS.length > 1 && (
                                    <Segmented<string>
                                        label={g.filter_system || ''}
                                        value={systemFilter}
                                        onChange={setSystemFilter}
                                        options={[{ value: 'all', label: g.system_all || '' }, ...GOVERNANCE_SYSTEMS.map(s => ({ value: s.key, label: s.name }))]}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                <FactTile icon={Layers} label={h.kpi_votes || ''} value={`${summary.votesAnalyzed.toLocaleString(language)}/${scopedEntries.length.toLocaleString(language)}`} />
                                <FactTile icon={Users} label={h.kpi_ballots || ''} value={summary.totalBallots.toLocaleString(language)} />
                                <FactTile icon={Users} label={h.fact_unique || ''} value={summary.uniqueVoters.toLocaleString(language)} />
                            </dl>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <FactTile icon={Coins} label={h.kpi_xrd || ''} value={`${formatXrd(summary.totalXrd, language)} XRD`} />
                                <FactTile icon={Coins} label={h.fact_avg_xrd || ''} value={`${formatXrd(summary.avgXrdPerVote, language)} XRD`} />
                            </dl>
                        </div>

                        <div className="space-y-2">
                            <ProgressBar
                                done={talliesDone}
                                icon={Layers}
                                label={fill(talliesDone ? (h.tallies_done || '') : (h.tallies_loading || ''), {
                                    n: loadedTallies.toLocaleString(language),
                                    total: scopedEntries.length.toLocaleString(language),
                                })}
                                ratio={scopedEntries.length ? loadedTallies / scopedEntries.length : 1}
                            />
                            <ProgressBar
                                done={ages.done && talliesDone}
                                icon={Hourglass}
                                label={fill(ages.done && talliesDone ? (c.age_done || '') : (c.age_loading || ''), {
                                    n: ages.loaded.toLocaleString(language),
                                    total: ages.total.toLocaleString(language),
                                })}
                                ratio={ages.total ? ages.loaded / ages.total : (talliesDone ? 1 : 0)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ComparisonTile
                            icon={ArrowLeftRight}
                            help={h.tip_kpi_most_changes}
                            label={h.kpi_most_changes || ''}
                            value={summary.mostChanges ? name(summary.mostChanges) : undefined}
                            hint={summary.mostChanges ? fill(h.kpi_most_changes_hint || '', {
                                n: summary.mostChanges.changedCount.toLocaleString(language),
                                total: (summary.mostChanges.changedCount + summary.mostChanges.sameCount).toLocaleString(language),
                            }) : undefined}
                        />
                        <ComparisonTile
                            icon={PieChart}
                            help={tip(c, 'kpi_current')}
                            label={c.kpi_current || ''}
                            value={current?.avgNakamoto != null ? fill(c.kpi_addresses || '', { n: current.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 }) }) : undefined}
                            hint={current ? fill(h.kpi_current_hint || '', {
                                voters: summary.votesAnalyzed > 0 ? Math.round(current.totalBallotsCounted / summary.votesAnalyzed).toLocaleString(language) : '0',
                                pct: formatPct(current.avgSpread ?? 0, language),
                                avg: formatXrd(summary.avgXrdPerVote, language),
                            }) : undefined}
                        />
                        <ComparisonTile
                            icon={Network}
                            help={tip(c, 'kpi_most_spread')}
                            label={c.kpi_most_spread || ''}
                            value={summary.mostDecentralised ? name(summary.mostDecentralised) : undefined}
                            hint={summary.mostDecentralised ? fill(c.kpi_spread_hint || '', {
                                n: (summary.mostDecentralised.avgNakamoto ?? 0).toLocaleString(language, { maximumFractionDigits: 1 }),
                                pct: formatPct(summary.mostDecentralised.avgSpread ?? 0, language),
                            }) : undefined}
                        />
                        <ComparisonTile
                            icon={Crown}
                            help={tip(c, 'kpi_most_concentrated')}
                            label={c.kpi_most_concentrated || ''}
                            value={summary.mostCentralised ? name(summary.mostCentralised) : undefined}
                            hint={summary.mostCentralised ? fill(c.kpi_spread_hint || '', {
                                n: (summary.mostCentralised.avgNakamoto ?? 0).toLocaleString(language, { maximumFractionDigits: 1 }),
                                pct: formatPct(summary.mostCentralised.avgSpread ?? 0, language),
                            }) : undefined}
                        />
                        <ComparisonTile
                            icon={Gauge}
                            help={tip(c, 'kpi_balanced')}
                            label={c.kpi_balanced || ''}
                            value={summary.mostBalanced ? name(summary.mostBalanced) : undefined}
                            hint={summary.mostBalanced ? balanceHint(summary.mostBalanced) : undefined}
                        />
                        <ComparisonTile
                            icon={TriangleAlert}
                            help={tip(c, 'kpi_unbalanced')}
                            label={c.kpi_unbalanced || ''}
                            value={summary.leastBalanced ? name(summary.leastBalanced) : undefined}
                            hint={summary.leastBalanced ? balanceHint(summary.leastBalanced) : undefined}
                        />
                        <ComparisonTile
                            icon={BadgeCheck}
                            help={h.tip_kpi_effective}
                            label={h.kpi_effective || ''}
                            value={summary.mostEffective ? name(summary.mostEffective) : undefined}
                            hint={summary.mostEffective ? effectiveHint(summary.mostEffective) : undefined}
                        />
                        <ComparisonTile
                            icon={XCircle}
                            help={h.tip_kpi_ineffective}
                            label={h.kpi_ineffective || ''}
                            value={summary.leastEffective ? name(summary.leastEffective) : undefined}
                            hint={summary.leastEffective ? effectiveHint(summary.leastEffective) : undefined}
                        />
                    </div>
                </div>
            </section>

            {summary.votesAnalyzed === 0 && talliesDone ? (
                <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                    <Info className="size-4 shrink-0" />{c.empty}
                </p>
            ) : (
                <section aria-labelledby="historical-methods-list" className="@container space-y-3">
                    <div className="space-y-2.5">
                        <h3 id="historical-methods-list" className="text-sm font-bold text-[var(--color-text-main)]">
                            {fill(c.list_title || '', { n: METHODS.length.toLocaleString(language) })}
                        </h3>
                        <div className="flex flex-col @xl:flex-row @xl:items-center gap-3">
                            <MethodSearchInput value={query} onChange={setQuery} placeholder={c.search_placeholder || ''} clearLabel={c.search_clear || ''} shownCount={shown.length} totalCount={summary.methods.length} />
                            <FamilyFilterBar family={family} onChange={setFamily} c={c} language={language} />
                        </div>
                    </div>

                    <div className="hidden lg:grid px-5 pt-3 gap-x-5 grid-cols-[minmax(0,1.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.9fr)_16px] text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                        <span className="cursor-help" title={tip(c, 'col_method')}>{c.col_method}</span>
                        <span className="cursor-help" title={h.tip_col_changes}>{h.col_changes}</span>
                        <span className="cursor-help" title={h.tip_col_ballots}>{h.col_ballots}</span>
                        <span className="cursor-help" title={h.tip_col_xrd}>{h.col_xrd}</span>
                        <SortableHeaderButton
                            label={h.col_spread || ''}
                            title={tip(c, 'col_nakamoto')}
                            active={sort?.by === 'spread'}
                            dir={sort?.by === 'spread' ? sort.dir : undefined}
                            onClick={() => setSort(prev => nextSort(prev, 'spread'))}
                        />
                        <SortableHeaderButton
                            label={c.col_resistance || ''}
                            title={tip(c, 'col_resistance')}
                            active={sort?.by === 'resistance'}
                            dir={sort?.by === 'resistance' ? sort.dir : undefined}
                            onClick={() => setSort(prev => nextSort(prev, 'resistance'))}
                        />
                        <span />
                    </div>

                    <GroupedMethodList
                        items={shown}
                        sorted={sortedShown}
                        sort={sort}
                        c={c}
                        renderRow={row => (
                            <HistoricalMethodItem
                                key={row.key}
                                row={row}
                                c={c}
                                h={h}
                                params={params}
                                pending={row.needsAge && (!talliesDone || !ages.done)}
                                language={language}
                            />
                        )}
                    />
                </section>
            )}

            <ComparisonGlossary id="historical-glossary" c={c} />
        </div>
    );
}
