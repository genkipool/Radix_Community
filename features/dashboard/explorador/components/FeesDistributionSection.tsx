'use client';

import React from 'react';
import { parseFloatSafe } from '../../utils/resourceUtils';

import { Check, Copy, ChevronDown, Coins } from 'lucide-react';

import { sanitizeText } from '@/utils/sanitize';
import { BalanceChangeRow } from './BalanceChangeRow';
import { AddressDisplay, EntityBadge, ValidatorNameLabel } from './EntityBadge';
import { isConsensusManager } from '@/features/dashboard/hooks/useEntityData';
import {
    IconFlame, IconMedal, IconBolt, IconGem, IconTip,
} from './TransactionIcons';
import { getXrdAddress } from '../constants';

import type { FungibleChange } from '@/features/dashboard/types/shared.types';
import type {
    RoyaltyRecipientObj,
    ValidatorSetObj,
    ValueWithXrd
} from '../types/gateway.types';

/* ─── Helper ─────────────────────────────── */
const fmtAmt = (v: number) => v.toFixed(4).replace(/\.?0+$/, '');

import { useQueryClient } from '@tanstack/react-query';
import { resolveProposerInfo, findProposerValidator } from '../utils/proposerUtils';

/* ─── Props ──────────────────────────────── */
import { FeesDistributionSectionProps } from '../types';


/* ═════════════════════════════════════════
   FeesDistributionSection
   Left  → account(s) that paid fees + cost breakdown
   Right → Burn · Proposer · Validator Set · Royalties · Tips
═════════════════════════════════════════ */
export function FeesDistributionSection({
    details, tx, tt, onCopy, copiedAddress, onResourceClick, readingMode, network, columns, locale,
}: FeesDistributionSectionProps) {
    const allFeeChanges = details.balance_changes?.fungible_fee_balance_changes ?? [];

    const accountPayers = allFeeChanges.filter(
        (fc) => !isConsensusManager(sanitizeText((fc.entity_address as string) || '')),
    );
    const cmEntry = allFeeChanges.find((fc) =>
        isConsensusManager(sanitizeText(String(fc.entity_address || ''))),
    );
    const cmAmount = Math.abs(parseFloatSafe(cmEntry?.balance_change));

    const qc = useQueryClient();
    const validatorsData = qc.getQueryData<{ validators: import('@/types/radix').Validator[] }>(['validators', network ?? 'mainnet']);
    const proposerInfo = resolveProposerInfo(details);
    const proposerValidator = proposerInfo && validatorsData?.validators
        ? findProposerValidator(proposerInfo, validatorsData.validators)
        : null;
    const proposerAddr = proposerValidator?.address ?? null;
    if (accountPayers.length === 0 && cmAmount <= 0) return null;

    /* ── fee_destination (supports both flat strings and nested objects) ── */
    const fd = details.receipt?.fee_destination ?? null;
    const pick = (a: unknown, b: unknown, c: unknown): number =>
        parseFloatSafe(typeof a === 'string' ? a : (b ?? c ?? 0));

    const fdBurn = fd?.to_burn as ValueWithXrd | string | undefined;
    const fdToBurn = fd?.toBurn as ValueWithXrd | string | undefined;
    const burnAmt = pick(fdBurn, (fdBurn as ValueWithXrd)?.xrd_amount ?? (fdToBurn as ValueWithXrd)?.xrdAmount, fdToBurn ?? 0);

    const fdProposer = fd?.to_proposer as ValueWithXrd | string | undefined;
    const fdToProposer = fd?.toProposer as ValueWithXrd | string | undefined;
    const proposerAmt = pick(fdProposer, (fdProposer as ValueWithXrd)?.xrd_amount ?? (fdToProposer as ValueWithXrd)?.xrdAmount, fdToProposer ?? 0);

    const fdValSetRaw = (fd?.to_validator_set ?? fd?.toValidatorSet) as ValidatorSetObj | string | undefined;
    let validatorAmt = 0;
    let fdValShares: Array<Record<string, unknown>> = [];
    if (typeof fdValSetRaw === 'string') {
        validatorAmt = parseFloatSafe(fdValSetRaw);
    } else if (fdValSetRaw) {
        fdValShares = fdValSetRaw.shares ?? [];
        validatorAmt = fdValShares.length > 0
            ? fdValShares.reduce((s: number, v) => s + parseFloatSafe(String(v.xrd_amount ?? v.xrdAmount)), 0)
            : parseFloatSafe(fdValSetRaw.xrd_amount ?? fdValSetRaw.xrdAmount);
    }

    const fdRoyaltyRecipients = (fd?.to_royalty_recipients ?? fd?.toRoyaltyRecipients ?? []) as Array<string | RoyaltyRecipientObj>;
    const royaltyAmtFromFD = Array.isArray(fdRoyaltyRecipients)
        ? fdRoyaltyRecipients.reduce((s: number, r) =>
            s + parseFloatSafe(typeof r === 'string' ? r : (r.xrd_amount ?? r.xrdAmount ?? r.amount)), 0)
        : 0;

    const feeSummary = details.receipt?.fee_summary ?? null;
    const tippingAmt = parseFloatSafe(feeSummary?.xrd_total_tipping_cost);
    const execCost = parseFloatSafe(feeSummary?.xrd_total_execution_cost);
    const storageCost = parseFloatSafe(feeSummary?.xrd_total_storage_cost);
    const finalizationCost = parseFloatSafe(feeSummary?.xrd_total_finalization_cost);
    const royaltyCost = parseFloatSafe(feeSummary?.xrd_total_royalty_cost);

    const royaltyAmtFromFees = allFeeChanges
        .filter(fc => fc.type === 'RoyaltyDistributed')
        .reduce((s, fc) => s + Math.abs(parseFloatSafe(fc.balance_change)), 0);

    const royaltyAmt = Math.max(royaltyAmtFromFD, royaltyAmtFromFees, royaltyCost);

    const costingParams = details.receipt?.costing_parameters ?? null;
    const xrdUsdPrice = parseFloatSafe(costingParams?.xrd_usd_price);

    const hasFeeDestination = burnAmt > 0 || proposerAmt > 0 || validatorAmt > 0;
    const finalBurn = hasFeeDestination ? burnAmt : cmAmount;
    const finalProposer = hasFeeDestination ? proposerAmt : cmAmount / 2;
    const finalValidator = hasFeeDestination ? validatorAmt : cmAmount / 2;
    const totalFee = parseFloatSafe(tx.feePaid);

    const rawEntities = details.affected_global_entities ?? [];
    const sourcePackages = Array.from(new Set([
        ...rawEntities
            .map((e) => sanitizeText(typeof e === 'string' ? e : (e?.address || '')))
            .filter(addr => addr.startsWith('package_')),
        ...allFeeChanges
            .filter(fc => fc.type === 'RoyaltyDistributed')
            .map(fc => sanitizeText(fc.entity_address || ''))
            .filter(addr => addr.startsWith('package_'))
    ]));

    const filteredRoyaltyRecipients = Array.isArray(fdRoyaltyRecipients)
        ? (fdRoyaltyRecipients as RoyaltyRecipientObj[]).filter((r) => {
            const addr = sanitizeText(
                r.royalty_recipient?.entity_address ??
                r.royalty_recipient?.entityAddress ??
                r.recipient_address ??
                r.recipientAddress ??
                r.recipient_component_address ?? '',
            );
            return !sourcePackages.includes(addr);
        })
        : [];


    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mt-4">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center">
                <span className="flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    {tt.fees_distribution || 'Fees Distributed'}
                </span>
            </h3>

            <div className={`flex flex-col ${columns === 2 ? '' : 'md:flex-row'} divide-y ${columns === 2 ? 'divide-y' : 'md:divide-y-0 md:divide-x'} divide-[var(--color-card-border)]`}>

                {/* ── LEFT: payers + cost breakdown ── */}
                <div className="flex-1 p-3 bg-red-500/3">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[#ef4444] mb-3 flex items-center gap-1.5 opacity-80">
                        <ChevronDown className="w-3 h-3 -rotate-180" />
                        {tt.fees_from_label || 'Fees Paid'}
                    </h5>

                    <div className="space-y-3">
                        {accountPayers.length > 0
                            ? accountPayers.map((fc, i: number) => {
                                const isRoyalty = fc.type === 'RoyaltyDistributed';
                                return (
                                    <div key={'fp' + i} className="space-y-1.5 transition-colors">
                                        <AddressDisplay
                                            label={isRoyalty ? (tt.fees_royalty_package || 'Royalty Recipient') : String(tt.from_address || 'From')}
                                            address={sanitizeText(fc.entity_address || '')}
                                            tt={tt}
                                            onCopy={onCopy}
                                            copiedAddress={copiedAddress}
                                            network={network}
                                            hideLabel={true}
                                        />
                                        <div className="pt-1.5">
                                            <BalanceChangeRow
                                                change={{
                                                    ...fc,
                                                    resource_address: fc.resource_address || getXrdAddress(network),
                                                    is_fee: true
                                                } as FungibleChange}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                readingMode={readingMode}
                                                network={network}
                                                locale={locale}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                            : <p className="text-xs text-[var(--color-text-muted)] italic py-2">{tt.system_generation || 'System component generation'}</p>
                        }
                    </div>

                    {feeSummary && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                                { label: tt.fee_execution || 'Execution', value: execCost, color: 'text-cyan-600', border: 'border-cyan-500/30', bg: 'bg-cyan-500/6', title: tt.fee_execution_title || 'Computational cost of processing the transaction logic.' },
                                { label: tt.fee_storage || 'Storage', value: storageCost, color: 'text-amber-600', border: 'border-amber-500/30', bg: 'bg-amber-500/6', title: tt.fee_storage_title || `Cost of storing data on-ledger.${xrdUsdPrice > 0 ? ` XRD/USD: $${xrdUsdPrice.toFixed(2)}` : ''}` },
                                { label: tt.fee_finalization || 'Finalization', value: finalizationCost, color: 'text-indigo-600', border: 'border-indigo-500/30', bg: 'bg-indigo-500/6', title: tt.fee_finalization_title || 'Cost of signature verification and finalization.' },
                                ...(royaltyCost > 0 ? [{ label: tt.fee_royalties || 'Royalties', value: royaltyCost, color: 'text-purple-600', border: 'border-purple-500/30', bg: 'bg-purple-500/6', title: tt.fee_royalty_cost_title || '100% paid to the Blueprint/Component developer.' }] : []),
                                ...(tippingAmt > 0 ? [{ label: tt.fee_tipping || 'Tips', value: tippingAmt, color: 'text-[var(--color-accent)]', border: 'border-[var(--color-primary)]/30', bg: 'bg-[var(--color-primary)]/5', title: tt.fee_tips_cost_title || '100% goes to the block proposer validator.' }] : []),
                            ].map(item => (
                                <div key={item.label}
                                    className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-lg border ${item.border} ${item.bg}`}
                                    title={item.title}
                                >
                                    <span className={`text-[10px] uppercase font-black tracking-widest ${item.color}`}>{item.label}</span>
                                    <span className="text-[13px] font-mono font-black text-[var(--color-text-main)]">{fmtAmt(item.value)} XRD</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── RIGHT: distribution breakdown ── */}
                <div className="flex-1 p-3 bg-green-500/3">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[#16a34a] mb-3 flex items-center gap-1.5 opacity-80">
                        <ChevronDown className="w-3 h-3" />
                        {tt.fees_breakdown || 'Breakdown'}
                    </h5>

                    <div className="space-y-2">
                        {finalBurn > 0 && (
                            <FeeRow
                                icon={<IconFlame className="w-4 h-4 text-orange-600 shrink-0" />}
                                label={tt.fees_burn || 'Burn'} pct="50%"
                                amount={finalBurn} color="orange"
                                title={tt.fees_burn_title || 'XRD permanently removed from total supply.'}
                                desc={tt.fees_burn_desc || 'XRD permanently removed from supply'}
                                border="border-orange-500/40" bg="bg-orange-500/10"
                            />
                        )}

                        {finalProposer > 0 && (
                            <div
                                className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3"
                                title={String(tt.fees_proposer_title || 'XRD awarded to the validator that proposed this block.')}
                            >
                                <FeeRowHeader
                                    icon={<IconMedal className="w-4 h-4 text-blue-600 shrink-0" />}
                                    label={tt.fees_proposer || 'Proposer'} pct="25%"
                                    amount={finalProposer} color="blue"
                                />
                                <p className="text-[10px] text-[var(--color-text-muted)] italic">
                                    {tt.fees_proposer_desc || 'XRD awarded to the block proposer validator'}
                                </p>
                                {proposerAddr && (
                                    <div className="mt-2.5 pl-2.5 border-l-2 border-blue-500/40 bg-blue-500/5 py-1 rounded-r-lg">
                                        <div className="flex items-center justify-between text-[10px] gap-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] uppercase font-black text-blue-600/60 leading-none">
                                                    {tt.fees_proposer_validator || 'Proposer Validator'}
                                                </span>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <ValidatorNameLabel address={proposerAddr} network={network} hideParentheses />
                                                    <CopyIconBtn address={proposerAddr} onCopy={onCopy} copiedAddress={copiedAddress} variant="ghost" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {finalValidator > 0 && (
                            <div
                                className="rounded-xl border border-green-500/40 bg-green-500/6 p-3"
                                title={String(tt.fees_validator_title || '25% distributed among the active validator set.')}
                            >
                                <FeeRowHeader
                                    icon={<IconBolt className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />}
                                    label={tt.fees_validator_set || 'Validator Set'} pct="25%"
                                    amount={finalValidator} color="green"
                                />
                                <p className="text-[10px] text-[var(--color-text-muted)] italic">
                                    {tt.fees_validator_set_desc || 'XRD distributed among the validator set'}
                                </p>
                                {fdValShares.length > 0 && (
                                    <div className="mt-2.5 space-y-1.5 pl-2.5 border-l-2 border-green-500/40 bg-green-500/3 py-1.5 rounded-r-lg">
                                        <span className="text-[8px] uppercase font-black text-green-700/70 dark:text-green-400/80 block mb-1">
                                            {tt.fees_top_recipients || 'Top Recipients'}
                                        </span>
                                        {fdValShares.slice(0, 5).map((s, si: number) => {
                                            const addr = sanitizeText(String(s.validator_address ?? s.validatorAddress ?? ''));
                                            const amt = parseFloatSafe(s.xrd_amount ?? s.xrdAmount);
                                            if (!addr || amt <= 0) return null;
                                            return (
                                                <div key={'vs' + si} className="flex items-center justify-between text-[10px] group/vs gap-2">
                                                    <ValidatorNameLabel address={addr} network={network} />
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-green-600 font-mono font-black">{fmtAmt(amt)} XRD</span>
                                                        <CopyIconBtn address={addr} onCopy={onCopy} copiedAddress={copiedAddress} groupHide />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {fdValShares.length > 5 && (
                                            <p className="text-[10px] text-[var(--color-text-muted)] italic">
                                                + {fdValShares.length - 5} more
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {royaltyAmt > 0 && (
                            <div
                                className="rounded-xl border border-purple-500/30 bg-purple-500/3 p-3"
                                title={String(tt.fees_royalty_title || '100% to royalty recipients.')}
                            >
                                <FeeRowHeader
                                    icon={<IconGem className="w-4 h-4 text-purple-600 shrink-0" />}
                                    label={tt.fees_royalty || 'Royalties'} pct="100%"
                                    amount={royaltyAmt} color="purple"
                                />
                                <p className="text-[10px] text-[var(--color-text-muted)] italic">
                                    {tt.fees_royalty_desc || 'XRD distributed to royalty recipients'}
                                </p>
                                {sourcePackages.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
                                        <span className="text-[8px] uppercase font-black text-purple-600/60 block">
                                            {tt.fees_royalty_package || 'Source Package'}
                                        </span>
                                        <div className="grid grid-cols-1 gap-2">
                                            {sourcePackages.map((addr, i) => (
                                                <EntityBadge key={'rp' + i} address={addr} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {filteredRoyaltyRecipients.length > 0 && (
                                    <div className="mt-4 space-y-1.5 pl-2.5 border-l-2 border-purple-500/40 bg-purple-500/3 py-1.5 rounded-r-lg">
                                        <span className="text-[8px] uppercase font-black text-purple-600/60 block mb-1">
                                            {tt.fees_recipients || 'Recipients'}
                                        </span>
                                        {filteredRoyaltyRecipients.slice(0, 5).map((r, ri: number) => {
                                            const item = r as RoyaltyRecipientObj;
                                            const addr = sanitizeText(
                                                item?.royalty_recipient?.entity_address ?? item?.royalty_recipient?.entityAddress ??
                                                item?.recipient_address ?? item?.recipientAddress ?? item?.recipient_component_address ?? '',
                                            );
                                            const amt = parseFloatSafe(typeof r === 'string' ? r : (r?.xrd_amount ?? r?.xrdAmount));
                                            if (!addr) return null;
                                            return (
                                                <div key={'rr' + ri} className="space-y-1">
                                                    <EntityBadge address={addr} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} />
                                                    {amt > 0 && (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="text-[8px] uppercase font-black text-purple-600/40">{tt.amount_label || 'Amount'}</span>
                                                            <span className="text-purple-600 font-mono font-black text-xs">{fmtAmt(amt)} XRD</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary footer */}
            <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-card-border)] text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-tight">
                <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6">
                    {accountPayers.map((fc, i: number) => {
                        const amt = Math.abs(parseFloatSafe(fc.balance_change));
                        return <span key={'fs' + i} className="flex items-center gap-1.5"><span className="text-red-500 font-black">-{fmtAmt(amt)}</span> {tt.sent_label || 'sent'}</span>;
                    })}
                    {finalBurn > 0 && <FooterItem icon={<IconFlame className="w-3.5 h-3.5 text-orange-600" />} value={fmtAmt(finalBurn)} color="text-orange-600" label={tt.fees_burn || 'Burn'} />}
                    {finalProposer > 0 && <FooterItem icon={<IconMedal className="w-3.5 h-3.5 text-blue-600" />} value={fmtAmt(finalProposer)} color="text-blue-600" label={tt.fees_proposer || 'Proposer'} />}
                    {finalValidator > 0 && <FooterItem icon={<IconBolt className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />} value={fmtAmt(finalValidator)} color="text-green-700 dark:text-green-400" label={tt.fees_validator_set || 'Validator'} />}
                    {tippingAmt > 0 && <FooterItem icon={<IconTip className="w-3.5 h-3.5 text-[var(--color-accent)]" />} value={fmtAmt(tippingAmt)} color="text-[var(--color-accent)]" label={tt.fees_tips || 'Tips'} />}
                    {royaltyAmt > 0 && <FooterItem icon={<IconGem className="w-3.5 h-3.5 text-purple-600" />} value={fmtAmt(royaltyAmt)} color="text-purple-600" label={tt.fees_royalty || 'Royalties'} />}
                    <div className="h-4 w-px bg-[var(--color-card-border)] mx-1 hidden md:block" />
                    <span className="flex items-center gap-1.5 font-black text-[var(--color-text-main)]">
                        {tt.fees_total || 'Total'}: <span className="text-amber-600 text-xs">{fmtAmt(totalFee)} XRD</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ─── Internal atoms ─────────────────────── */

function FeeRow({
    icon, label, pct, amount, color, title, desc, border, bg,
}: {
    icon: React.ReactNode; label: string; pct: string; amount: number;
    color: string; title: string; desc: string; border: string; bg: string;
}) {
    return (
        <div className={`rounded-xl border ${border} ${bg} p-3`} title={title}>
            <FeeRowHeader icon={icon} label={label} pct={pct} amount={amount} color={color} />
            <p className="text-[10px] text-[var(--color-text-muted)] italic">{desc}</p>
        </div>
    );
}

const COLOR_CLASSES: Record<string, { text: string; bg: string; border: string }> = {
    orange: { text: 'text-orange-600', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    green: { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
    purple: { text: 'text-purple-600', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
    pink: { text: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-primary)]/10', border: 'border-[var(--color-primary)]/30' },
};

function FeeRowHeader({
    icon, label, pct, amount, color,
}: {
    icon: React.ReactNode; label: string; pct: string; amount: number; color: string;
}) {
    const cc = COLOR_CLASSES[color] ?? COLOR_CLASSES.orange;
    return (
        <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
                {icon}
                <span className={`text-xs font-bold ${cc.text} inline-flex items-center h-5 leading-none pt-[1px]`}>{label}</span>
                <span className={`text-[9px] font-mono px-1.5 rounded-md ${cc.bg} ${cc.text} border ${cc.border} font-bold inline-flex items-center h-5 leading-none pt-[2px]`}>{pct}</span>
            </div>
            <span className={`font-mono font-black text-sm ${cc.text}`}>{fmtAmt(amount)} XRD</span>
        </div>
    );
}

function CopyIconBtn({
    address, onCopy, copiedAddress, groupHide = false, variant = 'default',
}: {
    address: string; onCopy: (v: string) => void; copiedAddress: string | null; groupHide?: boolean; variant?: 'default' | 'ghost';
}) {
    const isGhost = variant === 'ghost';
    return (
        <button
            type="button"
            onClick={e => { e.stopPropagation(); onCopy(address); }}
            className={`p-1 rounded transition-colors ${
                isGhost 
                ? 'bg-transparent border-none' 
                : 'bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-sm'
            } ${copiedAddress === address ? 'text-green-500' : `text-[var(--color-text-muted)] ${groupHide ? 'opacity-0 group-hover/vs:opacity-100' : ''} hover:text-[var(--color-text-main)]`
                }`}
        >
            {copiedAddress === address ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
    );
}

function FooterItem({
    icon, value, color, label,
}: {
    icon: React.ReactNode; value: string; color: string; label: string;
}) {
    return (
        <span className="flex items-center gap-1.5">
            {icon}
            <span className={`${color} font-black`}>{value}</span>
            {label}
        </span>
    );
}
