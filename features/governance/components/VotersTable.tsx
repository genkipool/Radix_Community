'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Loader2, ArrowLeftRight } from 'lucide-react';
import type { BallotChoice, TallySummary } from '../lib/governanceVotes';
import type { VoterRow } from '../types';
import { MJ_GRADE_DOT_COLOR, MJ_GRADE_ORDER } from '../lib/majorityJudgment';
import { fill, formatDate, formatPct, formatShare, formatXrd } from '../lib/format';
import { CopyButton, shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { useCopy } from '../hooks/useCopy';
import type { G } from './GovernanceBadges';
import { MultiFilterDropdown, type MultiFilterOption } from './MultiFilterDropdown';
import { VoterTxHistoryCell, VoterVoteCell } from './VoterBallotCells';

type VoterSort = 'recent' | 'power';

function formatDropdownLabel(
    activeOptions: MultiFilterOption[],
    fallback: string,
    rowCount: number,
    language: string,
): { label: string; title?: string } {
    if (activeOptions.length === 0) return { label: fallback };
    if (activeOptions.length === 1) {
        return { label: `${activeOptions[0].label} (${rowCount.toLocaleString(language)})` };
    }
    return {
        label: `${activeOptions[0].label} +${(activeOptions.length - 1).toLocaleString(language)}`,
        title: activeOptions.map(o => o.label).join(', '),
    };
}

/**
 * Every account with a counted vote: newest first by default or by voting
 * power, with a tab per ballot choice (or multi-select grade & candidate
 * filters for Majority Judgment elections). The XRD total follows the filter.
 */
export function VotersTable({ tally, voters, choices, g, language }: {
    tally: TallySummary | null;
    voters: VoterRow[];
    choices: BallotChoice[];
    g: G;
    language: string;
}) {
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [onlyChanged, setOnlyChanged] = useState(false);
    const [sort, setSort] = useState<VoterSort>('recent');
    const { copied, copy } = useCopy();

    const choiceLabel = (key: string) => choices.find(c => c.key === key)?.label ?? key;
    const power = (v: VoterRow) => Number(v.votePower) || 0;

    const isElection = voters.some(v => v.grades && Object.keys(v.grades).length > 0);
    const activeCandidateKeys = isElection
        ? selectedCandidates.filter(k => choices.some(c => c.key === k))
        : [];
    const activeCandidateSet = new Set(activeCandidateKeys);

    const tabs = [
        { key: 'all', label: g.voters_all || 'All', rows: voters },
        ...choices.map(c => ({ key: c.key, label: c.label, rows: voters.filter(v => v.choices.includes(c.key)) })).filter(t => t.rows.length > 0),
    ];

    const popupOptions: MultiFilterOption[] = isElection
        ? MJ_GRADE_ORDER.map(gradeIdx => {
            const key = String(gradeIdx);
            const label = g.mj?.grades?.[gradeIdx] ?? key;
            const count = voters.filter(v => {
                const entries = Object.entries(v.grades ?? {});
                const scoped = activeCandidateSet.size > 0
                    ? entries.filter(([cid]) => activeCandidateSet.has(cid))
                    : entries;
                return scoped.some(([, grade]) => grade === gradeIdx);
            }).length;
            return { key, label, count, dotClass: MJ_GRADE_DOT_COLOR[gradeIdx] };
        })
        : tabs.slice(1).map(t => ({ key: t.key, label: t.label, count: t.rows.length }));

    const activeKeys = selectedFilters.filter(k => popupOptions.some(o => o.key === k) || (!isElection && tabs.some(t => t.key === k)));
    const activeSet = new Set(activeKeys);

    const candidateOptions: MultiFilterOption[] = isElection
        ? choices.map(c => ({
            key: c.key,
            label: c.label,
            count: voters.filter(v => {
                const grade = v.grades?.[c.key];
                if (grade === undefined) return false;
                return activeSet.size === 0 || activeSet.has(String(grade));
            }).length,
        }))
        : [];

    const isAll = activeSet.size === 0 && activeCandidateSet.size === 0;
    const useDropdown = isElection || tabs.length > 5;

    const toggleFilter = (key: string) => {
        setSelectedFilters(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };
    const toggleCandidate = (key: string) => {
        setSelectedCandidates(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };

    const changedCount = voters.filter(v => v.changes > 0).length;
    const baseVoters = onlyChanged ? voters.filter(v => v.changes > 0) : voters;

    const filteredRows = isAll
        ? baseVoters
        : isElection
            ? baseVoters.filter(v => {
                const entries = Object.entries(v.grades ?? {});
                const scoped = activeCandidateSet.size > 0
                    ? entries.filter(([cid]) => activeCandidateSet.has(cid))
                    : entries;
                return activeSet.size > 0
                    ? scoped.some(([, grade]) => activeSet.has(String(grade)))
                    : scoped.length > 0;
            })
            : baseVoters.filter(v => v.choices.some(c => activeSet.has(c)));

    const rows = [...filteredRows].sort(sort === 'recent' ? (a, b) => b.voteId - a.voteId : (a, b) => power(b) - power(a));
    const totalXrd = rows.reduce((sum, v) => sum + power(v), 0);

    const voteDropdown = formatDropdownLabel(
        popupOptions.filter(o => activeSet.has(o.key)),
        g.col_vote || 'Vote',
        rows.length,
        language,
    );
    const candidateDropdown = formatDropdownLabel(
        candidateOptions.filter(o => activeCandidateSet.has(o.key)),
        g.candidates_title ?? '',
        rows.length,
        language,
    );

    return (
        <section aria-labelledby="voters-table" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-3">
                <h3 id="voters-table" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" />{g.voters_title || 'Voters'}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        aria-pressed={onlyChanged}
                        onClick={() => setOnlyChanged(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] leading-none font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            onlyChanged
                                ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm'
                                : 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                        }`}
                    >
                        <ArrowLeftRight className="size-3 shrink-0" aria-hidden="true" />
                        <span className="text-box-cap leading-none">{g.voters_changed ?? ''}</span>
                        <span className={`text-box-cap text-[10px] leading-none tabular-nums ${onlyChanged ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                            ({changedCount.toLocaleString(language)})
                        </span>
                    </button>
                    <div role="group" aria-label={g.voters_sort ?? ''} className="inline-flex gap-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] p-0.5">
                        {([['recent', g.voters_recent ?? ''], ['power', g.voters_top_xrd ?? '']] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={sort === key}
                                onClick={() => setSort(key)}
                                className={`w-28 px-2 py-1 rounded-md text-center text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${sort === key ? 'bg-[var(--color-card-bg)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-3 px-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-card-border)]">
                {useDropdown ? (
                    <div className="flex flex-wrap items-end gap-3 min-w-0 max-w-full">
                        <button
                            type="button"
                            aria-pressed={isAll}
                            onClick={() => {
                                setSelectedFilters([]);
                                setSelectedCandidates([]);
                            }}
                            className={`relative inline-flex items-center justify-center w-36 sm:w-44 shrink-0 pb-2.5 text-xs font-bold transition-colors cursor-pointer ${isAll ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="truncate">{tabs[0].label}</span>
                            <span className={`ml-1.5 shrink-0 text-[10px] tabular-nums ${isAll ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>({tabs[0].rows.length.toLocaleString(language)})</span>
                            {isAll && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                        </button>
                        <MultiFilterDropdown
                            title={g.col_vote || 'Vote'}
                            label={voteDropdown.label}
                            tooltip={voteDropdown.title}
                            closeLabel={g.status_closed ?? ''}
                            options={popupOptions}
                            activeKeys={activeSet}
                            onToggle={toggleFilter}
                            language={language}
                        />
                        {isElection && candidateOptions.length > 0 && (
                            <MultiFilterDropdown
                                title={g.candidates_title ?? ''}
                                label={candidateDropdown.label}
                                tooltip={candidateDropdown.title}
                                closeLabel={g.status_closed ?? ''}
                                options={candidateOptions}
                                activeKeys={activeCandidateSet}
                                onToggle={toggleCandidate}
                                language={language}
                            />
                        )}
                    </div>
                ) : (
                    <div role="tablist" aria-label={g.voters_title || 'Voters'} className="no-scrollbar flex gap-3 overflow-x-auto">
                        {tabs.map(t => {
                            const active = t.key === 'all' ? isAll : activeSet.has(t.key);
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setSelectedFilters(t.key === 'all' ? [] : [t.key])}
                                    className={`relative inline-flex items-center justify-center w-36 sm:w-44 shrink-0 pb-2.5 text-xs font-bold transition-colors cursor-pointer ${active ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    <span className="truncate">{t.label}</span>
                                    <span className={`ml-1.5 shrink-0 px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${active ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-surface)]'}`}>{t.rows.length.toLocaleString(language)}</span>
                                    {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                                </button>
                            );
                        })}
                    </div>
                )}
                <span className="shrink-0 pb-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap tabular-nums">
                    {g.voters_total_xrd ?? ''}: <span className="font-mono font-bold text-[var(--color-text-main)]">{formatXrd(totalXrd, language)} XRD</span>
                    {tally && tally.turnout > 0 && (!isAll || onlyChanged) && <span className="ml-1">({formatPct(totalXrd / tally.turnout, language)})</span>}
                </span>
            </div>

            {rows.length === 0 ? (
                <p className="p-5 text-sm text-[var(--color-text-muted)]">{onlyChanged ? (g.voters_changed_empty ?? '') : (g.voters_empty ?? '')}</p>
            ) : (
                <div className="max-h-[520px] overflow-auto">
                    <table className="w-full min-w-[1260px] table-fixed text-sm">
                        <colgroup>
                            <col className="w-[42px]" />
                            <col className="w-[196px]" />
                            <col />
                            <col className="w-[156px]" />
                            <col className="w-[180px]" />
                            <col className="w-[236px]" />
                        </colgroup>
                        <thead className="sticky top-0 z-10 bg-[var(--color-card-bg)] shadow-[0_1px_0_var(--color-card-border)]">
                            <tr className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                                <th className="text-left font-bold pl-4 pr-2 py-2.5 whitespace-nowrap">#</th>
                                <th className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{g.col_account || 'Account'}</th>
                                <th className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{g.col_vote || 'Vote'}</th>
                                <th className="text-right font-bold px-3 py-2.5 whitespace-nowrap">{g.col_power ?? ''}</th>
                                <th className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{g.col_date || 'Date'}</th>
                                <th className="text-right font-bold pl-3 pr-5 py-2.5 whitespace-nowrap">{g.col_txid || 'Transaction'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((v, i) => {
                                const p = power(v);
                                const history = v.history && v.history.length > 1 ? v.history : null;
                                const visibleChoices = isElection && !isAll
                                    ? v.choices.filter(c => {
                                        if (activeCandidateSet.size > 0 && !activeCandidateSet.has(c)) return false;
                                        if (activeSet.size > 0) {
                                            const gIdx = v.grades?.[c];
                                            return gIdx !== undefined && activeSet.has(String(gIdx));
                                        }
                                        return true;
                                    })
                                    : v.choices;
                                return (
                                    <tr key={v.account} className="border-t border-[var(--color-card-border)] hover:bg-[var(--color-surface)] transition-colors align-middle">
                                        <td className="pl-4 pr-2 py-2.5 font-mono text-xs text-[var(--color-text-muted)] tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                <Link href={`/${language}/dashboard/account/${v.account}`} prefetch={false} className="font-mono text-xs text-[var(--color-text-main)] hover:text-[var(--color-primary)]" title={v.account}>
                                                    {shortenAddress(v.account)}
                                                </Link>
                                                <CopyButton value={v.account} copiedAddress={copied} onCopy={copy} title={g.copy ?? ''} />
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                                            <VoterVoteCell
                                                voter={v}
                                                visibleChoices={visibleChoices}
                                                history={history}
                                                isElection={isElection}
                                                onlyChanged={onlyChanged}
                                                choiceLabel={choiceLabel}
                                                g={g}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {v.votePower === null ? (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]" title={g.power_pending}>
                                                    <Loader2 className="size-3 animate-spin" />{g.power_counting ?? ''}
                                                </span>
                                            ) : (
                                                <span className="inline-flex flex-col items-end leading-tight tabular-nums">
                                                    <span className="font-mono text-xs font-bold text-[var(--color-text-main)]">{formatXrd(p, language)} XRD</span>
                                                    {tally && tally.turnout > 0 && (
                                                        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{fill(g.power_share ?? '', { pct: formatShare(p / tally.turnout, language) })}</span>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap" suppressHydrationWarning>
                                            {history ? (
                                                <div className="space-y-1">
                                                    {history.map((entry, idx) => (
                                                        <div key={`${entry.txid}-${idx}`} className={idx === history.length - 1 ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[11px] opacity-80'}>
                                                            {formatDate(Date.parse(entry.time) / 1000, language)}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                formatDate(Date.parse(v.time) / 1000, language)
                                            )}
                                        </td>
                                        <td className="pl-3 pr-5 py-2.5 text-right whitespace-nowrap">
                                            <VoterTxHistoryCell txid={v.txid} history={history} language={language} g={g} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
