'use client';

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { formatPercent, formatXRD } from '@/utils/formatters';
import { useDestinationHints, useFundsFlow } from '../hooks/useFundsFlow';
import { buildFundsFlowExport, type Counterparty, type DestinationHint, type FundsFlow } from '../utils/fundsFlow';
import { mergeFunds } from '../utils/olympiaFlow';
import { useOlympiaFunds, useOlympiaLink } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from '../olympia/dict';
import { NetworkScopePills, OlympiaBadge, type NetworkScope } from '../olympia/OlympiaParts';
import { OlympiaCsvButton } from '../olympia/OlympiaCsvButton';
import { AddressChip, CopyButton } from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

/** Counterparties listed on each side at first, and how many more each press of "Show more" adds. */
const ROWS = 8;
/** A share of what an address receives that is worth saying it passes on. */
const NOTABLE_SHARE = 0.5;

const fill = (template: string | undefined, values: Record<string, string | number>) =>
    (template ?? '').replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** What part of the column's total a counterparty is; a sliver is said as such rather than as 0.0 %. */
function percentOf(amount: number, total: number, locale: string) {
    if (total <= 0) return '';
    const percent = (amount / total) * 100;
    return percent < 0.1 ? `<${formatPercent(0.1, 1, locale)}` : formatPercent(percent, 1, locale);
}

function Row({ row, side, max, total, hint, network, locale, text, copiedAddress, onCopy }: {
    row: Counterparty; side: 'in' | 'out'; max: number; total: number; hint?: DestinationHint; network: Network; locale: string;
    text: NonNullable<NonNullable<Tt['account_summary']>['funds']> | undefined; copiedAddress: string | null; onCopy: (v: string) => void;
}) {
    const meta = useEntityData(row.address, network);
    const amount = side === 'in' ? row.received : row.sent;
    const tone = side === 'in' ? 'var(--color-accent)' : 'var(--color-danger)';
    const passesOn = hint?.hub && hint.share >= NOTABLE_SHARE;
    return (
        <li className="py-2.5 border-b border-[var(--color-card-border)]/50 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                    {meta?.iconUrl && <SafeImage src={meta.iconUrl} alt={meta.name ?? row.address} fallbackName={meta.name ?? row.address} className="size-5 rounded-full shrink-0 object-cover" />}
                    <span className="flex flex-col min-w-0">
                        {meta?.name && <span className="text-xs font-semibold text-[var(--color-text-main)] truncate">{meta.name}</span>}
                        <span className="flex items-center gap-0.5 min-w-0">
                            <AddressChip address={row.address} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={text?.copy ?? 'Copy'} />
                            <OlympiaCsvButton address={row.address} />
                        </span>
                    </span>
                </span>
                <span className="text-right shrink-0">
                    <span className="block text-sm font-mono font-black" style={{ color: tone }}>{formatXRD(amount, locale)} XRD</span>
                    <span className="block text-[10px] text-[var(--color-text-muted)]">
                        <span className="font-bold" title={text?.share_title}>{percentOf(amount, total, locale)}</span>
                        {' · '}{fill(text?.txs, { n: row.txs })}
                    </span>
                </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-[var(--color-card-border)]/40 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (amount / max) * 100)}%`, background: tone, opacity: 0.7 }} />
            </div>
            {side === 'out' && hint && (hint.kind === 'collector' || passesOn) && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                    <Info className="size-3 shrink-0 mt-0.5" />
                    <span>
                        {passesOn && <>{fill(text?.passes_on, { share: formatPercent(hint.share * 100, 0, locale) })}{' '}<span className="inline-flex items-center gap-0.5 align-middle"><span className="font-mono" title={hint.hub ?? undefined}>{hint.hub!.slice(0, 12)}…{hint.hub!.slice(-6)}</span><CopyButton value={hint.hub!} copiedAddress={copiedAddress} onCopy={onCopy} title={text?.copy ?? 'Copy'} /></span>. </>}
                        {hint.kind === 'collector' && <span className="font-semibold text-[var(--color-text-main)]">{fill(text?.collector, { n: hint.hubSenders })}</span>}
                    </span>
                </p>
            )}
        </li>
    );
}

function Side({ title, icon, total, totalLabel, rows, side, hints, network, locale, text, copiedAddress, onCopy }: {
    title: string; icon: React.ReactNode; total: number; totalLabel?: string; rows: Counterparty[]; side: 'in' | 'out'; hints?: Record<string, DestinationHint>; network: Network; locale: string;
    text: NonNullable<NonNullable<Tt['account_summary']>['funds']> | undefined; copiedAddress: string | null; onCopy: (v: string) => void;
}) {
    const [visible, setVisible] = useState(ROWS);
    const amountOf = (c: Counterparty) => (side === 'in' ? c.received : c.sent);
    const listed = rows.filter(c => amountOf(c) > 0).toSorted((a, b) => amountOf(b) - amountOf(a));
    const shown = listed.slice(0, visible);
    const max = amountOf(shown[0] ?? ({ received: 1, sent: 1 } as Counterparty)) || 1;
    return (
        <section className="min-w-0">
            {/* The column's total, over its title. */}
            <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{totalLabel}</div>
                <div className={`text-base font-mono font-black ${total > 0 ? (side === 'in' ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]') : 'text-[var(--color-text-muted)]'}`}>{formatXRD(total, locale)} XRD</div>
            </div>
            <h4 className="flex items-center gap-1.5 text-[11px] uppercase font-black tracking-widest text-[var(--color-text-muted)] mb-1">{icon}{title}</h4>
            {shown.length === 0
                ? <p className="text-xs text-[var(--color-text-muted)] py-3">{text?.empty}</p>
                : (
                    <ul>
                        {shown.map(row => (
                            <Row key={row.address} row={row} side={side} max={max} total={total} hint={hints?.[row.address]} network={network} locale={locale} text={text} copiedAddress={copiedAddress} onCopy={onCopy} />
                        ))}
                    </ul>
                )}
            {listed.length > ROWS && (
                <div className="mt-1 flex items-center gap-3 text-[11px] font-semibold">
                    {listed.length > visible && (
                        <button type="button" onClick={() => setVisible(v => v + ROWS)} className="text-[var(--color-primary)] hover:underline">
                            {fill(text?.show_more, { n: Math.min(ROWS, listed.length - visible) })}
                        </button>
                    )}
                    {visible > ROWS && (
                        <button type="button" onClick={() => setVisible(ROWS)} className="text-[var(--color-text-muted)] hover:underline">
                            {text?.show_less}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

type FundsText = NonNullable<NonNullable<Tt['account_summary']>['funds']>;
/** A flow and whether the account has older activity the flow did not read. */
type AccountFunds = FundsFlow & { more: boolean };

/**
 * The funds flow drawn: window, JSON export, the two columns of counterparties
 * and the notes. Knows nothing of where the flow was read, so a Babylon flow,
 * an Olympia one or both merged look the same.
 */
export function FundsFlowView({ flow, hints, hintsLoading = false, exportFor, network, locale, text, copiedAddress, onCopy, extraNote }: {
    flow: AccountFunds; hints?: Record<string, DestinationHint>; hintsLoading?: boolean;
    /** Address and network the JSON export is labelled with. */
    exportFor: string; network: Network; locale: string; text: FundsText | undefined;
    copiedAddress: string | null; onCopy: (v: string) => void; extraNote?: React.ReactNode;
}) {
    const [copied, setCopied] = useState(false);
    const exported = () => JSON.stringify(buildFundsFlowExport(exportFor, network, flow, hints, new Date()), null, 2);
    const copyJson = async () => {
        try {
            await navigator.clipboard.writeText(exported());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };
    const downloadJson = () => {
        const url = URL.createObjectURL(new Blob([exported()], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `funds-flow-${exportFor.slice(-8)}-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <p className="text-xs text-[var(--color-text-muted)]">
                    {fill(text?.window, { n: flow.txs, from: date(flow.from), to: date(flow.to) })}
                    {flow.more && <> {text?.window_more}</>}
                </p>
                <div className="flex items-center gap-3 shrink-0 text-[11px] font-semibold">
                    <button type="button" onClick={copyJson} className="text-[var(--color-primary)] hover:underline">
                        {copied ? text?.copied : text?.copy_json}
                    </button>
                    <button type="button" onClick={downloadJson} className="text-[var(--color-primary)] hover:underline">
                        {text?.download_json}
                    </button>
                </div>
            </div>
            {extraNote}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                <Side title={text?.received_title ?? 'Received from'} icon={<ArrowDownLeft className="size-3.5 text-[var(--color-accent)]" />} total={flow.received} totalLabel={text?.total_received} rows={flow.counterparties} side="in" network={network} locale={locale} text={text} copiedAddress={copiedAddress} onCopy={onCopy} />
                <Side title={text?.sent_title ?? 'Sent to'} icon={<ArrowUpRight className="size-3.5 text-[var(--color-danger)]" />} total={flow.sent} totalLabel={text?.total_sent} rows={flow.counterparties} side="out" hints={hints} network={network} locale={locale} text={text} copiedAddress={copiedAddress} onCopy={onCopy} />
            </div>
            {hintsLoading && <p className="text-[11px] text-[var(--color-text-muted)]">{text?.hints_loading}</p>}
            <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <Info className="size-3.5 shrink-0 mt-px" />
                <span>{text?.note}</span>
            </p>
        </div>
    );
}

export function FundsFlowLoading({ text }: { text: FundsText | undefined }) {
    return (
        <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {text?.loading ?? 'Reading the latest transactions…'}
        </p>
    );
}

/**
 * Where an account's XRD comes from and where it goes: its biggest
 * counterparties over the latest 300 transactions. For the biggest places it sent
 * XRD to, a second read says whether they pass it on to one wallet many others
 * also feed — the way a deposit address behaves, shown as a pattern and not as a fact.
 *
 * An account that existed on Olympia (same key) also counts its Olympia
 * transfers: both histories are merged into one flow.
 */
export function AccountFundsFlowTab({ address, network, locale, copiedAddress, onCopy, tt }: {
    address: string; network: Network; locale: string; copiedAddress: string | null; onCopy: (v: string) => void; tt?: Tt;
}) {
    const text = tt?.account_summary?.funds;
    const o = olympiaDict(tt);
    const [scope, setScope] = useState<NetworkScope>('all');
    const { data: flow, isLoading, isError } = useFundsFlow(address, network);
    const { data: hints, isLoading: hintsLoading } = useDestinationHints(address, network, !!flow && flow.sent > 0);
    const { data: link } = useOlympiaLink(address, network);
    const { data: olympia, isLoading: olympiaLoading } = useOlympiaFunds(link ? address : null);

    const pills = link ? <NetworkScopePills o={o} value={scope} onChange={setScope} /> : null;
    const wrap = (body: React.ReactNode) => <div className="space-y-4">{pills}{body}</div>;

    const showOlympia = !!link && scope !== 'babylon';
    const showBabylon = !link || scope !== 'olympia';
    if ((showBabylon && isLoading) || (showOlympia && olympiaLoading)) return wrap(<FundsFlowLoading text={text} />);

    if (scope === 'olympia' && link) {
        if (!olympia) return wrap(<p className="text-xs font-semibold text-[var(--color-danger)]">{o.error ?? text?.error ?? ''}</p>);
        return wrap(
            <FundsFlowView
                flow={olympia}
                exportFor={olympia.olympiaAddress}
                network={network}
                locale={locale}
                text={text}
                copiedAddress={copiedAddress}
                onCopy={onCopy}
                extraNote={(
                    <p className="flex items-start gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <OlympiaBadge o={o} />
                        <span>{fill(o.funds_desc, { address: `${olympia.olympiaAddress.slice(0, 14)}…`, n: 5000 })}</span>
                    </p>
                )}
            />
        );
    }

    if (isError || !flow) return wrap(<p className="text-xs font-semibold text-[var(--color-danger)]">{text?.error ?? 'Could not read the transactions.'}</p>);

    const merged = scope === 'all' && olympia && olympia.txs > 0 ? { ...mergeFunds(flow, olympia), more: flow.more || olympia.more } : flow;
    return wrap(
        <FundsFlowView
            flow={merged}
            hints={hints}
            hintsLoading={hintsLoading}
            exportFor={address}
            network={network}
            locale={locale}
            text={text}
            copiedAddress={copiedAddress}
            onCopy={onCopy}
            extraNote={merged !== flow && (
                <p className="flex items-start gap-2 text-[11px] text-[var(--color-text-muted)]">
                    <OlympiaBadge o={o} />
                    <span>{o.funds_merged_note}</span>
                </p>
            )}
        />
    );
}
