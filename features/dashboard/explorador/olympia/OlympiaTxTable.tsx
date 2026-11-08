'use client';
/**
 * An account's Olympia transactions, newest first, in the layout of the
 * Babylon transactions tab: date, transaction, type, what left and what came
 * in, fee (when the account paid it) and message.
 */
import React from 'react';
import { m } from 'motion/react';
import { Lock, MessageSquare } from 'lucide-react';
import type { OlympiaBalanceChange, OlympiaTxItem } from '@/types/olympia';
import { useOlympiaTransactions } from '@/features/dashboard/services/olympiaApi';
import { actionLabel, type OlympiaDict } from './dict';
import { formatDateTime, formatDecimal } from './format';
import { Empty, ErrorText, Loading, OlympiaRef } from './OlympiaParts';

function ChangeCell({ change, locale, sign }: { change?: OlympiaBalanceChange; locale: string; sign: 1 | -1 }) {
  if (!change) return <span className="text-xs text-[var(--color-text-muted)]">-</span>;
  const abs = change.delta.startsWith('-') ? change.delta.slice(1) : change.delta;
  // Drawn like the Babylon table's TokenDisplay: signed amount and a plain symbol tag.
  const symbol = change.symbol || change.rri;
  return (
    <span className={`text-xs font-mono font-semibold flex items-center gap-1.5 whitespace-nowrap ${sign > 0 ? 'text-[var(--color-accent)]' : 'text-red-500'}`}>
      <span>{sign > 0 ? '+' : '-'}{formatDecimal(abs, locale, 4)}</span>
      <span className="text-[10px] text-[var(--color-text-main)] bg-white/10 px-1.5 py-0.5 rounded-sm" title={change.rri}>
        {symbol.length > 6 ? symbol.slice(0, 6) : symbol}
      </span>
    </span>
  );
}

function typeOf(tx: OlympiaTxItem, o: OlympiaDict): string {
  const types = [...new Set(tx.actions.map((a) => a.type).filter((t) => t && t !== 'BURN_XRD'))];
  if (types.length === 0) return tx.actions.length ? actionLabel(o, 'BURN_XRD') : actionLabel(o, 'OTHER');
  return types.map((t) => actionLabel(o, t)).join(' · ');
}

function TxRows({ tx, o, locale }: { tx: OlympiaTxItem; o: OlympiaDict; locale: string }) {
  // The fee is burnt and shows as a balance change too; it is listed in its own column.
  const own = tx.balanceChanges;
  const outs = own.filter((c) => c.deltaNum < 0);
  const ins = own.filter((c) => c.deltaNum > 0);
  const rows = Math.max(1, outs.length, ins.length);
  const message = tx.message ?? (tx.messageEncrypted ? o.message_encrypted : null);
  return (
    <tbody className="border-b border-[var(--color-card-border)] hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-300 text-sm last:border-b-0">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`${tx.transactionId}-${i}`} className="group align-top">
          {i === 0 && (
            <>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap text-[var(--color-text-main)] text-xs">{formatDateTime(tx.timestamp, locale)}</td>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap"><OlympiaRef value={tx.transactionId} locale={locale} head={8} tail={6} /></td>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{typeOf(tx, o)}</span>
              </td>
            </>
          )}
          <td className="py-3 px-4"><ChangeCell change={outs[i]} locale={locale} sign={-1} /></td>
          <td className="py-3 px-4"><ChangeCell change={ins[i]} locale={locale} sign={1} /></td>
          {i === 0 && (
            <>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-muted)]">
                {tx.isFeePayer && tx.feeXrd > 0 ? `${formatDecimal(String(tx.feeXrd), locale, 4)} XRD` : '-'}
              </td>
              <td rowSpan={rows} className="py-3 px-4 text-xs text-[var(--color-text-muted)] max-w-[260px]">
                {message ? (
                  <span className="inline-flex items-start gap-1.5" title={message}>
                    {tx.messageEncrypted ? <Lock className="size-3 shrink-0 mt-0.5" /> : <MessageSquare className="size-3 shrink-0 mt-0.5" />}
                    <span className="line-clamp-2 break-words">{message}</span>
                  </span>
                ) : '-'}
              </td>
            </>
          )}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * An Olympia transaction as rows of the Babylon transactions table (date,
 * hash, type, withdraw, deposit, fee, balance, staking balance, status), so an
 * account's Olympia history can follow its Babylon one in the same table. The
 * archive does not keep running balances, so those two cells stay empty; the
 * message, if any, goes under the type.
 */
export function OlympiaTxBabylonRows({ tx, o, locale, successLabel }: { tx: OlympiaTxItem; o: OlympiaDict; locale: string; successLabel: string }) {
  const outs = tx.balanceChanges.filter((c) => c.deltaNum < 0);
  const ins = tx.balanceChanges.filter((c) => c.deltaNum > 0);
  const rows = Math.max(1, outs.length, ins.length);
  const message = tx.message ?? (tx.messageEncrypted ? o.message_encrypted : null);
  const empty = <span className="text-xs text-[var(--color-text-muted)]">-</span>;
  return (
    <tbody className="border-b border-[var(--color-card-border)] hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-300 text-sm last:border-b-0">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`${tx.transactionId}-${i}`} className="group align-top">
          {i === 0 && (
            <>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap text-[var(--color-text-main)] text-xs">{formatDateTime(tx.timestamp, locale)}</td>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap"><OlympiaRef value={tx.transactionId} locale={locale} head={8} tail={6} /></td>
              <td rowSpan={rows} className="py-3 px-4">
                <span className="flex flex-col gap-1 items-start">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{typeOf(tx, o)}</span>
                    <span title={o.badge_tooltip} className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">· {o.badge ?? 'Olympia'}</span>
                  </span>
                  {message && (
                    <span className="inline-flex items-start gap-1 text-[11px] text-[var(--color-text-muted)] max-w-[220px]" title={message}>
                      {tx.messageEncrypted ? <Lock className="size-3 shrink-0 mt-0.5" /> : <MessageSquare className="size-3 shrink-0 mt-0.5" />}
                      <span className="line-clamp-2 break-words">{message}</span>
                    </span>
                  )}
                </span>
              </td>
            </>
          )}
          <td className="py-3 px-4"><ChangeCell change={outs[i]} locale={locale} sign={-1} /></td>
          <td className="py-3 px-4"><ChangeCell change={ins[i]} locale={locale} sign={1} /></td>
          {i === 0 && (
            <>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-muted)]">
                {tx.isFeePayer && tx.feeXrd > 0 ? `${formatDecimal(String(tx.feeXrd), locale, 4)} XRD` : '-'}
              </td>
              <td rowSpan={rows} className="py-3 px-4 text-right">{empty}</td>
              <td rowSpan={rows} className="py-3 px-4 text-right">{empty}</td>
              <td rowSpan={rows} className="py-3 px-4 whitespace-nowrap"><span className="text-xs font-semibold text-[var(--color-accent)]">{successLabel}</span></td>
            </>
          )}
        </tr>
      ))}
    </tbody>
  );
}

export function OlympiaTxTable({ address, o, locale, enabled = true }: { address: string; o: OlympiaDict; locale: string; enabled?: boolean }) {
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useOlympiaTransactions(address, enabled);
  if (isLoading) return <Loading text={o.loading} />;
  if (isError) return <ErrorText text={o.error} />;
  const txs = data?.pages.flatMap((p) => p?.items ?? []) ?? [];
  if (txs.length === 0) return <Empty text={o.tx_empty} />;
  // The markup of the Babylon transactions table (AccountTransactionsTab), with Olympia's columns.
  const th = 'py-3 px-4 font-semibold whitespace-nowrap';
  return (
    <div className="w-full flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]">
              <th className={th}>{o.date}</th>
              <th className={th}>{o.tx_id}</th>
              <th className={th}>{o.actions}</th>
              <th className={th}>{o.withdrawn}</th>
              <th className={th}>{o.deposited}</th>
              <th className={`${th} text-right`}>{o.fee}</th>
              <th className={th}>{o.message}</th>
            </tr>
          </thead>
          {txs.map((tx) => <TxRows key={tx.transactionId} tx={tx} o={o} locale={locale} />)}
        </table>
      </div>
      {hasNextPage && (
        <div className="flex justify-center mt-8 mb-4">
          <m.button
            type="button"
            onClick={(e) => { e.stopPropagation(); void fetchNextPage(); }}
            disabled={isFetchingNextPage}
            className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isFetchingNextPage ? o.loading : o.load_more}
          </m.button>
        </div>
      )}
    </div>
  );
}
