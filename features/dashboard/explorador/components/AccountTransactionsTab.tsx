'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { m } from "motion/react";
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetchTransactions, apiFetchEntityDetails, apiFetchValidators, apiFetchHistoricalStakingBalance } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
import { resolveTransactionType } from '../utils/transactionUtils';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { TransactionInfo, Validator } from '@/types/radix';
import { CopyButton } from '@/components/ui/CopyButton';
import { CalendarDropdown, type CalendarTranslations, type DateRange } from '@/components/ui/CalendarDropdown';
import { AlertCircle, Calendar, Check, Download, Loader2, X } from 'lucide-react';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import { formatNumber } from '@/utils/formatters';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { FungibleChange, NonFungibleChange } from '@/features/dashboard/types/shared.types';
import { NetworkScopePills, type NetworkScope } from '../olympia/OlympiaParts';
import { OlympiaTxBabylonRows, OlympiaTxTable } from '../olympia/OlympiaTxTable';
import { olympiaDict } from '../olympia/dict';
import { useOlympiaLink, useOlympiaTransactions } from '@/features/dashboard/services/olympiaApi';
import { useAccountMonthTxDays, useOlympiaYearTxDays } from '../hooks/useAccountMonthTxDays';
import { exportAccountTransactionsCsv } from '../utils/accountTransactionsCsv';
import { dayLabel } from './DayPicker';

interface AccountTransactionsTabProps {
    accountAddress: string;
    network: Network;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    locale: string;
    calendarT?: CalendarTranslations;
}

function localTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatRangeButtonLabel(range: DateRange, locale: string, placeholder: string): string {
    if (!range.start) return placeholder;
    if (!range.end || range.end === range.start) return dayLabel(range.start, locale);
    return `${dayLabel(range.start, locale)} – ${dayLabel(range.end, locale)}`;
}

interface TokenFlow {
    address: string;
    amount: string;
    isNft: boolean;
    count?: number;
}

function TokenDisplay({
    flow,
    network,
    locale,
    type }: {
    flow: TokenFlow;
    network: Network;
    locale: string;
    type: 'deposit' | 'withdraw';
}) {
    const isXrd = flow.address === getXrdAddress(network);

    const { data } = useQuery({
        queryKey: dashboardKeys.account.tokenSymbol(flow.address, network),
        queryFn: () => apiFetchEntityDetails(flow.address, network),
        enabled: !isXrd && !flow.isNft,
        staleTime: CACHE_TIMES.INFINITY });

    let symbol = isXrd ? 'XRD' : `${flow.address.slice(0, 4)}...${flow.address.slice(-4)}`;

    if (!isXrd && !flow.isNft && data?.metadata?.items) {
        
        const symbolItem = data.metadata.items.find((m: { key: string; value?: { typed?: { value?: string } } }) => m.key === 'symbol');
        
        const nameItem = data.metadata.items.find((m: { key: string; value?: { typed?: { value?: string } } }) => m.key === 'name');

        const rawSymbol = symbolItem?.value?.typed?.value || nameItem?.value?.typed?.value;

        if (rawSymbol) {
            if (rawSymbol === 'Liquid Stake Units') {
                symbol = 'LSU';
            } else {
                symbol = rawSymbol.length > 6 ? rawSymbol.slice(0, 6) : rawSymbol;
            }
        }
    }

    const amountStr = flow.isNft
        ? flow.count?.toString()
        : formatNumber(Math.abs(Number(flow.amount)), 4, locale);

    const colorClass = type === 'deposit' ? 'text-[var(--color-accent)]' : 'text-red-500';
    const sign = type === 'deposit' ? '+' : '-';

    return (
        <div className={`text-xs font-mono font-semibold ${colorClass} flex items-center gap-1.5`}>
            <span>{sign}{amountStr}</span>
            <span className="text-[10px] text-[var(--color-text-main)] bg-white/10 px-1.5 py-0.5 rounded-sm">
                {flow.isNft ? 'NFT' : symbol}
            </span>
        </div>
    );
}

interface StakingBalanceCellProps {
    tx: TransactionInfo & { isEndOfMonthAuth?: boolean };
    accountAddress: string;
    network: Network;
    locale: string;
    validatorsData?: { validators: Validator[]; networkStats: unknown };
}

function StakingBalanceCell({
    tx,
    accountAddress,
    network,
    locale,
    validatorsData
}: StakingBalanceCellProps) {
    const isStakeOrUnstake = tx.manifestClasses?.includes('ValidatorStake') || tx.manifestClasses?.includes('ValidatorUnstake');
    const shouldQuery = isStakeOrUnstake || tx.isEndOfMonthAuth;

    const { data: balance, isPending } = useQuery({
        queryKey: dashboardKeys.account.historicalStaking(accountAddress, network, tx.stateVersion),
        queryFn: () => apiFetchHistoricalStakingBalance(
            accountAddress,
            tx.stateVersion,
            network,
            validatorsData,
            tx.confirmedAt
        ),
        enabled: !!shouldQuery && !!validatorsData,
        staleTime: CACHE_TIMES.INFINITY,
        gcTime: CACHE_TIMES.LONG,
    });

    if (!shouldQuery) {
        return <span className="text-xs text-[var(--color-text-muted)]">-</span>;
    }

    if (isPending) {
        return <span className="text-xs text-[var(--color-text-muted)] animate-pulse">...</span>;
    }

    return (
        <span className="text-xs font-mono text-[var(--color-text-main)]">
            {balance && balance > 0 ? `${formatNumber(balance, 4, locale)} XRD` : '-'}
        </span>
    );
}

export function AccountTransactionsTab({
    accountAddress,
    network,
    tt,
    locale,
    calendarT,
}: AccountTransactionsTabProps) {
    const accT = tt?.account_summary;
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [calendarView, setCalendarView] = useState<{ year: number; month: number }>(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [exportingMode, setExportingMode] = useState<'all' | 'range' | null>(null);
    const [exportedCount, setExportedCount] = useState(0);
    const [exportDoneMode, setExportDoneMode] = useState<'all' | 'range' | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!calendarOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current?.contains(e.target as Node)) return;
            if (dateRange.start && !dateRange.end) {
                setDateRange({ start: dateRange.start, end: dateRange.start });
            }
            setCalendarOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [calendarOpen, dateRange]);

    const hasDateFilter = Boolean(dateRange.start || dateRange.end);
    const activeStart = dateRange.start || undefined;
    const activeEnd = dateRange.end || dateRange.start || undefined;
    const dateRangeKey = hasDateFilter ? `${activeStart ?? ''}_${activeEnd ?? ''}` : undefined;
    const todayStr = localTodayStr();

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isPending,
        isError,
        error
    } = useInfiniteQuery({
        queryKey: dashboardKeys.transactions.list(network, accountAddress, undefined, dateRangeKey),
        queryFn: async ({ pageParam }) =>
            apiFetchTransactions({
                cursor: pageParam as string | undefined,
                limit: 15,
                address: accountAddress,
                network,
                start: activeStart,
                end: activeEnd,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        staleTime: hasDateFilter ? 0 : CACHE_TIMES.SHORT });

    // An account that existed on Olympia (same key) shows its Olympia history
    // here too. In "All" it follows the Babylon one in the same table: once the
    // Babylon pages run out, "Load more" goes on with the Olympia ones.
    const [scope, setScope] = useState<NetworkScope>('all');
    const [olympiaStarted, setOlympiaStarted] = useState(false);
    const { data: olympiaLink } = useOlympiaLink(accountAddress, network);
    const o = olympiaDict(tt);
    const olympiaInline = !!olympiaLink && scope === 'all';
    // An account with no Babylon history at all goes straight to its Olympia
    // one: there is nothing to scroll past, and an empty table with only
    // "Load more" reads as broken.
    const noBabylonHistory = !isPending && !hasNextPage && !(data?.pages.some((p) => (p.transactions?.length ?? 0) > 0));
    const olympiaOn = olympiaStarted || (olympiaInline && noBabylonHistory);
    const olympiaPages = useOlympiaTransactions(olympiaLink?.olympiaAddress, olympiaInline && olympiaOn && !hasDateFilter);
    const olympiaTxs = olympiaInline && olympiaOn && !hasDateFilter ? olympiaPages.data?.pages.flatMap((p) => p?.items ?? []) ?? [] : [];

    const { data: entityDetails } = useQuery({
        queryKey: dashboardKeys.entities.detail(accountAddress, network),
        queryFn: () => apiFetchEntityDetails(accountAddress, network),
        staleTime: CACHE_TIMES.MEDIUM });

    const { data: validatorsData } = useQuery({
        queryKey: dashboardKeys.validators.list(network),
        queryFn: () => apiFetchValidators(network),
        staleTime: CACHE_TIMES.MEDIUM });

    const { data: monthTxDays } = useAccountMonthTxDays({
        accountAddress,
        network,
        year: calendarView.year,
        monthIndex: calendarView.month,
        enabled: calendarOpen && scope !== 'olympia',
    });

    const { data: olympiaYearTxDays } = useOlympiaYearTxDays({
        olympiaAddress: olympiaLink?.olympiaAddress,
        year: calendarView.year,
        enabled: calendarOpen && scope !== 'babylon',
    });

    const transactions = data?.pages.flatMap((p) => p.transactions || []) || [];

    const highlightedDays = (() => {
        const set = new Set<string>();
        if (scope !== 'olympia') {
            for (const day of monthTxDays ?? []) set.add(day);
            for (const tx of transactions) {
                const d = new Date(tx.confirmedAt);
                if (!Number.isNaN(d.getTime())) {
                    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }
            }
        }
        if (scope !== 'babylon') {
            for (const day of olympiaYearTxDays ?? []) set.add(day);
            for (const tx of olympiaTxs) {
                if (!tx.timestamp) continue;
                const d = new Date(tx.timestamp);
                if (!Number.isNaN(d.getTime())) {
                    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }
            }
        }
        return set;
    })();
    const transactionsWithBalances = (() => {
        if (hasDateFilter || !transactions.length || !entityDetails || !validatorsData) {
            return transactions.map(tx => ({ ...tx, balanceXrd: hasDateFilter ? null : 0, balanceStaking: 0 }));
        }

        const runningBalances: Record<string, number> = {};
        entityDetails.fungible_resources?.items.forEach((item) => {
            let amount = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itemAny = item as any;
            if (itemAny.amount !== undefined) {
                amount = Number(itemAny.amount);
            } else if (itemAny.vaults?.items?.length) {
                amount = itemAny.vaults.items.reduce((acc: number, v: { amount?: string }) => acc + parseFloat(v.amount || '0'), 0);
            }
            runningBalances[item.resource_address] = amount;
        });

        const validatorMap = new Map<string, number>();
        validatorsData.validators.forEach((v) => {
            if (v.lsuResource) validatorMap.set(v.lsuResource, v.lsu2xrdFactor || 1);
        });
        const xrdAddress = getXrdAddress(network);

        return transactions.map((tx) => {
            const currentXrd = runningBalances[xrdAddress] || 0;
            let currentStaking = 0;
            for (const [res, amount] of Object.entries(runningBalances)) {
                if (validatorMap.has(res) && amount > 0) {
                    currentStaking += amount * validatorMap.get(res)!;
                }
            }

            const fungibles = (tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || [];
            fungibles.forEach(f => {
                if (f.entity_address === accountAddress) {
                    const delta = Number(f.balance_change);
                    runningBalances[f.resource_address] = (runningBalances[f.resource_address] || 0) - delta;
                }
            });

            const fees = (tx.balanceChanges?.fungible_fee_balance_changes as FungibleChange[]) || [];
            fees.forEach(f => {
                if (f.entity_address === accountAddress) {
                    const delta = Number(f.balance_change);
                    runningBalances[f.resource_address] = (runningBalances[f.resource_address] || 0) - delta;
                }
            });

            return {
                ...tx,
                balanceXrd: currentXrd,
                balanceStaking: currentStaking };
        });
    })();

    const processedTransactions = (() => {
        const daysAllocated = new Set<string>();

        return transactionsWithBalances.map((tx, index) => {
            const date = new Date(tx.confirmedAt);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const nextDay = new Date(year, month, day + 1);
            const isLastDay = nextDay.getMonth() !== month;

            let isAuthorizedForDay = false;
            if (isLastDay && !daysAllocated.has(dayStr)) {
                isAuthorizedForDay = true;
                daysAllocated.add(dayStr);
            }

            const isLatest = index === 0;

            return {
                ...tx,
                isEndOfMonthAuth: isAuthorizedForDay || isLatest
            };
        });
    })();

    const txErrorText = 'Error loading transactions.';
    const txNoTransactionsText = 'No transactions found for this account.';

    const getTranslatedError = (rawMsg: string | undefined) => {
        if (!rawMsg) return txErrorText;
        if (rawMsg.includes('Failed to fetch transactions for address')) {
            return tt?.error_fetch_address || 'Failed to fetch transactions for this address.';
        }
        if (rawMsg.includes('Failed to fetch recent transactions')) {
            return tt?.error_fetch_recent || 'Failed to fetch recent transactions.';
        }
        if (rawMsg.includes('Failed to fetch transaction details')) {
            return tt?.error_fetch_details || 'Failed to fetch transaction details.';
        }
        if (rawMsg.includes('Failed to fetch full history')) {
            return tt?.error_fetch_history_max_pages || 'Failed to fetch full history (max pages reached).';
        }
        if (rawMsg.includes('Round proposer not available')) {
            return tt?.error_no_proposer || 'Round proposer not available.';
        }
        return rawMsg;
    };

    const rangePlaceholder = calendarT?.range_placeholder ?? '';
    const rangeLabel = formatRangeButtonLabel(dateRange, locale, rangePlaceholder);

    const handleSelectRange = (range: DateRange) => {
        setDateRange(range);
        if (range.start && range.end) {
            setCalendarOpen(false);
        }
    };

    const handleResetRange = () => {
        setDateRange({ start: null, end: null });
        setCalendarOpen(false);
    };

    const handleExportCsv = async (mode: 'all' | 'range') => {
        if (exportingMode) return;
        setExportingMode(mode);
        setExportedCount(0);
        setExportDoneMode(null);
        try {
            const count = await exportAccountTransactionsCsv({
                accountAddress,
                olympiaAddress: olympiaLink?.olympiaAddress,
                scope,
                network,
                start: mode === 'range' ? activeStart : undefined,
                end: mode === 'range' ? activeEnd : undefined,
                tt,
                olympiaT: o,
                onProgress: setExportedCount,
            });
            if (count > 0) {
                setExportDoneMode(mode);
                setTimeout(() => setExportDoneMode((cur) => (cur === mode ? null : cur)), 2500);
            }
        } finally {
            setExportingMode(null);
        }
    };

    const effectiveScope: NetworkScope = olympiaLink ? scope : 'babylon';
    const exportAllTooltip =
        effectiveScope === 'all'
            ? accT?.tx_export_csv_all_tooltip_all ?? accT?.tx_export_csv_all_tooltip
            : effectiveScope === 'olympia'
                ? accT?.tx_export_csv_all_tooltip_olympia ?? accT?.tx_export_csv_all_tooltip
                : accT?.tx_export_csv_all_tooltip_babylon ?? accT?.tx_export_csv_all_tooltip;

    const exportRangeTemplate =
        effectiveScope === 'all'
            ? accT?.tx_export_csv_range_tooltip_all ?? accT?.tx_export_csv_range_tooltip
            : effectiveScope === 'olympia'
                ? accT?.tx_export_csv_range_tooltip_olympia ?? accT?.tx_export_csv_range_tooltip
                : accT?.tx_export_csv_range_tooltip_babylon ?? accT?.tx_export_csv_range_tooltip;
    const exportRangeTooltip = exportRangeTemplate?.replace('{range}', rangeLabel);

    const calendarMinDate = scope === 'babylon' ? '2023-09-28' : olympiaLink ? '2021-07-28' : '2023-09-28';
    const calendarMaxDate = scope === 'olympia' ? '2023-09-28' : todayStr;

    const toolbar = (
        <div className="flex flex-col gap-2 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {olympiaLink ? (
                    <NetworkScopePills o={o} value={scope} onChange={setScope} />
                ) : (
                    <div />
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                        {hasDateFilter && (
                            <button
                                type="button"
                                onClick={() => void handleExportCsv('range')}
                                disabled={exportingMode !== null}
                                title={exportRangeTooltip}
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-[var(--color-primary)] hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {exportingMode === 'range' ? (
                                    <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden="true" />
                                ) : exportDoneMode === 'range' ? (
                                    <Check className="size-3.5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                                ) : (
                                    <Download className="size-3.5 shrink-0" aria-hidden="true" />
                                )}
                                <span className="whitespace-nowrap">
                                    {exportingMode === 'range'
                                        ? `${accT?.tx_export_csv_exporting ?? ''} (${exportedCount})`
                                        : accT?.tx_export_csv_range}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => void handleExportCsv('all')}
                            disabled={exportingMode !== null}
                            title={exportAllTooltip}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {exportingMode === 'all' ? (
                                <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden="true" />
                            ) : exportDoneMode === 'all' ? (
                                <Check className="size-3.5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                            ) : (
                                <Download className="size-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span className="whitespace-nowrap">
                                {exportingMode === 'all'
                                    ? `${accT?.tx_export_csv_exporting ?? ''} (${exportedCount})`
                                    : accT?.tx_export_csv_all}
                            </span>
                        </button>
                    </div>

                    {calendarT && (
                        <div className="relative flex items-center gap-1.5" ref={calendarRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!calendarOpen) {
                                        if (dateRange.start) {
                                            const [y, m] = dateRange.start.split('-');
                                            if (y && m) setCalendarView({ year: Number(y), month: Number(m) - 1 });
                                        } else if (scope === 'olympia') {
                                            setCalendarView({ year: 2023, month: 8 });
                                        } else {
                                            const now = new Date();
                                            setCalendarView({ year: now.getFullYear(), month: now.getMonth() });
                                        }
                                    }
                                    setCalendarOpen((v) => !v);
                                }}
                                aria-expanded={calendarOpen}
                                title={rangePlaceholder}
                                className={`inline-flex items-center justify-center gap-1.5 w-[224px] px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                                    calendarOpen || hasDateFilter
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/35'
                                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-card-border)] hover:text-[var(--color-text-main)] hover:border-[var(--color-primary)]/40'
                                }`}
                            >
                                <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="whitespace-nowrap truncate">{rangeLabel}</span>
                            </button>
                            {hasDateFilter && (
                                <button
                                    type="button"
                                    onClick={handleResetRange}
                                    title={calendarT.reset_button}
                                    aria-label={calendarT.reset_button}
                                    className="inline-flex items-center justify-center size-7 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 transition-colors cursor-pointer"
                                >
                                    <X className="size-3.5" aria-hidden="true" />
                                </button>
                            )}

                            <CalendarDropdown
                                key={`${scope}-${String(calendarOpen)}`}
                                open={calendarOpen}
                                align="right"
                                calendarT={calendarT}
                                dateRange={dateRange}
                                onSelectRange={handleSelectRange}
                                onReset={handleResetRange}
                                minDate={calendarMinDate}
                                maxDate={calendarMaxDate}
                                highlightedDays={highlightedDays}
                                onViewMonthChange={(year, month) => setCalendarView({ year, month })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const containerClass = `w-full flex flex-col${calendarOpen ? ' min-h-[380px]' : ''}`;

    if (olympiaLink && scope === 'olympia') {
        return (
            <div className={containerClass}>
                {toolbar}
                <OlympiaTxTable
                    address={olympiaLink.olympiaAddress}
                    o={o}
                    locale={locale}
                    dateRange={hasDateFilter ? { start: activeStart, end: activeEnd } : undefined}
                />
            </div>
        );
    }

    if (isError) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return (
            <div className={containerClass}>
                {toolbar}
                <div className="flex flex-col items-center justify-center py-12 text-red-400 gap-3">
                    <AlertCircle className="size-6" />
                    <span className="text-sm font-medium">{getTranslatedError(errorMsg)}</span>
                </div>
            </div>
        );
    }

    // Babylon pages first; after the last one, the Olympia pages, newest first.
    const olympiaMore = olympiaInline && !hasDateFilter && (!olympiaOn || olympiaPages.hasNextPage);
    const showLoadMore = hasNextPage || olympiaMore;
    const loadingMore = isFetchingNextPage || olympiaPages.isFetching;
    const loadMore = () => {
        if (hasNextPage) void fetchNextPage();
        else if (!olympiaOn) setOlympiaStarted(true);
        else void olympiaPages.fetchNextPage();
    };

    if (isPending) {
        return (
            <div className={containerClass}>
                {toolbar}
                <p className="flex items-center gap-2 py-12 justify-center text-xs text-[var(--color-text-muted)]">
                    <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    {accT?.funds?.loading ?? ''}
                </p>
            </div>
        );
    }

    if (transactions.length === 0 && (!olympiaInline || hasDateFilter)) {
        return (
            <div className={containerClass}>
                {toolbar}
                <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
                    <span className="text-sm font-medium">{txNoTransactionsText}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            {toolbar}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]">
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_date_tooltip || 'Transaction confirmation date'}>{accT?.tx_date || 'Date'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_hash_tooltip || 'Transaction identifier'}>{accT?.tx_hash || 'Hash'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_type_tooltip || 'Type of transaction according to manifest'}>{accT?.tx_type || 'Type'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_withdraw_tooltip || 'Tokens leaving the account'}>{accT?.tx_withdraw || 'Withdraw'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_deposit_tooltip || 'Tokens entering the account'}>{accT?.tx_deposit || 'Deposit'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap text-right" title={accT?.tx_fee_tooltip || 'Transaction cost paid by this account'}>{accT?.tx_fee || 'Fee'}</th>
                            <th
                                className="py-3 px-4 font-semibold whitespace-nowrap text-right"
                                title={accT?.tx_balance_tooltip || 'Available XRD balance after the transaction'}
                            >
                                {accT?.tx_balance || 'Balance'}
                            </th>
                            <th
                                className="py-3 px-4 font-semibold whitespace-nowrap text-right"
                                title={accT?.tx_staking_balance_tooltip || 'Estimated XRD value in staking after the transaction'}
                            >
                                {accT?.tx_staking_balance || 'Staking Balance'}
                            </th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_status_tooltip || 'Result of transaction execution'}>{accT?.tx_status || 'Status'}</th>
                        </tr>
                    </thead>
                    {processedTransactions.map((tx) => {
                        const isSuccess = tx.status === 'CommittedSuccess' || tx.status === 'Committed';

                        // Token movements
                        const fungibles = ((tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || []).filter(
                            (c) => c.entity_address === accountAddress && !c.is_fee
                        );
                        const nonFungibles = ((tx.balanceChanges?.non_fungible_balance_changes as NonFungibleChange[]) || []).filter(
                            (c) => c.entity_address === accountAddress
                        );

                        const deposits: TokenFlow[] = [];
                        const withdraws: TokenFlow[] = [];

                        fungibles.forEach(f => {
                            if (Number(f.balance_change) > 0) {
                                deposits.push({ address: f.resource_address, amount: f.balance_change, isNft: false });
                            } else if (Number(f.balance_change) < 0) {
                                withdraws.push({ address: f.resource_address, amount: f.balance_change, isNft: false });
                            }
                        });

                        nonFungibles.forEach(nf => {
                            if (nf.added && nf.added.length > 0) {
                                deposits.push({ address: nf.resource_address, amount: '', count: nf.added.length, isNft: true });
                            }
                            if (nf.removed && nf.removed.length > 0) {
                                withdraws.push({ address: nf.resource_address, amount: '', count: nf.removed.length, isNft: true });
                            }
                        });

                        const maxRows = Math.max(1, deposits.length, withdraws.length);
                        const rows = Array.from({ length: maxRows }).map((_, i) => ({
                            deposit: deposits[i],
                            withdraw: withdraws[i]
                        }));

                        // Fee logic
                        const feeChanges = (tx.balanceChanges?.fungible_fee_balance_changes as FungibleChange[]) || [];
                        const accountFee = feeChanges.find((c) => c.entity_address === accountAddress);
                        const feePaidByAccount = accountFee ? Math.abs(Number(accountFee.balance_change)) : 0;

                        const dateStr = new Date(tx.confirmedAt).toLocaleString(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        const shortHash = `${tx.intentHash.slice(0, 8)}...${tx.intentHash.slice(-6)}`;
                        const typeStr = resolveTransactionType(tx.manifestClasses || [], [], tt);

                        return (
                            <tbody key={tx.intentHash} className="border-b border-[var(--color-card-border)] hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-300 text-sm last:border-b-0">
                                {rows.map((row, rowIdx) => (
                                    <tr key={`${tx.intentHash}-${rowIdx}`} className="group">
                                        {rowIdx === 0 && (
                                            <>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-[var(--color-text-main)] text-xs border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {dateStr}
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <Link
                                                            href={dashboardRoutes.tx(locale, tx.intentHash, { network })}
                                                            className="font-mono text-xs text-[var(--color-primary)] hover:underline"
                                                            title={tx.intentHash}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {shortHash}
                                                        </Link>
                                                        <CopyButton value={tx.intentHash} variant="minimal" />
                                                    </div>
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] opacity-80 group-hover:opacity-100 transition-opacity">
                                                        {typeStr}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {row.withdraw ? <TokenDisplay flow={row.withdraw} network={network} locale={locale} type="withdraw" /> : <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {row.deposit ? <TokenDisplay flow={row.deposit} network={network} locale={locale} type="deposit" /> : <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                                        </td>
                                        {rowIdx === 0 && (
                                            <>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-muted)] border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {feePaidByAccount > 0 ? `${(Math.trunc(feePaidByAccount * 10000) / 10000).toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} XRD` : '-'}
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-main)] border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {tx.balanceXrd !== null ? `${formatNumber(tx.balanceXrd, 4, locale)} XRD` : '-'}
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <StakingBalanceCell
                                                        tx={tx}
                                                        accountAddress={accountAddress}
                                                        network={network}
                                                        locale={locale}
                                                        validatorsData={validatorsData}
                                                    />
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <span className={`text-xs font-semibold ${isSuccess ? 'text-[var(--color-accent)]' : 'text-red-500'}`}>
                                                        {isSuccess ? (accT?.tx_success || 'Success') : (accT?.tx_failed || 'Failed')}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}
                    {olympiaTxs.map((tx) => (
                        <OlympiaTxBabylonRows key={tx.transactionId} tx={tx} o={o} locale={locale} successLabel={accT?.tx_success || 'Success'} />
                    ))}
                </table>
            </div>

            {showLoadMore && (
                <div className="flex justify-center mt-8 mb-4">
                    <m.button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loadingMore ? (
                            <>
                                {accT?.tx_loading || 'Loading...'}
                            </>
                        ) : (
                            accT?.tx_load_more || 'Load More'
                        )}
                    </m.button>
                </div>
            )}
        </div>
    );
}

