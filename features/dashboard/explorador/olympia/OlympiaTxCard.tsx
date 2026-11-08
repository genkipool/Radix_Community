'use client';
/**
 * The card of an Olympia transaction (64-hex id), drawn like the Babylon
 * transaction card (TransactionCard + TransactionTabs): header with hash,
 * status and type chips, date, epoch / round, the amount it moved and the
 * accounts it touched; once open, Summary (message, asset transfers, fee,
 * affected entities), Details and the raw archive data.
 *
 * Every piece is Olympia's own: Babylon components look addresses up on the
 * Babylon Gateway, which knows nothing of rdx1… / rv1… / xrd_rr1….
 */
import React, { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  Activity, Check, ChevronDown, Clock, Coins, Copy, FileJson, Flame, Info, Landmark, List, Mail, Terminal, Users, Wallet, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CloseButton } from '@/components/ui/CloseButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { RadixIcon } from '@/components/shared/RadixIcon';
import type { MarketData, TranslationsT } from '@/features/dashboard/types';
import { Pill } from '@/components/ui/Pill';
import { OlympiaEntityBadge } from './OlympiaEntityBadge';
import { OlympiaResourceInlinePanel } from './OlympiaResourcePanel';
import type { AccountCardProps } from '../types/components.types';
import { useOlympiaTx } from '@/features/dashboard/services/olympiaApi';
import { OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';
import type { OlympiaTxDetail } from '@/types/olympia';
import { actionLabel, olympiaDict, type OlympiaDict } from './dict';
import { formatDateTime, formatDecimal, shortHash } from './format';
import { Empty, OlympiaBadge, OlympiaRef, SourceNote } from './OlympiaParts';
import { olympiaTxFlow, type OlympiaFlowRow, type OlympiaTxFlow } from './txFlow';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Tab = 'summary' | 'details' | 'raw';

/** Four decimals, cut and not rounded, as the Babylon card prints amounts. */
const amount4 = (v: number, locale: string) =>
  (Math.trunc(v * 10000) / 10000).toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const PANEL = 'bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden';
const PANEL_TITLE = 'px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2';
const CHIP = 'inline-flex items-center justify-center px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none align-middle box-border border backdrop-blur-md transition-all duration-300 h-[18px] sm:h-[22px]';

/* ── Header chips ─────────────────────────────────────────────────────────── */

function StatusChips({ tt, o, types }: { tt: Tt; o: OlympiaDict; types: string[] }) {
  return (
    <>
      <span
        className={`${CHIP} bg-white/5`}
        style={{
          color: 'var(--color-accent)',
          borderColor: 'rgba(var(--color-accent-rgb), 0.2)',
          boxShadow: '0 0 12px rgba(var(--color-accent-rgb), 0.1), inset 0 0 4px rgba(var(--color-accent-rgb), 0.05)',
          textShadow: '0 0 8px rgba(var(--color-accent-rgb), 0.3)',
        }}
      >
        <span className="mt-[1px]">{tt.success || 'Success'}</span>
      </span>
      <span className={`${CHIP} bg-[var(--color-surface)] border-[var(--color-card-border)] px-3 text-[var(--color-text-muted)]`}>
        <span className="mt-[1px]">{types.map((t) => actionLabel(o, t)).join(' · ') || actionLabel(o, 'OTHER')}</span>
      </span>
      <OlympiaBadge o={o} />
    </>
  );
}

/* ── Asset transfers ──────────────────────────────────────────────────────── */

/**
 * One token amount, in the layout of the Babylon BalanceChangeRow (without its
 * Gateway lookup). Like it, a token row opens in place the token's card (its
 * Olympia tabs); the fee row does not open.
 */
function AmountRow({ row, tt, o, locale, onCopy, copiedAddress, fee, t }: {
  row: Pick<OlympiaFlowRow, 'rri' | 'symbol' | 'name' | 'iconUrl' | 'amount'>; tt: Tt; o: OlympiaDict; locale: string;
  onCopy: (v: string) => void; copiedAddress: string | null; fee?: boolean; t?: Partial<TranslationsT>;
}) {
  const [expanded, setExpanded] = useState(false);
  const opens = !fee;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!opens || window.getSelection()?.toString()) return;
    setExpanded((v) => !v);
  };
  const color = row.amount > 0 ? 'text-[var(--color-accent)]' : 'text-red-500 dark:text-red-400';
  const symbol = row.symbol || row.rri;
  const name = row.name || symbol;
  const label = fee ? (tt.fee_label || 'Fees') : (tt.amount_label || 'Amount');
  return (
    <div className="mb-2">
    <div
      role={opens ? 'button' : undefined}
      tabIndex={opens ? 0 : undefined}
      onClick={toggle}
      onKeyDown={(e) => { if (opens && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpanded((v) => !v); } }}
      aria-expanded={opens ? expanded : undefined}
      className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-[var(--color-surface)] border border-[var(--color-card-border)] group transition-all hover:bg-[var(--color-surface-hover)] gap-3 ${opens ? 'cursor-pointer' : 'cursor-auto'} ${opens && expanded ? 'rounded-t-xl border-b-transparent' : 'rounded-xl'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {row.iconUrl
          ? <SafeImage src={row.iconUrl} alt={symbol} fallbackName={symbol} className="size-10 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0" />
          : <div className="size-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shadow-inner border border-[var(--color-primary)]/30 shrink-0">{symbol.slice(0, 2).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
            <div className="font-bold text-sm sm:text-base text-[var(--color-text-main)] truncate min-w-0">{name}</div>
            {row.symbol && <TokenBadge className="shrink-0">{row.symbol}</TokenBadge>}
            {opens && <ChevronDown className={`size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[150px] sm:max-w-[200px]" title={row.rri}>{shortHash(row.rri, 12, 6)}</div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCopy(row.rri); }}
              className={`p-1 rounded-md transition-colors ${copiedAddress === row.rri ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/5'}`}
              title={o.copy || 'Copy'}
            >
              {copiedAddress === row.rri ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
        </div>
      </div>
      <div className={`font-mono font-bold lg:text-lg ${color} shrink-0 text-right flex flex-col justify-end`}>
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-black mb-0.5 opacity-70">
          {label.length > 10 ? `${label.slice(0, 8).trim()}...` : label}
        </div>
        <div className="flex items-baseline gap-1.5 justify-end">
          <span>{row.amount > 0 ? '+' : ''}{amount4(row.amount, locale)}</span>
          {row.symbol && <span className="text-xs font-semibold opacity-70">{row.symbol}</span>}
        </div>
      </div>
    </div>
    <AnimatePresence>
      {opens && expanded && (
        <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
          <OlympiaResourceInlinePanel rri={row.rri} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />
        </m.div>
      )}
    </AnimatePresence>
    </div>
  );
}

/** An address over its rows; a validator shows its name and what the stake did. */
function Party({ address, label, kind, o, locale, children }: {
  address: string; label?: string | null; kind?: OlympiaFlowRow['kind']; o: OlympiaDict; locale: string; children: React.ReactNode;
}) {
  const note = kind === 'stake' ? o.tx_staked : kind === 'unstake' ? o.tx_unstaking : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 pl-2 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          {label && <span className="text-xs font-bold text-[var(--color-text-main)] truncate">{label}</span>}
          <OlympiaRef value={address} locale={locale} head={12} tail={6} />
        </span>
        {note && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30 text-[var(--color-primary)] bg-[var(--color-primary)]/10 shrink-0">{note}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Rows of one address grouped, in first-seen order. */
function byAddress(rows: OlympiaFlowRow[]): OlympiaFlowRow[][] {
  const groups = new Map<string, OlympiaFlowRow[]>();
  for (const r of rows) groups.set(`${r.address}|${r.kind}`, [...(groups.get(`${r.address}|${r.kind}`) ?? []), r]);
  return [...groups.values()];
}

function AssetTransfers({ flow, tt, t, o, locale, onCopy, copiedAddress }: {
  flow: OlympiaTxFlow; tt: Tt; t?: Partial<TranslationsT>; o: OlympiaDict; locale: string; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const [info, setInfo] = useState(false);
  if (flow.origin.length === 0 && flow.destination.length === 0 && !flow.feeOnlyPayer) return null;
  const feeRow = { rri: OLYMPIA_XRD_RRI, symbol: 'XRD', name: 'Radix', iconUrl: null, amount: -flow.fee };
  const nestedFee = (address: string) => flow.fee > 0 && address === flow.feePayer && (
    <div className="pl-4 border-l-2 border-[var(--color-card-border)] opacity-80 scale-95 origin-left">
      <AmountRow o={o} row={feeRow} tt={tt} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} fee />
    </div>
  );
  // The fee goes under the payer's first transfer group only.
  const feeGroup = byAddress(flow.origin).findIndex((rows) => rows[0].kind === 'transfer' && rows[0].address === flow.feePayer);
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
      <h3 className={`${PANEL_TITLE} justify-between`}>
        <span className="flex items-center gap-2"><Wallet className="size-3.5 text-[var(--color-primary)]" />{tt.asset_transfer || ''}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
          className="p-1 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          title={o.tx_flow_note}
          aria-expanded={info}
        >
          <Info className="size-3.5" />
        </button>
      </h3>
      {info && <p className="px-4 py-2.5 text-xs text-[var(--color-text-main)] border-b border-[var(--color-card-border)] bg-[var(--color-primary)]/5">{o.tx_flow_note}</p>}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[var(--color-card-border)]">
        <div className="flex-1 p-3 bg-blue-500/5">
          <h5 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-3 flex items-center gap-1.5 opacity-80">
            <Landmark className="size-3" />{tt.from_address || ''}
          </h5>
          <div className="space-y-3">
            {byAddress(flow.origin).map((rows, i) => {
              const showFee = i === feeGroup;
              return (
                <Party key={`o-${rows[0].address}-${rows[0].kind}`} address={rows[0].address} label={rows[0].label} kind={rows[0].kind} o={o} locale={locale}>
                  {rows.map((r) => <AmountRow o={o} key={r.rri} row={r} tt={tt} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />)}
                  {showFee && nestedFee(rows[0].address)}
                </Party>
              );
            })}
            {flow.feeOnlyPayer && (
              <Party address={flow.feeOnlyPayer} o={o} locale={locale}>
                <AmountRow o={o} row={feeRow} tt={tt} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} fee />
              </Party>
            )}
            {flow.origin.length === 0 && !flow.feeOnlyPayer && <p className="text-xs text-[var(--color-text-muted)] italic py-2">{o.tx_minted}</p>}
          </div>
        </div>
        <div className="flex-1 p-3 bg-[var(--color-accent)]/5">
          <h5 className="text-[10px] uppercase font-black tracking-widest text-[var(--color-accent)] mb-3 flex items-center gap-1.5 opacity-80">
            <Landmark className="size-3" />{tt.to_address || ''}
          </h5>
          <div className="space-y-3">
            {byAddress(flow.destination).map((rows) => (
              <Party key={`d-${rows[0].address}-${rows[0].kind}`} address={rows[0].address} label={rows[0].label} kind={rows[0].kind} o={o} locale={locale}>
                {rows.map((r) => <AmountRow o={o} key={r.rri} row={r} tt={tt} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />)}
                {rows[0].kind === 'unstake' && <p className="pl-2 text-[11px] text-[var(--color-text-muted)]">{o.tx_unstake_note}</p>}
              </Party>
            ))}
            {flow.destination.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic py-2">{flow.origin.length > 0 ? o.tx_burnt : '-'}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Fee and entities ─────────────────────────────────────────────────────── */

function FeePanel({ flow, o, locale }: { flow: OlympiaTxFlow; o: OlympiaDict; locale: string }) {
  if (flow.fee <= 0) return null;
  return (
    <div className={PANEL}>
      <h3 className={PANEL_TITLE}><Coins className="size-3.5 text-[var(--color-primary)]" />{o.tx_fee_title}</h3>
      <div className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] shrink-0">{o.fee_payer}</span>
            {flow.feePayer ? <OlympiaRef value={flow.feePayer} locale={locale} head={12} tail={6} /> : '-'}
          </span>
          <span className="font-mono font-bold text-[var(--color-text-main)]">{amount4(flow.fee, locale)} XRD</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400"><Flame className="size-3.5" />{o.tx_fee_burnt}</span>
          <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">{amount4(flow.fee, locale)} XRD · 100%</span>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">{o.tx_fee_burnt_note}</p>
      </div>
    </div>
  );
}

/** "Affected entities" and "Created entities", in the frame and with the badges of Babylon's EntitiesSection. */
function EntitiesPanel({ variant, items, tt, t, locale, onCopy, copiedAddress, marketData }: {
  variant: 'affected' | 'created';
  items: { address: string; label?: string | null }[];
  tt: Tt; t?: Partial<TranslationsT>; locale: string; onCopy: (v: string) => void; copiedAddress: string | null; marketData?: MarketData | null;
}) {
  const created = variant === 'created';
  return (
    <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mt-4">
      <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center justify-between">
        <span className="flex items-center gap-2">
          {created ? <Zap className="size-3.5 text-blue-600 dark:text-blue-400" /> : <Activity className="size-3.5 text-violet-400" />}
          {created ? tt.created_entities : tt.affected_entities}
        </span>
        <Pill color="custom" className={created ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'}>
          {items.length}
        </Pill>
      </h3>
      <div className="p-3">
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            {items.map((e) => (
              <OlympiaEntityBadge key={`${variant}-${e.address}`} address={e.address} name={e.label} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} marketData={marketData} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] italic py-2 text-center">
            {created ? tt.no_created_entities : tt.no_affected_entities}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

function SummaryTab({ tx, flow, tt, t, o, locale, onCopy, copiedAddress, marketData }: {
  tx: OlympiaTxDetail; flow: OlympiaTxFlow; tt: Tt; t?: Partial<TranslationsT>; o: OlympiaDict; locale: string; onCopy: (v: string) => void; copiedAddress: string | null; marketData?: MarketData | null;
}) {
  const message = tx.message ?? (tx.messageEncrypted ? o.message_encrypted : null);
  return (
    <div className="space-y-6">
      {message && (
        <div className={PANEL}>
          <h3 className={PANEL_TITLE}><Terminal className="size-3.5 text-[var(--color-primary)]" />{tt.message_payload || ''}</h3>
          <div className="p-4 sm:p-5 text-xs sm:text-sm font-mono break-words text-[var(--color-text-main)] leading-relaxed">
            {tx.messageEncrypted ? message : <>&quot;{message}&quot;</>}
          </div>
        </div>
      )}
      <AssetTransfers flow={flow} tt={tt} t={t} o={o} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />
      <FeePanel flow={flow} o={o} locale={locale} />
      <EntitiesPanel variant="affected" items={flow.entities} tt={tt} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} marketData={marketData} />
      <EntitiesPanel variant="created" items={flow.created} tt={tt} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} marketData={marketData} />
      <SourceNote o={o} />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 border-b border-[var(--color-card-border)] pb-2 last:border-b-0">
      <span className="text-[var(--color-text-muted)] w-full sm:w-1/3 font-semibold">{label}:</span>
      <span className="text-[var(--color-text-main)] w-full sm:w-2/3 min-w-0 break-all">{children}</span>
    </div>
  );
}

function ActionsTable({ tx, o, locale }: { tx: OlympiaTxDetail; o: OlympiaDict; locale: string }) {
  if (tx.actions.length === 0) return <Empty text="-" />;
  const th = 'py-2 px-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap';
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-surface)] border-b border-[var(--color-card-border)]">
          <tr><th className={th}>#</th><th className={th}>{o.actions}</th><th className={th}>{o.from}</th><th className={th}>{o.to}</th><th className={`${th} text-right`}>{o.amount}</th></tr>
        </thead>
        <tbody>
          {tx.actions.map((a) => (
            <tr key={a.index} className="border-b border-[var(--color-card-border)]/50 last:border-b-0">
              <td className="py-2 px-3 text-[var(--color-text-muted)]">{a.index}</td>
              <td className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">{actionLabel(o, a.type)}</td>
              <td className="py-2 px-3">{a.from ? <OlympiaRef value={a.from} locale={locale} /> : '-'}</td>
              <td className="py-2 px-3">
                {a.to ? <OlympiaRef value={a.to} locale={locale} /> : a.validator ? (
                  <span className="flex flex-col">{a.validatorName && <span className="font-semibold">{a.validatorName}</span>}<OlympiaRef value={a.validator} locale={locale} /></span>
                ) : '-'}
              </td>
              <td className="py-2 px-3 text-right whitespace-nowrap">
                {a.amount ? (
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold">
                    {formatDecimal(a.amount, locale, 6)}
                    {a.symbol && <span className="text-[10px] text-[var(--color-text-main)] bg-white/10 px-1.5 py-0.5 rounded-sm" title={a.rri ?? undefined}>{a.symbol.slice(0, 6)}</span>}
                  </span>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangesList({ tx, locale }: { tx: OlympiaTxDetail; locale: string }) {
  if (tx.allBalanceChanges.length === 0) return <Empty text="-" />;
  return (
    <ul className="divide-y divide-[var(--color-card-border)]/50">
      {tx.allBalanceChanges.map((c, i) => (
        <li key={`${c.address}-${c.rri}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
          {c.address ? <OlympiaRef value={c.address} locale={locale} head={12} tail={6} /> : <span>-</span>}
          <span className={`inline-flex items-center gap-1.5 font-mono font-semibold whitespace-nowrap ${c.deltaNum < 0 ? 'text-red-500' : 'text-[var(--color-accent)]'}`}>
            {c.deltaNum > 0 ? '+' : ''}{formatDecimal(c.delta, locale, 6)}
            <span className="text-[10px] text-[var(--color-text-main)] bg-white/10 px-1.5 py-0.5 rounded-sm" title={c.rri}>{(c.symbol || c.rri).slice(0, 6)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DetailsTab({ tx, tt, o, locale }: { tx: OlympiaTxDetail; tt: Tt; o: OlympiaDict; locale: string }) {
  return (
    <div className="space-y-6 text-xs">
      <div className={PANEL}>
        <h3 className={PANEL_TITLE}><List className="size-3.5 text-[var(--color-primary)]" />{o.tx_info}</h3>
        <div className="p-4 space-y-2">
          <DetailRow label={o.tx_id}><span className="font-mono">{tx.transactionId}</span></DetailRow>
          {/* The archive keeps committed transactions only: every one it has succeeded. */}
          <DetailRow label={tt.status ?? ''}>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">{tt.success ?? ''}</span>
          </DetailRow>
          <DetailRow label={tt.date_time || o.date}>{formatDateTime(tx.timestamp, locale)}</DetailRow>
          <DetailRow label={o.state_version}>{tx.stateVersion.toLocaleString(locale)}</DetailRow>
          <DetailRow label={o.epoch_round}>Ep: {tx.epoch} / Rnd: {tx.round}</DetailRow>
          <DetailRow label={o.fee}><span className="font-mono">{formatDecimal(String(tx.feeXrd), locale, 9)} XRD</span></DetailRow>
          <DetailRow label={o.fee_payer}>{tx.feePayer ? <OlympiaRef value={tx.feePayer} locale={locale} full /> : '-'}</DetailRow>
          <DetailRow label={o.accounts_count}>{tx.accountsCount.toLocaleString(locale)}</DetailRow>
          <DetailRow label={o.actions}>{tx.actions.length.toLocaleString(locale)}</DetailRow>
          {(tx.message || tx.messageEncrypted) && (
            <DetailRow label={tt.message_payload ?? ''}>{tx.messageEncrypted ? o.message_encrypted : `"${tx.message}"`}</DetailRow>
          )}
        </div>
      </div>
      <div className={PANEL}>
        <h3 className={PANEL_TITLE}><Activity className="size-3.5 text-[var(--color-primary)]" />{o.actions} ({tx.actions.length})</h3>
        <ActionsTable tx={tx} o={o} locale={locale} />
      </div>
      <div className={PANEL}>
        <h3 className={PANEL_TITLE}><Wallet className="size-3.5 text-[var(--color-primary)]" />{o.changes_tab} ({tx.allBalanceChanges.length})</h3>
        <ChangesList tx={tx} locale={locale} />
      </div>
    </div>
  );
}

function RawBlock({ title, text, tt, onCopy, copiedAddress, pre }: {
  title: string; text: string; tt: Tt; onCopy: (v: string) => void; copiedAddress: string | null; pre: boolean;
}) {
  const copied = copiedAddress === text;
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5"><FileJson className="size-3.5 text-[var(--color-primary)]" />{title}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopy(text); }}
          className={`p-1.5 rounded-md transition-colors ${copied ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
          title={tt.copy_raw || ''}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </h3>
      <div className={`p-4 bg-[#0d1117] rounded-xl border border-[var(--color-card-border)] text-xs font-mono text-green-400/90 shadow-inner overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar ${pre ? 'whitespace-pre' : 'break-all'}`}>
        {text}
      </div>
    </div>
  );
}

function RawTab({ tx, tt, o, onCopy, copiedAddress }: { tx: OlympiaTxDetail; tt: Tt; o: OlympiaDict; onCopy: (v: string) => void; copiedAddress: string | null }) {
  const { rawHex, ...rest } = tx;
  return (
    <div className="space-y-5">
      <RawBlock title={o.tx_raw_title} text={JSON.stringify(rest, null, 2)} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} pre />
      {rawHex && <RawBlock title={o.tx_raw_hex} text={rawHex} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} pre={false} />}
    </div>
  );
}

function TabBar({ tab, setTab, tt, id }: { tab: Tab; setTab: (t: Tab) => void; tt: Tt; id: string }) {
  const icon = (t: Tab, Icon: typeof Activity) => <Icon className={`size-3.5 ${tab === t ? 'text-[var(--color-primary)]' : 'group-hover:text-[var(--color-text-main)]'}`} />;
  const labels: Record<Tab, React.ReactNode> = {
    summary: <>{icon('summary', Activity)}{tt.summary || 'Summary'}</>,
    details: <>{icon('details', List)}{tt.details || 'Details'}</>,
    raw: <>{icon('raw', FileJson)}{tt.raw_receipt || ''}</>,
  };
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-card-border)] px-6 overflow-x-auto hide-scrollbar shrink-0">
      {(['summary', 'details', 'raw'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={(e) => { e.stopPropagation(); setTab(t); }}
          className={`py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 relative group ${tab === t ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
        >
          {labels[t]}
          {tab === t && (
            <m.div layoutId={`olympiaTxTab-${id}`} className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-full z-10" transition={{ type: 'tween', ease: 'circOut', duration: 0.3 }} />
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

export function OlympiaTxCard({ address, columns, isExpanded, onExpand, onCopy, copiedAddress, t, locale, isModal, marketData }: AccountCardProps) {
  const tt: Tt = t?.dashboard?.transactions ?? {};
  const o = olympiaDict(tt);
  const [tab, setTab] = useState<Tab>('summary');
  const { data: tx, isLoading, isError, refetch } = useOlympiaTx(address);
  // While it loads it holds its place, as Babylon's list does; a read that
  // failed says so, so the transaction does not silently drop out of a list.
  if (isLoading) return <div className="col-span-full h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse" />;
  if (isError) {
    return (
      <Card className="col-span-full p-4 bg-[var(--color-surface)] border border-[var(--color-card-border)]">
        <p className="text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-2">
          <span className="font-mono">{shortHash(address, 12, 8)}</span>
          <span className="text-[var(--color-danger)]">{o.error}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); void refetch(); }} className="font-bold text-[var(--color-primary)] hover:underline">{t?.dashboard?.error?.retry}</button>
        </p>
      </Card>
    );
  }
  if (!tx) return null;

  const flow = olympiaTxFlow(tx);
  const id = tx.transactionId;
  const toggle = () => onExpand?.(address);
  const clickable = !isModal && !!onExpand;
  const headlineLabel = flow.headline.kind === 'stake' ? (tt.tx_type_stake || 'Stake')
    : flow.headline.kind === 'unstake' ? (tt.tx_type_unstake || 'Unstake')
      : flow.headline.kind === 'amount' ? (tt.amount || 'Amount') : (tt.fee_paid || '');
  const hash = columns >= 2 ? `${id.slice(0, 10)}...${id.slice(-10)}` : id;
  const message = tx.message ?? (tx.messageEncrypted ? o.message_encrypted : null);
  const stat = 'text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1';

  return (
    <Card
      onClick={clickable ? (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, [role="button"], input, textarea')) return;
        if (window.getSelection()?.toString()) return;
        toggle();
      } : undefined}
      className={`p-0 shadow-md transition-all duration-300 group overflow-hidden col-span-full ${clickable ? 'cursor-pointer' : 'cursor-default'} ${isModal ? 'bg-[var(--color-bg)] h-full flex flex-col' : ''} ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
      innerClassName={isModal ? 'flex flex-col h-full min-h-0 flex-1' : ''}
    >
      <div className="flex flex-col sm:flex-row shrink-0">
        <div aria-hidden="true" className="w-full sm:w-[140px] p-4 sm:p-6 border-r shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row sm:flex-col items-center gap-3 text-center relative overflow-hidden self-stretch justify-center">
          <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: 'radial-gradient(circle at top, rgba(var(--color-accent-rgb), 0.2), transparent)' }} />
          <div className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center" style={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 15px rgba(var(--color-accent-rgb), 0.2)' }}>
            <RadixIcon className="size-8" strokeColor="var(--color-accent)" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-5 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3 sm:flex-nowrap">
              <div className="text-sm sm:text-base font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1" title={id}>
                <span className="truncate">{hash}</span>
                <CopyButton
                  value={id}
                  variant="card-inline"
                  size="sm"
                  forceCopied={copiedAddress === id}
                  onClick={(e) => { e.stopPropagation(); onCopy(id); }}
                  className="shrink-0 ml-1"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {columns === 1 && <StatusChips tt={tt} o={o} types={flow.types} />}
                {isModal && onExpand && <CloseButton onClose={toggle} title={t?.dashboard?.reading?.close || 'Close'} iconSize={20} className="shrink-0 ml-1" />}
              </div>
            </div>

            <div className={`grid ${columns >= 2 && columns <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2 sm:gap-4 text-sm mt-3 items-center`}>
              <div>
                <div className={stat}><Clock className="size-3" /> {tt.date_time || ''}</div>
                <div className="text-sm font-bold text-[var(--color-text-main)] truncate">{formatDateTime(tx.timestamp, locale)}</div>
              </div>
              <div>
                <div className={stat}><Clock className="size-3" /> {tt.epoch_round || 'Epoch/Round'}</div>
                <div className="text-sm font-bold text-[var(--color-text-main)] truncate">Ep: {tx.epoch} / Rnd: {tx.round}</div>
              </div>
              <div>
                <div className={stat}><Coins className="size-3" /> {headlineLabel}</div>
                <div className="text-base sm:text-lg font-bold text-[var(--color-text-main)] truncate">
                  {amount4(flow.headline.amount, locale)} <span className="uppercase">{flow.headline.symbol}</span>
                </div>
              </div>
              <div className="flex flex-wrap sm:flex-col gap-x-4 gap-y-1 sm:gap-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-1">
                  <Users className="size-3" /> {tx.accountsCount} {tt.accounts || 'Accounts'}
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-1">
                  <Activity className="size-3" /> {tx.actions.length} {o.actions}
                </div>
              </div>
            </div>

            {columns >= 2 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[var(--color-card-border)]/50">
                <StatusChips tt={tt} o={o} types={flow.types} />
              </div>
            )}
          </div>
        </div>
      </div>

      {message && !isExpanded && (
        <div className="p-3 bg-[var(--color-bg)]/80 text-[11px] sm:text-xs font-mono text-[var(--color-text-muted)] border-t border-[var(--color-card-border)] flex items-start gap-2 shadow-inner">
          <Mail className="shrink-0 mt-0.5 text-[var(--color-primary)] size-3.5" />
          <span className="truncate translate-y-[2px]">{message}</span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <m.div
            initial={isModal ? false : { opacity: 0, height: 0 }}
            animate={isModal ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`overflow-hidden bg-[var(--color-bg)] ${isModal ? 'flex-1 flex flex-col min-h-0' : ''}`}
          >
            <div
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              className={`flex flex-col mt-4 pt-4 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50 rounded-xl overflow-hidden cursor-auto ${isModal ? 'flex-1 min-h-0' : ''}`}
            >
              <TabBar tab={tab} setTab={setTab} tt={tt} id={id} />
              <div className={`p-4 sm:p-5 text-sm ${isModal ? 'flex-1 overflow-y-auto min-h-0 custom-scrollbar' : ''}`}>
                {tab === 'summary' && <SummaryTab tx={tx} flow={flow} tt={tt} t={t} o={o} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} marketData={marketData} />}
                {tab === 'details' && <DetailsTab tx={tx} tt={tt} o={o} locale={locale} />}
                {tab === 'raw' && <RawTab tx={tx} tt={tt} o={o} onCopy={onCopy} copiedAddress={copiedAddress} />}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
