'use client';
/**
 * The "Rewards" tab of a Babylon account: one row per year with the days it
 * earned staking rewards and how much, and that year's CoinTracking CSV in
 * the row itself, in the table of the Olympia rewards tab.
 *
 * Babylon's yearly figure comes from replaying the account's history against
 * the validators' daily data, in the browser, so the tab works the years out
 * by itself as soon as it opens: one at a time, newest first. The CSV of each
 * year comes from that same work, so downloading it is instant.
 *
 * What it asks the server is the same for every account (the years with data
 * and each year's validator data), cached by the CDN and by the browser, and
 * read from Redis at most once per instance and hour (services/accountRewards.ts):
 * opening the tab costs Redis nothing per account. The account's history is
 * read from the Gateway by the browser. Leaving the tab stops a year still
 * being worked out; the finished ones are kept for half an hour.
 */
import React, { useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiFetchAccountRewardsYears } from '@/features/dashboard/services/apiClient';
import type { TranslationsT } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { generateClientAccountRewardsCsv, NoRewardsDataError, type AccountRewardsYear } from '../services/clientCsvExport';
import { downloadText } from '../olympia/rewardsCsv';
import { RewardsYearsTable, rewardsCellText, type RewardsYearsColumn } from './RewardsYearsTable';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Sums = { days: number; delegatorXrd: number; feeXrd: number };
type Kind = 'all' | 'delegator' | 'validator';
const EMPTY_YEAR: AccountRewardsYear = { csv: '', csvDelegator: '', csvValidator: '', totalXrd: 0, delegatorXrd: 0, feeXrd: 0, days: 0, ownedValidators: [] };

const yearKey = (address: string, year: string) => ['account-rewards-year', address, year] as const;

export function AccountRewardsTab({ address, tt, locale }: { address: string; tt?: Tt; locale: string }) {
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
  const columns: RewardsYearsColumn<Sums>[] = [
    { label: text?.days ?? 'Days', value: (r) => r.days.toLocaleString(locale), tone: 'text-[var(--color-text-muted)]' },
    { label: text?.total ?? '', value: (r) => xrd(r.delegatorXrd), tone: 'font-bold text-[var(--color-accent)]' },
    ...(owner ? [
      { label: text?.fee ?? '', value: (r: Sums) => xrd(r.feeXrd), tone: 'text-[var(--color-text-main)]' },
      { label: text?.sum ?? 'Total', value: (r: Sums) => xrd(r.delegatorXrd + r.feeXrd), tone: 'font-black text-[var(--color-text-main)]' },
    ] : []),
  ];
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

  return (
    <RewardsYearsTable
      title={text?.title ?? ''}
      desc={text?.desc}
      legend={legend}
      yearLabel={text?.year ?? 'Year'}
      downloadLabel={text?.download ?? 'CSV'}
      totalLabel={text?.sum ?? 'Total'}
      columns={columns}
      total={allDone ? done.reduce<Sums>((acc, r) => ({ days: acc.days + (r?.days ?? 0), delegatorXrd: acc.delegatorXrd + (r?.delegatorXrd ?? 0), feeXrd: acc.feeXrd + (r?.feeXrd ?? 0) }), { days: 0, delegatorXrd: 0, feeXrd: 0 }) : null}
      rows={years.map((year, i) => {
        const q = results[i];
        const out = q.data;
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
          row: out ? { days: out.days, delegatorXrd: out.delegatorXrd, feeXrd: out.feeXrd } : null,
          status,
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
