'use client';

import React, { useState } from 'react';
import {
    Scale, Coins, Users, Hourglass, BadgeCheck, XCircle, Info,
    Equal, PieChart, Target, Crown, Network, Gauge, TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { toMethodVoters, useAccountAges } from '../hooks/useAccountAges';
import { useMethodComparisonControls } from '../hooks/useMethodComparisonControls';
import { itemChoices } from '../lib/governanceVotes';
import {
    CONTROL_SHARE, METHODS, compareMethods, computeAttackDifficulty, computeConsensusResistance, computeElectionConclusions,
    computeElectionConsensus, computeMethodResistance, computeMethodScoreRows, methodResistanceMetricsFromResult, scoreMethodResult,
    fairBalanceScore, fairEffectiveScore, fairScoreExtremes, sortMethodScoreRows, spreadExtremes,
    type MethodKey,
    type MethodResult,
} from '../lib/votingMethods';
import { parseQuantile } from '../lib/majorityJudgment';
import { isCountedVoter } from '../lib/comparisonUtils';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { TONE } from './VoteParts';
import { stanceResolver, type G } from './GovernanceBadges';
import {
    ElectionCandidatesKpiGrid,
    ElectionConsensusCandidateCards,
    ElectionConsensusKpiGrid,
    ElectionMethodCandidatesGrid,
} from './ElectionSection';
import { MethodGuideModal, MethodGuideTrigger } from './MethodGuideModal';
import { CURRENT_ATTACK_SHARES } from './ElectionResistanceTab';
import { MethodRow } from './ComparisonMethodRow';
import { MethodScoresTable, toScoreTableEntries } from './MethodScoresTable';
import { useRegisterTabExport, type RegisterTabExport } from './JsonExportPill';
import {
    ruleParams, tip, methodText, matchesMethodQuery, formatBalanceHint, nextSort, sortComparisonRows,
    methodCatalogForExport, glossaryForExport,
    ComparisonTile, FamilyFilterBar, MethodSearchInput, SortableHeaderButton, ComparisonGlossary,
    ProgressBar, FactTile, GroupedMethodList,
    type CompareDict,
} from './ComparisonParts';

type C = CompareDict;

/**
 * Comparison tab: the same ballots counted with other voting rules, what each
 * would have decided and how concentrated power is under each one.
 */
export function MethodsComparison({ entry, system, g, language, now, onRegisterExport }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
    onRegisterExport?: RegisterTabExport;
}) {
    const { item, kind, id } = entry;
    const c: C = g.compare ?? {};
    const choices = itemChoices(kind, item, stanceResolver(g));
    const {
        family, setFamily, query, setQuery, sort, setSort, focusedMethod, jumpToMethod,
    } = useMethodComparisonControls('method-row-');
    const [guidePanel, setGuidePanel] = useState<
        // Only the key: the method is looked up on every render so the panel never shows a stale snapshot.
        | { kind: 'method'; key: MethodKey }
        | { kind: 'consensus' }
        | { kind: 'current' }
        | null
    >(null);
    const [rankingViewKey, setRankingViewKey] = useState<MethodKey | 'consensus'>('consensus');

    // Same query as the result tab: switching tabs does not ask again.
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, voters: true }, system.network);
    const rows = tallyQuery.data?.voters ?? [];
    const counted = rows.filter(isCountedVoter);
    // Account age is measured on the day the vote opened.
    const at = item.start ?? now;
    const ages = useAccountAges(counted.map(v => v.account), system.network, at, counted.length > 0);
    const voters = toMethodVoters(counted, ages);
    const results = voters.length
        ? compareMethods(voters, choices, item, { gradeQuantile: tallyQuery.data?.electionData?.gradeQuantileApplied })
        : [];
    const params = ruleParams(language);
    const pending = rows.filter(v => v.votePower === null).length;
    const zeroPower = rows.filter(v => v.votePower !== null && !(Number(v.votePower) > 0)).length;
    const readyForExport = results.filter(r => !(r.needsAge && !ages.done) && r.counted > 0);
    // Any unread ledger figure leaves the voter out of some rule (same rule as the historical tab).
    const unknownAgesCount = ages.done
        ? voters.filter(v => v.ageDays === null || v.stakedXrd == null || v.twab90Xrd == null || v.min90Xrd == null).length
        : 0;
    const electionConsensus = kind === 'election'
        ? computeElectionConsensus(readyForExport, tallyQuery.data?.electionData)
        : null;
    const electionData = tallyQuery.data?.electionData ?? null;
    // Computed before the export getter so the JSON always contains the same
    // ranking rows as the table, even while tallies/ages are still loading.
    const scoreEntries = toScoreTableEntries(
        computeMethodScoreRows(readyForExport, {
            quantile: parseQuantile(electionData?.gradeQuantileApplied),
            consensus: kind === 'election' && Boolean(item.election) && electionConsensus
                ? {
                    methodWeights: electionConsensus.methodWeights,
                    concentration: electionConsensus.weightedConcentration,
                }
                : null,
        }),
        c,
        language,
        electionConsensus?.evaluatedMethods,
    );

    // The balance tiles are the first and last rows of the score table itself, so ties can never
    // make them name a different method than the table shows.
    const tableOrder = sortMethodScoreRows(scoreEntries.filter(r => !r.isConsensus), 'final', 'desc');
    const tableBalance = {
        most: tableOrder.length ? results.find(r => r.key === tableOrder[0].key) : undefined,
        least: tableOrder.length ? results.find(r => r.key === tableOrder[tableOrder.length - 1].key) : undefined,
    };

    useRegisterTabExport(onRegisterExport, () => {
        const currentResult = results.find(r => r.current);
        const otherResults = readyForExport.filter(r => !r.current);
        return {
            tab: 'compare',
            exportedAt: new Date().toISOString(),
            language,
            system: {
                key: system.key,
                name: system.name,
                network: system.network,
                component: system.component,
            },
            vote: {
                kind,
                id,
                title: item.title,
                start: item.start,
                deadline: item.deadline,
                quorum: item.quorum,
                approvalThreshold: item.approvalThreshold,
                /** Full proposal/election metadata, including options, description and candidate slate. */
                item,
            },
            filters: { family, query, sort },
            summary: {
                totalVoters: rows.length,
                countedVoters: currentResult?.counted ?? 0,
                pendingVoters: pending,
                zeroPowerVoters: zeroPower,
                eligibleXrd: currentResult?.eligibleXrd ?? 0,
                quorumXrd: currentResult?.quorumXrd ?? 0,
                agesLoaded: ages.loaded,
                agesTotal: ages.total,
                agesDone: ages.done,
                unknownAges: unknownAgesCount,
                sameOutcomeCount: otherResults.filter(r => r.sameAsCurrent).length,
                comparedMethodsCount: otherResults.length,
            },
            ...(electionConsensus ? (() => {
                const conclusions = computeElectionConclusions(
                    electionConsensus,
                    readyForExport,
                    voters.map(v => v.power),
                    item.quorum,
                    tallyQuery.data?.electionData?.gradeQuantileApplied ?? null,
                );
                return {
                    electionConsensus: {
                        ...electionConsensus,
                        conclusions,
                        resistance: {
                            // Level and score are the consensus row of the ranking table, not a fixed label.
                            level: scoreEntries.find(r => r.key === 'consensus')?.resistance ?? null,
                            score: scoreEntries.find(r => r.key === 'consensus')?.resistanceScore ?? null,
                            // `maxShare` is what the cards show; `difficulty` is scored from `scoringShare`, like the cards.
                            scenarios: computeConsensusResistance(
                                readyForExport,
                                electionConsensus.methodWeights,
                                parseQuantile(electionData?.gradeQuantileApplied),
                            ).map(sc => ({
                                ...sc,
                                decidesResult: sc.scoringShare > CONTROL_SHARE,
                                difficulty: computeAttackDifficulty(sc.id, sc.scoringShare).score,
                            })),
                        },
                    },
                    ...(currentResult ? {
                        currentMethodAnalysis: {
                            method: currentResult.key,
                            conclusions: {
                                gradeQuantile: conclusions.gradeQuantile,
                                quantileValue: conclusions.quantileValue,
                                decisiveBlock: conclusions.currentDecisiveBlock,
                                concentration: currentResult.concentration,
                                eligibleXrd: currentResult.eligibleXrd,
                                quorumRequiredXrd: item.quorum,
                                quorumReachedXrd: currentResult.quorumXrd,
                                quorumMet: currentResult.quorumMet,
                                electedSeats: currentResult.electionSummary?.elected ?? [],
                                agreementWithOtherMethods: {
                                    sameAsCurrentCount: conclusions.councilStability.sameAsCurrentCount,
                                    alternativeMethodsCount: conclusions.councilStability.alternativeMethodsCount,
                                    sameAsCurrentShare: conclusions.councilStability.sameAsCurrentShare,
                                },
                            },
                            resistance: {
                                // Structural tier from the catalogue and the 0..10 score of the ranking table.
                                level: currentResult.resistance,
                                score: scoreEntries.find(r => r.key === currentResult.key)?.resistanceScore ?? null,
                                scenarios: CURRENT_ATTACK_SHARES.map(sc => ({
                                    ...sc,
                                    decidesResult: sc.maxShare > CONTROL_SHARE,
                                    difficulty: computeAttackDifficulty(sc.id, sc.maxShare).score,
                                })),
                            },
                        },
                    } : {}),
                };
            })() : {}),
            /** The KPI tiles exactly as shown (balance = final score / 10, effectiveness = ∛(resistance/10 × spread × quorum)). */
            kpis: (() => {
                const q = parseQuantile(electionData?.gradeQuantileApplied);
                const pickKpi = (r: MethodResult | undefined, value?: number) => (r ? { key: r.key, ...(value !== undefined ? { value } : {}) } : null);
                const kpiReady = readyForExport;
                const spreadKpi = spreadExtremes(kpiReady, r => r.concentration.spread);
                const fair = fairScoreExtremes(kpiReady, q);
                const otherReady = kpiReady.filter(r => !r.current);
                return {
                    sameOutcome: { same: otherReady.filter(r => r.sameAsCurrent).length, total: otherReady.length },
                    mostDecentralised: pickKpi(spreadKpi.most, spreadKpi.most?.concentration.spread ?? undefined),
                    mostConcentrated: pickKpi(spreadKpi.least, spreadKpi.least?.concentration.spread ?? undefined),
                    mostBalanced: pickKpi(tableBalance.most, tableBalance.most ? fairBalanceScore(tableBalance.most, q) : undefined),
                    leastBalanced: pickKpi(tableBalance.least, tableBalance.least ? fairBalanceScore(tableBalance.least, q) : undefined),
                    mostEffective: pickKpi(fair.effective.most, fair.effective.most ? fairEffectiveScore(fair.effective.most, q) : undefined),
                    leastEffective: pickKpi(fair.effective.least, fair.effective.least ? fairEffectiveScore(fair.effective.least, q) : undefined),
                };
            })(),
            /**
             * Every method's full result. `scored` is false while it still needs account ages
             * (or counts nobody): such methods are left out of the tiles, the table and `methodAudits`.
             */
            methods: results.map(r => ({ ...r, scored: readyForExport.includes(r) })),
            /** The resistance panel of each scored method, exactly as rendered (localized texts included). */
            methodAudits: (() => {
                const q = parseQuantile(electionData?.gradeQuantileApplied);
                const dict = c as Record<string, unknown>;
                return readyForExport.map(m => {
                    const { scores } = scoreMethodResult(m, q);
                    const report = computeMethodResistance(m.key, methodResistanceMetricsFromResult(m, q), language);
                    return {
                        key: m.key,
                        resistanceTier: m.resistance,
                        scores: {
                            resistance: scores.score,
                            structural: scores.structuralScore,
                            attackDefence: scores.attackScore,
                            weakestAttack: scores.minDifficulty,
                            averageDifficulty: scores.avgDifficulty,
                            averageMaxShare: scores.avgMaxShare,
                            decentralisation: scores.decentralisationScore,
                            final: scores.finalScore,
                        },
                        balance: fairBalanceScore(m, q),
                        effectiveness: fairEffectiveScore(m, q),
                        attacks: report.scenarios.map(sc => ({
                            id: sc.id,
                            maxShare: sc.maxShare,
                            decidesResult: sc.maxShare > CONTROL_SHARE,
                            difficulty: computeAttackDifficulty(sc.id, sc.maxShare).score,
                            captures: fill(String(dict[sc.capturesKey] ?? ''), sc.params),
                            blocked: fill(String(dict[sc.blockedKey] ?? ''), sc.params),
                        })),
                    };
                });
            })(),
            /** Name, rule, family and resistance of all 50 methods, plus the figures their rules use. */
            methodCatalog: methodCatalogForExport(c, language),
            /** Ranking table exactly as rendered, with localized labels and score metrics. */
            scoreTable: {
                rows: scoreEntries,
                defaultSort: { key: 'final', dir: 'desc' },
            },
            /** Glossary shown under the table, with every level tip and hint. */
            glossary: glossaryForExport(c),
            /** Every ballot row, including vote history and per-candidate grades. */
            voters: rows,
            /** Raw tally payload (collector election results when available). */
            tally: tallyQuery.data ?? null,
            notes: [
                c.note_hypothetical ?? '',
                zeroPower > 0 ? fill(c.note_zero_power ?? '', { n: zeroPower.toLocaleString(language) }) : '',
                pending > 0 ? fill(c.note_pending ?? '', { n: pending.toLocaleString(language) }) : '',
                unknownAgesCount > 0 ? fill(c.note_unknown_age ?? '', { n: unknownAgesCount.toLocaleString(language) }) : '',
            ].filter(Boolean),
            /** All localized strings used by the governance tabs (labels, tooltips, guide steps). */
            labels: g,
        };
    });

    if (tallyQuery.isLoading) return <div className="h-64 rounded-2xl bg-[var(--color-surface)] animate-pulse" aria-hidden />;
    if (!results.length) {
        return (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                <Info className="size-4 shrink-0" />{c.empty ?? ''}
            </p>
        );
    }

    const ready = results.filter(r => !(r.needsAge && !ages.done) && r.counted > 0);
    const current = results.find(r => r.current)!;
    const others = ready.filter(r => !r.current);
    const same = others.filter(r => r.sameAsCurrent).length;
    // Ranked by how spread out the weight is, so a method is not favoured just because more addresses count under it.
    const { most, least } = spreadExtremes(ready, r => r.concentration.spread);
    const outcomeLabel = (r: MethodResult) => (
        r.counted === 0 ? c.outcome_none
            : r.outcome === 'approved' ? c.outcome_approved
                : r.outcome === 'rejected' ? c.outcome_rejected
                    : r.outcome === 'no_quorum' ? c.outcome_no_quorum
                        : r.winner?.label
    );
    const shown = results.filter(r =>
        (family === 'all' || r.family === family)
        && matchesMethodQuery(c, {
            key: r.key,
            family: r.family,
            resistance: r.resistance,
            spread: r.concentration.spread,
            nakamoto: r.concentration.nakamoto,
            extra: [
                outcomeLabel(r),
                r.current ? c.badge_current : r.sameAsCurrent === false ? c.badge_changes : r.sameAsCurrent === true ? c.badge_same : undefined,
            ],
        }, params, query));
    const sortedShown = sortComparisonRows(shown, sort, r => r.concentration.spread, r => r.resistance);
    const name = (r: MethodResult) => methodText(c, r.key, params).name;
    // Scored with the same 0..10 resistance as the ranking table.
    const { effective } = fairScoreExtremes(ready, parseQuantile(electionData?.gradeQuantileApplied));
    const balance = tableBalance;
    const resistanceScoreOf = (r: MethodResult) => scoreEntries.find(e => e.key === r.key)?.resistanceScore;
    const balanceHint = (r: MethodResult) =>
        formatBalanceHint(c, r.resistance, r.concentration.nakamoto, r.counted, r.concentration.spread, language, 0, resistanceScoreOf(r));
    const effectiveHint = (r: MethodResult) => fill(c.kpi_effective_hint || '', {
        score: (resistanceScoreOf(r) ?? 0).toLocaleString(language, { maximumFractionDigits: 1 }),
        resistance: (((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance).toLowerCase(),
        pct: formatPct(r.concentration.spread ?? 0, language),
        quorum: r.quorumMet === null ? (c.kpi_quorum_none || '') : r.quorumMet ? (c.kpi_quorum_ok || '') : (c.kpi_quorum_ko || ''),
    });

    const isElection = kind === 'election' && Boolean(item.election);
    const methodByKey = new Map(results.map(m => [m.key, m]));
    const guideMethod = guidePanel?.kind === 'method' ? methodByKey.get(guidePanel.key) : undefined;
    const openMethodGuide = (key: MethodKey | 'consensus') => {
        if (key === 'consensus') {
            if (electionConsensus) setGuidePanel({ kind: 'consensus' });
            return;
        }
        const hit = methodByKey.get(key);
        if (hit) setGuidePanel({ kind: 'method', key: hit.key });
    };
    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 sm:p-7">
                <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl" aria-hidden />
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    {/* The text spreads over the tiles' height: the age bar lines up with their bottom edge. */}
                    <div className="min-w-0 flex flex-col justify-between gap-5">
                        <div className="min-w-0">
                            <span className="grid place-items-center size-12 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                <Scale className="size-6" />
                            </span>
                            <h2 className="mt-4 text-xl md:text-2xl font-black text-[var(--color-text-main)]">{c.heading ?? ''}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{isElection
                                ? fill(c.intro_election ?? c.intro ?? '', { quantilePct: formatPct(parseQuantile(electionData?.gradeQuantileApplied), language) })
                                : c.intro}</p>
                        </div>
                        <dl className={isElection ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5'}>
                            {(() => {
                                const votersTip = zeroPower > 0
                                    ? tip(c, 'fact_voters_with_zero', {
                                        counted: current.counted.toLocaleString(language),
                                        total: rows.length.toLocaleString(language),
                                        zero: zeroPower.toLocaleString(language),
                                    })
                                    : tip(c, 'fact_voters');
                                return (isElection
                                    ? [
                                        [Users, c.fact_voters ?? '', current.counted.toLocaleString(language), votersTip],
                                        [Coins, c.fact_xrd ?? '', `${formatXrd(current.eligibleXrd, language)}`, tip(c, 'fact_xrd')],
                                        [Target, c.fact_quorum ?? '', item.quorum === null ? '—' : formatXrd(item.quorum, language), tip(c, 'fact_quorum')],
                                        [Crown, c.fact_seats ?? '', (item.election?.seatCount ?? 0).toLocaleString(language), tip(c, 'fact_seats'), undefined,
                                            // Same "N candidatos" line as the seats box in the results tab.
                                            (item.election?.candidates.length ?? 0) > 0
                                                ? `${(item.election?.candidates.length ?? 0).toLocaleString(language)} ${(g.candidates_title ?? '').toLowerCase()}`
                                                : undefined],
                                    ]
                                    : [
                                        [Users, c.fact_voters ?? '', current.counted.toLocaleString(language), votersTip],
                                        [Coins, c.fact_xrd ?? '', `${formatXrd(current.eligibleXrd, language)}`, tip(c, 'fact_xrd')],
                                        [Target, c.fact_quorum ?? '', item.quorum === null ? '—' : formatXrd(item.quorum, language), tip(c, 'fact_quorum')],
                                        [BadgeCheck, c.fact_threshold ?? '', item.approvalThreshold === null ? '—' : formatPct(item.approvalThreshold, language), tip(c, 'fact_threshold')],
                                        // Addresses behind each option, as they voted.
                                        ...current.rows.filter(x => x.power > 0 || x.tone !== 'neutral').map(x => {
                                            const n = current.addressesByChoice[x.key] ?? 0;
                                            return [TONE[x.tone].icon, x.label, n.toLocaleString(language), tip(c, 'fact_option', {
                                                n: n.toLocaleString(language), label: x.label, pct: formatShare(n / Math.max(1, current.counted), language),
                                            }), TONE[x.tone].text] as const;
                                        }),
                                    ]
                                );
                            })().map(([Icon, label, value, title, tone, hint]) => (
                                <FactTile
                                    key={label as string}
                                    icon={Icon as LucideIcon}
                                    label={label as string}
                                    value={value as string}
                                    title={title as string | undefined}
                                    tone={tone as string | undefined}
                                    hint={hint as string | undefined}
                                />
                            ))}
                        </dl>
                        <ProgressBar
                            done={ages.done}
                            icon={Hourglass}
                            label={fill(ages.done ? (c.age_done ?? '') : (c.age_loading ?? ''), {
                                n: ages.loaded.toLocaleString(language), total: ages.total.toLocaleString(language),
                            })}
                            ratio={ages.total ? ages.loaded / ages.total : 1}
                        />
                    </div>
                    {/* In pairs: result and today, centralisation, balance. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ComparisonTile
                            icon={Equal}
                            help={tip(c, 'kpi_consensus')}
                            label={c.kpi_consensus ?? ''}
                            value={fill(c.kpi_consensus_value ?? '', { n: same.toLocaleString(language), total: others.length.toLocaleString(language) })}
                            hint={same === others.length
                                ? c.kpi_consensus_all
                                : others.length - same === 1
                                    ? c.kpi_consensus_hint_one
                                    : fill(c.kpi_consensus_hint ?? '', { changed: (others.length - same).toLocaleString(language) })}
                        />
                        <ComparisonTile
                            icon={PieChart}
                            help={tip(c, 'kpi_current')}
                            label={c.kpi_current ?? ''}
                            value={fill(c.kpi_addresses ?? '', { n: (current.concentration.nakamoto ?? 0).toLocaleString(language) })}
                            hint={fill(c.kpi_current_hint ?? '', { total: current.counted.toLocaleString(language) })}
                        />
                        <ComparisonTile
                            icon={Network}
                            help={tip(c, 'kpi_most_spread')}
                            label={c.kpi_most_spread ?? ''}
                            value={most ? name(most) : undefined}
                            hint={most ? fill(c.kpi_spread_hint ?? '', { n: (most.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(most.concentration.spread ?? 0, language) }) : undefined}
                            onClick={most ? () => jumpToMethod(most.key) : undefined}
                        />
                        <ComparisonTile
                            icon={Crown}
                            help={tip(c, 'kpi_most_concentrated')}
                            label={c.kpi_most_concentrated ?? ''}
                            value={least ? name(least) : undefined}
                            hint={least ? fill(c.kpi_spread_hint ?? '', { n: (least.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(least.concentration.spread ?? 0, language) }) : undefined}
                            onClick={least ? () => jumpToMethod(least.key) : undefined}
                        />
                        <ComparisonTile
                            icon={Gauge}
                            help={tip(c, 'kpi_balanced')}
                            label={c.kpi_balanced ?? ''}
                            value={balance.most ? name(balance.most) : undefined}
                            hint={balance.most ? balanceHint(balance.most) : undefined}
                            onClick={balance.most ? () => jumpToMethod(balance.most!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={TriangleAlert}
                            help={tip(c, 'kpi_unbalanced')}
                            label={c.kpi_unbalanced ?? ''}
                            value={balance.least ? name(balance.least) : undefined}
                            hint={balance.least ? balanceHint(balance.least) : undefined}
                            onClick={balance.least ? () => jumpToMethod(balance.least!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={BadgeCheck}
                            help={tip(c, 'kpi_effective')}
                            label={c.kpi_effective || ''}
                            value={effective.most ? name(effective.most) : undefined}
                            hint={effective.most ? effectiveHint(effective.most) : (ready.length > 0 ? c.kpi_effective_none : undefined)}
                            onClick={effective.most ? () => jumpToMethod(effective.most!.key) : undefined}
                        />
                        <ComparisonTile
                            icon={XCircle}
                            help={tip(c, 'kpi_ineffective')}
                            label={c.kpi_ineffective || ''}
                            value={effective.least ? name(effective.least) : undefined}
                            hint={effective.least ? effectiveHint(effective.least) : (ready.length > 0 ? c.kpi_effective_none : undefined)}
                            onClick={effective.least ? () => jumpToMethod(effective.least!.key) : undefined}
                        />
                    </div>
                </div>
            </section>

            {isElection && item.election && electionData && (
                <section aria-labelledby="election-current-ranking-heading" className="space-y-2.5">
                    <h3 id="election-current-ranking-heading" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                        <Crown className="size-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                        <span>{c.election_current_ranking_title ?? ''}</span>
                        {electionConsensus && (
                            <MethodGuideTrigger
                                onClick={() => setGuidePanel({ kind: 'current' })}
                                label={c.election_current_guide_open ?? ''}
                            />
                        )}
                    </h3>
                    <ElectionCandidatesKpiGrid
                        election={item.election}
                        electionData={electionData}
                        g={g}
                        language={language}
                    />
                    {(() => {
                        // The recount weighs ballots at the snapshot like the collector; when current
                        // power had to stand in, or the totals differ, say so instead of silently
                        // showing two orders.
                        const official = Number(electionData.totalVotingPower);
                        const recounted = voters.reduce((sum, v) => sum + v.power, 0);
                        if (!Number.isFinite(official)) return null;
                        if (electionData.powerAt !== 'current' && Math.abs(official - recounted) < 1) return null;
                        return (
                            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                                <Info className="size-3 mt-0.5 shrink-0" />
                                {fill(c.election_official_mismatch_note ?? '', {
                                    official: formatXrd(official, language),
                                    counted: formatXrd(recounted, language),
                                    diff: formatXrd(Math.abs(official - recounted), language),
                                    zero: zeroPower.toLocaleString(language),
                                })}
                            </p>
                        );
                    })()}
                </section>
            )}

            {isElection && electionConsensus && (
                <ElectionConsensusKpiGrid
                    consensus={electionConsensus}
                    methods={readyForExport}
                    scoreRows={scoreEntries}
                    selectedKey={rankingViewKey}
                    onSelectKey={setRankingViewKey}
                    gradeQuantile={electionData?.gradeQuantileApplied ?? null}
                    c={c}
                    g={g}
                    language={language}
                    onOpenGuide={openMethodGuide}
                />
            )}

            <section aria-labelledby="methods-list" className="@container space-y-3">
                <div className="space-y-2.5">
                    <h3 id="methods-list" className="text-sm font-bold text-[var(--color-text-main)]">{fill(c.list_title ?? '', { n: METHODS.length.toLocaleString(language) })}</h3>
                    <div className="flex flex-col @xl:flex-row @xl:items-center gap-3">
                        <MethodSearchInput value={query} onChange={setQuery} placeholder={c.search_placeholder || ''} clearLabel={c.search_clear || ''} shownCount={shown.length} totalCount={results.length} />
                        <FamilyFilterBar family={family} onChange={setFamily} c={c} language={language} />
                    </div>
                </div>

                <div className="hidden lg:grid px-5 pt-3 gap-x-5 grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_16px] text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                    <span className="cursor-help" title={tip(c, 'col_method')}>{c.col_method ?? ''}</span>
                    <span className="cursor-help" title={tip(c, 'col_result')}>{c.col_result ?? ''}</span>
                    <span className="cursor-help" title={tip(c, isElection ? 'col_overlap' : 'col_support')}>{isElection ? (c.col_overlap ?? '') : (c.col_support ?? '')}</span>
                    <span className="cursor-help" title={tip(c, 'col_counted')}>{c.col_counted ?? ''}</span>
                    <SortableHeaderButton
                        label={c.col_nakamoto ?? ''}
                        title={tip(c, 'col_nakamoto')}
                        active={sort?.by === 'spread'}
                        dir={sort?.by === 'spread' ? sort.dir : undefined}
                        onClick={() => setSort(prev => nextSort(prev, 'spread'))}
                    />
                    <span className="cursor-help" title={tip(c, 'col_decisive')}>{c.col_decisive ?? ''}</span>
                    <SortableHeaderButton
                        label={c.col_resistance ?? ''}
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
                    renderRow={r => (
                        <MethodRow
                            key={r.key}
                            r={r}
                            c={c}
                            g={g}
                            params={params}
                            threshold={item.approvalThreshold}
                            quorum={item.quorum}
                            ageLoading={!ages.done}
                            language={language}
                            rowId={`method-row-${r.key}`}
                            focusNonce={focusedMethod?.key === r.key ? focusedMethod.nonce : 0}
                            onOpenGuide={m => setGuidePanel({ kind: 'method', key: m.key })}
                        />
                    )}
                />
            </section>

            {scoreEntries.length > 0 && (
                <MethodScoresTable
                    rows={scoreEntries}
                    onJumpToMethod={key => {
                        if (key === 'consensus') {
                            document.getElementById('election-consensus-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            return;
                        }
                        jumpToMethod(key);
                    }}
                    onOpenGuide={openMethodGuide}
                    canExpandRow={isElection && electionConsensus ? row => (
                        row.key === 'consensus' || Boolean(methodByKey.get(row.key)?.electionSummary)
                    ) : undefined}
                    renderExpandedRow={isElection && electionConsensus ? row => {
                        if (row.key === 'consensus') {
                            return (
                                <ElectionConsensusCandidateCards
                                    consensus={electionConsensus}
                                    c={c}
                                    g={g}
                                    language={language}
                                />
                            );
                        }
                        const method = methodByKey.get(row.key);
                        if (!method?.electionSummary) return null;
                        return (
                            <ElectionMethodCandidatesGrid
                                summary={method.electionSummary}
                                gradeQuantile={electionData?.gradeQuantileApplied ?? null}
                                c={c}
                                g={g}
                                language={language}
                            />
                        );
                    } : undefined}
                    c={c}
                    language={language}
                />
            )}

            <ComparisonGlossary id="methods-glossary" c={c} />

            <MethodGuideModal
                isOpen={guidePanel !== null && (guidePanel.kind === 'method' ? Boolean(guideMethod) : Boolean(electionConsensus))}
                onClose={() => setGuidePanel(null)}
                target={guideMethod ? {
                    mode: 'single',
                    method: guideMethod,
                    current,
                    allMethods: readyForExport,
                    quorum: item.quorum,
                    threshold: item.approvalThreshold,
                    gradeQuantile: electionData?.gradeQuantileApplied ?? null,
                } : guidePanel?.kind === 'current' && electionConsensus ? {
                    mode: 'current-election',
                    consensus: electionConsensus,
                    current,
                    methods: readyForExport,
                    voterPowers: voters.map(v => v.power),
                    quorum: item.quorum,
                    gradeQuantile: electionData?.gradeQuantileApplied ?? null,
                } : guidePanel?.kind === 'consensus' && electionConsensus ? {
                    mode: 'consensus',
                    consensus: electionConsensus,
                    current,
                    methods: readyForExport,
                    voterPowers: voters.map(v => v.power),
                    quorum: item.quorum,
                    gradeQuantile: electionData?.gradeQuantileApplied ?? null,
                } : null}
                methodName={guideMethod
                    ? methodText(c, guideMethod.key, params).name
                    : guidePanel?.kind === 'current'
                        ? methodText(c, current.key, params).name
                        : electionConsensus
                            ? fill(c.election_consensus_title ?? '', { n: electionConsensus.evaluatedMethods.toLocaleString(language) })
                            : ''}
                methodRule={guideMethod
                    ? methodText(c, guideMethod.key, params).rule
                    : guidePanel?.kind === 'current'
                        ? methodText(c, current.key, params).rule
                        : fill(c.election_consensus_hint ?? '', electionConsensus ? {
                            families: electionConsensus.familyCount.toLocaleString(language),
                            pct: formatPct(electionConsensus.familyCount > 0 ? 1 / electionConsensus.familyCount : 0, language),
                        } : {})}
                c={c}
                g={g}
                language={language}
            />

            <div className="space-y-1.5">
                {[
                    c.note_hypothetical,
                    zeroPower > 0 ? fill(c.note_zero_power ?? '', { n: zeroPower.toLocaleString(language) }) : null,
                    pending > 0 ? fill(c.note_pending ?? '', { n: pending.toLocaleString(language) }) : null,
                    unknownAgesCount > 0 ? fill(c.note_unknown_age ?? '', { n: unknownAgesCount.toLocaleString(language) }) : null,
                ].filter(Boolean).map((text, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />{text}
                    </p>
                ))}
            </div>
        </div>
    );
}
