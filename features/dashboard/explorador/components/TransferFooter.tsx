'use client';

import React from 'react';
import { Shield, ArrowUp, ArrowDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { TransferFooterProps } from '../types';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import { IconFlame, IconBolt } from './TransactionIcons';

/**
 * TransferFooter
 * Displays a summary of total assets sent, received, and fees paid.
 */
export function TransferFooter({
    senders, receivers, actualFeePaid, tt, resourceAddress,
    isResourceBurned, mintedNftCount, burnedNftCount,
    network, locale,
}: TransferFooterProps) {
    // Read metadata from React Query cache — populated by BalanceChangeRow renders above.
    const qc = useQueryClient();
    const entityData = resourceAddress && network
        ? qc.getQueryData<GatewayEntityDetails>(entityKeys.full(resourceAddress, network))
        : null;

    const rawSymbol = entityData?.metadata?.items?.find((m: MetadataItem) => m.key === 'symbol')?.value?.typed?.value;
    const rawName = entityData?.metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.value?.typed?.value;

    let symbol = '';
    if (!resourceAddress) {
        symbol = 'XRD';
    } else if (rawSymbol) {
        symbol = rawSymbol;
    } else if (rawName && /liquid.?stake|lsu/i.test(rawName)) {
        symbol = 'LSU';
    }

    const burnedReceivers = isResourceBurned ? receivers.filter(c => parseFloat(c.balance_change || '0') < 0) : [];

    const greenCls = 'text-[#16a34a]';

    return (
        <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-card-border)] text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-tight">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">

                {/* ── Fungible Senders ── */}
                {(() => {
                    const sentAmount = senders.filter(c => parseFloat(c.balance_change || '0') < 0).reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);
                    if (sentAmount <= 0 && receivers.length > 0) return null;
                    if (senders.length === 0) return null;

                    return (
                        <span className="flex items-center gap-2">
                            <ArrowUp className="text-red-500 w-3.5 h-3.5" />
                            {receivers.length > 0 ? tt?.sent_label || 'SENT' : ''}
                            <span className="text-red-500 font-black">
                                {sentAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                            </span>
                            {receivers.length === 0 && <span className="opacity-80 lowercase italic">{tt?.burned_by_network_subtitle || 'burned or destroyed by system.'}</span>}
                        </span>
                    );
                })()}

                {/* ── Recipients Count ── */}
                {senders.length > 0 && receivers.length > 0 && (
                    <>
                        <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                        <span className="flex items-center gap-2 text-[var(--color-text-main)]">
                            <IconBolt className="w-3.5 h-3.5 opacity-60" />
                            <span className="font-black">{receivers.length}</span>
                            {tt?.recipients_label || 'RECIPIENTS'}
                        </span>
                    </>
                )}

                {/* ── Fungible Receivers (positive balance = actual receives for SOURCE accounts) ── */}
                {(() => {
                    const sourceReceives = senders.filter(c => parseFloat(c.balance_change || '0') > 0);
                    if (sourceReceives.length === 0) return null;

                    const receivedAmount = sourceReceives.reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);

                    return (
                        <>
                            <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                            <span className="flex items-center gap-2">
                                <ArrowDown className={`${greenCls} w-3.5 h-3.5`} />
                                {senders.length > 0 ? tt?.received_label || 'RECEIVED' : ''}
                                <span className={`${greenCls} font-black`}>
                                    {receivedAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                                </span>
                            </span>
                        </>
                    );
                })()}

                {/* ── Destination Account RECEIVED ── */}
                {(() => {
                    const destAccounts = receivers.filter(c => c.entity_address.startsWith('account_'));
                    const receivedAmount = destAccounts.filter(c => parseFloat(c.balance_change || '0') > 0).reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);
                    if (receivedAmount <= 0) return null;

                    return (
                        <>
                            <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                            <span className="flex items-center gap-2">
                                <ArrowDown className={`${greenCls} w-3.5 h-3.5 opacity-60`} />
                                {tt?.received_label || 'RECEIVED'} (DEST)
                                <span className={`${greenCls} font-black`}>
                                    {receivedAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                                </span>
                            </span>
                        </>
                    );
                })()}

                {/* ── Destination Account SENT ── */}
                {(() => {
                    const destAccounts = receivers.filter(c => c.entity_address.startsWith('account_'));
                    const sentAmount = destAccounts.filter(c => parseFloat(c.balance_change || '0') < 0).reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);
                    if (sentAmount <= 0) return null;

                    return (
                        <>
                            <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                            <span className="flex items-center gap-2">
                                <ArrowUp className="text-red-500/60 w-3.5 h-3.5" />
                                {tt?.sent_label || 'SENT'} (DEST)
                                <span className="text-red-500 font-black">
                                    {sentAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                                </span>
                            </span>
                        </>
                    );
                })()}

                {/* ── Fungible Burned (negative balance in destination = vault burn) ── */}
                {burnedReceivers.length > 0 && (
                    <>
                        <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                        <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <IconFlame className="w-3.5 h-3.5" />
                            {tt?.system_burn || 'BURNED'}
                            <span className="font-black">
                                {burnedReceivers.reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                            </span>
                        </span>
                    </>
                )}

                {/* ── Network Fee ── */}
                {parseFloat(actualFeePaid) > 0 && (
                    <>
                        <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                        <span className="flex items-center gap-2">
                            <Shield className="text-amber-500 w-3.5 h-3.5" />
                            {tt?.fee_label?.toUpperCase() || 'FEE'}
                            <span className="text-amber-600 font-black">{parseFloat(actualFeePaid).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} XRD</span>
                        </span>
                    </>
                )}

                {/* ── NFTs Minted (Stake Claim receipt) ── */}
                {mintedNftCount != null && mintedNftCount > 0 && (
                    <>
                        <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                        <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                            <IconBolt className="w-3.5 h-3.5" />
                            {tt?.nfts_minted_label?.toUpperCase() || 'NFTS MINTED'}
                            <span className="font-black">{mintedNftCount}</span>
                        </span>
                    </>
                )}

                {/* ── NFTs Burned (Stake Claim redeemed) ── */}
                {burnedNftCount != null && burnedNftCount > 0 && (
                    <>
                        <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                        <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <IconFlame className="w-3.5 h-3.5" />
                            {tt?.nfts_burned_label?.toUpperCase() || 'NFTS BURNED'}
                            <span className="font-black">{burnedNftCount}</span>
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
