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

                {/* ── Consolidated Fungible Flow ── */}
                {(() => {
                    const allFungible = [...senders, ...receivers];
                    // Filter out fees and sum up negative/positive changes
                    const totalSent = allFungible
                        .filter(c => !c.is_fee && parseFloat(c.balance_change || '0') < 0)
                        .reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);
                    
                    const totalReceived = allFungible
                        .filter(c => !c.is_fee && parseFloat(c.balance_change || '0') > 0)
                        .reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0);

                    return (
                        <>
                            {totalSent > 0 && (
                                <span className="flex items-center gap-2">
                                    <ArrowUp className="text-red-500 w-3.5 h-3.5" />
                                    {tt?.sent_label || 'SENT'}
                                    <span className="text-red-500 font-black">
                                        {totalSent.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                                    </span>
                                    {totalReceived === 0 && <span className="opacity-80 lowercase italic">{tt?.burned_by_network_subtitle || 'burned or destroyed by system.'}</span>}
                                </span>
                            )}

                            {totalSent > 0 && totalReceived > 0 && (
                                <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                            )}

                            {totalReceived > 0 && (
                                <span className="flex items-center gap-2">
                                    <ArrowDown className={`${greenCls} w-3.5 h-3.5`} />
                                    {tt?.received_label || 'RECEIVED'}
                                    <span className={`${greenCls} font-black`}>
                                        {totalReceived.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {symbol}
                                    </span>
                                </span>
                            )}

                            {receivers.length > 0 && (
                                <>
                                    <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                                    <span className="flex items-center gap-2 text-[var(--color-text-main)]">
                                        <IconBolt className="w-3.5 h-3.5 opacity-60" />
                                        <span className="font-black">{receivers.length}</span>
                                        {tt?.recipients_label || 'RECIPIENTS'}
                                    </span>
                                </>
                            )}
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
