'use client';
/**
 * The "Rewards" tab of a Babylon account: one row per year with the days it
 * earned staking rewards, XRD earned, fiat value at receipt date, fiat value
 * at current price, and that year's CoinTracking CSV in the row itself.
 * Clicking a year row expands its monthly / daily breakdown.
 *
 * Babylon's yearly figure comes from replaying the account's history against
 * the validators' daily data, in the browser, so the tab works the years out
 * by itself as soon as it opens: one at a time, newest first. Historical daily
 * XRD prices come from `/api/xrd-daily-prices` (static baseline + in-memory
 * tail, zero Redis commands, fetched once per 6 h and shared across accounts).
 */
import React, { useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiFetchAccountRewardsYears } from '@/features/dashboard/services/apiClient';
import { resolveCurrentXrdPrice, useXrdDailyPrices } from '@/features/dashboard/hooks/useXrdDailyPrices';
import type { MarketData, TranslationsT } from '@/features/dashboard/types';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import { formatNumber } from '@/utils/formatters';
import { generateClientAccountRewardsCsv, NoRewardsDataError, type AccountRewardsYear } from '../services/clientCsvExport';
import { downloadText } from '../olympia/rewardsCsv';
import {
    computeFiatChangePct,
    fiatChangeTone,
    formatSignedCurrency,
    formatSignedPercent,
    summarizeYearRewards,
    type YearRewardsBreakdown,
} from '../utils/rewardsBreakdown';
import { RewardsYearBreakdown, type RewardsBreakdownLabels } from './RewardsYearBreakdown';
import { RewardsYearsTable, rewardsCellText, type RewardsYearsColumn } from './RewardsYearsTable';

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
    const qc = useQueryClient();
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [justSaved, setJustSaved] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['account-rewards-years', address],
        queryFn: () => apiFetchAccountRewardsYears(address),
        staleTime: 5 * 60_000,
    });

    const years = (data?.years ?? []).map(String).sort();
    const { data: dailyPricesData } = useXrdDailyPrices(years.length > 0);
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

    const breakdowns: Array<YearRewardsBreakdown | null> = results.map((r) => (
        r.data
            ? summarizeYearRewards(r.data.dailyRewards ?? [], dailyPricesData?.prices, currency, currentPrice, 'account')
            : null
    ));

    const save = (year: string, kind: Kind, csv: string) => {
        const suffix = kind === 'all' ? '' : `_${kind}`;
        downloadText(`account_rewards${suffix}_${address.substring(0, 25)}_${year}.csv`, csv);
        const key = `${year}-${kind}`;
        setJustSaved(key);
        window.setTimeout(() => setJustSaved((k) => (k === key ? null : k)), 2000);
    };

    if (isLoading) {
        return (
            <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Loader2 className="size-3.5 animate-spin" />
                {accT?.account_rewards_modal_loading ?? 'Loading...'}
            </p>
        );
    }
    if (isError) return <p className="text-xs font-semibold text-[var(--color-danger)]">{accT?.account_rewards_modal_error ?? 'Error'}</p>;
    if (years.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">{accT?.account_rewards_modal_no_data ?? ''}</p>;

    const done = results.map((r) => r.data ?? null);
    const allDone = done.every(Boolean);
    // The fee column and the delegator / validator downloads, only for an account that owned a validator, as in Olympia.
    const owner = done.some((r) => (r?.ownedValidators.length ?? 0) > 0 || (r?.feeXrd ?? 0) > 0);
    const xrd = (n: number) => `${formatNumber(n, 2, locale)} XRD`;
    const fiat = (n: number | null) => (n === null ? '—' : formatCurrency(n, currency, locale));
    const changeTooltip = (r: Sums) => {
        if (r.fiatAtReceipt === null || r.fiatCurrent === null) return undefined;
        const delta = formatSignedCurrency(r.fiatCurrent - r.fiatAtReceipt, currency, locale);
        return (text?.fiat_change_cell_tooltip ?? '{delta}').replace('{delta}', delta);
    };

    const columns: RewardsYearsColumn<Sums>[] = [
        { label: text?.days ?? 'Days', tooltip: text?.days_tooltip, value: (r) => r.days.toLocaleString(locale), tone: 'text-[var(--color-text-muted)]' },
        { label: text?.total ?? '', tooltip: text?.total_tooltip, value: (r) => xrd(r.delegatorXrd), tone: 'font-bold text-[var(--color-accent)]' },
        ...(owner ? [
            { label: text?.fee ?? '', tooltip: text?.fee_tooltip, value: (r: Sums) => xrd(r.feeXrd), tone: 'text-[var(--color-text-main)]' },
            { label: text?.sum ?? 'Total', tooltip: text?.sum_tooltip, value: (r: Sums) => xrd(r.delegatorXrd + r.feeXrd), tone: 'font-black text-[var(--color-text-main)]' },
        ] : []),
        {
            label: text?.fiat_at_receipt ?? 'At receipt',
            tooltip: text?.fiat_at_receipt_tooltip,
            value: (r) => fiat(r.fiatAtReceipt),
            tone: 'text-[var(--color-text-main)]',
        },
        {
            label: text?.fiat_current ?? 'Current value',
            tooltip: text?.fiat_current_tooltip,
            value: (r) => fiat(r.fiatCurrent),
            tone: 'text-[var(--color-text-muted)]',
        },
        {
            label: text?.fiat_change ?? 'Change',
            tooltip: text?.fiat_change_tooltip,
            value: (r) => formatSignedPercent(computeFiatChangePct(r.fiatAtReceipt, r.fiatCurrent), locale),
            tone: (r) => fiatChangeTone(computeFiatChangePct(r.fiatAtReceipt, r.fiatCurrent)),
            cellTooltip: changeTooltip,
        },
    ];

    const breakdownLabels: RewardsBreakdownLabels = {
        byMonth: text?.breakdown_monthly ?? 'By month',
        byMonthTooltip: text?.breakdown_monthly_tooltip,
        byDay: text?.breakdown_daily ?? 'By day',
        byDayTooltip: text?.breakdown_daily_tooltip,
        month: text?.breakdown_month ?? 'Month',
        monthTooltip: text?.breakdown_month_tooltip,
        monthRowHint: text?.breakdown_month_row_hint,
        date: text?.breakdown_date ?? 'Date',
        dateTooltip: text?.breakdown_date_tooltip,
        days: text?.days ?? 'Days',
        daysTooltip: text?.days_tooltip,
        delegator: text?.total ?? 'As delegator',
        delegatorTooltip: text?.total_tooltip,
        fee: text?.fee ?? 'Validator fee',
        feeTooltip: text?.fee_tooltip,
        delegators: text?.total ?? 'As delegator',
        delegatorsTooltip: text?.total_tooltip,
        total: text?.sum ?? 'Total',
        totalTooltip: text?.sum_tooltip,
        unitPrice: text?.breakdown_unit_price ?? 'XRD price',
        unitPriceTooltip: text?.breakdown_unit_price_tooltip,
        fiatAtReceipt: text?.fiat_at_receipt ?? 'At receipt',
        fiatAtReceiptTooltip: text?.fiat_at_receipt_tooltip,
        fiatCurrent: text?.fiat_current ?? 'Current value',
        fiatCurrentTooltip: text?.fiat_current_tooltip,
        fiatChange: text?.fiat_change ?? 'Change',
        fiatChangeTooltip: text?.fiat_change_tooltip,
        fiatChangeCellTooltip: text?.fiat_change_cell_tooltip,
        allMonths: text?.breakdown_all_months ?? 'All months',
        empty: text?.no_csv ?? 'No rewards in this year.',
        fiatNote: text?.fiat_note ?? '',
    };

    const titled = (t: string | undefined, year: string) => (t ?? '').replace('{year}', year);
    // The same three downloads as Olympia's; "Validator" stays off for an account that owned no validator.
    const kinds: { kind: Kind; label: string; tooltip?: string; off?: string; csv: (r: AccountRewardsYear) => string }[] = [
        { kind: 'all', label: text?.kind_all ?? 'All', tooltip: text?.kind_all_tooltip, off: text?.no_csv, csv: (r) => r.csv },
        { kind: 'delegator', label: text?.kind_delegator ?? 'Delegator', tooltip: text?.kind_delegator_tooltip, off: text?.no_csv, csv: (r) => r.csvDelegator },
        { kind: 'validator', label: text?.kind_validator ?? 'Validator', tooltip: text?.kind_validator_tooltip, off: text?.kind_validator_off, csv: (r) => r.csvValidator },
    ];
    const legend = [
        { label: text?.kind_all ?? 'All', text: text?.legend_all ?? '' },
        { label: text?.kind_delegator ?? 'Delegator', text: text?.legend_delegator ?? '' },
        { label: text?.kind_validator ?? 'Validator', text: text?.legend_validator ?? '' },
    ];
    const working = results.some((r) => r.fetchStatus === 'fetching');

    const total: Sums | null = allDone
        ? done.reduce<Sums>((acc, r, i) => {
            const b = breakdowns[i];
            return {
                days: acc.days + (r?.days ?? 0),
                delegatorXrd: acc.delegatorXrd + (r?.delegatorXrd ?? 0),
                feeXrd: acc.feeXrd + (r?.feeXrd ?? 0),
                fiatAtReceipt: b?.fiatAtReceipt != null ? (acc.fiatAtReceipt ?? 0) + b.fiatAtReceipt : acc.fiatAtReceipt,
                fiatCurrent: b?.fiatCurrent != null ? (acc.fiatCurrent ?? 0) + b.fiatCurrent : acc.fiatCurrent,
            };
        }, { days: 0, delegatorXrd: 0, feeXrd: 0, fiatAtReceipt: null, fiatCurrent: null })
        : null;

    return (
        <RewardsYearsTable
            title={text?.title ?? ''}
            desc={text?.desc}
            legend={legend}
            yearLabel={text?.year ?? 'Year'}
            yearTooltip={text?.year_tooltip}
            downloadLabel={text?.download ?? 'CSV'}
            downloadTooltip={text?.download_tooltip}
            totalLabel={text?.sum ?? 'Total'}
            expandHint={text?.expand_hint}
            columns={columns}
            total={total}
            rows={years.map((year, i) => {
                const q = results[i];
                const out = q.data;
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
                return {
                    year,
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
                            done: justSaved === `${year}-${k.kind}`,
                            onClick: () => { if (csv) save(year, k.kind, csv); },
                        };
                    }),
                };
            })}
            footer={working ? <p className="text-[11px] text-[var(--color-text-muted)]">{accT?.account_rewards_modal_generating_desc}</p> : undefined}
        />
    );
}
