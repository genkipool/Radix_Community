'use client';

import React, { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
    History, Coins, Users, Layers, Hourglass, BadgeCheck, XCircle,
    ArrowLeftRight, Info, PieChart, Crown, Network, Gauge, TriangleAlert,
} from 'lucide-react';
import { GOVERNANCE_SYSTEMS, systemByKey } from '../config/systems';
import type { GovernanceEntry } from '../types';
import type { GovernanceItemKind } from '../lib/governanceVotes';
import { apiFetchGovernanceTally } from '../services/governanceApi';
import { tallyKey } from '../hooks/useGovernanceTally';
import { slidingWindowEnabled, toMethodVoters, useAccountAges } from '../hooks/useAccountAges';
import { useMethodComparisonControls } from '../hooks/useMethodComparisonControls';
import { METHODS } from '../lib/votingMethods';
import { aggregateHistoricalMethods, type HistoricalMethodRow } from '../lib/historicalMethods';
import { fill, formatPct, formatXrd } from '../lib/format';
import { MethodGuideModal } from './MethodGuideModal';
import { HistoricalMethodItem } from './HistoricalMethodRow';
import { Segmented, stanceResolver, type G } from './GovernanceBadges';
import { useRegisterTabExport, type RegisterTabExport } from './JsonExportPill';
import { isCountedVoter } from '../lib/comparisonUtils';
import {
    ruleParams, tip, methodText, matchesMethodQuery, formatBalanceHint, nextSort, sortComparisonRows,
    ComparisonTile, FamilyFilterBar, MethodSearchInput, SortableHeaderButton, ComparisonGlossary,
    ProgressBar, FactTile, GroupedMethodList,
    type CompareDict, type HistoricalDict,
} from './ComparisonParts';

type ScopeKind = 'all' | GovernanceItemKind;

const TALLY_PARALLEL = 6;

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
    const {
        family, setFamily, query, setQuery, sort, setSort, focusedMethod, jumpToMethod,
    } = useMethodComparisonControls('historical-method-row-');
    const [guideRow, setGuideRow] = useState<HistoricalMethodRow | null>(null);

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
            if (isCountedVoter(v) && !seen.has(v.account)) {
                seen.add(v.account);
                allUniqueAccounts.push(v.account);
            }
        }
    });

    const historyAt = latestStart > 0 ? latestStart : now;
    const ages = useAccountAges(allUniqueAccounts, 'mainnet', historyAt, talliesDone && allUniqueAccounts.length > 0);

    const voteInputs = scopedEntries.flatMap((entry, i) => {
        const rows = tallyQueries[i]?.data?.voters ?? [];
        const counted = rows.filter(isCountedVoter);
        if (counted.length === 0) return [];
        return [{
            entry,
            voters: toMethodVoters(counted, ages),
            stanceLabel,
            gradeQuantile: tallyQueries[i]?.data?.electionData?.gradeQuantileApplied ?? null,
        }];
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
                                        { value: 'election', label: g.kind_election || '' },
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
                            onClick={summary.mostChanges ? () => jumpToMethod(summary.mostChanges!.key) : undefined}
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
                            onClick={summary.mostDecentralised ? () => jumpToMethod(summary.mostDecentralised!.key) : undefined}
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
                            onClick={summary.mostCentralised ? () => jumpToMethod(summary.mostCentralised!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={Gauge}
                            help={tip(c, 'kpi_balanced')}
                            label={c.kpi_balanced || ''}
                            value={summary.mostBalanced ? name(summary.mostBalanced) : undefined}
                            hint={summary.mostBalanced ? balanceHint(summary.mostBalanced) : undefined}
                            onClick={summary.mostBalanced ? () => jumpToMethod(summary.mostBalanced!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={TriangleAlert}
                            help={tip(c, 'kpi_unbalanced')}
                            label={c.kpi_unbalanced || ''}
                            value={summary.leastBalanced ? name(summary.leastBalanced) : undefined}
                            hint={summary.leastBalanced ? balanceHint(summary.leastBalanced) : undefined}
                            onClick={summary.leastBalanced ? () => jumpToMethod(summary.leastBalanced!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={BadgeCheck}
                            help={h.tip_kpi_effective}
                            label={h.kpi_effective || ''}
                            value={summary.mostEffective ? name(summary.mostEffective) : undefined}
                            hint={summary.mostEffective ? effectiveHint(summary.mostEffective) : undefined}
                            onClick={summary.mostEffective ? () => jumpToMethod(summary.mostEffective!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={XCircle}
                            help={h.tip_kpi_ineffective}
                            label={h.kpi_ineffective || ''}
                            value={summary.leastEffective ? name(summary.leastEffective) : undefined}
                            hint={summary.leastEffective ? effectiveHint(summary.leastEffective) : undefined}
                            onClick={summary.leastEffective ? () => jumpToMethod(summary.leastEffective!.key) : undefined}
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
                                rowId={`historical-method-row-${row.key}`}
                                focusNonce={focusedMethod?.key === row.key ? focusedMethod.nonce : 0}
                                onOpenGuide={setGuideRow}
                            />
                        )}
                    />
                </section>
            )}

            <ComparisonGlossary id="historical-glossary" c={c} />

            <MethodGuideModal
                isOpen={Boolean(guideRow)}
                onClose={() => setGuideRow(null)}
                target={guideRow ? {
                    mode: 'historical',
                    row: guideRow,
                    totalVotes: summary.votesAnalyzed,
                } : null}
                methodName={guideRow ? methodText(c, guideRow.key, params).name : ''}
                methodRule={guideRow ? methodText(c, guideRow.key, params).rule : ''}
                c={c}
                h={h}
                g={g}
                language={language}
            />
        </div>
    );
}
