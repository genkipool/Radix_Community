'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { TransferFooterProps } from '../types';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import { IconFlame, IconMedal, IconBolt } from './TransactionIcons';

/**
 * TransferFooter
 * Displays a summary of total assets sent, received, and fees paid.
 */
export function TransferFooter({
    senders, receivers, actualFeePaid, tt, resourceAddress, network,
}: TransferFooterProps) {
    const fmt = (v: string) => Math.abs(parseFloat(v || '0')).toFixed(4).replace(/\.?0+$/, '');

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

    const greenCls = 'text-[#16a34a]';

    return (
        <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-card-border)] text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-tight">
            {senders.length > 0 && receivers.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-2">
                        <IconFlame className="text-red-500 w-3.5 h-3.5" />
                        {tt.sent_label || 'SENT'}
                        <span className="text-red-500 font-black">{senders.reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0).toFixed(4).replace(/\.?0+$/, '')} {symbol}</span>
                    </span>
                    <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                    <span className="flex items-center gap-2 text-[var(--color-text-main)]">
                        <IconBolt className="w-3.5 h-3.5 opacity-60" />
                        <span className="font-black">{receivers.length}</span>
                        {tt.recipients_label || 'RECIPIENTS'}
                    </span>
                    <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                    <span className="flex items-center gap-2">
                        <IconMedal className={`${greenCls} w-3.5 h-3.5`} />
                        {tt.received_label || 'RECEIVED'}
                        <span className={`${greenCls} font-black`}>{receivers.reduce((s, c) => s + Math.abs(parseFloat(c.balance_change || '0')), 0).toFixed(4).replace(/\.?0+$/, '')} {symbol}</span>
                    </span>
                    <div className="h-4 w-px bg-[var(--color-card-border)] hidden sm:block" />
                    <span className="flex items-center gap-2">
                        <Shield className="text-amber-500 w-3.5 h-3.5" />
                        {tt.fee_label?.toUpperCase() || 'FEE'}
                        <span className="text-amber-600 font-black">{actualFeePaid} XRD</span>
                    </span>
                </div>
            ) : senders.length > 0 ? (
                <div className="flex items-center justify-center gap-2 py-1">
                    <IconFlame className="text-red-500 w-4 h-4" />
                    <span className="text-red-500 font-black">{fmt(senders[0]?.balance_change)} {symbol}</span>
                    <span className="opacity-80">{tt.burned_by_network_subtitle || 'burned or destroyed by system.'}</span>
                </div>
            ) : receivers.length > 0 ? (
                <div className="flex items-center justify-center gap-2 py-1">
                    <IconMedal className={`${greenCls} w-4 h-4`} />
                    <span className={`${greenCls} font-black`}>{receivers[0]?.balance_change} {symbol}</span>
                    <span className="opacity-80">{tt.validator_emissions_subtitle || 'generated or minted by system.'}</span>
                </div>
            ) : null}
        </div>
    );
}
