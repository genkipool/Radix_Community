'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, ArrowLeftRight, Wallet, Route, Table2 } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SafeImage } from '@/components/ui/SafeImage';
import { sanitizeText } from '@/utils/sanitize';
import type { Network, TranslationsT, TransactionDetails, EntityMeta } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import type { SwapHop } from '../utils/transactionUtils';
import { buildSwapRoutingChart, detectSwapMode } from '../utils/transactionUtils';
import { MermaidDiagram } from './MermaidDiagram';
import { BalanceChanges, FungibleChange } from '../types/gateway.types';
import { ExplorerTable } from './ExplorerTable';

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
            {copiedAddress === addr ? <Check className="size-2.5 text-[var(--color-accent)]" /> : <Copy className="size-2.5 text-[var(--color-text-muted)]/40" />}
        </button>
    );
}

function resolveTokenSymbol(meta: EntityMeta | null, resourceAddress: string): string {
    if (meta?.symbol) return meta.symbol;
    const name = (meta?.name || '').toLowerCase();
    if (name.includes('liquid stake') || name.includes('lsu')) return 'LSU';
    if (resourceAddress.toLowerCase().includes('radxrd')) return 'XRD';
    return resourceAddress.slice(-6).toUpperCase();
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
    const truncated = Math.trunc(parseFloat(amount) * 10000) / 10000;
    const fmtAmt = truncated.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const clean = sanitizeText(resource);

    return (
        <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
            <span className={`text-[9px] uppercase font-black tracking-widest ${colorClass} opacity-80`}>
                {isSold ? (tt?.swap_sold_label || 'Token Sold') : (tt?.swap_received_label || 'Token Received')}
            </span>
            <div className={`size-10 rounded-full border-2 ${borderClass} ${bgClass} flex items-center justify-center shrink-0 shadow-sm`}>
                {iconUrl ? (
                    <SafeImage src={iconUrl} alt={name || symbol || 'Token'} className="size-8 rounded-full object-cover" fallbackName={symbol || name || '?'} />
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

    const prevRef = React.useRef('');
    const key = `${address}:${name}:${symbol}:${blueprintName}`;
    if (key !== prevRef.current) {
        prevRef.current = key;
        onResolved(address, name, symbol, blueprintName);
    }

    return null;
}

/* ── Routing Mermaid diagram wrapper ── */
function RoutingMermaid({ fungibles, feeEntries, initiatorAddrs, network, tt, tx, details, onCopy, copiedAddress, swapMode }: {
    fungibles: FungibleChange[];
    feeEntries: { entity_address: string; resource_address: string; balance_change: string }[];
    initiatorAddrs: string[];
    network: Network;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    tx: TransactionInfo;
    details: TransactionDetails;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    swapMode: 'NORMAL_SWAP' | 'ARBITRAGE' | 'NOT_SWAP';
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

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const container = target.closest('[data-diag-copy]');
            if (container) {
                e.stopPropagation();
                const addr = container.getAttribute('data-diag-copy');
                if (addr) onCopy(addr);
            }
        };
        window.addEventListener('click', handleClick, true);
        return () => window.removeEventListener('click', handleClick, true);
    }, [onCopy]);

    // Build the Mermaid chart definition
    const feePaid = parseFloat(sanitizeText(String(tx.feePaid || '0')));
    const feeDest = details?.receipt?.fee_destination;
    const feePayer = details?.balance_changes?.fungible_fee_balance_changes?.find(f => parseFloat(f.balance_change) < 0)?.entity_address;

    const chart = buildSwapRoutingChart(
        details?.receipt?.events || [],
        fungibles,
        feeEntries,
        initiatorAddrs,
        names,
        symbols,
        blueprintNames,
        tt,
        feePaid,
        feeDest,
        feePayer,
        swapMode
    );

    return (
        <>
            {allAddresses.map(addr => (
                <NameResolver key={addr} address={addr} network={network} onResolved={handleResolved} />
            ))}
            <h4 className="px-4 sm:px-5 text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                <Route className="size-3 text-[var(--color-accent)]" />
                {tt?.swap_routing_label || 'Routing Path'}
            </h4>
            <MermaidDiagram chart={chart} copiedAddress={copiedAddress} />
        </>
    );
}

/* ── Balance change row ── */
function BalanceRow({ change, isUser, onCopy, copiedAddress, onResourceClick, network, locale, tt }: {
    change: FungibleChange; isUser: boolean; onCopy: (v: string) => void; copiedAddress: string | null;
    onResourceClick?: (a: string) => void; network: Network; locale: string; tt?: Partial<TranslationsT['dashboard']['transactions']>;
}) {
    const entityMeta = useEntityData(sanitizeText(change.entity_address), network);
    const resourceMeta = useEntityData(sanitizeText(change.resource_address), network);
    const entityClean = sanitizeText(change.entity_address);
    const resourceClean = sanitizeText(change.resource_address);
    const val = parseFloat(change.balance_change);
    const isPositive = val > 0;
    const truncatedVal = Math.trunc(Math.abs(val) * 10000) / 10000;
    const fmtVal = truncatedVal.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const symbol = resolveTokenSymbol(resourceMeta, resourceClean);

    // Determine role
    let role = 'DEX';
    let roleColor = 'text-[var(--color-text-muted)]';
    if (isUser) { role = tt?.swap_account_label || 'Account'; roleColor = 'text-[var(--color-primary)]'; }
    else if (entityClean.includes('consensusmanager')) { role = 'Validators'; roleColor = 'text-violet-400/90'; }
    else if (entityClean.startsWith('resource_')) { role = 'Burn'; roleColor = 'text-violet-400/90'; }

    return (
        <tr className="border-b border-[var(--color-card-border)] hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-300 last:border-b-0 group">
            <td className="py-3 px-4 border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors min-w-[240px]">
                <div className="flex items-center gap-1.5">
                    <span className="cursor-pointer hover:text-[var(--color-primary)] transition-colors text-[10px] font-mono text-[var(--color-text-muted)]" title={entityClean} onClick={() => onResourceClick?.(entityClean)}>
                        {entityMeta?.name ? <><span className="font-bold text-[var(--color-text-main)] font-sans mr-1">{entityMeta.name}</span>{trunc(entityClean, 12, 10)}</> : trunc(entityClean, 20, 16)}
                    </span>
                    <CopyBtn addr={entityClean} onCopy={onCopy} copiedAddress={copiedAddress} />
                </div>
            </td>
            <td className="py-3 px-4 border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors min-w-[140px]"><span className={`text-[9px] font-bold uppercase tracking-wider font-sans ${roleColor}`}>{role}</span></td>
            <td className="py-3 px-4 border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                <div className="flex items-center gap-1.5">
                    <span className="cursor-pointer hover:text-[var(--color-primary)] transition-colors text-[10px] font-mono text-[var(--color-text-muted)]" title={resourceClean} onClick={() => onResourceClick?.(resourceClean)}>
                        {trunc(resourceClean, 20, 36)}
                    </span>
                    <CopyBtn addr={resourceClean} onCopy={onCopy} copiedAddress={copiedAddress} />
                </div>
            </td>
            <td className={`py-3 px-4 text-right text-[10px] font-mono font-bold ${isPositive ? 'text-[var(--color-accent)]' : 'text-rose-500'} border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors`}>
                {isPositive ? '+' : '−'}{fmtVal} {symbol && <span className="text-[9px] font-bold font-sans ml-1 opacity-70">{symbol}</span>}
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
    const soldSymbol = resolveTokenSymbol(soldMeta, soldToken.resource);
    const receivedSymbol = resolveTokenSymbol(receivedMeta, receivedToken.resource);
    const fmtRate = rate > 0 ? rate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
    const truncatedSold = Math.trunc(parseFloat(soldToken.amount) * 10000) / 10000;
    const fmtSold = truncatedSold.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const truncatedReceived = Math.trunc(parseFloat(receivedToken.amount) * 10000) / 10000;
    const fmtReceived = truncatedReceived.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

    const accountMeta = useEntityData(initiatorAddress, network);
    const accountName = accountMeta?.name;
    const cleanAccount = sanitizeText(initiatorAddress);

    // All fungible balance changes for routing diagram and table
    const fungibles = balanceChanges?.fungible_balance_changes ?? [];
    const rawSwapMode = detectSwapMode(details?.receipt?.events || [], Array.from(initiators));
    const swapMode = (rawSwapMode === 'ARBITRAGE' && soldToken.resource !== receivedToken.resource) ? 'NORMAL_SWAP' : rawSwapMode;

    return (
        <div className="space-y-0">

            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
                {/* ── Header ── */}
                <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                    <ArrowLeftRight className="size-3.5 text-[var(--color-accent)] shrink-0" />
                    {swapMode === 'ARBITRAGE' ? (tt?.swap_arbitrage_title || 'Arbitrage Settlement') : (tt?.swap_settlement_title || 'DEX Settlement')}
                </h3>

                {/* ── Section 1: Token Flow + Swap Details ── */}
                <div className="p-4 sm:p-5 flex flex-col gap-6">
                    {/* Account address badge at the top */}
                    <div className="flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity border-b border-dashed border-[var(--color-card-border)] pb-3">
                        <Wallet className="size-4 text-[var(--color-text-muted)]" />
                        {accountName && <span className="text-[11px] font-bold text-[var(--color-text-main)] truncate max-w-[160px]">{accountName}</span>}
                        <span className="text-[12px] font-mono text-[var(--color-text-muted)] truncate cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={cleanAccount} onClick={() => onResourceClick?.(cleanAccount)}>{trunc(cleanAccount, 12, 12)}</span>
                        <CopyBtn addr={cleanAccount} onCopy={onCopy} copiedAddress={copiedAddress} />
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left: Token flow */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-2">
                                <TokenColumn resource={soldToken.resource} amount={soldToken.amount} side="sold" tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                                <ArrowRight className="size-4 text-[var(--color-text-muted)] opacity-50 rotate-90 sm:rotate-0 shrink-0" />
                                <div className="flex flex-col items-center gap-2 shrink-0 px-6 py-4 rounded-xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-bg)]/50 shadow-sm transition-all duration-300 hover:border-[var(--color-accent)]/50 group/swap">
                                    <ArrowLeftRight className="size-6 text-[var(--color-accent)] transition-transform duration-500 group-hover/swap:rotate-180" />
                                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-[var(--color-accent)]">Swap</span>
                                    {dexName && <span className="text-[11px] font-bold text-[var(--color-text-main)] truncate max-w-[140px]" title={dexName}>{dexName}</span>}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[110px] cursor-pointer hover:text-[var(--color-primary)] transition-colors" title={cleanDex} onClick={() => onResourceClick?.(cleanDex)}>{trunc(cleanDex, 10, 6)}</span>
                                        <CopyBtn addr={cleanDex} onCopy={onCopy} copiedAddress={copiedAddress} />
                                    </div>
                                </div>
                                <ArrowRight className="size-4 text-[var(--color-text-muted)] opacity-50 rotate-90 sm:rotate-0 shrink-0" />
                                <TokenColumn resource={receivedToken.resource} amount={receivedToken.amount} side="received" tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                            </div>
                            <div className="mt-4 border-t-2 border-[var(--color-card-border)]/40" />
                        </div>

                        {/* Right: Swap Details (Minimalist Text Layout) */}
                        <div className="lg:w-[300px] shrink-0 self-stretch border-l border-[var(--color-card-border)]/50 pl-4 flex flex-col justify-between">
                            <div className="px-1 space-y-3">
                                <div>
                                    <h4 className="text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                                        <Table2 className="size-3 text-[var(--color-accent)]" />
                                        {tt?.swap_details_label || 'Swap Details'}
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{tt?.swap_sold_label || 'Sold'}</span>
                                            <span className="text-[11px] font-mono font-black text-rose-500 truncate">−{fmtSold} {soldSymbol}</span>
                                        </div>
                                        <div className="flex justify-between items-baseline gap-2">
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{tt?.swap_received_label || 'Received'}</span>
                                            <span className="text-[11px] font-mono font-black text-[var(--color-accent)] truncate">+{fmtReceived} {receivedSymbol}</span>
                                        </div>
                                        {swapMode === 'ARBITRAGE' && soldToken.resource === receivedToken.resource && (
                                            <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-dashed border-[var(--color-card-border)]">
                                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">Beneficio</span>
                                                <span className="text-[11px] font-mono font-black text-[var(--color-primary)] truncate">
                                                    +{parseFloat((receivedAmt - soldAmt).toString()).toLocaleString(locale, { maximumFractionDigits: 8 })} {receivedSymbol}
                                                </span>
                                            </div>
                                        )}
                                        {minReceivedAmount && (
                                            <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-dashed border-[var(--color-card-border)]">
                                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{tt?.swap_min_received_label || 'Min. Expected'}</span>
                                                <span className="text-[11px] font-mono font-black text-[var(--color-text-main)] truncate">
                                                    {parseFloat(minReceivedAmount).toLocaleString(locale, { maximumFractionDigits: 8 })} {receivedSymbol}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-[var(--color-card-border)]">
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{tt?.swap_rate_label || 'Rate'}</span>
                                            <span className="text-[11px] font-mono font-bold text-[var(--color-text-main)]">1:{fmtRate}</span>
                                        </div>
                                        {routingHops.length > 1 && (
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{tt?.swap_hops_label || 'Hops'}</span>
                                                <span className="text-[11px] font-mono text-[var(--color-text-main)]">{routingHops.length}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="px-1">
                                <div className="mt-4 border-t-2 border-[var(--color-card-border)]/40" />
                            </div>
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
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            swapMode={swapMode}
                        />
                    </div>
                )}

                {/* ── Section 3: Balance Changes Table ── */}
                {fungibles.length > 0 && (
                    <div className="px-4 sm:px-5 pb-4">
                        <ExplorerTable
                            title={tt?.swap_settlements_label || 'Balance Changes'}
                            icon={<Table2 className="size-3 text-[var(--color-accent)]" />}
                            headers={[
                                { label: tt?.swap_entity_label || 'Entity', className: 'min-w-[240px]' },
                                { label: tt?.swap_role_label || 'Role', className: 'min-w-[140px]' },
                                tt?.swap_asset_label || 'Asset',
                                tt?.swap_variation_label || 'Net'
                            ]}
                        >
                            {fungibles.map((fc, i) => (
                                <BalanceRow
                                    key={`${fc.entity_address}-${fc.resource_address}-${i}`}
                                    change={fc}
                                    isUser={initiators.has(sanitizeText(fc.entity_address))}
                                    onCopy={onCopy}
                                    copiedAddress={copiedAddress}
                                    onResourceClick={onResourceClick}
                                    network={network}
                                    locale={locale}
                                    tt={tt}
                                />
                            ))}
                        </ExplorerTable>
                    </div>
                )}
            </div>
        </div>
    );
}
