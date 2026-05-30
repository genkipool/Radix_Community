'use client';
import { SafeImage } from '@/components/ui/SafeImage';
import React, { useState } from 'react';
import { Check, Copy, ChevronDown } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { getMetaValue } from '../utils/metadataUtils';
import { BalanceChangeRowProps } from '../types/components.types';
import { getWellKnownKey, getGenericTooltipKey } from '../constants/wellKnownAddresses';
import { ResourceInlinePanel } from './ResourceInlinePanel';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';

/* ═══════ BALANCE CHANGE ROW ═══════ */
const BalanceChangeRow = ({
    change, t, tt: ttProp, onResourceClick: _onResourceClick, onCopy, copiedAddress, readingMode: _readingMode, network = 'mainnet', side: _side, locale,
    iconOverride, colorOverride, hideSign, titleOverride,
}: BalanceChangeRowProps & { titleOverride?: string }) => {
    const tt = ttProp ?? t?.dashboard?.transactions;
    const [expanded, setExpanded] = useState(false);

    const { data: metadata, isLoading } = useQuery({
        queryKey: entityKeys.full(change.resource_address, network),
        queryFn: () => apiFetchEntityDetails(change.resource_address, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 1000 * 60 * 10, retry: 2, retryOnMount: true,
    });

    const isPositive = parseFloat(change.balance_change || '0') > 0;
    const isNegative = parseFloat(change.balance_change || '0') < 0;
    const color = colorOverride ?? (isPositive ? 'text-[var(--color-accent)]' : isNegative ? 'text-red-500 dark:text-red-400' : 'text-[var(--color-text-main)]');
    const sign = hideSign ? '' : isPositive ? '+' : '';

    const metaItems: MetadataItem[] = (metadata as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const rawName = getMetaValue(metaItems, 'name');
    const rawSymbol = getMetaValue(metaItems, 'symbol');
    const iconUrl = getMetaValue(metaItems, 'icon_url');
    const isFee = change.is_fee;

    // Resolve tooltip for address
    const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
    const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

    const wellKnownKey = getWellKnownKey(change.resource_address, network || 'mainnet');
    const genericKey = getGenericTooltipKey(change.resource_address);
    const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
        ? well_known[wellKnownKey]
        : genericKey && type_tooltips?.[genericKey]
            ? type_tooltips[genericKey]
            : null;

    const name = rawName
        || (metadata && !isLoading ? `${change.resource_address.slice(0, 10)}...${change.resource_address.slice(-6)}` : '...');
    const symbol = rawSymbol
        || (rawName && /liquid.?stake|lsu/i.test(rawName) ? 'LSU' : '');

    let titleStr = '';
    const feeTitle = tt?.fee_deduction_title || 'Fee deduction of {amount} {token} from account {account}';
    const sentTitle = tt?.sent_title || 'Account {account} sent {amount} {token}';
    const receivedTitle = tt?.received_title || 'Account {account} received {amount} {token}';

    if (isFee) {
        titleStr = (feeTitle || 'Fee deduction of {amount} {token} from account {account}')
            .replace('{amount}', change.balance_change.replace('-', ''))
            .replace('{token}', symbol || name)
            .replace('{account}', change.entity_address);
    } else {
        titleStr = isNegative
            ? (sentTitle || 'Account {account} sent {amount} {token}').replace('{account}', change.entity_address).replace('{amount}', change.balance_change.replace('-', '')).replace('{token}', symbol || name)
            : (receivedTitle || 'Account {account} received {amount} {token}').replace('{account}', change.entity_address).replace('{amount}', change.balance_change).replace('{token}', symbol || name);
    }

    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFee) return;
        if (window.getSelection()?.toString()) return;
        setExpanded(prev => !prev);
    };

    const isRoyalty = change.type === 'RoyaltyDistributed';

    return (
        <div className="mb-2">
            <button type="button"
                className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-[var(--color-surface)] border border-[var(--color-card-border)] group transition-all hover:bg-[var(--color-surface-hover)] gap-3 ${!isFee ? 'cursor-pointer' : 'cursor-auto'} ${!isFee && expanded ? 'rounded-t-xl border-b-transparent' : 'rounded-xl'}`}
                title={titleOverride || titleStr} onClick={handleCardClick}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {iconUrl
                        ? <SafeImage src={iconUrl} alt={symbol || name} fallbackName={symbol || name} className="size-10 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0" />
                        : <div className="size-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shadow-inner border border-[var(--color-primary)]/30 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                    }
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                            <div className={`font-bold text-sm sm:text-base text-[var(--color-text-main)] ${!isFee ? 'group-hover:text-[var(--color-primary)]' : ''} transition-colors truncate min-w-0`}>{name}</div>
                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                            {!isFee && <ChevronDown className={`size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[150px] sm:max-w-[200px]" title={wellKnownTip || change.resource_address}>{change.resource_address.slice(0, 12)}...{change.resource_address.slice(-6)}</div>
                            <button type="button" onClick={e => { e.stopPropagation(); onCopy(change.resource_address); }} className={`p-1 rounded-md transition-colors ${copiedAddress === change.resource_address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/5'}`} title="Copy Address">
                                {copiedAddress === change.resource_address ? <Check className="size-3" /> : <Copy className="size-3" />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className={`font-mono font-bold lg:text-lg ${color} shrink-0 text-right flex flex-col justify-end`}>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-black mb-0.5 opacity-70">
                        {(() => {
                            const lbl = isRoyalty ? (tt?.fees_royalty || 'Royalties') : isFee ? (tt?.fee_label || 'Fees') : (tt?.amount_label || 'Amount');
                            return lbl.length > 10 ? lbl.slice(0, 8).trim() + '...' : lbl;
                        })()}
                    </div>
                    <div className="flex items-baseline gap-1.5 justify-end">
                        {iconOverride && <span className="shrink-0">{iconOverride}</span>}
                        <span>
                            {sign}
                            {(() => {
                                const val = hideSign ? Math.abs(parseFloat(change.balance_change)) : parseFloat(change.balance_change);
                                const truncated = Math.trunc(val * 10000) / 10000;
                                return truncated.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                            })()}
                        </span>

                        {symbol && <span className="text-xs font-semibold opacity-70">{symbol}</span>}
                    </div>
                </div>
            </button>
            <AnimatePresence>
                {!isFee && expanded && (
                    <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <ResourceInlinePanel address={change.resource_address} details={metadata || null} loading={isLoading} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export { BalanceChangeRow };
