'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'motion/react';
import { Activity, Gift, Vote, TrendingUp, ArrowRight, Check, ChevronDown, Copy, Settings2, Landmark, User, Hash, Clock, Database } from 'lucide-react';
import { useEntityData, extractEntityMeta } from '@/features/dashboard/hooks/useEntityData';
import { Pill } from '@/components/ui/Pill';
import { EntityBadge } from './EntityBadge';
import type { OracleUpdate, OracleCall, AirdropData } from '@/features/dashboard/explorador/types';
import type { Network, TranslationsT, GatewayEvent, GatewayField, GatewayEntityDetails } from '@/features/dashboard/types';
import { sanitizeText } from '@/utils/sanitize';
import { getWellKnownKey, getGenericTooltipKey } from '@/features/dashboard/explorador/constants/wellKnownAddresses';
import { resolveProposerInfo, findProposerValidator } from '@/features/dashboard/explorador/utils/proposerUtils';
import { SafeImage } from '@/components/ui/SafeImage';
import { priceChange, priceRewrites, type PriceRewrite } from '@/features/dashboard/explorador/utils/oraclePrices';
import { useEntityDetailsBatch } from '@/features/dashboard/explorador/hooks/useEntityDetailsBatch';
import { ResourceInlinePanel } from './ResourceInlinePanel';

const findEventAmount = (events: GatewayEvent[], resourceAddress: string): string | null => {
    if (!resourceAddress) return null;
    const cleanResource = sanitizeText(resourceAddress);

    // Look for Mint or Deposit events for this resource
    const match = events.find(e => {
        const emitter = sanitizeText(e.emitter?.entity?.entity_address || '');
        if (emitter === cleanResource && (e.name === 'MintFungibleResourceEvent' || e.name === 'MintNonFungibleResourceEvent')) {
            return true;
        }

        // Also check data fields for Deposit/Withdraw if emitter is the account but data mentions resource
        if (e.name === 'DepositEvent' || e.name === 'WithdrawEvent') {
            const fields = e.data?.fields || [];
            const resField = fields.find((f: GatewayField) => f.type_name === 'ResourceAddress' && sanitizeText(String(f.value)) === cleanResource);
            if (resField) return true;
        }
        return false;
    });

    if (!match) return null;

    const fields = match.data?.fields || [];
    const amountField = fields.find((f: GatewayField) => f.field_name === 'amount' || f.kind === 'Decimal');
    return amountField ? sanitizeText(String(amountField.value)) : null;
};

const extractResourceAddress = (ev: GatewayEvent): string => {
    const emitterAddr = sanitizeText(ev.emitter?.entity?.entity_address || '');
    if (emitterAddr.startsWith('resource_')) return emitterAddr;

    const fields = ev.data?.fields || [];
    // 1. Prioritize known field names
    const priorityField = fields.find((f: GatewayField) =>
        f.field_name === 'resource_address' ||
        f.field_name === 'resource' ||
        f.field_name === 'token_address' ||
        f.field_name === 'input_resource' ||
        f.field_name === 'bet_resource' ||
        f.field_name === 'input_address'
    );
    if (priorityField && typeof priorityField.value === 'string' && priorityField.value.startsWith('resource_')) {
        return sanitizeText(priorityField.value);
    }

    // 2. Fallback: Search for any value starting with "resource_" in the fields
    const anyResource = fields.find((f: GatewayField) =>
        typeof f.value === 'string' && f.value.startsWith('resource_')
    );
    return anyResource ? sanitizeText(String(anyResource.value)) : '';
};


/* OraclePriceRow
   One price of an oracle update in three columns (what one unit was worth,
   what it is worth now, how much it moved), with a bar for where it sits
   among the others (log scale: a feed mixes 1e-10 placeholders with BTC).
   Opens into the resource's own tabs, from the details already loaded for
   the whole update. */

/** A price as people read it: the significant digits of a tiny one, a few decimals of a large one. */
const formatOraclePrice = (price: string, locale: string) => {
    const n = Number(price);
    if (!Number.isFinite(n)) return price;
    return n >= 1
        ? n.toLocaleString(locale, { maximumFractionDigits: 4 })
        : n.toLocaleString(locale, { maximumSignificantDigits: 4 });
};

/** A template's {placeholders} replaced by nodes. */
const fillTemplate = (template: string, nodes: Record<string, React.ReactNode>) =>
    template.split(/(\{\w+\})/).map((part, i) => {
        const key = part.match(/^\{(\w+)\}$/)?.[1];
        return <React.Fragment key={i}>{key && key in nodes ? nodes[key] : part}</React.Fragment>;
    });

/** The time between two moments, in the largest unit that keeps it readable. */
const formatGap = (seconds: number, locale: string) => {
    const [value, unit] = seconds < 3600 ? [seconds / 60, 'minute'] : seconds < 86_400 ? [seconds / 3600, 'hour'] : [seconds / 86_400, 'day'];
    return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(value);
};

/**
 * Columns shared by the header and every row, so they line up. Narrow
 * screens: the asset on its own line, the three prices under it.
 */
const ORACLE_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-2 sm:gap-x-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_9.5rem_10.5rem_4.5rem_0.875rem] items-center gap-y-1';

function OraclePriceRow({
    update, share, rewrite, details, loading, unit, tt, onCopy, copiedAddress, network, locale = 'en',
}: {
    update: OracleUpdate;
    /** Where the new price sits between the lowest (0) and the highest (1) of the update, on a log scale. */
    share: number;
    /** What the update did to this price, read from the receipt. */
    rewrite?: PriceRewrite;
    /** The token's details, loaded with the rest of the update's. */
    details: GatewayEntityDetails | null;
    loading: boolean;
    /** The unit prices are quoted in (its symbol), when known. */
    unit: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const meta = details ? extractEntityMeta(details) : null;
    const label = meta?.symbol || meta?.name || `${update.baseToken.slice(0, 14)}…${update.baseToken.slice(-6)}`;
    const before = rewrite?.before?.price;
    const change = priceChange(before, update.price);
    const changeColor = change === null || change === 0
        ? 'text-[var(--color-text-muted)]'
        : change > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]';
    const worth = (price: string) => `1 ${label} = ${price}${unit ? ` ${unit}` : ''}`;
    const unitMark = unit && <span className="hidden sm:inline ml-1 font-sans text-[9px] font-bold text-[var(--color-text-muted)]">{unit}</span>;

    return (
        <li className={open ? 'bg-[var(--color-surface)]' : ''}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); if (!window.getSelection()?.toString()) setOpen((v) => !v); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); } }}
                className={`${ORACLE_GRID} px-1 py-2 cursor-pointer rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors`}
            >
                <span className="col-span-3 sm:col-span-1 flex items-center gap-2 min-w-0" title={meta?.name ? `${meta.name} · ${update.baseToken}` : update.baseToken}>
                    {meta?.iconUrl ? (
                        <SafeImage src={meta.iconUrl} alt={label} fallbackName={label} className="size-5 rounded-full object-cover shrink-0" />
                    ) : (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[8px] font-black text-[var(--color-primary)]">
                            {label.slice(0, 2).toUpperCase()}
                        </span>
                    )}
                    <span className="truncate text-xs font-bold text-[var(--color-text-main)]">{label}</span>
                </span>
                <span className="hidden sm:block h-1.5 rounded-full bg-[var(--color-primary)]/10 overflow-hidden" aria-hidden>
                    <span className="block h-full rounded-full bg-[var(--color-primary)]/70" style={{ width: `${Math.max(2, share * 100)}%` }} />
                </span>
                <span className="truncate text-right font-mono text-[10px] sm:text-[11px] text-[var(--color-text-muted)] tabular-nums" title={before !== undefined ? worth(before) : undefined}>
                    {before !== undefined ? <>{formatOraclePrice(before, locale)}{unitMark}</> : '—'}
                </span>
                <span className="truncate text-right font-mono text-[10px] sm:text-xs font-black text-[var(--color-text-main)] tabular-nums" title={worth(update.price)}>
                    {formatOraclePrice(update.price, locale)}{unitMark}
                </span>
                <span className={`text-right font-mono text-[11px] font-bold tabular-nums whitespace-nowrap ${changeColor}`}>
                    {change !== null ? `${change > 0 ? '+' : ''}${change.toLocaleString(locale, { maximumFractionDigits: 2 })}%` : ''}
                </span>
                <ChevronDown className={`hidden sm:block size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="mb-2 rounded-xl border border-[var(--color-card-border)] overflow-hidden" role="presentation" onClick={(e) => e.stopPropagation()}>
                            <ResourceInlinePanel
                                address={update.baseToken}
                                details={details}
                                loading={loading}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                tt={tt}
                                network={network}
                                locale={locale}
                            />
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </li>
    );
}

/* OracleUpdateSection
   What the update did, as four facts across the width (the oracle, the call,
   the unit and the time between the old prices and the new), then every
   price before and after. Takes any number of prices: the tokens' details
   load together, 20 per request, from the explorer's cache first. */
export function OracleUpdateSection({
    updates, call, updatedSubstates, confirmedAt, tt, onCopy, copiedAddress, onResourceClick, network, locale = 'en',
}: {
    updates: OracleUpdate[];
    /** The call the updates come from, when the manifest names it. */
    call?: OracleCall | null;
    /** The receipt's rewritten substates: the prices before and after. */
    updatedSubstates?: Parameters<typeof priceRewrites>[0];
    /** When the transaction was committed: the new prices' date when the feed does not record one. */
    confirmedAt?: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    const tokens = updates.map((u) => u.baseToken);
    const { data: entities, isLoading } = useEntityDetailsBatch(
        [...tokens, ...(call?.reference ? [call.reference] : []), ...(call ? [call.component] : [])],
        network,
    );

    if (updates.length === 0) return null;

    const rewrites = priceRewrites(updatedSubstates, tokens);
    const sorted = [...updates].sort((a, b) => Number(b.price) - Number(a.price));
    const logs = sorted.map((u) => Math.log10(Math.max(Number(u.price), Number.MIN_VALUE)));
    const lo = Math.min(...logs);
    const span = Math.max(...logs) - lo;

    const referenceMeta = call?.reference && entities?.[call.reference] ? extractEntityMeta(entities[call.reference]) : null;
    const unit = referenceMeta?.symbol || referenceMeta?.name || '';
    const oracleMeta = call && entities?.[call.component] ? extractEntityMeta(entities[call.component]) : null;
    const firstTime = (side: 'before' | 'after') => Object.values(rewrites).map((r) => r[side]?.timestamp).find((t): t is number => typeof t === 'number');
    const fromTime = firstTime('before');
    const confirmed = confirmedAt ? Date.parse(confirmedAt) / 1000 : NaN;
    const toTime = firstTime('after') ?? (Number.isFinite(confirmed) ? confirmed : undefined);
    const day = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(locale, { dateStyle: 'medium' });
    const time = (seconds: number) => new Date(seconds * 1000).toLocaleTimeString(locale, { timeStyle: 'short' });
    const sameDay = fromTime !== undefined && toTime !== undefined && day(fromTime) === day(toTime);

    const factLabel = 'text-[9px] uppercase font-black tracking-wider text-[var(--color-text-muted)]';
    const factValue = 'mt-0.5 truncate text-xs font-bold text-[var(--color-text-main)]';
    const factNote = 'text-[10px] leading-snug text-[var(--color-text-muted)]';
    const columnTitle = 'text-[9px] uppercase font-black tracking-wider text-[var(--color-text-muted)]';

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-primary)]/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-primary)]/20 bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Activity className="size-3.5 text-[var(--color-primary)]" />
                    {tt?.oracle_update_label || 'Oracle Price Update'}
                </span>
                <Pill color="custom" className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20">
                    {updates.length}
                </Pill>
            </h3>
            <div className="p-3 space-y-3">
                {call ? (
                    // Four facts sharing the width evenly, hairlines between them.
                    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-border)]">
                        <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                            <dt className={factLabel}>{tt?.oracle_component || 'Oracle'}</dt>
                            <dd className={factValue}>{oracleMeta?.name || oracleMeta?.blueprintName || '…'}</dd>
                            <dd className="flex items-center gap-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onResourceClick?.(call.component); }}
                                    className="truncate font-mono text-[10px] text-[var(--color-primary)] hover:underline"
                                    title={call.component}
                                >
                                    {call.component.slice(0, 14)}…{call.component.slice(-6)}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(call.component); }}
                                    className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                    title={tt?.copy_address || 'Copy'}
                                >
                                    {copiedAddress === call.component ? <Check className="size-3 text-[var(--color-accent)]" /> : <Copy className="size-3" />}
                                </button>
                            </dd>
                        </div>
                        <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                            <dt className={factLabel}>{tt?.oracle_call || 'Call'}</dt>
                            <dd className={`${factValue} font-mono`}>{call.method}()</dd>
                            <dd className={factNote}>{(tt?.oracle_prices_count || '{count} prices').replace('{count}', String(updates.length))}</dd>
                        </div>
                        <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                            <dt className={factLabel}>{tt?.oracle_unit || 'Unit'}</dt>
                            <dd className={factValue} title={call.reference ?? undefined}>
                                {call.reference ? (unit || `${call.reference.slice(0, 14)}…`) : (tt?.oracle_quote_unknown || 'Not stated')}
                            </dd>
                            <dd className={factNote}>{tt?.oracle_unit_hint || 'Price of 1 unit of each token'}</dd>
                        </div>
                        <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                            <dt className={factLabel}>{tt?.oracle_interval || 'Prices interval'}</dt>
                            {fromTime !== undefined && toTime !== undefined ? (
                                <>
                                    <dd className={`${factValue} flex items-center gap-1`}>
                                        {sameDay ? time(fromTime) : `${day(fromTime)} ${time(fromTime)}`}
                                        <ArrowRight className="size-3 shrink-0 text-[var(--color-text-muted)]" />
                                        {sameDay ? time(toTime) : `${day(toTime)} ${time(toTime)}`}
                                    </dd>
                                    <dd className={factNote}>
                                        {sameDay && `${day(toTime)} · `}
                                        {toTime > fromTime && <span className="font-bold text-[var(--color-primary)]">{formatGap(toTime - fromTime, locale)}</span>}
                                    </dd>
                                </>
                            ) : (
                                <dd className={factValue}>{toTime !== undefined ? `${day(toTime)} ${time(toTime)}` : '—'}</dd>
                            )}
                        </div>
                    </dl>
                ) : tt?.oracle_update_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic">{tt.oracle_update_desc}</p>
                )}

                <div>
                    <p className="px-1 pb-2 text-[11px] text-[var(--color-text-muted)]">
                        {fillTemplate(unit ? (tt?.oracle_table_caption || 'What 1 unit of each token is worth, in {unit}.') : (tt?.oracle_table_caption_no_unit || 'What 1 unit of each token is worth.'), {
                            unit: <b className="text-[var(--color-text-main)]">{unit}</b>,
                        })}
                    </p>
                    <div className={`${ORACLE_GRID} px-1 pb-1.5 border-b border-[var(--color-card-border)]`}>
                        <span className={`col-span-3 sm:col-span-1 ${columnTitle}`}>{tt?.oracle_col_asset || 'Asset'}</span>
                        <span className={`hidden sm:block ${columnTitle} normal-case font-semibold italic`}>{tt?.oracle_log_scale || 'Bars on a logarithmic scale'}</span>
                        <span className={`${columnTitle} text-right`}>{tt?.oracle_col_before || 'Before'}</span>
                        <span className={`${columnTitle} text-right`}>{tt?.oracle_col_after || 'Now'}</span>
                        <span className={`${columnTitle} text-right`}>{tt?.oracle_col_change || 'Change'}</span>
                        <span className="hidden sm:block" aria-hidden />
                    </div>
                    <ul className="divide-y divide-[var(--color-card-border)]">
                        {sorted.map((update, i) => (
                            <OraclePriceRow
                                key={`${update.baseToken}-${update.quoteToken}`}
                                update={update}
                                share={span > 0 ? (logs[i] - lo) / span : 1}
                                rewrite={rewrites[update.baseToken]}
                                details={entities?.[update.baseToken] ?? null}
                                loading={isLoading}
                                unit={update.quoteToken && update.quoteToken === call?.reference ? unit : ''}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                network={network}
                                locale={locale}
                            />
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

/* AirdropRewardCard + AirdropSection */

function AirdropRewardCard({
    airdropData, tt, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    airdropData: AirdropData;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    const meta = useEntityData(airdropData?.resource || '', network);
    const symbol = meta?.symbol ?? '';
    const iconUrl = meta?.iconUrl;

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3 shadow-sm divide-y divide-[var(--color-card-border)] h-full">
            <div className="pb-2">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt?.airdrop_winner || 'Winner Account'}
                </span>
                <EntityBadge address={airdropData?.account} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
            </div>
            <div className="pt-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black text-purple-500 tracking-wider opacity-80">
                    {tt?.airdrop_amount || 'Reward Amount'}
                </span>
                <div className="flex items-center justify-between w-full">
                    {airdropData?.resource ? (
                        <button type="button"
                            className="flex items-center gap-1 cursor-pointer hover:text-[var(--color-primary)] transition-colors text-left"
                            onClick={() => onResourceClick?.(airdropData?.resource!)}
                        >
                            {iconUrl && (
                                <SafeImage
                                    src={iconUrl}
                                    alt="Token"
                                    className="size-4 rounded-full bg-white/10"
                                    fallbackName={symbol || 'Token'}
                                />
                            )}
                            <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[120px]" title={airdropData?.resource}>
                                {airdropData?.resource.slice(0, 8)}...{airdropData?.resource.slice(-6)}
                            </span>
                        </button>
                    ) : <div />}
                    <span className="text-base font-mono font-black text-purple-400 flex items-center gap-1.5">
                        +{airdropData?.amount}
                        {symbol && (
                            <span className="text-xs font-bold text-[var(--color-text-main)] bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                {symbol}
                            </span>
                        )}
                    </span>
                </div>
            </div>
            <div className="pt-2 mt-1">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt?.airdrop_contract || 'Smart Contract'}
                </span>
                <EntityBadge address={airdropData?.component} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
            </div>
            <div className="pt-2 mt-1 flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                    {tt?.airdrop_event_id || 'Event ID'}
                </span>
                <div className="pl-4 pt-1">
                    <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-[var(--color-text-main)] border border-[var(--color-card-border)]">
                        #{airdropData?.eventId}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function AirdropSection({
    airdropData, tt, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    airdropData: AirdropData | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    if (!airdropData) return null;
    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-purple-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-purple-500/20 bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Gift className="size-3.5 text-purple-400" />
                    {tt?.airdrop_label || 'Airdrop / Rewards'}
                </span>
            </h3>
            <div className="p-3">
                {tt?.airdrop_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-3">{tt?.airdrop_desc}</p>
                )}
                <AirdropRewardCard
                    airdropData={airdropData}
                    tt={tt}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    onResourceClick={onResourceClick}
                    network={network}
                    locale={locale}
                />
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────
   New Protocol Event Sections
   ───────────────────────────────────────── */

export function VaultCreationSection({
    events, tt, te, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    events: GatewayEvent[];
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const vaultEvents = events.filter(e => e.name === 'VaultCreationEvent');
    if (vaultEvents.length === 0) return null;

    const extractField = (ev: GatewayEvent, key: string): string => {
        const fields = ev.data?.fields || [];
        const field = fields.find((f: GatewayField) => f.field_name === key);
        return sanitizeText(String(field?.value || field?.hex || ''));
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-amber-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-amber-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Landmark className="size-3.5 text-amber-400" />
                {te?.vault_creation || 'Vault Creation'}
            </h3>
            <div className="p-3 space-y-2">
                {vaultEvents.map((ev) => {
                    const resourceAddress = extractResourceAddress(ev);
                    const vaultId = extractField(ev, 'vault_id');
                    const amount = findEventAmount(events, resourceAddress);

                    return (
                        <VaultCreationCard
                            key={`vault-${resourceAddress}`}
                            resource={resourceAddress}
                            vaultId={vaultId}
                            amount={amount}
                            tt={tt}
                            te={te}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            _onResourceClick={onResourceClick}
                            network={network}
                            locale={locale}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function VaultCreationCard({
    resource, vaultId, amount, tt, te, onCopy, copiedAddress, _onResourceClick, network, locale: _locale = 'en'
}: {
    resource: string;
    vaultId: string;
    amount: string | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    _onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const wellKnownKey = getWellKnownKey(sanitizeText(resource), network);
    const genericKey = !wellKnownKey ? getGenericTooltipKey(sanitizeText(resource)) : null;
    const wellKnownTip = wellKnownKey
        ? tt?.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt?.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;
    const meta = useEntityData(resource, network);
    const symbol = meta?.symbol || '';
    const clean = sanitizeText(resource);
    const short = clean.length > 20 ? `${clean.slice(0, 12)}...${clean.slice(-6)}` : clean;
    const isResource = clean.startsWith('resource_');
    const isClickable = !!_onResourceClick && isResource;

    return (
        <div className="bg-amber-500/10 border border-amber-500/60 rounded-xl p-3.5 shadow-sm flex flex-col gap-3.5 h-full">
            {/* Top Row: Resource Identity & Amount */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {meta?.iconUrl && (
                        <SafeImage
                            src={meta.iconUrl}
                            alt={meta.name || 'Token'}
                            className="size-7 rounded-full bg-white/10 shadow-sm border border-amber-500/20 shrink-0 object-cover"
                            fallbackName={meta.name || 'Token'}
                        />
                    )}
                    <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                            {meta?.name && (
                                <span className="text-xs font-bold truncate text-amber-900 dark:text-amber-100 italic pe-1">
                                    {meta.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded border border-amber-500/40 text-amber-800 dark:text-amber-400 bg-amber-500/5 shrink-0 ${wellKnownTip ? 'cursor-help' : ''}`}
                                title={wellKnownTip ?? undefined}
                            >
                                {te?.resource || 'Resource'}
                            </span>
                            <button type="button"
                                className={`font-mono text-xs truncate text-[var(--color-text-main)] ${isClickable ? 'cursor-pointer hover:text-amber-600 transition-colors underline decoration-amber-500/30 underline-offset-2' : ''} text-left`}
                                title={wellKnownTip || clean}
                                onClick={() => isClickable && _onResourceClick?.(clean)}
                            >
                                {short}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(clean); }}
                                className="p-1 hover:bg-amber-500/20 rounded transition-colors shrink-0"
                                title={tt?.copy_raw || 'Copy'}
                            >
                                {copiedAddress === clean ? <Check className="size-3 text-[var(--color-accent)]" /> : <Copy className="size-3 text-amber-800/40 dark:text-amber-400/40" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simplified Amount Section */}
                {amount && (
                    <div className="flex flex-col items-end shrink-0 ml-auto">
                        <span className="text-[8px] uppercase font-bold text-amber-800/50 dark:text-amber-400/50 tracking-widest leading-none mb-1">
                            {te?.amount || 'Amount'}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-black text-amber-700 dark:text-amber-300">{amount}</span>
                            {symbol && (
                                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-100 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    {symbol}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Row: Vault ID Section */}
            <div className="pt-3 border-t border-amber-500/20">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        < Landmark className="size-2.5 text-amber-600/60 dark:text-amber-400/60" />
                        <span className="text-[9px] uppercase font-black text-amber-800/60 dark:text-amber-400/60 tracking-wider">
                            {te?.vault_id || 'Vault ID'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 px-0.5 w-full pl-4 pt-1">
                        <span className="text-xs font-mono text-[var(--color-text-main)] truncate select-all" title={vaultId}>
                            {vaultId.length > 20 ? `${vaultId.slice(0, 12)}...${vaultId.slice(-6)}` : vaultId}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(vaultId); }}
                            className="hover:text-amber-600 transition-colors shrink-0 p-1"
                            title={tt?.copy_raw || 'Copy'}
                        >
                            {copiedAddress === vaultId ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5 text-amber-800/30 dark:text-amber-400/30" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BetVoteSection({
    events, tt, te, onCopy, copiedAddress, onResourceClick: _onResourceClick, network, locale,
}: {
    events: GatewayEvent[];
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const voteEvents = events.filter(e => e.name === 'BetVoteEvent' || e.name === 'BetCreatedEvent');
    if (voteEvents.length === 0) return null;

    const extractField = (ev: GatewayEvent, key: string): string => {
        const fields = ev.data?.fields || [];
        const field = fields.find((f: GatewayField) => f.field_name === key);
        return sanitizeText(String(field?.value || field?.hex || ''));
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-blue-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-blue-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Vote className="size-3.5 text-blue-400" />
                {te?.bet_vote || 'Vote / Prediction'}
            </h3>
            <div className="p-3 space-y-2">
                {voteEvents.map((ev) => {
                    const emitterData = ev.emitter as { entity?: { entity_address: string; entity_type: string }, package_address?: string };
                    const emitter = sanitizeText(emitterData?.entity?.entity_address || emitterData?.package_address || '');
                    const entityType = emitterData?.entity?.entity_type || (emitterData?.package_address ? 'Package' : '');
                    const amount = extractField(ev, 'amount');
                    const option = extractField(ev, 'option') || extractField(ev, 'name');
                    const resourceAddress = extractResourceAddress(ev);

                    return (
                        <BetVoteCard
                            key={`vote-${emitter}-${option}-${amount}`}
                            option={option}
                            emitter={emitter}
                            entityType={entityType}
                            amount={amount}
                            resourceAddress={resourceAddress}
                            eventName={ev.name || ''}
                            tt={tt}
                            te={te}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            network={network}
                            locale={locale}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function BetVoteCard({
    option, emitter, entityType, amount, resourceAddress, eventName, tt, te, onCopy, copiedAddress, network, locale: _locale = 'en'
}: {
    option: string;
    emitter: string;
    entityType: string;
    amount: string | null;
    resourceAddress?: string;
    eventName: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
}) {
    const wellKnownKey = resourceAddress ? getWellKnownKey(resourceAddress, network) : null;
    const genericKey = (!wellKnownKey && resourceAddress) ? getGenericTooltipKey(resourceAddress) : null;
    const wellKnownTip = wellKnownKey
        ? tt?.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt?.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    const emitterKey = getWellKnownKey(emitter, network);
    const genericEmitterKey = !emitterKey ? getGenericTooltipKey(emitter) : null;
    const emitterTip = emitterKey
        ? tt?.well_known_tooltips?.[emitterKey as keyof typeof tt.well_known_tooltips]
        : genericEmitterKey
            ? tt?.type_tooltips?.[genericEmitterKey as keyof typeof tt.type_tooltips]
            : null;
    const meta = useEntityData(resourceAddress || '', network);
    const symbol = meta?.symbol || '';
    const isBet = eventName === 'BetCreatedEvent';
    const label = isBet ? (te?.bet_name || 'Bet Name') : (te?.option || 'Option');

    // Dynamic mapping to existing translations
    const getEntityTypeLabel = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('package')) return tt?.entity_type_package || 'Package';
        if (t.includes('component')) return tt?.entity_type_component || 'Component';
        if (t.includes('account')) return tt?.entity_type_account || 'Account';
        if (t.includes('identity')) return tt?.entity_type_identity || 'Identity';
        if (t.includes('resource')) return tt?.entity_type_resource || 'Resource';
        if (t.includes('validator')) return tt?.entity_type_validator || 'Validator';
        return tt?.entity_type_unknown || 'Entity';
    };

    const typeLabel = entityType ? getEntityTypeLabel(entityType) : '';

    return (
        <div className="bg-blue-500/10 border border-blue-500/60 rounded-xl p-3.5 shadow-sm flex flex-col gap-3.5 h-full">
            {/* Top Row: Option & Amount */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {meta?.iconUrl && (
                        <SafeImage
                            src={meta.iconUrl}
                            alt={meta.name || 'Token'}
                            className="size-7 rounded-full bg-white/10 shadow-sm border border-blue-500/20 shrink-0 object-cover"
                            fallbackName={meta.name || 'Token'}
                        />
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] uppercase font-black tracking-wider text-blue-800/60 dark:text-blue-400/60 self-start">
                            {label}
                        </span>
                        {option && option !== resourceAddress && (
                            <span className="text-xs font-bold truncate text-blue-900 dark:text-blue-100 italic pe-1">
                                {option}
                            </span>
                        )}
                        {meta?.name && (
                            <span className="text-[10px] font-bold truncate text-blue-900/60 dark:text-blue-100/60 italic pe-1">
                                {meta.name}
                            </span>
                        )}
                        {resourceAddress && (
                            <div className="flex items-center gap-2 mt-1.5 min-w-0">
                                <span className={`text-xs font-mono truncate text-[var(--color-text-main)] select-all ${wellKnownTip ? 'cursor-help' : ''}`} title={wellKnownTip ?? resourceAddress}>
                                    {resourceAddress.length > 20 ? `${resourceAddress.slice(0, 12)}...${resourceAddress.slice(-6)}` : resourceAddress}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(resourceAddress); }}
                                    className="p-1 hover:bg-blue-500/20 rounded transition-colors shrink-0"
                                    title={tt?.copy_raw || 'Copy'}
                                >
                                    {copiedAddress === resourceAddress ? <Check className="size-3 text-[var(--color-accent)]" /> : <Copy className="size-3 text-blue-800/40 dark:text-blue-400/40" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount Highlight */}
                {amount && amount !== '0' && (
                    <div className="flex flex-col items-end shrink-0 ml-auto">
                        <span className="text-[8px] uppercase font-bold text-blue-800/50 dark:text-blue-400/50 tracking-widest leading-none mb-1">
                            {te?.amount || 'Amount'}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-black text-blue-700 dark:text-blue-300">{amount}</span>
                            {symbol && (
                                <span className="text-[10px] font-bold text-blue-900 dark:text-blue-100 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                                    {symbol}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Row: Emitter (at) */}
            <div className="pt-3 border-t border-blue-500/20">
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase font-black text-blue-800/60 dark:text-blue-400/60 tracking-wider">
                                {te?.at || 'at'}
                            </span>
                            {typeLabel && (
                                <span
                                    className={`text-[8px] uppercase font-bold tracking-tight px-1 py-0.5 leading-none rounded border border-blue-500/40 text-blue-800 dark:text-blue-400 bg-blue-500/10 shrink-0 ${emitterTip ? 'cursor-help' : ''}`}
                                    title={emitterTip ?? undefined}
                                >
                                    {typeLabel}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 pl-4 pt-1">
                            <span className="text-xs font-mono text-[var(--color-text-main)] truncate select-all" title={emitter}>
                                {emitter.length > 20 ? `${emitter.slice(0, 12)}...${emitter.slice(-6)}` : emitter}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(emitter); }}
                                className="hover:text-blue-600 transition-colors shrink-0 p-1"
                                title={tt?.copy_raw || 'Copy'}
                            >
                                {copiedAddress === emitter ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5 text-blue-800/30 dark:text-blue-400/30" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function RatesChangedSection({
    events, tt, te, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    events: GatewayEvent[];
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const rateEvents = events.filter(e => e.name === 'RatesChangedEvent');
    if (rateEvents.length === 0) return null;

    const extractField = (ev: GatewayEvent, key: string): string => {
        const fields = ev.data?.fields || [];
        const field = fields.find((f: GatewayField) => f.field_name === key);
        return sanitizeText(String(field?.value || field?.hex || ''));
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-teal-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-teal-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <TrendingUp className="size-3.5 text-teal-400" />
                {te?.rates_changed || 'Rates Update'}
            </h3>
            <div className="p-3 space-y-2">
                {rateEvents.map((ev) => {
                    const emitter = sanitizeText(ev.emitter?.entity?.entity_address || '');
                    const rateType = extractField(ev, 'rate_type');
                    const prev = extractField(ev, 'previous');
                    const curr = extractField(ev, 'current');

                    return (
                        <div key={`rate-${emitter}-${rateType}`} className="p-3 bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl shadow-sm flex flex-col gap-3">
                            <EntityBadge address={emitter} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                            <div className="flex items-center justify-between gap-4 py-1.5 px-2 bg-teal-500/5 rounded-lg border border-teal-500/20">
                                <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wide">{rateType}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-bold text-[var(--color-text-muted)]">{prev}%</span>
                                    <ArrowRight className="size-3 text-teal-500 opacity-50" />
                                    <span className="text-sm font-mono font-black text-teal-400">{curr}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function MetadataUpdatesSection({
    events, tt, te, onCopy, copiedAddress, onResourceClick: _onResourceClick, network, locale: _locale
}: {
    events: GatewayEvent[];
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    te?: Partial<TranslationsT['events']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const metaEvents = events.filter(e => e.name === 'SetMetadataEvent');
    if (metaEvents.length === 0) return null;

    const extractField = (ev: GatewayEvent, key: string): GatewayField | undefined => {
        const fields = ev.data?.fields || [];
        const field = fields.find((f: GatewayField) => f.field_name === key);
        return field;
    };

    // Group by emitting entity
    const grouped = metaEvents.reduce((acc, ev) => {
        const emitterData = ev.emitter as { entity?: { entity_address: string; entity_type: string }, package_address?: string };
        const emitter = sanitizeText(emitterData?.entity?.entity_address || emitterData?.package_address || '');
        const entityType = emitterData?.entity?.entity_type || (emitterData?.package_address ? 'Package' : '');
        if (!acc[emitter]) acc[emitter] = { emitter, entityType, updates: [] };

        const keyField = extractField(ev, 'key');
        const key = sanitizeText(String(keyField?.value || keyField?.hex || ''));

        const valueField = extractField(ev, 'value');
        let metaValue = '...';
        const vfFields = valueField?.fields as GatewayField[] | undefined;
        if (valueField && valueField.variant_name && Array.isArray(vfFields) && vfFields.length > 0) {
            metaValue = sanitizeText(String(vfFields[0].value || vfFields[0].hex || ''));
        }
        acc[emitter].updates.push({ key, value: metaValue });
        return acc;
    }, {} as Record<string, { emitter: string, entityType: string, updates: { key: string, value: string }[] }>);

    const translateKey = (k: string) => {
        if (k === 'account_type') return te?.account_type || 'Account Type';
        if (k === 'name') return te?.name_tag || 'Name';
        if (k === 'tags') return te?.tags || 'Tags';
        if (k === 'claimed_entities') return te?.claimed_entities || 'Claimed Entities';
        if (k === 'info_url') return te?.info_url || 'Info URL';
        if (k === 'icon_url') return te?.icon_url || 'Icon URL';
        if (k === 'description') return te?.description || 'Description';
        return k;
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-indigo-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-indigo-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Settings2 className="size-3.5 text-indigo-400" />
                {te?.set_metadata || 'Profile/Config Update'}
            </h3>
            <div className="p-4 flex flex-col gap-4">
                {Object.values(grouped).map((grp) => (
                    <MetadataEntityBlock
                        key={`meta-${grp.emitter}`}
                        emitter={grp.emitter}
                        updates={grp.updates}
                        translateKey={translateKey}
                        tt={tt}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        network={network}
                    />
                ))}
            </div>
        </div>
    );
}

function MetadataEntityBlock({
    emitter, updates, translateKey, tt, onCopy, copiedAddress, network
}: {
    emitter: string;
    updates: { key: string, value: string }[];
    translateKey: (k: string) => string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
}) {
    const meta = useEntityData(emitter, network);

    const wellKnownKey = getWellKnownKey(sanitizeText(emitter), network);
    const genericKey = !wellKnownKey ? getGenericTooltipKey(sanitizeText(emitter)) : null;
    const wellKnownTip = wellKnownKey
        ? tt?.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt?.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    // Filter out missing or empty values
    const validUpdates = updates.filter(u => {
        const val = u.value?.trim() || '';
        return val && val !== '...' && val !== '[]' && val !== 'None' && val !== 'null';
    });

    if (validUpdates.length === 0) return null;

    // Resolve name and icon from updates or fallback to meta.
    const nameUpdate = validUpdates.find(u => u.key === 'name')?.value;
    const resolvedName = nameUpdate || meta?.name;

    const iconUrlUpdate = validUpdates.find(u => u.key === 'icon_url')?.value;
    const resolvedIconUrl = iconUrlUpdate || meta?.iconUrl;

    // Ordered keys to display below the address
    const orderedKeys = ['info_url', 'icon_url', 'claimed_entities', 'tags', 'account_type'];

    // Group them: matching the ordered keys first, then the rest
    const orderedUpdates = orderedKeys.flatMap(k => { const u = validUpdates.find(u => u.key === k); return u ? [u] : []; }) as { key: string, value: string }[];
    const restUpdates = validUpdates.filter(u => !orderedKeys.includes(u.key) && u.key !== 'name');

    const displayUpdates = [...orderedUpdates, ...restUpdates];

    return (
        <div className="flex flex-col sm:flex-row items-start gap-4 pb-4 last:pb-0 border-b border-[var(--color-card-border)] last:border-0 border-dashed">
            {/* Left side: Circular Image */}
            <div className="shrink-0 mt-0.5">
                {resolvedIconUrl ? (
                    <SafeImage
                        src={resolvedIconUrl}
                        alt={resolvedName || 'Entity Icon'}
                        className="size-12 rounded-full bg-[var(--color-surface)] shadow-sm object-cover border border-[var(--color-card-border)]"
                        fallbackName={resolvedName || 'Entity'}
                    />
                ) : (
                    <div className="size-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center">
                        <span className="text-[10px] text-[var(--color-text-muted)]">N/A</span>
                    </div>
                )}
            </div>

            {/* Right side: Information */}
            <div className="flex flex-col min-w-0 flex-1">
                {/* 1. Name */}
                {resolvedName && (
                    <div className="font-bold text-[var(--color-text-main)] text-sm mb-0.5">
                        {resolvedName}
                    </div>
                )}

                {/* 2. Address */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-[var(--color-text-muted)] select-all truncate" title={wellKnownTip || emitter}>
                        {emitter.length > 20 ? `${emitter.slice(0, 12)}...${emitter.slice(-6)}` : emitter}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCopy(emitter); }}
                        className="p-1 hover:bg-slate-500/10 rounded transition-colors shrink-0"
                        title={tt?.copy_raw || 'Copy'}
                    >
                        {copiedAddress === emitter ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5 text-[var(--color-text-muted)]" />}
                    </button>
                </div>

                {/* The rest in specific order */}
                <div className="flex flex-col gap-0.5 text-xs">
                    {displayUpdates.map((u) => (
                        <div key={u.key} className="flex flex-col gap-0.5 mb-2 last:mb-0">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                                {translateKey(u.key)}
                            </span>
                            {u.key === 'info_url' ? (
                                <div className="pl-4 pt-1">
                                    <a
                                        href={u.value.startsWith('http') ? u.value : `https://${u.value}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-xs text-blue-500 hover:underline break-all"
                                    >
                                        {u.value}
                                    </a>
                                </div>
                            ) : (
                                <span className="font-mono text-xs text-[var(--color-text-main)] break-all pl-4 pt-1" title={u.value}>
                                    {u.value.length > 40 && (u.value.startsWith('resource_') || u.value.startsWith('account_') || u.value.startsWith('package_') || u.value.startsWith('component_'))
                                        ? `${u.value.slice(0, 12)}...${u.value.slice(-6)}`
                                        : u.value}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── ProposerSection ── */
export function ProposerSection({ details, tx, tt, network, onCopy, copiedAddress, locale = 'en' }: {
    details?: import('@/features/dashboard/types').TransactionDetails;
    tx: import('@/types/radix').TransactionInfo;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network?: 'mainnet' | 'stokenet';
    onCopy: (val: string) => void;
    copiedAddress: string | null;
    locale?: string;
}) {
    const qc = useQueryClient();
    const validatorsData = qc.getQueryData<{ validators: import('@/types/radix').Validator[] }>(['validators', network ?? 'mainnet']);

    const proposerInfo = resolveProposerInfo(details ?? null);
    if (!proposerInfo) return null;

    const proposerValidator = validatorsData?.validators
        ? findProposerValidator(proposerInfo, validatorsData.validators)
        : null;

    const valName = proposerValidator?.name || sanitizeText(tt?.proposer_box_title || 'Proposer');
    const valAddress = proposerValidator?.address || '';
    const valIcon = proposerValidator?.iconUrl;

    const wellKnownKey = getWellKnownKey(sanitizeText(valAddress), network || 'mainnet');
    const genericKey = !wellKnownKey ? getGenericTooltipKey(sanitizeText(valAddress)) : null;
    const wellKnownTip = wellKnownKey
        ? tt?.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt?.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    // Formatting local and UTC dates
    const dateObj = tx.confirmedAt;
    let formattedDate = '-';
    try {
        if (dateObj) {
            const d = new Date(dateObj);

            const localDate = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
            const localTime = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            formattedDate = `${localDate} ${localTime}`;
        }
    } catch { }

    const stateVersionValue = details?.state_version || '?';

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center">
                <span className="flex items-center gap-2 cursor-help" title={tt?.proposer_tooltip || ''}>
                    <User className="size-3.5 text-[var(--color-primary)]" />
                    {tt?.proposer_box_title || 'Proposer'}
                </span>
            </h3>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 divide-y xl:divide-y-0 xl:divide-x divide-[var(--color-card-border)]">

                {/* 1. Name */}
                <div className="flex flex-col gap-1 xl:px-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-[var(--color-card-border)] xl:border-none first:pt-0 first:border-0 first:xl:pl-0">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                        {tt?.proposer_name || 'Validator Name'}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                        {valIcon ? (
                            <SafeImage
                                src={valIcon}
                                alt={valName}
                                className="size-5 rounded-full bg-[var(--color-surface)] shadow-sm object-cover border border-[var(--color-card-border)] shrink-0"
                                fallbackName={valName}
                            />
                        ) : (
                            <div className="size-5 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center shrink-0">
                                <User className="size-2.5 text-[var(--color-text-muted)]" />
                            </div>
                        )}
                        <span className="text-[13px] font-bold text-[var(--color-text-main)] truncate" title={valName}>
                            {valName}
                        </span>
                    </div>
                </div>

                {/* 2. Address */}
                <div className="flex flex-col gap-1 xl:px-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-[var(--color-card-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                        {tt?.proposer_address || 'Validator Address'}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13px] font-mono text-[var(--color-text-main)] truncate" title={wellKnownTip || valAddress}>
                            {valAddress ? `${valAddress.slice(0, 10)}...${valAddress.slice(-8)}` : 'N/A'}
                        </span>
                        {valAddress && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(valAddress); }}
                                className="p-1 hover:bg-[var(--color-surface)] rounded text-[var(--color-text-muted)] transition-colors shrink-0"
                                title={tt?.copy_raw || 'Copy'}
                            >
                                {copiedAddress === valAddress ? <Check className="size-3 text-[var(--color-accent)]" /> : <Copy className="size-3" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. Date & Time */}
                <div className="flex flex-col gap-1 xl:px-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-[var(--color-card-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Clock className="size-3" />
                        {tt?.proposer_local_date || 'Local Date'}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-main)] font-mono truncate" title={formattedDate}>
                        {formattedDate}
                    </span>
                </div>

                {/* 4. Epoch/Round */}
                <div className="flex flex-col gap-1 xl:px-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-[var(--color-card-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Hash className="size-3" />
                        {tt?.proposer_epoch_round || 'Epoch/Round'}
                    </span>
                    <span className="text-[13px] font-bold text-[var(--color-text-main)] font-mono">
                        {tx.epoch} / {tx.round}
                    </span>
                </div>

                {/* 5. State Version & Index */}
                <div className="flex flex-col gap-1 xl:px-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-[var(--color-card-border)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Database className="size-3" />
                        {tt?.proposer_state_version_index || 'State Version / Index'}
                    </span>
                    <span className="text-[13px] font-bold text-[var(--color-text-main)] font-mono">
                        {stateVersionValue} / #{proposerInfo.validatorIndex}
                    </span>
                </div>

            </div>
        </div>
    );
}
