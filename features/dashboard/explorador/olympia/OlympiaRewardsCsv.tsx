'use client';
/**
 * Download of Olympia staking rewards as CSV, for an account (what it earned
 * delegating and, for validator owners, the fee; either or both) or a
 * validator (its owner's daily fee), in the formats of the Babylon exports.
 *
 * Two shapes: `OlympiaRewardsCsv` sits inside a tab as a table of years with
 * their totals and downloads, `OlympiaRewardsCsvModal` is the dialog, drawn
 * like the Babylon account rewards dialog (AccountRewardsCsvModal).
 */
import React, { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Download, Loader2, X } from 'lucide-react';
import { RadixIcon } from '@/components/shared/RadixIcon';
import { useMounted } from '@/hooks/useMounted';
import { olympiaApi, useOlympiaAccount } from '@/features/dashboard/services/olympiaApi';
import type { OlympiaDict } from './dict';
import { formatAmount } from './format';
import { FilterPills, OlympiaBadge } from './OlympiaParts';
import { downloadText, olympiaAccountRewardsCsv, olympiaValidatorRewardsCsv, type OlympiaRewardKind } from './rewardsCsv';

type Subject = 'account' | 'validator';
type Result = { kind: 'done'; year: number; totalXrd: number } | { kind: 'empty' } | { kind: 'error' } | null;

/** The state and the download itself, shared by both shapes. */
function useRewardsCsv(subject: Subject, address: string, years: number[]) {
  const [year, setYear] = useState<number | null>(years.at(-1) ?? null);
  const [kind, setKind] = useState<OlympiaRewardKind>('all');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const download = async () => {
    if (!year) return;
    setBusy(true);
    setResult(null);
    try {
      const { csv, totalXrd } = subject === 'account'
        ? olympiaAccountRewardsCsv((await olympiaApi.accountRewards(address, year))?.days ?? [], kind)
        : olympiaValidatorRewardsCsv(address, (await olympiaApi.validatorRewards(address, year))?.days ?? []);
      if (!csv) {
        setResult({ kind: 'empty' });
        return;
      }
      const suffix = subject === 'account' && kind !== 'all' ? `_${kind}` : '';
      downloadText(`olympia_${subject}_rewards${suffix}_${address.slice(0, 20)}_${year}.csv`, csv);
      setResult({ kind: 'done', year, totalXrd });
    } catch {
      setResult({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return { year, setYear, kind, setKind, busy, result, download };
}

type Csv = ReturnType<typeof useRewardsCsv>;

function YearButtons({ years, csv }: { years: number[]; csv: Csv }) {
  return (
    <div className="flex flex-wrap gap-2">
      {years.map((y) => (
        <button
          type="button"
          key={y}
          onClick={(e) => { e.stopPropagation(); csv.setYear(y); }}
          aria-pressed={csv.year === y}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${csv.year === y
            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
            : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-main)]'}`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function KindPills({ o, csv }: { o: OlympiaDict; csv: Csv }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-black text-[var(--color-text-muted)]">{o.rewards_kind ?? 'Rewards'}</p>
      <FilterPills
        value={csv.kind}
        onChange={csv.setKind}
        options={[
          { key: 'all', label: o.rewards_kind_all ?? 'All', tooltip: o.rewards_kind_all_tooltip },
          { key: 'delegator', label: o.rewards_kind_delegator ?? 'Delegator', tooltip: o.rewards_kind_delegator_tooltip },
          { key: 'validator', label: o.rewards_kind_validator ?? 'Validator', tooltip: o.rewards_kind_validator_tooltip },
        ]}
      />
    </div>
  );
}

function DownloadButton({ o, csv, disabled }: { o: OlympiaDict; csv: Csv; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void csv.download(); }}
      disabled={!csv.year || csv.busy || disabled}
      title={o.rewards_csv_tooltip}
      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
    >
      {csv.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {csv.busy ? o.rewards_csv_generating : o.rewards_csv_download}
    </button>
  );
}

/** What the last download gave: its total, "nothing that year" or an error. */
function ResultNote({ o, csv, locale }: { o: OlympiaDict; csv: Csv; locale: string }) {
  const r = csv.result;
  if (!r) return null;
  if (r.kind === 'error') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
        <p className="text-xs text-red-400">{o.error}</p>
      </div>
    );
  }
  if (r.kind === 'empty') {
    return (
      <div className="text-center py-4 bg-[var(--color-bg)]/50 rounded-2xl border border-dashed border-[var(--color-card-border)]">
        <p className="text-xs text-[var(--color-text-muted)] px-4">{o.rewards_csv_empty}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-3">
        <div className="size-9 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center shrink-0">
          <RadixIcon className="size-5" strokeColor="var(--color-accent)" />
        </div>
        <h4 className="text-sm font-bold text-[var(--color-text-main)]">{o.rewards_csv_done ?? ''}</h4>
      </div>
      <div className="p-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-bg)] flex justify-between items-center">
        <span className="text-xs font-semibold text-[var(--color-text-muted)]">{o.rewards_csv_total ?? ''} · {r.year}</span>
        <span className="text-sm font-black text-[var(--color-text-main)]">{formatAmount(r.totalXrd, locale)} XRD</span>
      </div>
    </div>
  );
}

type YearRow = { year: number; days: number; delegatorXrd: number; feeXrd: number };

/** One year's rewards, read once and kept: the table's totals and the CSV come from the same read. */
function useYearRewards(subject: Subject, address: string, years: number[]) {
  return useQueries({
    queries: years.map((year) => ({
      queryKey: ['olympia', 'rewards', subject, address, year] as const,
      queryFn: async () => subject === 'account'
        ? { account: (await olympiaApi.accountRewards(address, year))?.days ?? [], validator: null }
        : { account: null, validator: (await olympiaApi.validatorRewards(address, year))?.days ?? [] },
      staleTime: Infinity,
      gcTime: 30 * 60_000,
      retry: 1,
    })),
  });
}

function summarize(year: number, data: ReturnType<typeof useYearRewards>[number]['data']): YearRow | null {
  if (!data) return null;
  if (data.account) {
    const days = new Set(data.account.map((d) => d.day)).size;
    return {
      year,
      days,
      delegatorXrd: data.account.reduce((acc, d) => acc + d.delegatorXrd, 0),
      feeXrd: data.account.reduce((acc, d) => acc + d.feeXrd, 0),
    };
  }
  const v = data.validator ?? [];
  return {
    year,
    days: v.filter((d) => d.feeXrd > 0 || d.delegatorsXrd > 0).length,
    delegatorXrd: v.reduce((acc, d) => acc + d.delegatorsXrd, 0),
    feeXrd: v.reduce((acc, d) => acc + d.feeXrd, 0),
  };
}

/**
 * The CSV download inside a tab: a table with one row per year (days with
 * rewards, what was earned and the total) and that year's downloads in the
 * row itself. No frame of its own.
 */
export function OlympiaRewardsCsv({ subject, address, years, o, locale, kinds = true }: {
  subject: Subject; address: string; years: number[]; o: OlympiaDict; locale: string;
  /** Offer the delegator / validator downloads (off for an account that never owned a validator). */
  kinds?: boolean;
}) {
  const results = useYearRewards(subject, address, years);
  const [done, setDone] = useState<string | null>(null);
  if (years.length === 0) return null;

  const isAccount = subject === 'account';
  const showFee = !isAccount || kinds;
  const rows = years.map((year, i) => ({ year, query: results[i], row: summarize(year, results[i].data) }));
  const total = rows.reduce((acc, r) => ({
    days: acc.days + (r.row?.days ?? 0),
    delegatorXrd: acc.delegatorXrd + (r.row?.delegatorXrd ?? 0),
    feeXrd: acc.feeXrd + (r.row?.feeXrd ?? 0),
  }), { days: 0, delegatorXrd: 0, feeXrd: 0 });
  const allLoaded = rows.every((r) => r.row);

  const save = (year: number, kind: OlympiaRewardKind) => {
    const data = rows.find((r) => r.year === year)?.query.data;
    if (!data) return;
    const { csv } = data.account
      ? olympiaAccountRewardsCsv(data.account, kind)
      : olympiaValidatorRewardsCsv(address, data.validator ?? []);
    if (!csv) return;
    const suffix = isAccount && kind !== 'all' ? `_${kind}` : '';
    downloadText(`olympia_${subject}_rewards${suffix}_${address.slice(0, 20)}_${year}.csv`, csv);
    setDone(`${year}-${kind}`);
    window.setTimeout(() => setDone((d) => (d === `${year}-${kind}` ? null : d)), 2000);
  };

  const downloads: { kind: OlympiaRewardKind; label: string; tooltip?: string; has: (r: YearRow) => boolean }[] = isAccount
    ? [
        { kind: 'all', label: o.rewards_kind_all ?? 'All', tooltip: o.rewards_kind_all_tooltip, has: (r) => r.delegatorXrd + r.feeXrd > 0 },
        ...(kinds ? [
          { kind: 'delegator' as const, label: o.rewards_kind_delegator ?? 'Delegator', tooltip: o.rewards_kind_delegator_tooltip, has: (r: YearRow) => r.delegatorXrd > 0 },
          { kind: 'validator' as const, label: o.rewards_kind_validator ?? 'Validator', tooltip: o.rewards_kind_validator_tooltip, has: (r: YearRow) => r.feeXrd > 0 },
        ] : []),
      ]
    : [{ kind: 'all', label: o.rewards_csv_download ?? 'Download', tooltip: o.rewards_csv_tooltip, has: (r) => r.feeXrd > 0 }];

  const th = 'py-2.5 px-3 first:pl-0 last:pr-0 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap';
  const num = 'py-3 px-3 text-right font-mono text-xs whitespace-nowrap';
  const xrd = (n: number) => `${formatAmount(n, locale)} XRD`;
  // Accounts: what it earned delegating, then its validator fee. Validators: the owner's fee, then what its delegators earned.
  const first = (r: { delegatorXrd: number; feeXrd: number }) => (isAccount ? r.delegatorXrd : r.feeXrd);
  const second = (r: { delegatorXrd: number; feeXrd: number }) => (isAccount ? r.feeXrd : r.delegatorXrd);
  const ownTotal = (r: { delegatorXrd: number; feeXrd: number }) => (isAccount ? r.delegatorXrd + r.feeXrd : r.feeXrd);

  return (
    <section className="space-y-3" onClick={(e) => e.stopPropagation()} role="presentation">
      <div className="space-y-1">
        <h4 className="text-[11px] uppercase font-black tracking-widest text-[var(--color-text-main)]">{o.rewards_csv_title}</h4>
        <p className="text-xs text-[var(--color-text-muted)]">{isAccount ? o.rewards_csv_desc : o.rewards_csv_owner_desc}</p>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="border-b border-[var(--color-card-border)]">
            <tr>
              <th className={th}>{o.rewards_year}</th>
              <th className={`${th} text-right`}>{o.rewards_table_days ?? 'Days'}</th>
              <th className={`${th} text-right`}>{isAccount ? (o.rewards_table_delegator ?? '') : (o.rewards_table_fee ?? '')}</th>
              {showFee && <th className={`${th} text-right`}>{isAccount ? (o.rewards_table_fee ?? '') : (o.rewards_table_delegators ?? '')}</th>}
              {isAccount && showFee && <th className={`${th} text-right`}>{o.rewards_table_total ?? 'Total'}</th>}
              <th className={`${th} text-right`}>{o.rewards_table_download ?? 'CSV'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ year, query, row }) => (
              <tr key={year} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                <td className="py-3 pr-3 text-sm font-bold text-[var(--color-text-main)]">{year}</td>
                {!row ? (
                  <td colSpan={(showFee ? 3 : 2) + (isAccount && showFee ? 1 : 0)} className="py-3 px-4 text-right text-xs text-[var(--color-text-muted)]">
                    {query.isError ? <span className="text-[var(--color-danger)]">{o.error}</span> : <Loader2 className="size-3.5 animate-spin inline" />}
                  </td>
                ) : (
                  <>
                    <td className={`${num} text-[var(--color-text-muted)]`}>{row.days.toLocaleString(locale)}</td>
                    <td className={`${num} font-bold text-[var(--color-accent)]`}>{xrd(first(row))}</td>
                    {showFee && <td className={`${num} text-[var(--color-text-main)]`}>{xrd(second(row))}</td>}
                    {isAccount && showFee && <td className={`${num} font-black text-[var(--color-text-main)]`}>{xrd(ownTotal(row))}</td>}
                  </>
                )}
                <td className="py-2 pl-3">
                  <div className="flex justify-end flex-wrap gap-x-3 gap-y-1">
                    {downloads.map((d) => {
                      const key = `${year}-${d.kind}`;
                      const enabled = !!row && d.has(row);
                      return (
                        <button
                          key={d.kind}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); save(year, d.kind); }}
                          disabled={!enabled}
                          title={enabled ? d.tooltip : o.rewards_csv_empty}
                          className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--color-text-muted)]"
                        >
                          {done === key ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Download className="size-3.5" />}
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {years.length > 1 && allLoaded && (
            <tfoot className="border-t border-[var(--color-card-border)]">
              <tr>
                <td className="py-3 pr-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{o.rewards_table_total ?? 'Total'}</td>
                <td className={`${num} text-[var(--color-text-muted)]`}>{total.days.toLocaleString(locale)}</td>
                <td className={`${num} font-bold text-[var(--color-accent)]`}>{xrd(first(total))}</td>
                {showFee && <td className={`${num} text-[var(--color-text-main)]`}>{xrd(second(total))}</td>}
                {isAccount && showFee && <td className={`${num} font-black text-[var(--color-text-main)]`}>{xrd(ownTotal(total))}</td>}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/** The CSV download as a dialog, in the layout of the Babylon account rewards dialog. */
export function OlympiaRewardsCsvModal({ subject, address, years, o, locale, onClose, closeLabel }: {
  subject: Subject; address: string; years: number[]; o: OlympiaDict; locale: string; onClose: () => void; closeLabel?: string;
}) {
  const csv = useRewardsCsv(subject, address, years);
  // The delegator / validator choice only means something for an account that
  // earned a validator fee, i.e. owned a validator on Olympia.
  const { data: account } = useOlympiaAccount(subject === 'account' ? address : null);
  const ownedValidator = (account?.rewards.validatorFeeXrd ?? 0) > 0;
  const mounted = useMounted();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm w-full text-left cursor-auto"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={o.rewards_csv_title}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--color-card-border)]">
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">{o.rewards_csv_title}</h3>
          <button
            type="button"
            onClick={onClose}
            title={closeLabel ?? 'Close'}
            aria-label={closeLabel ?? 'Close'}
            className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2 min-w-0">
            <OlympiaBadge o={o} />
            <span className="font-mono text-[11px] text-[var(--color-text-muted)] truncate" title={address}>{address}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">{subject === 'account' ? o.rewards_csv_desc : o.rewards_csv_owner_desc}</p>
          <YearButtons years={years} csv={csv} />
          {subject === 'account' && ownedValidator && <KindPills o={o} csv={csv} />}
          <ResultNote o={o} csv={csv} locale={locale} />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
          <DownloadButton o={o} csv={csv} disabled={years.length === 0} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
