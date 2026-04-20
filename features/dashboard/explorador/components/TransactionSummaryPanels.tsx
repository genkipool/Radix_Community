/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import { Activity, Gift, Box, Vote, TrendingUp, ArrowRight, Check, Copy, Settings2 } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { Pill } from '@/components/ui/Pill';
import { EntityBadge } from './EntityBadge';
import type { OracleUpdate, AirdropData } from '@/features/dashboard/explorador/types';
import type { Network, TranslationsT, GatewayEvent, GatewayField } from '@/features/dashboard/types';
import { sanitizeText } from '@/utils/sanitize';
import { getWellKnownKey, getGenericTooltipKey } from '@/features/dashboard/explorador/constants/wellKnownAddresses';

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


/* OraclePriceUpdateCard */

export function OraclePriceUpdateCard({
    update, tt, onCopy, copiedAddress, onResourceClick, network, locale = 'en',
}: {
    update: OracleUpdate;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    const meta = useEntityData(update.quoteToken, network);
    const symbol = meta?.symbol ?? '';

    return (
        <div className="p-2.5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-col gap-2.5 shadow-sm">
            <div className="flex flex-col gap-1.5 min-w-0">
                <EntityBadge
                    address={update.baseToken}
                    tt={tt}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    onResourceClick={onResourceClick}
                    network={network}
                    locale={locale}
                />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-card-border)]">
                <span className="text-[10px] uppercase font-black text-blue-500 tracking-wider">
                    {tt.oracle_new_price || 'New Price'}
                </span>
                <span className="text-sm font-mono font-black text-blue-400 flex items-center gap-1.5">
                    {update.price}
                    {symbol && (
                        <span className="text-[10px] font-bold text-[var(--color-text-main)] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {symbol}
                        </span>
                    )}
                </span>
            </div>
            <div className="flex items-center justify-between pt-1">
                <span className="text-[8px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider border border-[var(--color-card-border)] px-1.5 py-0.5 rounded-sm">
                    {tt.quote_token || 'Quote Token'}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={update.quoteToken}>
                    {update.quoteToken.slice(0, 16)}...{update.quoteToken.slice(-6)}
                </span>
            </div>
        </div>
    );
}

/* OracleUpdateSection
   Section wrapper + grid of OraclePriceUpdateCards */
export function OracleUpdateSection({
    updates, tt, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    updates: OracleUpdate[];
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    if (updates.length === 0) return null;
    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-blue-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-blue-500/20 bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    {tt.oracle_update_label || 'Oracle Price Update'}
                </span>
                <Pill color="custom" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {updates.length}
                </Pill>
            </h3>
            <div className="p-3 space-y-2">
                {tt.oracle_update_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-3">
                        {tt.oracle_update_desc}
                    </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {updates.map((update, idx: number) => (
                        <OraclePriceUpdateCard
                            key={idx}
                            update={update}
                            tt={tt}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            onResourceClick={onResourceClick}
                            network={network}
                            locale={locale}
                        />
                    ))}
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
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string
}) {
    const meta = useEntityData(airdropData.resource || '', network);
    const symbol = meta?.symbol ?? '';
    const iconUrl = meta?.iconUrl;

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3 shadow-sm divide-y divide-[var(--color-card-border)]">
            <div className="pb-2">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt.airdrop_winner || 'Winner Account'}
                </span>
                <EntityBadge address={airdropData.account} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
            </div>
            <div className="pt-2 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-purple-500 tracking-wider flex items-center gap-1.5 opacity-80">
                        {tt.airdrop_amount || 'Reward Amount'}
                    </span>
                    {airdropData.resource && (
                        <div
                            className="flex items-center gap-1 mt-1 cursor-pointer hover:text-[var(--color-primary)] transition-colors"
                            onClick={() => onResourceClick?.(airdropData.resource!)}
                        >
                            {iconUrl && <img src={iconUrl} alt="Token" className="w-4 h-4 rounded-full bg-white/10" />}
                            <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[120px]" title={airdropData.resource}>
                                {airdropData.resource.slice(0, 8)}...{airdropData.resource.slice(-6)}
                            </span>
                        </div>
                    )}
                </div>
                <span className="text-base font-mono font-black text-purple-400 flex items-center gap-1.5">
                    +{airdropData.amount}
                    {symbol && (
                        <span className="text-xs font-bold text-[var(--color-text-main)] bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {symbol}
                        </span>
                    )}
                </span>
            </div>
            <div className="pt-2 mt-1">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt.airdrop_contract || 'Smart Contract'}
                </span>
                <EntityBadge address={airdropData.component} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
            </div>
            <div className="pt-2 mt-1 flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                    {tt.airdrop_event_id || 'Event ID'}:
                </span>
                <span className="text-[10px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-[var(--color-text-main)] border border-[var(--color-card-border)]">
                    #{airdropData.eventId}
                </span>
            </div>
        </div>
    );
}

export function AirdropSection({
    airdropData, tt, onCopy, copiedAddress, onResourceClick, network, locale,
}: {
    airdropData: AirdropData | null;
    tt: TranslationsT['dashboard']['transactions'];
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
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                    {tt.airdrop_label || 'Airdrop / Rewards'}
                </span>
            </h3>
            <div className="p-3">
                {tt.airdrop_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-3">{tt.airdrop_desc}</p>
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
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
                <Box className="w-3.5 h-3.5 text-amber-400" />
                {te.vault_creation || 'Vault Creation'}
            </h3>
            <div className="p-3 space-y-2">
                {vaultEvents.map((ev, idx) => {
                    const resourceAddress = extractResourceAddress(ev);
                    const vaultId = extractField(ev, 'vault_id');
                    const amount = findEventAmount(events, resourceAddress);

                    return (
                        <VaultCreationCard
                            key={`vault-${idx}`}
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    _onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}) {
    const wellKnownKey = getWellKnownKey(sanitizeText(resource), network);
    const genericKey = !wellKnownKey ? getGenericTooltipKey(sanitizeText(resource)) : null;
    const wellKnownTip = wellKnownKey
        ? tt.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;
    const meta = useEntityData(resource, network);
    const symbol = meta?.symbol || '';
    const clean = sanitizeText(resource);
    const short = clean.length > 20 ? `${clean.slice(0, 12)}...${clean.slice(-6)}` : clean;
    const isResource = clean.startsWith('resource_');
    const isClickable = !!_onResourceClick && isResource;

    return (
        <div className="bg-amber-500/10 border border-amber-500/60 rounded-xl p-3.5 shadow-sm flex flex-col gap-3.5">
            {/* Top Row: Resource Identity & Amount */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {meta?.iconUrl && (
                        <img
                            src={meta.iconUrl}
                            alt={meta.name || 'Token'}
                            className="w-7 h-7 rounded-full bg-white/10 shadow-sm border border-amber-500/20 shrink-0 object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                    <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                            {meta?.name && (
                                <span className="text-xs font-bold truncate text-amber-900 dark:text-amber-100 italic">
                                    {meta.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded border border-amber-500/40 text-amber-800 dark:text-amber-400 bg-amber-500/5 shrink-0 ${wellKnownTip ? 'cursor-help' : ''}`}
                                title={wellKnownTip ?? undefined}
                            >
                                {te.resource || 'Resource'}
                            </span>
                            <span
                                className={`font-mono text-xs truncate text-[var(--color-text-main)] ${isClickable ? 'cursor-pointer hover:text-amber-600 transition-colors underline decoration-amber-500/30 underline-offset-2' : ''}`}
                                title={clean}
                                onClick={() => isClickable && _onResourceClick?.(clean)}
                            >
                                {short}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(clean); }}
                                className="p-1 hover:bg-amber-500/20 rounded transition-colors shrink-0"
                                title={tt.copy_raw || 'Copy'}
                            >
                                {copiedAddress === clean ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-amber-800/40 dark:text-amber-400/40" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simplified Amount Section */}
                {amount && (
                    <div className="flex flex-col items-end shrink-0 ml-auto">
                        <span className="text-[8px] uppercase font-bold text-amber-800/50 dark:text-amber-400/50 tracking-widest leading-none mb-1">
                            {te.amount || 'Amount'}
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
                        <Box className="w-2.5 h-2.5 text-amber-600/60 dark:text-amber-400/60" />
                        <span className="text-[9px] uppercase font-black text-amber-800/60 dark:text-amber-400/60 tracking-wider">
                            {te.vault_id || 'Vault ID'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 px-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-main)] truncate select-all">{vaultId}</span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(vaultId); }}
                            className="hover:text-amber-600 transition-colors shrink-0 p-1"
                            title={tt.copy_raw || 'Copy'}
                        >
                            {copiedAddress === vaultId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-amber-800/30 dark:text-amber-400/30" />}
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
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
                <Vote className="w-3.5 h-3.5 text-blue-400" />
                {te.bet_vote || 'Vote / Prediction'}
            </h3>
            <div className="p-3 space-y-2">
                {voteEvents.map((ev, idx) => {
                    const emitterData = ev.emitter as { entity?: { entity_address: string; entity_type: string }, package_address?: string };
                    const emitter = sanitizeText(emitterData?.entity?.entity_address || emitterData?.package_address || '');
                    const entityType = emitterData?.entity?.entity_type || (emitterData?.package_address ? 'Package' : '');
                    const amount = extractField(ev, 'amount');
                    const option = extractField(ev, 'option') || extractField(ev, 'name');
                    const resourceAddress = extractResourceAddress(ev);

                    return (
                        <BetVoteCard
                            key={`vote-${idx}`}
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
}) {
    const wellKnownKey = resourceAddress ? getWellKnownKey(resourceAddress, network) : null;
    const genericKey = (!wellKnownKey && resourceAddress) ? getGenericTooltipKey(resourceAddress) : null;
    const wellKnownTip = wellKnownKey
        ? tt.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    const emitterKey = getWellKnownKey(emitter, network);
    const genericEmitterKey = !emitterKey ? getGenericTooltipKey(emitter) : null;
    const emitterTip = emitterKey
        ? tt.well_known_tooltips?.[emitterKey as keyof typeof tt.well_known_tooltips]
        : genericEmitterKey
            ? tt.type_tooltips?.[genericEmitterKey as keyof typeof tt.type_tooltips]
            : null;
    const meta = useEntityData(resourceAddress || '', network);
    const symbol = meta?.symbol || '';
    const isBet = eventName === 'BetCreatedEvent';
    const label = isBet ? (te.bet_name || 'Bet Name') : (te.option || 'Option');

    // Mapeo dinámico a traducciones existentes
    const getEntityTypeLabel = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('package')) return tt.entity_type_package || 'Package';
        if (t.includes('component')) return tt.entity_type_component || 'Component';
        if (t.includes('account')) return tt.entity_type_account || 'Account';
        if (t.includes('identity')) return tt.entity_type_identity || 'Identity';
        if (t.includes('resource')) return tt.entity_type_resource || 'Resource';
        if (t.includes('validator')) return tt.entity_type_validator || 'Validator';
        return tt.entity_type_unknown || 'Entity';
    };

    const typeLabel = entityType ? getEntityTypeLabel(entityType) : '';

    return (
        <div className="bg-blue-500/10 border border-blue-500/60 rounded-xl p-3.5 shadow-sm flex flex-col gap-3.5">
            {/* Top Row: Option & Amount */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {meta?.iconUrl && (
                        <img
                            src={meta.iconUrl}
                            alt={meta.name || 'Token'}
                            className="w-7 h-7 rounded-full bg-white/10 shadow-sm border border-blue-500/20 shrink-0 object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] uppercase font-black tracking-wider text-blue-800/60 dark:text-blue-400/60 self-start">
                            {label}
                        </span>
                        {option && option !== resourceAddress && (
                            <span className="text-xs font-bold truncate text-blue-900 dark:text-blue-100 italic">
                                {option}
                            </span>
                        )}
                        {meta?.name && (
                            <span className="text-[10px] font-bold truncate text-blue-900/60 dark:text-blue-100/60 italic">
                                {meta.name}
                            </span>
                        )}
                        {resourceAddress && (
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-xs font-mono truncate text-[var(--color-text-main)] select-all ${wellKnownTip ? 'cursor-help' : ''}`} title={wellKnownTip ?? resourceAddress}>
                                    {resourceAddress.length > 20 ? `${resourceAddress.slice(0, 12)}...${resourceAddress.slice(-6)}` : resourceAddress}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(resourceAddress); }}
                                    className="p-1 hover:bg-blue-500/20 rounded transition-colors shrink-0"
                                    title={tt.copy_raw || 'Copy'}
                                >
                                    {copiedAddress === resourceAddress ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-blue-800/40 dark:text-blue-400/40" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount Highlight */}
                {amount && amount !== '0' && (
                    <div className="flex flex-col items-end shrink-0 ml-auto">
                        <span className="text-[8px] uppercase font-bold text-blue-800/50 dark:text-blue-400/50 tracking-widest leading-none mb-1">
                            {te.amount || 'Amount'}
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
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-black text-blue-800/60 dark:text-blue-400/60 tracking-wider">
                            {te.at || 'at'}
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
                    <div className="flex items-center gap-2 min-w-0 px-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-main)] truncate select-all">{emitter}</span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(emitter); }}
                            className="hover:text-blue-600 transition-colors shrink-0 p-1"
                            title={tt.copy_raw || 'Copy'}
                        >
                            {copiedAddress === emitter ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-blue-800/30 dark:text-blue-400/30" />}
                        </button>
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
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
                <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                {te.rates_changed || 'Rates Update'}
            </h3>
            <div className="p-3 space-y-2">
                {rateEvents.map((ev, idx) => {
                    const emitter = sanitizeText(ev.emitter?.entity?.entity_address || '');
                    const rateType = extractField(ev, 'rate_type');
                    const prev = extractField(ev, 'previous');
                    const curr = extractField(ev, 'current');

                    return (
                        <div key={`rate-${idx}`} className="p-3 bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl shadow-sm flex flex-col gap-3">
                            <EntityBadge address={emitter} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} locale={locale} />
                            <div className="flex items-center justify-between gap-4 py-1.5 px-2 bg-teal-500/5 rounded-lg border border-teal-500/20">
                                <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wide">{rateType}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-bold text-[var(--color-text-muted)]">{prev}%</span>
                                    <ArrowRight className="w-3 h-3 text-teal-500 opacity-50" />
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
    tt: TranslationsT['dashboard']['transactions'];
    te: TranslationsT['events'];
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

    // Agrupar por entidad emisora
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
        if (k === 'account_type') return te.account_type || 'Account Type';
        if (k === 'name') return te.name_tag || 'Name';
        if (k === 'tags') return te.tags || 'Tags';
        if (k === 'claimed_entities') return te.claimed_entities || 'Claimed Entities';
        if (k === 'info_url') return te.info_url || 'Info URL';
        if (k === 'icon_url') return te.icon_url || 'Icon URL';
        if (k === 'description') return te.description || 'Description';
        return k;
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-indigo-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-indigo-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                {te.set_metadata || 'Profile/Config Update'}
            </h3>
            <div className="p-4 flex flex-col gap-4">
                {Object.values(grouped).map((grp, idx) => (
                    <MetadataEntityBlock
                        key={`meta-grp-${idx}`}
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
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
}) {
    const meta = useEntityData(emitter, network);

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
    const orderedUpdates = orderedKeys.map(k => validUpdates.find(u => u.key === k)).filter(Boolean) as {key: string, value: string}[];
    const restUpdates = validUpdates.filter(u => !orderedKeys.includes(u.key) && u.key !== 'name');
    
    const displayUpdates = [...orderedUpdates, ...restUpdates];

    return (
        <div className="flex flex-col sm:flex-row items-start gap-4 pb-4 last:pb-0 border-b border-[var(--color-card-border)] last:border-0 border-dashed">
            {/* Left side: Circular Image */}
            <div className="shrink-0 mt-0.5">
                {resolvedIconUrl ? (
                    <img 
                        src={resolvedIconUrl} 
                        alt={resolvedName || 'Entity Icon'} 
                        className="w-12 h-12 rounded-full bg-[var(--color-surface)] shadow-sm object-cover border border-[var(--color-card-border)]"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center">
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
                    <span className="text-xs font-mono text-[var(--color-text-muted)] select-all truncate" title={emitter}>
                        {emitter.length > 40 ? `${emitter.slice(0, 15)}...${emitter.slice(-15)}` : emitter}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCopy(emitter); }}
                        className="p-1 hover:bg-slate-500/10 rounded transition-colors shrink-0"
                        title={tt.copy_raw || 'Copy'}
                    >
                        {copiedAddress === emitter ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                    </button>
                </div>

                {/* The rest in specific order */}
                <div className="flex flex-col gap-0.5 text-xs">
                    {displayUpdates.map((u, i) => (
                        <div key={`param-${i}`} className="flex flex-col sm:flex-row sm:items-start sm:gap-1">
                            <span className="font-semibold text-[var(--color-text-main)] capitalize shrink-0">
                                {translateKey(u.key)}:
                            </span>
                            {u.key === 'info_url' ? (
                                <a 
                                    href={u.value.startsWith('http') ? u.value : `https://${u.value}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="font-mono text-blue-500 hover:underline break-all mt-0.5 sm:mt-0"
                                >
                                    {u.value}
                                </a>
                            ) : (
                                <span className="font-mono text-[var(--color-text-muted)] break-all mt-0.5 sm:mt-0">
                                    {u.value}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
