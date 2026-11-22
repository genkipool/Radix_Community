'use client';
/**
 * The "Rewards" tab of a Babylon account: one row per year (including Olympia
 * years when the account existed on Olympia) with the days it earned staking
 * rewards, XRD earned, fiat value at receipt date, fiat value at current price,
 * and that year's CoinTracking CSV in the row itself. Clicking a year row
 * expands its monthly / daily breakdown.
 *
 * Babylon's yearly figure comes from replaying the account's history against
 * the validators' daily data, in the browser, so the tab works the years out
 * by itself as soon as it opens: one at a time, newest first. Olympia's years
 * come from the static archive (zero Redis commands) and share React Query's
 * cache with the Olympia tab. Historical daily XRD prices come from
 * `/api/xrd-daily-prices` (static baseline + in-memory tail, zero Redis
 * commands, fetched once per 6 h and shared across accounts).
 */
import React, { useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiFetchAccountRewardsYears } from '@/features/dashboard/services/apiClient';
import { olympiaApi, useOlympiaAccount, useOlympiaLink } from '@/features/dashboard/services/olympiaApi';
import { resolveCurrentXrdPrice, useXrdDailyPrices } from '@/features/dashboard/hooks/useXrdDailyPrices';
import type { MarketData, TranslationsT } from '@/features/dashboard/types';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import { formatNumber } from '@/utils/formatters';
import { generateClientAccountRewardsCsv, NoRewardsDataError, type AccountRewardsYear } from '../services/clientCsvExport';
import { olympiaDict } from '../olympia/dict';
import { downloadText, olympiaAccountRewardsCsv } from '../olympia/rewardsCsv';
import {
    computeFiatChangePct,
    fiatChangeTone,
    formatSignedCurrency,
    formatSignedPercent,
    mergeDailyRewards,
    summarizeYearRewards,
    type YearRewardsBreakdown,
} from '../utils/rewardsBreakdown';
import { RewardsYearBreakdown, type RewardsBreakdownLabels } from './RewardsYearBreakdown';
import { RewardsYearsTable, rewardsCellText, type RewardsYearsColumn, type RewardsYearsRow } from './RewardsYearsTable';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Sums = {
    days: number;
    delegatorXrd: number;
    feeXrd: number;
    fiatAtReceipt: number | null;
    fiatCurrent: number | null;
};
type Kind = 'all' | 'delegator' | 'validator';
const EMPTY_YEAR: AccountRewardsYear = {
    csv: '',
    csvDelegator: '',
    csvValidator: '',
    csvTransactions: '',
    totalXrd: 0,
    delegatorXrd: 0,
    feeXrd: 0,
    days: 0,
    ownedValidators: [],
    dailyRewards: [],
};

const yearKey = (address: string, year: string) => ['account-rewards-year', address, year] as const;

export function AccountRewardsTab({ address, tt, locale, marketData }: {
    address: string;
    tt?: Tt;
    locale: string;
    marketData?: MarketData;
}) {
    const accT = tt?.account_summary;
    const text = accT?.rewards;
    const o = olympiaDict(tt);
    const qc = useQueryClient();
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [justSaved, setJustSaved] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['account-rewards-years', address],
        queryFn: () => apiFetchAccountRewardsYears(address),
        staleTime: 5 * 60_000,
    });

    // If this account existed on Olympia (same key), include its Olympia years too.
    const { data: olympiaLink } = useOlympiaLink(address, 'mainnet');
    const olympiaLookupAddress = olympiaLink?.olympiaAddress ?? null;
    const { data: olympiaAccount } = useOlympiaAccount(olympiaLookupAddress);
    const olympiaAddress = olympiaAccount?.address ?? olympiaLookupAddress ?? '';
    const olympiaYears = (olympiaAccount?.rewards.years ?? []).slice().sort((a, b) => a - b);

    const olympiaResults = useQueries({
        queries: olympiaYears.map((year) => ({
            queryKey: ['olympia', 'rewards', 'account', olympiaAddress, year] as const,
            queryFn: async () => {
                const [rewards, moves] = await Promise.all([
                    olympiaApi.accountRewards(olympiaAddress, year),
                    olympiaApi.accountMoves(olympiaAddress, year),
                ]);
                return {
                    account: rewards?.days ?? [],
                    moves: moves ? { list: moves.moves, tooMany: moves.tooMany } : { list: [], tooMany: false },
                    validator: null,
                };
            },
            enabled: !!olympiaAddress,
            staleTime: Infinity,
            gcTime: 30 * 60_000,
            retry: 1,
        })),
    });

    const years = (data?.years ?? []).map(String).sort();
    const { data: dailyPricesData } = useXrdDailyPrices(years.length > 0 || olympiaYears.length > 0);
    const currency = getCurrencyForLocale(locale);
    const currentPrice = resolveCurrentXrdPrice(marketData, dailyPricesData?.prices, currency);

    // Worked out newest first, one at a time: a year starts once every newer one has settled.
    const order = [...years].reverse();
    const settled = (year: string) => {
        const status = qc.getQueryState(yearKey(address, year))?.status;
        return status === 'success' || status === 'error';
    };

    const results = useQueries({
        queries: years.map((year) => ({
            queryKey: yearKey(address, year),
            queryFn: async ({ signal }: { signal: AbortSignal }): Promise<AccountRewardsYear> => {
                try {
                    return await generateClientAccountRewardsCsv(
                        address, year,
                        (p) => setProgress((all) => ({ ...all, [year]: Math.min(99, p) })),
                        signal, accT,
                    );
                } catch (err) {
                    // A year with nothing to put in the CSV earned nothing.
                    if (err instanceof NoRewardsDataError) return EMPTY_YEAR;
                    throw err;
                }
            },
            enabled: order.slice(0, order.indexOf(year)).every(settled),
            staleTime: Infinity,
            gcTime: 30 * 60_000,
            retry: false,
        })),
    });

    const olympiaBreakdowns: Array<YearRewardsBreakdown | null> = olympiaResults.map((r) => {
        const days = r.data?.account;
        if (!days) return null;
        const points = mergeDailyRewards(
            days.map((d) => ({ date: d.day, xrd: d.delegatorXrd })),
            days.map((d) => ({ date: d.day, xrd: d.feeXrd })),
        );
        return summarizeYearRewards(points, dailyPricesData?.prices, currency, currentPrice, 'account');
    });

    const breakdowns: Array<YearRewardsBreakdown | null> = results.map((r) => (
        r.data
            ? summarizeYearRewards(r.data.dailyRewards ?? [], dailyPricesData?.prices, currency, currentPrice, 'account')
            : null
    ));

    const markSaved = (key: string) => {
        setJustSaved(key);
        window.setTimeout(() => setJustSaved((k) => (k === key ? null : k)), 2000);
    };

    const saveBabylon = (year: string, kind: Kind, csv: string) => {
        const suffix = kind === 'all' ? '' : `_${kind}`;
        downloadText(`account_rewards${suffix}_${address.substring(0, 25)}_${year}.csv`, csv);
        markSaved(`babylon-${year}-${kind}`);
    };

    const saveOlympia = (year: number, kind: Kind, idx: number) => {
        const d = olympiaResults[idx]?.data;
        if (!d?.account) return;
        const { csv } = olympiaAccountRewardsCsv(d.account, kind, d.moves?.list ?? []);
        if (!csv) return;
        const suffix = kind === 'all' ? '' : `_${kind}`;
        downloadText(`olympia_account_rewards${suffix}_${olympiaAddress.slice(0, 20)}_${year}.csv`, csv);
        markSaved(`olympia-${year}-${kind}`);
    };

    if (isLoading && olympiaYears.length === 0) {
        return (
            <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Loader2 className="size-3.5 animate-spin" />
                {accT?.account_rewards_modal_loading ?? ''}
            </p>
        );
    }
    if (isError && olympiaYears.length === 0) return <p className="text-xs font-semibold text-[var(--color-danger)]">{accT?.account_rewards_modal_error ?? ''}</p>;
    if (years.length === 0 && olympiaYears.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">{accT?.account_rewards_modal_no_data ?? ''}</p>;

    const olympiaSummaries: Array<Sums | null> = olympiaResults.map((r, i) => {
        const days = r.data?.account;
        if (!days) return null;
        const b = olympiaBreakdowns[i];
        return {
            days: new Set(days.map((d) => d.day)).size,
            delegatorXrd: days.reduce((acc, d) => acc + d.delegatorXrd, 0),
            feeXrd: days.reduce((acc, d) => acc + d.feeXrd, 0),
            fiatAtReceipt: b?.fiatAtReceipt ?? null,
            fiatCurrent: b?.fiatCurrent ?? null,
        };
    });

    const babylonDone = results.map((r) => r.data ?? null);
    const allOlympiaDone = olympiaSummaries.every(Boolean);
    const allBabylonDone = babylonDone.every(Boolean);
    const allDone = allOlympiaDone && allBabylonDone;

    // Show the validator fee column whenever the account owned a validator on Olympia or Babylon.
    const olympiaOwner = (olympiaAccount?.rewards.validatorFeeXrd ?? 0) > 0 || olympiaSummaries.some((s) => (s?.feeXrd ?? 0) > 0);
    const babylonOwner = babylonDone.some((r) => (r?.ownedValidators.length ?? 0) > 0 || (r?.feeXrd ?? 0) > 0);
    const owner = olympiaOwner || babylonOwner;

    const xrd = (n: number) => `${formatNumber(n, 2, locale)} XRD`;
    const fiat = (n: number | null) => (n === null ? '—' : formatCurrency(n, currency, locale));
    const changeTooltip = (r: Sums) => {
        if (r.fiatAtReceipt === null || r.fiatCurrent === null) return undefined;
        const delta = formatSignedCurrency(r.fiatCurrent - r.fiatAtReceipt, currency, locale);
        return (text?.fiat_change_cell_tooltip ?? '{delta}').replace('{delta}', delta);
    };

    const columns: RewardsYearsColumn<Sums>[] = [
        { label: text?.days ?? '', tooltip: text?.days_tooltip, value: (r) => r.days.toLocaleString(locale), tone: 'text-[var(--color-text-muted)]' },
        { label: text?.total ?? '', tooltip: text?.total_tooltip, value: (r) => xrd(r.delegatorXrd), tone: 'font-bold text-[var(--color-accent)]' },
        ...(owner ? [
            { label: text?.fee ?? '', tooltip: text?.fee_tooltip, value: (r: Sums) => xrd(r.feeXrd), tone: 'text-[var(--color-text-main)]' },
            { label: text?.sum ?? '', tooltip: text?.sum_tooltip, value: (r: Sums) => xrd(r.delegatorXrd + r.feeXrd), tone: 'font-black text-[var(--color-text-main)]' },
        ] : []),
        {
            label: text?.fiat_at_receipt ?? '',
            tooltip: text?.fiat_at_receipt_tooltip,
            value: (r) => fiat(r.fiatAtReceipt),
            tone: 'text-[var(--color-text-main)]',
        },
        {
            label: text?.fiat_current ?? '',
            tooltip: text?.fiat_current_tooltip,
            value: (r) => fiat(r.fiatCurrent),
            tone: 'text-[var(--color-text-muted)]',
        },
        {
            label: text?.fiat_change ?? '',
            tooltip: text?.fiat_change_tooltip,
            value: (r) => formatSignedPercent(computeFiatChangePct(r.fiatAtReceipt, r.fiatCurrent), locale),
            tone: (r) => fiatChangeTone(computeFiatChangePct(r.fiatAtReceipt, r.fiatCurrent)),
            cellTooltip: changeTooltip,
        },
    ];

    const breakdownLabels: RewardsBreakdownLabels = {
        byMonth: text?.breakdown_monthly ?? '',
        byMonthTooltip: text?.breakdown_monthly_tooltip,
        byDay: text?.breakdown_daily ?? '',
        byDayTooltip: text?.breakdown_daily_tooltip,
        month: text?.breakdown_month ?? '',
        monthTooltip: text?.breakdown_month_tooltip,
        monthRowHint: text?.breakdown_month_row_hint,
        date: text?.breakdown_date ?? '',
        dateTooltip: text?.breakdown_date_tooltip,
        days: text?.days ?? '',
        daysTooltip: text?.days_tooltip,
        delegator: text?.total ?? '',
        delegatorTooltip: text?.total_tooltip,
        fee: text?.fee ?? '',
        feeTooltip: text?.fee_tooltip,
        delegators: text?.total ?? '',
        delegatorsTooltip: text?.total_tooltip,
        total: text?.sum ?? '',
        totalTooltip: text?.sum_tooltip,
        unitPrice: text?.breakdown_unit_price ?? '',
        unitPriceTooltip: text?.breakdown_unit_price_tooltip,
        fiatAtReceipt: text?.fiat_at_receipt ?? '',
        fiatAtReceiptTooltip: text?.fiat_at_receipt_tooltip,
        fiatCurrent: text?.fiat_current ?? '',
        fiatCurrentTooltip: text?.fiat_current_tooltip,
        fiatChange: text?.fiat_change ?? '',
        fiatChangeTooltip: text?.fiat_change_tooltip,
        fiatChangeCellTooltip: text?.fiat_change_cell_tooltip,
        allMonths: text?.breakdown_all_months ?? '',
        empty: text?.no_csv ?? '',
        fiatNote: text?.fiat_note ?? '',
    };

    const titled = (t: string | undefined, year: string | number) => (t ?? '').replace('{year}', String(year));
    const kinds: { kind: Kind; label: string; tooltip?: string; off?: string; csv: (r: AccountRewardsYear) => string }[] = [
        { kind: 'all', label: text?.kind_all ?? '', tooltip: text?.kind_all_tooltip, off: text?.no_csv, csv: (r) => r.csv },
        { kind: 'delegator', label: text?.kind_delegator ?? '', tooltip: text?.kind_delegator_tooltip, off: text?.no_csv, csv: (r) => r.csvDelegator },
        { kind: 'validator', label: text?.kind_validator ?? '', tooltip: text?.kind_validator_tooltip, off: text?.kind_validator_off, csv: (r) => r.csvValidator },
    ];
    const legend = [
        { label: text?.kind_all ?? '', text: text?.legend_all ?? '' },
        { label: text?.kind_delegator ?? '', text: text?.legend_delegator ?? '' },
        { label: text?.kind_validator ?? '', text: text?.legend_validator ?? '' },
    ];
    const working = results.some((r) => r.fetchStatus === 'fetching');

    const olympiaTableRows: RewardsYearsRow<Sums>[] = olympiaYears.flatMap((year, i) => {
        const q = olympiaResults[i];
        const summary = olympiaSummaries[i];
        // Hide settled years with 0 XRD earned.
        if (summary && summary.delegatorXrd + summary.feeXrd <= 0) return [];
        const breakdown = olympiaBreakdowns[i];
        const moves = q.data?.moves;
        return [{
            rowKey: `olympia-${year}`,
            year,
            badge: text?.olympia_badge ?? o.badge,
            badgeTone: 'olympia',
            row: summary,
            status: q.isError ? <span className="text-[var(--color-danger)]">{o.error}</span> : undefined,
            renderExpanded: breakdown
                ? () => (
                    <RewardsYearBreakdown
                        breakdown={breakdown}
                        currency={currency}
                        locale={locale}
                        showFee={owner}
                        mode="account"
                        labels={breakdownLabels}
                    />
                )
                : undefined,
            downloads: kinds.map((k) => {
                const enabled = !!summary && (
                    k.kind === 'all'
                        ? !moves?.tooMany && (summary.delegatorXrd + summary.feeXrd > 0 || (moves?.list.length ?? 0) > 0)
                        : k.kind === 'delegator'
                            ? summary.delegatorXrd > 0
                            : summary.feeXrd > 0
                );
                const tooMany = k.kind === 'all' && !!moves?.tooMany;
                return {
                    key: k.kind,
                    label: k.label,
                    tooltip: enabled ? titled(k.tooltip, year) : tooMany ? o.rewards_kind_all_too_many : k.off,
                    enabled,
                    done: justSaved === `olympia-${year}-${k.kind}`,
                    onClick: () => { if (enabled) saveOlympia(year, k.kind, i); },
                };
            }),
        }];
    });

    const hasOlympiaRows = olympiaTableRows.length > 0;

    const babylonTableRows: RewardsYearsRow<Sums>[] = years.flatMap((year, i) => {
        const q = results[i];
        const out = q.data;
        // Hide settled years with 0 XRD earned.
        if (out && out.delegatorXrd + out.feeXrd <= 0) return [];
        const breakdown = breakdowns[i];
        let status: React.ReactNode;
        if (q.isError) {
            status = <span className="text-[var(--color-danger)]">{q.error instanceof Error ? q.error.message : String(q.error)}</span>;
        } else if (q.fetchStatus === 'fetching') {
            const p = progress[year] ?? 0;
            status = (
                <span className="inline-flex items-center justify-end gap-2">
                    <span className="h-1.5 w-24 bg-[var(--color-card-border)]/50 rounded-full overflow-hidden">
                        <span className="block h-full bg-[var(--color-primary)] transition-all duration-300 ease-out" style={{ width: `${p}%` }} />
                    </span>
                    <span className="font-mono w-8 text-right">{Math.round(p)}%</span>
                </span>
            );
        } else if (!out) {
            status = <span className={rewardsCellText}>{text?.queued ?? ''}</span>;
        }
        return [{
            rowKey: `babylon-${year}`,
            year,
            badge: hasOlympiaRows ? text?.babylon_badge : undefined,
            badgeTone: 'babylon',
            row: out
                ? {
                    days: out.days,
                    delegatorXrd: out.delegatorXrd,
                    feeXrd: out.feeXrd,
                    fiatAtReceipt: breakdown?.fiatAtReceipt ?? null,
                    fiatCurrent: breakdown?.fiatCurrent ?? null,
                }
                : null,
            status,
            renderExpanded: breakdown
                ? () => (
                    <RewardsYearBreakdown
                        breakdown={breakdown}
                        currency={currency}
                        locale={locale}
                        showFee={owner}
                        mode="account"
                        labels={breakdownLabels}
                    />
                )
                : undefined,
            downloads: kinds.map((k) => {
                const csv = out ? k.csv(out) : '';
                return {
                    key: k.kind,
                    label: k.label,
                    tooltip: csv ? titled(k.tooltip, year) : k.off,
                    enabled: !!csv,
                    done: justSaved === `babylon-${year}-${k.kind}`,
                    onClick: () => { if (csv) saveBabylon(year, k.kind, csv); },
                };
            }),
        }];
    });

    const visibleRows = [...olympiaTableRows, ...babylonTableRows];
    if (allDone && visibleRows.length === 0) {
        return <p className="text-xs text-[var(--color-text-muted)]">{accT?.account_rewards_modal_no_data ?? ''}</p>;
    }

    const total: Sums | null = allDone
        ? visibleRows.reduce<Sums>((acc, { row }) => {
            if (!row) return acc;
            return {
                days: acc.days + row.days,
                delegatorXrd: acc.delegatorXrd + row.delegatorXrd,
                feeXrd: acc.feeXrd + row.feeXrd,
                fiatAtReceipt: row.fiatAtReceipt != null ? (acc.fiatAtReceipt ?? 0) + row.fiatAtReceipt : acc.fiatAtReceipt,
                fiatCurrent: row.fiatCurrent != null ? (acc.fiatCurrent ?? 0) + row.fiatCurrent : acc.fiatCurrent,
            };
        }, { days: 0, delegatorXrd: 0, feeXrd: 0, fiatAtReceipt: null, fiatCurrent: null })
        : null;

    return (
        <RewardsYearsTable
            title={text?.title ?? ''}
            desc={text?.desc}
            legend={legend}
            yearLabel={text?.year ?? ''}
            yearTooltip={text?.year_tooltip}
            downloadLabel={text?.download ?? ''}
            downloadTooltip={text?.download_tooltip}
            totalLabel={text?.sum ?? ''}
            expandHint={text?.expand_hint}
            columns={columns}
            total={total}
            rows={visibleRows}
            footer={working ? <p className="text-[11px] text-[var(--color-text-muted)]">{accT?.account_rewards_modal_generating_desc}</p> : undefined}
        />
    );
}
