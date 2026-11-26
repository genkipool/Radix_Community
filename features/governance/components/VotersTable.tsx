'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, ExternalLink, Loader2, ChevronDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Portal } from '@/components/ui/Portal';
import { SelectPopup, SelectPopupRow } from '@/components/ui/SelectPopup';
import { usePickerPopup } from '@/features/console/hooks/usePickerPopup';
import type { BallotChoice, TallySummary } from '../lib/governanceVotes';
import type { VoterRow } from '../types';
import { MJ_GRADE_ABBR_COLOR, MJ_GRADE_DOT_COLOR, MJ_GRADE_ORDER } from '../lib/majorityJudgment';
import { fill, formatDate, formatPct, formatShare, formatXrd } from '../lib/format';
import { CopyButton, shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { useCopy } from '../hooks/useCopy';
import type { G } from './GovernanceBadges';

type VoterSort = 'recent' | 'power';

/**
 * Every account with a counted vote: newest first by default or by voting
 * power, with a tab per ballot choice (or multi-select grade filter for
 * Majority Judgment elections). The XRD total follows the filter.
 */
export function VotersTable({ tally, voters, choices, g, language }: {
    tally: TallySummary | null;
    voters: VoterRow[];
    choices: BallotChoice[];
    g: G;
    language: string;
}) {
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [sort, setSort] = useState<VoterSort>('recent');
    const { copied, copy } = useCopy();
    const {
        open: filterOpen,
        show: showFilter,
        close: closeFilter,
        buttonRef: filterButtonRef,
        popupRef: filterPopupRef,
        layoutFor: filterLayoutFor,
    } = usePickerPopup();
    const filterLayout = filterLayoutFor(300, 'left');
    const choiceLabel = (key: string) => choices.find(c => c.key === key)?.label ?? key;
    const power = (v: VoterRow) => Number(v.votePower) || 0;

    const isElection = voters.some(v => v.grades && Object.keys(v.grades).length > 0);
    const gradeOptions = isElection
        ? MJ_GRADE_ORDER.map(gradeIdx => {
            const key = String(gradeIdx);
            const label = g.mj?.grades?.[gradeIdx] ?? key;
            const matching = voters.filter(v => Object.values(v.grades ?? {}).includes(gradeIdx));
            return { key, gradeIdx, label, rows: matching };
        })
        : [];

    const tabs = [
        { key: 'all', label: g.voters_all || 'All', rows: voters },
        ...choices.map(c => ({ key: c.key, label: c.label, rows: voters.filter(v => v.choices.includes(c.key)) })).filter(t => t.rows.length > 0),
    ];

    const popupOptions = isElection
        ? gradeOptions
        : tabs.slice(1).map(t => ({ ...t, gradeIdx: undefined as number | undefined }));

    const activeKeys = selectedFilters.filter(k => popupOptions.some(o => o.key === k) || (!isElection && tabs.some(t => t.key === k)));
    const activeSet = new Set(activeKeys);
    const isAll = activeSet.size === 0;
    const useDropdown = isElection || tabs.length > 5;

    const toggleFilter = (key: string) => {
        setSelectedFilters(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };

    const filteredRows = isAll
        ? voters
        : isElection
            ? voters.filter(v => Object.values(v.grades ?? {}).some(grade => activeSet.has(String(grade))))
            : voters.filter(v => v.choices.some(c => activeSet.has(c)));

    const rows = [...filteredRows].sort(sort === 'recent' ? (a, b) => b.voteId - a.voteId : (a, b) => power(b) - power(a));
    const totalXrd = rows.reduce((sum, v) => sum + power(v), 0);

    const activeOptions = popupOptions.filter(o => activeSet.has(o.key));
    const dropdownLabel = activeOptions.length === 0
        ? (g.col_vote || 'Vote')
        : activeOptions.length === 1
            ? `${activeOptions[0].label} (${rows.length.toLocaleString(language)})`
            : `${activeOptions[0].label} +${(activeOptions.length - 1).toLocaleString(language)}`;
    const dropdownTitle = activeOptions.length > 1
        ? activeOptions.map(o => o.label).join(', ')
        : undefined;

    return (
        <section aria-labelledby="voters-table" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-3">
                <h3 id="voters-table" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" />{g.voters_title || 'Voters'}
                </h3>
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

            <div className="mt-3 px-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-card-border)]">
                {useDropdown ? (
                    <div className="flex items-end gap-3 min-w-0 max-w-full">
                        <button
                            type="button"
                            aria-pressed={isAll}
                            onClick={() => setSelectedFilters([])}
                            className={`relative inline-flex items-center justify-center w-36 sm:w-44 shrink-0 pb-2.5 text-xs font-bold transition-colors cursor-pointer ${isAll ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="truncate">{tabs[0].label}</span>
                            <span className={`ml-1.5 shrink-0 text-[10px] tabular-nums ${isAll ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>({tabs[0].rows.length.toLocaleString(language)})</span>
                            {isAll && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                        </button>
                        <div className="relative shrink-0">
                            <button
                                ref={filterButtonRef}
                                type="button"
                                aria-expanded={filterOpen}
                                title={dropdownTitle}
                                onClick={() => (filterOpen ? closeFilter() : showFilter())}
                                className={`relative inline-flex items-center justify-center gap-1.5 w-36 sm:w-44 pb-2.5 text-xs font-bold transition-colors cursor-pointer ${!isAll ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                <span className="truncate">{dropdownLabel}</span>
                                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${filterOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                                {!isAll && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                            </button>
                            <Portal>
                                <AnimatePresence>
                                    {filterOpen && (
                                        <SelectPopup
                                            ref={filterPopupRef}
                                            title={g.col_vote || 'Vote'}
                                            closeLabel={g.status_closed ?? ''}
                                            onClose={closeFilter}
                                            direction={filterLayout.direction}
                                            style={{
                                                ...filterLayout.style,
                                                height: 'auto',
                                                maxHeight: filterLayout.style.height,
                                            }}
                                        >
                                            {popupOptions.map(opt => (
                                                <SelectPopupRow
                                                    key={opt.key}
                                                    selected={activeSet.has(opt.key)}
                                                    label={opt.label}
                                                    icon={opt.gradeIdx !== undefined ? (
                                                        <span className={`size-2 rounded-full ${MJ_GRADE_DOT_COLOR[opt.gradeIdx]}`} aria-hidden="true" />
                                                    ) : undefined}
                                                    trailing={
                                                        <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
                                                            ({opt.rows.length.toLocaleString(language)})
                                                        </span>
                                                    }
                                                    onClick={() => toggleFilter(opt.key)}
                                                />
                                            ))}
                                        </SelectPopup>
                                    )}
                                </AnimatePresence>
                            </Portal>
                        </div>
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
                    {g.voters_total_xrd || 'Total'}: <span className="font-mono font-bold text-[var(--color-text-main)]">{formatXrd(totalXrd, language)} XRD</span>
                    {tally && tally.turnout > 0 && !isAll && <span className="ml-1">({formatPct(totalXrd / tally.turnout, language)})</span>}
                </span>
            </div>

            {rows.length === 0 ? (
                <p className="p-5 text-sm text-[var(--color-text-muted)]">{g.voters_empty}</p>
            ) : (
                <div className="max-h-[520px] overflow-auto">
                    <table className="w-full min-w-[1220px] table-fixed text-sm">
                        <colgroup>
                            <col className="w-[42px]" />
                            <col className="w-[196px]" />
                            <col />
                            <col className="w-[156px]" />
                            <col className="w-[168px]" />
                            <col className="w-[196px]" />
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
                                const visibleChoices = isElection && !isAll
                                    ? v.choices.filter(c => {
                                        const gIdx = v.grades?.[c];
                                        return gIdx !== undefined && activeSet.has(String(gIdx));
                                    })
                                    : v.choices;
                                return (
                                    <tr key={v.account} className="border-t border-[var(--color-card-border)] hover:bg-[var(--color-surface)] transition-colors">
                                        <td className="pl-4 pr-2 py-2.5 font-mono text-xs text-[var(--color-text-muted)] tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                <Link href={`/${language}/dashboard/account/${v.account}`} prefetch={false} className="font-mono text-xs text-[var(--color-text-main)] hover:text-[var(--color-primary)]" title={v.account}>
                                                    {shortenAddress(v.account)}
                                                </Link>
                                                <CopyButton value={v.account} copiedAddress={copied} onCopy={copy} title={g.copy || 'Copy'} />
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                                            {visibleChoices.length > 3 || isElection ? (
                                                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                                    {visibleChoices.map((c, idx) => {
                                                        const label = choiceLabel(c);
                                                        const gradeIdx = v.grades?.[c];
                                                        const gradeAbbr = gradeIdx !== undefined ? g.mj?.grade_abbrs?.[gradeIdx] : undefined;
                                                        const gradeFull = gradeIdx !== undefined ? g.mj?.grades?.[gradeIdx] : undefined;
                                                        return (
                                                            <span
                                                                key={`${c}-${idx}`}
                                                                title={gradeFull ? `${label} — ${gradeFull}` : label}
                                                                className="whitespace-nowrap text-xs font-semibold text-[var(--color-text-secondary)]"
                                                            >
                                                                {label}
                                                                {gradeAbbr && (
                                                                    <span className={`ml-0.5 font-mono text-[10px] font-bold ${MJ_GRADE_ABBR_COLOR[gradeIdx!] ?? ''}`}>
                                                                        ({gradeAbbr})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                    {v.changes > 0 && <span className="text-[10px] font-normal text-[var(--color-text-muted)] self-center" title={g.vote?.changed_vote}>↻</span>}
                                                </div>
                                            ) : (
                                                <span className="whitespace-nowrap">
                                                    {visibleChoices.map((c, idx) => {
                                                        const label = choiceLabel(c);
                                                        const gradeIdx = v.grades?.[c];
                                                        const gradeAbbr = gradeIdx !== undefined ? g.mj?.grade_abbrs?.[gradeIdx] : undefined;
                                                        const gradeFull = gradeIdx !== undefined ? g.mj?.grades?.[gradeIdx] : undefined;
                                                        return (
                                                            <React.Fragment key={`${c}-${idx}`}>
                                                                {idx > 0 && ', '}
                                                                <span title={gradeFull ? `${label} — ${gradeFull}` : label}>
                                                                    {label}
                                                                    {gradeAbbr && (
                                                                        <span className={`ml-1 font-mono text-[10px] font-bold ${MJ_GRADE_ABBR_COLOR[gradeIdx!] ?? ''}`}>
                                                                            ({gradeAbbr})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    {v.changes > 0 && <span className="ml-1.5 text-[10px] font-normal text-[var(--color-text-muted)]" title={g.vote?.changed_vote}>↻</span>}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {v.votePower === null ? (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]" title={g.power_pending}>
                                                    <Loader2 className="size-3 animate-spin" />{g.power_counting || 'Counting…'}
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
                                            {formatDate(Date.parse(v.time) / 1000, language)}
                                        </td>
                                        <td className="pl-3 pr-5 py-2.5 text-right whitespace-nowrap">
                                            <Link href={`/${language}/dashboard/tx/${v.txid}`} prefetch={false} className="inline-flex items-center justify-end gap-1.5 font-mono text-xs text-[var(--color-primary)] hover:underline" title={v.txid}>
                                                <span>{shortenAddress(v.txid)}</span>
                                                <ExternalLink className="size-3 shrink-0" />
                                            </Link>
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
