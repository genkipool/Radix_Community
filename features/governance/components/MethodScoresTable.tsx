'use client';

import React, { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronsDownUp, ChevronsUpDown, Scale } from 'lucide-react';
import {
    nextMethodScoreSort,
    sortMethodScoreRows,
    type MethodKey,
    type MethodScoreRow,
    type MethodScoreSortKey,
    type MethodScoreSortState,
} from '../lib/votingMethods';
import { fill, formatPct } from '../lib/format';
import {
    FAMILY_ICON,
    RESISTANCE_STYLE,
    methodText,
    ruleParams,
    tip,
    type CompareDict,
} from './ComparisonParts';
import { MethodGuideTrigger } from './MethodGuideModal';

/** Semantic text tone shared across the score cards and comparison table. */
export function scoreTextTone(score: number): string {
    if (score < 3.5) return 'text-red-500';
    if (score < 5.5) return 'text-orange-600 dark:text-orange-400';
    if (score < 7.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-[var(--color-accent)]';
}

/** Semantic border/background tone shared by the score summary cards. */
export function scoreChipTone(score: number): string {
    if (score < 3.5) return 'border-red-500/30 bg-red-500/8';
    if (score < 5.5) return 'border-orange-500/30 bg-orange-500/8';
    if (score < 7.5) return 'border-yellow-500/30 bg-yellow-500/8';
    return 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8';
}

/** Semantic fill tone shared by the score progress bars. */
export function scoreBarTone(score: number): string {
    if (score < 3.5) return 'bg-red-500';
    if (score < 5.5) return 'bg-orange-500';
    if (score < 7.5) return 'bg-yellow-500';
    return 'bg-[var(--color-accent)]';
}

/** Formats a 0..10 score consistently with up to 1 decimal place. */
export function formatScoreValue(score: number, language: string): string {
    return score.toLocaleString(language, { maximumFractionDigits: 1 });
}

export interface MethodScoreTableEntry extends MethodScoreRow {
    label: string;
    rule?: string;
}

/** Attaches localized display labels and rule descriptions to raw method/consensus score rows. */
export function toScoreTableEntries(
    rows: readonly MethodScoreRow[],
    c: CompareDict,
    language: string,
    evaluatedMethodsCount?: number,
): MethodScoreTableEntry[] {
    const params = ruleParams(language);
    const nStr = (evaluatedMethodsCount ?? rows.filter(r => r.key !== 'consensus').length).toLocaleString(language);
    return rows.map(row => {
        if (row.key === 'consensus') {
            return {
                ...row,
                label: fill(c.election_resistance_ranking_consensus_label ?? '', { n: nStr }),
                rule: c.election_consensus_picker_consensus_sub ?? '',
            };
        }
        const text = methodText(c, row.key, params);
        return {
            ...row,
            label: text.name,
            rule: text.rule,
        };
    });
}

interface TableColumnSpec {
    id: string;
    label: string;
    headerTip: string;
    sortKey?: MethodScoreSortKey;
    align: 'left' | 'right';
    responsiveClass?: string;
    renderCell: (row: MethodScoreTableEntry, isSorted: boolean) => React.ReactNode;
    cellTip: (row: MethodScoreTableEntry) => string;
}

/**
 * Full-width borderless sortable table comparing resistance, decentralisation, final scores,
 * and concentration metrics across all voting methods (and weighted consensus when present).
 */
export function MethodScoresTable({
    rows,
    onJumpToMethod,
    onOpenGuide,
    canExpandRow,
    renderExpandedRow,
    c,
    language,
}: {
    rows: readonly MethodScoreTableEntry[];
    onJumpToMethod?: (key: MethodKey | 'consensus') => void;
    onOpenGuide?: (key: MethodKey | 'consensus') => void;
    canExpandRow?: (row: MethodScoreTableEntry) => boolean;
    renderExpandedRow?: (row: MethodScoreTableEntry) => React.ReactNode;
    c: CompareDict;
    language: string;
}) {
    const [sort, setSort] = useState<MethodScoreSortState>({ key: 'final', dir: 'desc' });
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    const displayedRows = sort ? sortMethodScoreRows(rows, sort.key, sort.dir) : rows;
    // Ranked by final score (the default order): tied methods share a position and the
    // consensus row is not numbered, exactly like the "#x/N" ranks in the side panel.
    const rankedByFinal = sort?.key === 'final' && sort.dir === 'desc';
    const methodFinals = rows.filter(r => !r.isConsensus).map(r => (r.finalScore === null ? null : (r.finalRaw ?? r.finalScore)));
    const rankLabel = (row: MethodScoreTableEntry, idx: number): string => {
        if (!rankedByFinal) return (idx + 1).toLocaleString(language);
        if (row.isConsensus) return '—';
        const mine = row.finalScore === null ? null : (row.finalRaw ?? row.finalScore);
        if (mine === null) return '—';
        return (methodFinals.filter(v => v !== null && v > mine).length + 1).toLocaleString(language);
    };
    const familiesDict = (c.families ?? {}) as Record<string, string>;
    const resistanceDict = (c.resistance ?? {}) as Record<string, string>;
    const expandedSet = new Set(expandedKeys);

    const handleSort = (key: MethodScoreSortKey) => {
        setSort(prev => nextMethodScoreSort(prev, key));
    };

    const toggleRow = (key: string) => {
        if (!renderExpandedRow) return;
        setExpandedKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };

    const renderScoreCell = (value: number | null, isSorted: boolean) => (
        <span
            className={`font-mono ${
                value === null
                    ? 'text-[var(--color-text-muted)] font-normal'
                    : `${scoreTextTone(value)} ${isSorted ? 'font-bold' : 'font-medium'}`
            }`}
        >
            {value === null ? '—' : `${formatScoreValue(value, language)}/10`}
        </span>
    );

    const naTip = c.election_resistance_ranking_cell_na_tip ?? '';
    const familyLabelOf = (row: MethodScoreTableEntry) => (
        row.family === 'consensus'
            ? (c.election_resistance_ranking_family_consensus ?? '')
            : (familiesDict[row.family] ?? row.family)
    );

    const isHistorical = rows.some(r => r.votesTotal !== undefined);
    const coverageColumn: TableColumnSpec = {
        id: 'coverage',
        label: c.election_resistance_ranking_col_coverage ?? '',
        headerTip: c.election_resistance_ranking_tip_coverage ?? '',
        align: 'right',
        responsiveClass: 'hidden md:table-cell',
        renderCell: row => {
            const total = row.votesTotal ?? 0;
            const evaluated = row.votesEvaluated ?? 0;
            return (
                <span className={`font-mono ${total > 0 && evaluated / total < 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-secondary)]'}`}>
                    {evaluated.toLocaleString(language)}/{total.toLocaleString(language)}
                </span>
            );
        },
        cellTip: row => fill(c.election_resistance_ranking_cell_coverage_tip ?? '', {
            evaluated: (row.votesEvaluated ?? 0).toLocaleString(language),
            total: (row.votesTotal ?? 0).toLocaleString(language),
            pct: formatPct((row.votesTotal ?? 0) > 0 ? (row.votesEvaluated ?? 0) / (row.votesTotal ?? 1) : 0, language),
        }),
    };
    const baseColumns: readonly TableColumnSpec[] = [
        {
            id: 'family',
            label: c.election_resistance_ranking_col_family ?? '',
            headerTip: c.election_resistance_ranking_tip_family ?? '',
            align: 'left',
            responsiveClass: 'hidden xl:table-cell',
            renderCell: row => {
                const Icon = row.family === 'consensus' ? Scale : FAMILY_ICON[row.family];
                return (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                        <Icon className="size-3.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                        <span>{familyLabelOf(row)}</span>
                    </span>
                );
            },
            cellTip: row => fill(c.election_resistance_ranking_cell_family_tip ?? '', {
                name: row.label,
                family: familyLabelOf(row),
            }),
        },
        {
            id: 'antiSybil',
            label: c.election_resistance_ranking_col_antisybil ?? '',
            headerTip: c.election_resistance_ranking_tip_antisybil ?? '',
            sortKey: 'antiSybil',
            align: 'right',
            responsiveClass: 'hidden lg:table-cell',
            renderCell: row => {
                const style = RESISTANCE_STYLE[row.resistance];
                const ResIcon = style.icon;
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${style.cls}`}>
                        <ResIcon className="size-3 shrink-0" aria-hidden="true" />
                        <span>{resistanceDict[row.resistance] || row.resistance}</span>
                    </span>
                );
            },
            cellTip: row => fill(c.election_resistance_ranking_cell_antisybil_tip ?? '', {
                level: resistanceDict[row.resistance] || row.resistance,
                desc: tip(c, `resistance_${row.resistance}`) ?? '',
            }),
        },
        {
            id: 'minDifficulty',
            label: c.election_resistance_ranking_col_weakest ?? '',
            headerTip: c.election_resistance_ranking_tip_weakest ?? '',
            sortKey: 'minDifficulty',
            align: 'right',
            responsiveClass: 'hidden lg:table-cell',
            renderCell: (row, isSorted) => renderScoreCell(row.minDifficulty, isSorted),
            cellTip: row => fill(c.election_resistance_ranking_cell_weakest_tip ?? '', {
                min: formatScoreValue(row.minDifficulty, language),
                avgShare: formatPct(row.avgMaxShare, language),
            }),
        },
        {
            id: 'nakamoto',
            label: c.election_resistance_ranking_col_nakamoto ?? '',
            headerTip: c.election_resistance_ranking_tip_nakamoto ?? '',
            sortKey: 'nakamoto',
            align: 'right',
            responsiveClass: 'hidden md:table-cell',
            renderCell: (row, isSorted) => (
                <span className={`font-mono ${isSorted ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {row.nakamoto != null ? row.nakamoto.toLocaleString(language, { maximumFractionDigits: 1 }) : '—'}
                </span>
            ),
            cellTip: row => (row.nakamoto != null
                ? fill(c.election_resistance_ranking_cell_nakamoto_tip ?? '', {
                    n: row.nakamoto.toLocaleString(language, { maximumFractionDigits: 1 }),
                })
                : naTip),
        },
        {
            id: 'top1',
            label: c.election_resistance_ranking_col_top1 ?? '',
            headerTip: c.election_resistance_ranking_tip_top1 ?? '',
            sortKey: 'top1',
            align: 'right',
            responsiveClass: 'hidden md:table-cell',
            renderCell: (row, isSorted) => (
                <span className={`font-mono ${isSorted ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {row.top1 != null ? formatPct(row.top1, language) : '—'}
                </span>
            ),
            cellTip: row => (row.top1 != null
                ? fill(c.election_resistance_ranking_cell_top1_tip ?? '', {
                    pct: formatPct(row.top1, language),
                })
                : naTip),
        },
        {
            id: 'resistance',
            label: c.election_resistance_ranking_col_resistance ?? '',
            headerTip: c.election_resistance_ranking_tip_resistance ?? '',
            sortKey: 'resistance',
            align: 'right',
            renderCell: (row, isSorted) => renderScoreCell(row.resistanceScore, isSorted),
            cellTip: row => fill(c.election_resistance_ranking_cell_resistance_tip ?? '', {
                score: formatScoreValue(row.resistanceScore, language),
                level: resistanceDict[row.resistance] || row.resistance,
                min: formatScoreValue(row.minDifficulty, language),
            }),
        },
        {
            id: 'decentralisation',
            label: c.election_resistance_ranking_col_decent ?? '',
            headerTip: c.election_resistance_ranking_tip_decent ?? '',
            sortKey: 'decentralisation',
            align: 'right',
            renderCell: (row, isSorted) => renderScoreCell(row.decentralisationScore, isSorted),
            cellTip: row => (row.decentralisationScore !== null
                ? fill(c.election_resistance_ranking_cell_decent_tip ?? '', {
                    score: formatScoreValue(row.decentralisationScore, language),
                    eff: row.effective != null
                        ? row.effective.toLocaleString(language, { maximumFractionDigits: 1 })
                        : '—',
                })
                : naTip),
        },
        {
            id: 'final',
            label: c.election_resistance_ranking_col_final ?? '',
            headerTip: c.election_resistance_ranking_tip_final ?? '',
            sortKey: 'final',
            align: 'right',
            renderCell: (row, isSorted) => renderScoreCell(row.finalScore, isSorted),
            cellTip: row => (row.finalScore !== null && row.decentralisationScore !== null
                ? fill(
                    (row.votesTotal !== undefined ? c.election_resistance_ranking_cell_final_hist_tip : null)
                        ?? c.election_resistance_final_score_tip ?? '',
                    {
                        score: formatScoreValue(row.finalScore, language),
                        resistance: formatScoreValue(row.resistanceScore, language),
                        decentralisation: formatScoreValue(row.decentralisationScore, language),
                        evaluated: (row.votesEvaluated ?? 0).toLocaleString(language),
                        total: (row.votesTotal ?? 0).toLocaleString(language),
                    },
                )
                : naTip),
        },
    ];

    // Historical table: coverage sits right before the final score it dilutes.
    const columns: readonly TableColumnSpec[] = isHistorical
        ? [...baseColumns.slice(0, -1), coverageColumn, baseColumns[baseColumns.length - 1]]
        : baseColumns;

    const expandable = Boolean(renderExpandedRow);
    const isRowExpandable = (row: MethodScoreTableEntry) => (
        expandable && (canExpandRow ? canExpandRow(row) : true)
    );
    const expandableKeys = expandable
        ? rows.filter(r => (canExpandRow ? canExpandRow(r) : true)).map(r => r.key)
        : [];
    const allExpanded = expandableKeys.length > 0 && expandableKeys.every(k => expandedSet.has(k));
    const handleToggleAll = () => {
        startTransition(() => {
            setExpandedKeys(allExpanded ? [] : expandableKeys);
        });
    };
    const totalColSpan = 2 + columns.length + (expandable ? 1 : 0);

    return (
        <section aria-labelledby="method-scores-ranking-title" className="space-y-3">
            <div className="space-y-1">
                <h3 id="method-scores-ranking-title" className="text-sm font-bold text-[var(--color-text-main)]">
                    {c.election_resistance_ranking_title ?? ''}
                </h3>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {c.election_resistance_ranking_hint ?? ''}
                    </p>
                    {expandableKeys.length > 0 && (
                        <button
                            type="button"
                            aria-pressed={allExpanded}
                            disabled={isPending}
                            onClick={handleToggleAll}
                            title={allExpanded
                                ? (c.election_resistance_ranking_collapse_all_tip ?? '')
                                : (c.election_resistance_ranking_expand_all_tip ?? '')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)] text-[11px] font-semibold text-[var(--color-text-secondary)] transition-[color,background-color,border-color,transform,scale] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {/* Both chevrons share one cell and cross-fade, so the state change reads as a motion instead of a pop. */}
                            <span className="inline-grid shrink-0 place-items-center">
                                <ChevronsUpDown aria-hidden="true" className={`col-start-1 row-start-1 size-3.5 transition-opacity duration-200 ease-out motion-reduce:transition-none ${allExpanded ? 'opacity-0' : 'opacity-100'}`} />
                                <ChevronsDownUp aria-hidden="true" className={`col-start-1 row-start-1 size-3.5 transition-opacity duration-200 ease-out motion-reduce:transition-none ${allExpanded ? 'opacity-100' : 'opacity-0'}`} />
                            </span>
                            {/* Both labels share one grid cell: the widest one sets the size, so toggling never shifts the layout. */}
                            <span className="inline-grid items-center">
                                <span aria-hidden={!allExpanded} className={`col-start-1 row-start-1 whitespace-nowrap ${allExpanded ? '' : 'invisible'}`}>
                                    {c.election_resistance_ranking_collapse_all ?? ''}
                                </span>
                                <span aria-hidden={allExpanded} className={`col-start-1 row-start-1 whitespace-nowrap ${allExpanded ? 'invisible' : ''}`}>
                                    {c.election_resistance_ranking_expand_all ?? ''}
                                </span>
                            </span>
                        </button>
                    )}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)]/70">
                            <th
                                scope="col"
                                title={c.election_resistance_ranking_tip_rank ?? ''}
                                className="pb-2 pr-3 sm:pr-4 w-px whitespace-nowrap text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] cursor-help"
                            >
                                #
                            </th>
                            <th
                                scope="col"
                                title={c.election_resistance_ranking_tip_method ?? ''}
                                className="pb-2 pr-4 sm:pr-5 w-full min-w-[180px] text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] cursor-help"
                            >
                                {c.election_resistance_ranking_col_method ?? ''}
                            </th>
                            {columns.map(col => {
                                const isActive = col.sortKey !== undefined && sort?.key === col.sortKey;
                                const ariaSort: 'ascending' | 'descending' | 'none' = isActive
                                    ? (sort.dir === 'desc' ? 'descending' : 'ascending')
                                    : 'none';
                                const SortIcon = !isActive
                                    ? ArrowUpDown
                                    : sort.dir === 'desc'
                                        ? ArrowDown
                                        : ArrowUp;
                                return (
                                    <th
                                        key={col.id}
                                        scope="col"
                                        aria-sort={col.sortKey ? ariaSort : undefined}
                                        className={`pb-2 ${col.align === 'left' ? 'pr-4 sm:pr-5 text-left' : 'pl-4 sm:pl-5 text-right'} w-px whitespace-nowrap ${col.responsiveClass ?? ''}`}
                                    >
                                        {col.sortKey ? (
                                            <button
                                                type="button"
                                                onClick={() => handleSort(col.sortKey!)}
                                                title={col.headerTip}
                                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                                    isActive
                                                        ? 'text-[var(--color-primary)]'
                                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                                }`}
                                            >
                                                <span>{col.label}</span>
                                                <SortIcon className="size-3 shrink-0" aria-hidden="true" />
                                            </button>
                                        ) : (
                                            <span
                                                title={col.headerTip}
                                                className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] cursor-help"
                                            >
                                                {col.label}
                                            </span>
                                        )}
                                    </th>
                                );
                            })}
                            {expandable && <th scope="col" className="pb-2 pl-3 sm:pl-4 w-px" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-card-border)]/40">
                        {displayedRows.map((row, idx) => {
                            const rowExpandable = isRowExpandable(row);
                            const isExpanded = rowExpandable && expandedSet.has(row.key);
                            const expandedContent = isExpanded && renderExpandedRow ? renderExpandedRow(row) : null;
                            return (
                                <React.Fragment key={row.key}>
                                    <tr
                                        onClick={rowExpandable ? () => toggleRow(row.key) : undefined}
                                        className={`${row.current ? 'bg-[var(--color-primary)]/8' : ''} ${
                                            rowExpandable ? 'cursor-pointer hover:bg-[var(--color-surface)]/60 transition-colors' : ''
                                        }`}
                                    >
                                        <td
                                            title={fill(c.election_resistance_ranking_cell_rank_tip ?? '', {
                                                rank: rankLabel(row, idx),
                                                name: row.label,
                                            })}
                                            className="py-2 pr-3 sm:pr-4 w-px whitespace-nowrap font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums align-middle"
                                        >
                                            {rankLabel(row, idx)}
                                        </td>
                                        <th scope="row" className="py-2 pr-4 sm:pr-5 w-full max-w-0 text-left align-middle">
                                            <span className="flex items-center gap-0.5 min-w-0">
                                                {onJumpToMethod ? (
                                                    <button
                                                        type="button"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            onJumpToMethod(row.key);
                                                        }}
                                                        title={row.rule
                                                            ? `${fill(c.election_resistance_ranking_jump_tip ?? '', { name: row.label })} · ${row.rule}`
                                                            : fill(c.election_resistance_ranking_jump_tip ?? '', { name: row.label })}
                                                        className={`truncate text-left hover:text-[var(--color-primary)] hover:underline cursor-pointer ${
                                                            row.current
                                                                ? 'font-semibold text-[var(--color-primary)]'
                                                                : 'font-medium text-[var(--color-text-main)]'
                                                        }`}
                                                    >
                                                        {row.label}
                                                    </button>
                                                ) : (
                                                    <span
                                                        title={row.rule || row.label}
                                                        className={`truncate ${
                                                            row.current
                                                                ? 'font-semibold text-[var(--color-primary)]'
                                                                : 'font-medium text-[var(--color-text-main)]'
                                                        }`}
                                                    >
                                                        {row.label}
                                                    </span>
                                                )}
                                                {onOpenGuide && (
                                                    <span className="inline-flex shrink-0">
                                                        <MethodGuideTrigger
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                onOpenGuide(row.key);
                                                            }}
                                                            label={fill(c.election_resistance_ranking_open_tip ?? '', { name: row.label })}
                                                        />
                                                    </span>
                                                )}
                                            </span>
                                        </th>
                                        {columns.map(col => {
                                            const isSorted = col.sortKey !== undefined && sort?.key === col.sortKey;
                                            return (
                                                <td
                                                    key={col.id}
                                                    title={col.cellTip(row)}
                                                    className={`py-2 ${col.align === 'left' ? 'pr-4 sm:pr-5 text-left' : 'pl-4 sm:pl-5 text-right'} w-px whitespace-nowrap tabular-nums align-middle ${col.responsiveClass ?? ''}`}
                                                >
                                                    {col.renderCell(row, isSorted)}
                                                </td>
                                            );
                                        })}
                                        {expandable && (
                                            <td className="py-2 pl-3 sm:pl-4 w-px whitespace-nowrap text-right align-middle">
                                                {rowExpandable && (
                                                    <button
                                                        type="button"
                                                        aria-expanded={isExpanded}
                                                        aria-label={fill(c.election_resistance_ranking_expand_tip ?? '', { name: row.label })}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            toggleRow(row.key);
                                                        }}
                                                        className="inline-flex items-center justify-center p-1 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                                                    >
                                                        <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                    {isExpanded && expandedContent && (
                                        <tr className="bg-[var(--color-surface)]/40">
                                            <td colSpan={totalColSpan} className="p-0">
                                                <div
                                                    className="sticky left-0 w-full px-2 sm:px-3 py-3.5"
                                                    style={{ contentVisibility: 'auto', containIntrinsicBlockSize: '220px' }}
                                                >
                                                    {expandedContent}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
