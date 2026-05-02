'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, ArrowLeftRight, Wallet, Route, Table2 } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SafeImage } from '@/components/ui/SafeImage';
import { sanitizeText } from '@/utils/sanitize';
import type { Network, TranslationsT, TransactionDetails } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import type { SwapHop } from '../utils/transactionUtils';
import { buildSwapRoutingChart } from '../utils/transactionUtils';
import { MermaidDiagram } from './MermaidDiagram';
import type { BalanceChanges, FungibleChange } from '../types';

interface SwapSettlementCardProps {
    soldToken: { resource: string; amount: string };
    receivedToken: { resource: string; amount: string };
    dexComponent: string;
    initiatorAddress: string;
    routingHops: SwapHop[];
    balanceChanges: BalanceChanges | undefined;
    initiators: Set<string>;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale: string;
    tx: TransactionInfo;
    details: TransactionDetails;
    minReceivedAmount?: string;
}

/* ── Helpers ── */
function trunc(addr: string, pre = 10, suf = 6): string {
    return addr.length > pre + suf + 3 ? `${addr.slice(0, pre)}…${addr.slice(-suf)}` : addr;
}

function CopyBtn({ addr, onCopy, copiedAddress }: { addr: string; onCopy: (v: string) => void; copiedAddress: string | null }) {
    return (
        <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(addr); }} className="p-0.5 hover:bg-[var(--color-surface)] rounded transition-colors shrink-0">
            {copiedAddress === addr ? <Check className="w-2.5 h-2.5 text-[var(--color-accent)]" /> : <Copy className="w-2.5 h-2.5 text-[var(--color-text-muted)]/40" />}
        </button>
    );
}

/* ── Token column (sold/received) ── */
function TokenColumn({ resource, amount, side, tt, onCopy, copiedAddress, onResourceClick, network, locale }: {
    resource: string; amount: string; side: 'sold' | 'received';
    tt?: Partial<TranslationsT['dashboard']['transactions']>; onCopy: (v: string) => void; copiedAddress: string | null;
    onResourceClick?: (a: string) => void; network: Network; locale: string;
}) {
    const meta = useEntityData(resource, network);
    const symbol = meta?.symbol ?? '';
    const name = meta?.name ?? '';
    const iconUrl = meta?.iconUrl;
    const isSold = side === 'sold';
    const colorClass = isSold ? 'text-rose-500' : 'text-[var(--color-accent)]';
    const bgClass = isSold ? 'bg-rose-500/10' : 'bg-[var(--color-accent)]/10';
    const borderClass = isSold ? 'border-rose-500/40' : 'border-[var(--color-accent)]/40';
    const textColorClass = isSold ? 'text-rose-500' : 'text-[var(--color-accent)]';

    const sign = isSold ? '−' : '+';
    const fmtAmt = parseFloat(amount).toLocaleString(locale, { maximumFractionDigits: 8 });
    const clean = sanitizeText(resource);

    return (
        <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
            <span className={`text-[9px] uppercase font-black tracking-widest ${colorClass} opacity-80`}>
                {isSold ? (tt?.swap_sold_label || 'Token Sold') : (tt?.swap_received_label || 'Token Received')}
            </span>
            <div className={`w-10 h-10 rounded-full border-2 ${borderClass} ${bgClass} flex items-center justify-center shrink-0 shadow-sm`}>
                {iconUrl ? (
                    <SafeImage src={iconUrl} alt={name || symbol || 'Token'} className="w-8 h-8 rounded-full object-cover" fallbackName={symbol || name || '?'} />
                ) : (
                    <span className={`text-xs font-black ${textColorClass}`}>{symbol ? symbol.slice(0, 3) : '?'}</span>
                )}
            </div>
            {(symbol || name) && <span className="text-xs font-bold text-[var(--color-text-main)] truncate max-w-full text-center">{symbol || name}</span>}
            <span className={`text-sm font-mono font-black ${textColorClass}`}>{sign}{fmtAmt}</span>
            <div className="flex items-center gap-1 min-w-0 max-w-full">
                <span className={`text-[9px] font-mono text-[var(--color-text-muted)] truncate ${onResourceClick ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`} title={clean} onClick={() => onResourceClick?.(clean)}>{trunc(clean)}</span>
                <CopyBtn addr={clean} onCopy={onCopy} copiedAddress={copiedAddress} />
            </div>
        </div>
    );
}

/* ── Routing intermediary node ── */
/* ── Entity name resolver (invisible, feeds names map) ── */
function NameResolver({ address, network, onResolved }: {
    address: string; network: Network;
    onResolved: (addr: string, name: string, symbol: string, blueprintName: string) => void;
}) {
    const meta = useEntityData(address, network);
    const name = meta?.name || '';
    const symbol = meta?.symbol || '';
    const blueprintName = meta?.blueprintName || '';

    useEffect(() => {
        onResolved(address, name, symbol, blueprintName);
    }, [address, name, symbol, blueprintName, onResolved]);

    return null;
}

/* ── Routing Mermaid diagram wrapper ── */
function RoutingMermaid({ fungibles, feeEntries, initiatorAddrs, network, tt, tx, details }: {
    fungibles: FungibleChange[];
    feeEntries: { entity_address: string; resource_address: string; balance_change: string }[];
    initiatorAddrs: string[];
    network: Network;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    tx: TransactionInfo;
    details: TransactionDetails;
}) {
    const [names, setNames] = useState<Map<string, string>>(new Map());
    const [symbols, setSymbols] = useState<Map<string, string>>(new Map());
    const [blueprintNames, setBlueprintNames] = useState<Map<string, string>>(new Map());

    // Collect all unique addresses (entities + resources)
    const addrSet = new Set<string>();
    for (const fc of fungibles) {
        addrSet.add(sanitizeText(fc.entity_address));
        addrSet.add(sanitizeText(fc.resource_address));
    }
    for (const fc of feeEntries) {
        addrSet.add(sanitizeText(fc.entity_address));
        addrSet.add(sanitizeText(fc.resource_address));
    }
    const allAddresses = Array.from(addrSet);

    const handleResolved = (addr: string, name: string, symbol: string, blueprintName: string) => {
        const clean = sanitizeText(addr);
        if (name) setNames(prev => { const n = new Map(prev); n.set(clean, name); return n; });
        if (symbol) setSymbols(prev => { const s = new Map(prev); s.set(clean, symbol); return s; });
        if (blueprintName) setBlueprintNames(prev => { const b = new Map(prev); b.set(clean, blueprintName); return b; });
    };

    // Build the Mermaid chart definition
    const feePaid = parseFloat(sanitizeText(String(tx.feePaid || '0')));
    const feeDest = details?.receipt?.fee_destination;
    const feePayer = details?.balance_changes?.fungible_fee_balance_changes?.find(f => parseFloat(f.balance_change) < 0)?.entity_address;

    const chart = buildSwapRoutingChart(
        fungibles,
        feeEntries,
        initiatorAddrs,
        names,
        symbols,
        blueprintNames,
        tt,
        feePaid,
        feeDest,
        feePayer
    );

    return (
        <>
            {allAddresses.map(addr => (
                <NameResolver key={addr} address={addr} network={network} onResolved={handleResolved} />
            ))}
            <h4 className="px-4 sm:px-5 text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                <Route className="w-3 h-3 text-[var(--color-accent)]" />
                {tt?.swap_routing_label || 'Routing Path'}
            </h4>
            <MermaidDiagram chart={chart} />
        </>
    );
}

/* ── Balance change row ── */
function BalanceRow({ change, isUser, onCopy: _onCopy, copiedAddress: _copiedAddress, onResourceClick, network, locale, tt }: {
    change: FungibleChange; isUser: boolean; onCopy: (v: string) => void; copiedAddress: string | null;
    onResourceClick?: (a: string) => void; network: Network; locale: string; tt?: Partial<TranslationsT['dashboard']['transactions']>;
}) {
    const entityMeta = useEntityData(sanitizeText(change.entity_address), network);
    const resourceMeta = useEntityData(sanitizeText(change.resource_address), network);
    const entityClean = sanitizeText(change.entity_address);
    const resourceClean = sanitizeText(change.resource_address);
    const val = parseFloat(change.balance_change);
    const isPositive = val > 0;
    const fmtVal = Math.abs(val).toLocaleString(locale, { maximumFractionDigits: 8 });
    const symbol = resourceMeta?.symbol ?? '';

    // Determine role
    let role = 'DEX';
    let badgeClass = 'bg-white/5 text-[var(--color-text-muted)] border-[var(--color-card-border)]';
    if (isUser) { role = tt?.swap_account_label || 'Account'; badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20'; }
    else if (entityClean.includes('consensusmanager')) { role = 'Validators'; badgeClass = 'bg-violet-500/10 text-violet-400 border-violet-500/20'; }
    else if (entityClean.startsWith('resource_')) { role = 'Burn'; badgeClass = 'bg-violet-500/10 text-violet-400 border-violet-500/20'; }

    return (
        <tr className="group hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                <span className="cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={entityClean} onClick={() => onResourceClick?.(entityClean)}>
                    {entityMeta?.name ? <><span className="font-bold text-[var(--color-text-main)] font-sans mr-1">{entityMeta.name}</span>{trunc(entityClean, 6, 4)}</> : trunc(entityClean, 12, 6)}
                </span>
            </td>
            <td className="px-3 py-2"><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border font-sans ${badgeClass}`}>{role}</span></td>
            <td className="px-3 py-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                <span className="cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={resourceClean} onClick={() => onResourceClick?.(resourceClean)}>
                    {symbol ? <><span className="font-bold text-[var(--color-text-main)] font-sans mr-1">{symbol}</span>{trunc(resourceClean, 6, 4)}</> : trunc(resourceClean, 12, 6)}
                </span>
            </td>
            <td className={`px-3 py-2 text-right text-[10px] font-mono font-bold ${isPositive ? 'text-[var(--color-accent)]' : 'text-rose-500'}`}>
                {isPositive ? '+' : '−'}{fmtVal}
            </td>
        </tr>
    );
}

/* ══════════════════════════════════════════════
   Main SwapSettlementCard
   ══════════════════════════════════════════════ */
export function SwapSettlementCard({
    soldToken, receivedToken, dexComponent, initiatorAddress, routingHops,
    balanceChanges, initiators, tt, onCopy, copiedAddress, onResourceClick, network, locale,
    tx, details, minReceivedAmount,
}: SwapSettlementCardProps) {
    const dexMeta = useEntityData(dexComponent, network);
    const dexName = dexMeta?.name ?? '';
    const cleanDex = sanitizeText(dexComponent);

    const soldAmt = parseFloat(soldToken.amount);
    const receivedAmt = parseFloat(receivedToken.amount);
    const rate = soldAmt > 0 ? receivedAmt / soldAmt : 0;

    const soldMeta = useEntityData(soldToken.resource, network);
    const receivedMeta = useEntityData(receivedToken.resource, network);
    const soldSymbol = soldMeta?.symbol ?? soldToken.resource.slice(-6);
    const receivedSymbol = receivedMeta?.symbol ?? receivedToken.resource.slice(-6);
    const fmtRate = rate > 0 ? rate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
    const fmtSold = parseFloat(soldToken.amount).toLocaleString(locale, { maximumFractionDigits: 8 });
    const fmtReceived = parseFloat(receivedToken.amount).toLocaleString(locale, { maximumFractionDigits: 8 });

    const accountMeta = useEntityData(initiatorAddress, network);
    const accountName = accountMeta?.name;
    const cleanAccount = sanitizeText(initiatorAddress);

    // All fungible balance changes for routing diagram and table
    const fungibles = balanceChanges?.fungible_balance_changes ?? [];

    return (
        <div className="space-y-0">
            {/* ── Account address badge (OUTSIDE the card, top-left) ── */}
            <div className="flex items-center gap-1.5 mb-2 pl-1">
                <Wallet className="w-3 h-3 text-[var(--color-text-muted)]" />
                {accountName && <span className="text-[10px] font-bold text-[var(--color-text-main)] truncate max-w-[140px]">{accountName}</span>}
                <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={cleanAccount} onClick={() => onResourceClick?.(cleanAccount)}>{trunc(cleanAccount, 12, 6)}</span>
                <CopyBtn addr={cleanAccount} onCopy={onCopy} copiedAddress={copiedAddress} />
            </div>

            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
                {/* ── Header ── */}
                <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                    {tt?.swap_settlement_title || 'DEX Settlement'}
                </h3>

                {/* ── Section 1: Token Flow + Swap Details side-by-side ── */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4">
                    {/* Left: Token flow */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-2">
                            <TokenColumn resource={soldToken.resource} amount={soldToken.amount} side="sold" tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] opacity-50 rotate-90 sm:rotate-0 shrink-0" />
                            <div className="flex flex-col items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg border border-dashed border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                                <ArrowLeftRight className="w-4 h-4 text-[var(--color-accent)]" />
                                <span className="text-[9px] uppercase font-black tracking-widest text-[var(--color-accent)]">Swap</span>
                                {dexName && <span className="text-[10px] font-bold text-[var(--color-text-main)] truncate max-w-[120px]" title={dexName}>{dexName}</span>}
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] font-mono text-[var(--color-text-muted)] truncate max-w-[100px] cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={cleanDex} onClick={() => onResourceClick?.(cleanDex)}>{trunc(cleanDex, 8, 4)}</span>
                                    <CopyBtn addr={cleanDex} onCopy={onCopy} copiedAddress={copiedAddress} />
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] opacity-50 rotate-90 sm:rotate-0 shrink-0" />
                            <TokenColumn resource={receivedToken.resource} amount={receivedToken.amount} side="received" tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                        </div>
                        {/* Rate */}
                        <div className="mt-4 pt-3 border-t border-[var(--color-card-border)] flex items-center justify-center gap-2">
                            <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">{tt?.swap_rate_label || 'Rate'}:</span>
                            <span className="text-[11px] font-mono font-bold text-[var(--color-text-main)]">1 {soldSymbol} = {fmtRate} {receivedSymbol}</span>
                        </div>
                    </div>

                    {/* Right: Swap Details mini-table */}
                    <div className="lg:w-[240px] shrink-0 bg-[var(--color-bg)]/50 rounded-lg border border-[var(--color-card-border)] overflow-hidden self-start">
                        <h4 className="px-3 py-2 text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-1.5">
                            <Table2 className="w-3 h-3 text-[var(--color-accent)]" />
                            {tt?.swap_details_label || 'Swap Details'}
                        </h4>
                        <div className="divide-y divide-[var(--color-card-border)]">
                            <div className="flex justify-between px-3 py-1.5 gap-2">
                                <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">{tt?.swap_sold_label || 'Sold'}</span>
                                <span className="text-[10px] font-mono font-bold text-rose-500 text-right truncate">−{fmtSold} {soldSymbol}</span>
                            </div>
                            <div className="flex justify-between px-3 py-1.5 gap-2">
                                <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">{tt?.swap_received_label || 'Received'}</span>
                                <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] text-right truncate">+{fmtReceived} {receivedSymbol}</span>
                            </div>
                            {minReceivedAmount && (
                                <div className="flex justify-between px-3 py-1.5 gap-2 bg-[var(--color-accent)]/5">
                                    <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">{tt?.swap_min_received_label || 'Min. Expected'}</span>
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] text-right truncate">
                                        {parseFloat(minReceivedAmount).toLocaleString(locale, { maximumFractionDigits: 8 })} {receivedSymbol}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between px-3 py-1.5 gap-2">
                                <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">{tt?.swap_rate_label || 'Rate'}</span>
                                <span className="text-[10px] font-mono font-bold text-[var(--color-text-main)] text-right">1:{fmtRate}</span>
                            </div>
                            {routingHops.length > 1 && (
                                <div className="flex justify-between px-3 py-1.5 gap-2">
                                    <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">{tt?.swap_hops_label || 'Hops'}</span>
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-accent)]">{routingHops.length}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Section 2: Routing Diagram (Mermaid) ── */}
                {fungibles.length > 0 && (
                    <div className="px-0 pb-4">
                        <RoutingMermaid
                            fungibles={fungibles}
                            feeEntries={balanceChanges?.fungible_fee_balance_changes ?? []}
                            initiatorAddrs={Array.from(initiators)}
                            network={network}
                            tt={tt}
                            tx={tx}
                            details={details}
                        />
                    </div>
                )}

                {/* ── Section 3: Balance Changes Table ── */}
                {fungibles.length > 0 && (
                    <div className="px-4 sm:px-5 pb-4">
                        <div className="bg-[var(--color-bg)]/50 rounded-lg border border-[var(--color-card-border)] overflow-hidden">
                            <h4 className="px-3 py-2 text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-1.5">
                                <Table2 className="w-3 h-3 text-[var(--color-accent)]" />
                                {tt?.swap_settlements_label || 'Balance Changes'}
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[10px]">
                                    <thead>
                                        <tr className="border-b border-[var(--color-card-border)]">
                                            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{tt?.swap_entity_label || 'Entity'}</th>
                                            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{tt?.swap_role_label || 'Role'}</th>
                                            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{tt?.swap_asset_label || 'Asset'}</th>
                                            <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{tt?.swap_variation_label || 'Net'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fungibles.map((fc, i) => (
                                            <BalanceRow key={`${fc.entity_address}-${fc.resource_address}-${i}`} change={fc} isUser={initiators.has(sanitizeText(fc.entity_address))} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} tt={tt} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
