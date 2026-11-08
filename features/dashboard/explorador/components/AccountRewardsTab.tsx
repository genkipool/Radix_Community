'use client';
/**
 * The "Rewards" tab of a Babylon account: one row per year with staking
 * rewards, and that year's CoinTracking CSV in the row itself, in the layout
 * of the Olympia rewards table. Babylon's yearly figure comes from replaying
 * the account's history against the validators' daily data, which takes
 * minutes, so a year's total appears once its CSV has been worked out; the
 * file is kept, and downloading it again is instant.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Download, Loader2 } from 'lucide-react';
import { apiFetchAccountRewardsYears } from '@/features/dashboard/services/apiClient';
import type { MarketData, TranslationsT } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import { generateClientAccountRewardsCsv } from '../services/clientCsvExport';
import { downloadText } from '../olympia/rewardsCsv';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type YearState = { status: 'running'; progress: number } | { status: 'done'; csv: string; totalXrd: number } | { status: 'error'; message: string };

function RowIcon({ running, saved }: { running: boolean; saved: boolean }) {
  if (running) return <Loader2 className="size-3.5 animate-spin" />;
  if (saved) return <Check className="size-3.5 text-[var(--color-accent)]" />;
  return <Download className="size-3.5" />;
}

export function AccountRewardsTab({ address, tt, locale, marketData }: {
  address: string; tt?: Tt; locale: string; marketData?: MarketData | null;
}) {
  const accT = tt?.account_summary;
  const text = accT?.rewards;
  const [years, setYears] = useState<Record<string, YearState>>({});
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const running = useRef<AbortController | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['account-rewards-years', address],
    queryFn: () => apiFetchAccountRewardsYears(address),
    staleTime: 5 * 60_000,
  });

  // Leaving the tab stops a CSV still being worked out.
  useEffect(() => () => running.current?.abort(), []);

  const currency = getCurrencyForLocale(locale);
  const price = currency === 'EUR' ? (marketData?.priceEur ?? 0) : (marketData?.priceUsd ?? 0);
  const list = (data?.years ?? []).map(String).sort((a, b) => b.localeCompare(a));
  const busy = Object.values(years).some((y) => y.status === 'running');

  const save = (year: string, csv: string) => {
    downloadText(`account_rewards_${address.substring(0, 25)}_${year}.csv`, csv);
    setJustSaved(year);
    window.setTimeout(() => setJustSaved((y) => (y === year ? null : y)), 2000);
  };

  const download = async (year: string) => {
    const state = years[year];
    if (state?.status === 'done') {
      save(year, state.csv);
      return;
    }
    const controller = new AbortController();
    running.current = controller;
    setYears((all) => ({ ...all, [year]: { status: 'running', progress: 0 } }));
    try {
      const out = await generateClientAccountRewardsCsv(
        address, year,
        (p) => setYears((all) => (all[year]?.status === 'running' ? { ...all, [year]: { status: 'running', progress: Math.min(99, p) } } : all)),
        controller.signal, accT,
      );
      if (controller.signal.aborted) return;
      if (!out.csv) {
        setYears((all) => ({ ...all, [year]: { status: 'error', message: accT?.account_rewards_modal_no_data ?? '' } }));
        return;
      }
      setYears((all) => ({ ...all, [year]: { status: 'done', csv: out.csv, totalXrd: out.totalXrd || 0 } }));
      save(year, out.csv);
    } catch (err) {
      if (controller.signal.aborted) return;
      setYears((all) => ({ ...all, [year]: { status: 'error', message: err instanceof Error ? err.message : String(err) } }));
    } finally {
      if (running.current === controller) running.current = null;
    }
  };

  const th = 'py-2.5 px-3 first:pl-0 last:pr-0 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap';
  const num = 'py-3 px-3 text-right font-mono text-xs whitespace-nowrap';

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-[11px] uppercase font-black tracking-widest text-[var(--color-text-main)]">{text?.title ?? ''}</h4>
        <p className="text-xs text-[var(--color-text-muted)]">{text?.desc ?? accT?.account_rewards_modal_desc}</p>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 className="size-3.5 animate-spin" />
          {accT?.account_rewards_modal_loading ?? 'Loading...'}
        </p>
      ) : isError ? (
        <p className="text-xs font-semibold text-[var(--color-danger)]">{accT?.account_rewards_modal_error ?? 'Error'}</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">{accT?.account_rewards_modal_no_data ?? ''}</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-[var(--color-card-border)]">
              <tr>
                <th className={th}>{text?.year ?? 'Year'}</th>
                <th className={`${th} text-right`}>{text?.total ?? ''}</th>
                <th className={`${th} text-right`}>{text?.value ?? ''}</th>
                <th className={`${th} text-right`}>{text?.download ?? ''}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((year) => {
                const state = years[year];
                return (
                  <tr key={year} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 pr-3 text-sm font-bold text-[var(--color-text-main)]">{year}</td>
                    {state?.status === 'running' ? (
                      <td colSpan={2} className="py-3 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">{accT?.account_rewards_modal_generating ?? ''}</span>
                          <div className="h-1.5 w-32 bg-[var(--color-card-border)]/50 rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out" style={{ width: `${state.progress}%` }} />
                          </div>
                          <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-8 text-right">{Math.round(state.progress)}%</span>
                        </div>
                      </td>
                    ) : state?.status === 'error' ? (
                      <td colSpan={2} className="py-3 px-3 text-right text-xs text-[var(--color-danger)]">{state.message}</td>
                    ) : state?.status === 'done' ? (
                      <>
                        <td className={`${num} font-black text-[var(--color-accent)]`}>{formatNumber(state.totalXrd, 2, locale)} XRD</td>
                        <td className={`${num} text-[var(--color-text-muted)]`}>
                          {price > 0 ? `≈ ${formatCurrency(state.totalXrd * price, currency as 'USD' | 'EUR', locale)}` : '-'}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="py-3 px-3 text-right text-[11px] text-[var(--color-text-muted)]">{text?.pending ?? ''}</td>
                    )}
                    <td className="py-2 pl-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void download(year); }}
                          disabled={busy}
                          title={accT?.download_rewards_tooltip}
                          className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--color-text-muted)]"
                        >
                          <RowIcon running={state?.status === 'running'} saved={justSaved === year} />
                          {accT?.account_rewards_modal_download ?? ''}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.length > 0 && <p className="text-[11px] text-[var(--color-text-muted)]">{accT?.account_rewards_modal_generating_desc}</p>}
    </section>
  );
}
