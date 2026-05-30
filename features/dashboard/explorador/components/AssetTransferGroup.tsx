'use client';

import React, { useState } from 'react';
import type { AssetTransferGroupProps } from '@/features/dashboard/explorador/types';
import { Wallet, Info, Landmark } from 'lucide-react';
import { BalanceChangeRow } from '@/features/dashboard/explorador/components/BalanceChangeRow';
import { NftTransferCard } from '@/features/dashboard/explorador/components/NftTransferCard';
import { AddressDisplay } from '@/features/dashboard/explorador/components/EntityBadge';
import { SourceBadge } from '@/features/dashboard/explorador/components/SourceBadge';
import { ValidatorInlinePanel } from '@/features/dashboard/explorador/components/ValidatorInlinePanel';
import { TransferFooter } from '@/features/dashboard/explorador/components/TransferFooter';
import { isConsensusManager } from '@/features/dashboard/hooks/useEntityData';
import { sanitizeText } from '@/utils/sanitize';
import { classifySource } from '../utils/parseManifest';
import { getXrdAddress } from '../constants';


import { IconFlame } from './TransactionIcons';
import { TransactionFlowInfoModal } from './TransactionFlowInfoModal';

export function AssetTransferGroup({
    group, balanceChanges, initiators, realTransferAddresses,
    actualFeePaid, tt: _tt, t,
    onCopy, copiedAddress, onResourceClick, formatEntity, readingMode, network,
    isClaim, isUnstake, isStake, validatorOps, pairedValidatorOp, pairedNftChange, columns,
    locale,
}: AssetTransferGroupProps) {
    const tt = _tt;
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // Only account_ addresses can be origins; everything else goes to destination.
    const originActors = group.filter(c => {
        if (!sanitizeText(c.entity_address).startsWith('account_')) return false;

        const isOrigin = initiators.has(sanitizeText(c.entity_address));
        if (!isOrigin) return false;

        // If it's NOT a fee, it's always included
        if (!c.is_fee) return true;

        // If it IS a fee:
        // 1. If the address has a REAL (non-fee) change IN THIS GROUP, the fee is nested elsewhere in this component,
        //    so we don't show it as a standalone sender row.
        const hasRealInGroup = group.some(oc => oc.entity_address === c.entity_address && !oc.is_fee);
        if (hasRealInGroup) return false;

        // 2. If the address has a REAL (non-fee) change in ANY OTHER group, the fee is nested in THAT other card,
        //    so we don't show it as a standalone sender row here in the XRD card.
        const hasRealInWholeTx = realTransferAddresses.has(sanitizeText(c.entity_address));
        if (hasRealInWholeTx) return false;

        return true;
    });

    const destActors = group.filter(c => {
        // Non-account addresses always go to destination
        if (!sanitizeText(c.entity_address).startsWith('account_')) {
            if (!c.is_fee) return true;
            const hasRealInGroup = group.some(oc => oc.entity_address === c.entity_address && !oc.is_fee);
            if (hasRealInGroup) return false;
            const hasRealInWholeTx = realTransferAddresses.has(sanitizeText(c.entity_address));
            return !hasRealInWholeTx;
        }

        const isOrigin = initiators.has(sanitizeText(c.entity_address));
        if (isOrigin) return false;

        if (!c.is_fee) return true;

        const hasRealInGroup = group.some(oc => oc.entity_address === c.entity_address && !oc.is_fee);
        if (hasRealInGroup) return false;

        const hasRealInWholeTx = realTransferAddresses.has(sanitizeText(c.entity_address));
        if (hasRealInWholeTx) return false;

        return true;
    });

    // If after filtering we have NO actors, we hide the whole card.
    // This happens for a group (usually XRD) that only contains fees for addresses already shown in other cards.
    if (originActors.length === 0 && destActors.length === 0) return null;

    const isStakingInferred = isClaim || isUnstake || isStake;

    const isFungibleBurned = (resAddress: string) => {
        return !(balanceChanges.fungible_balance_changes ?? []).some(
            c => c.resource_address === resAddress && parseFloat(c.balance_change) > 0
        );
    };

    return (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mb-4 last:mb-0">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-[var(--color-primary)]" />
                    {tt?.asset_transfer || 'Asset Transfers'}
                </div>
                <button
                    type="button"
                    onClick={() => setIsInfoModalOpen(true)}
                    className="p-1 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border border-transparent group"
                    title={tt?.tx_flow_info_title || 'How to read our transaction flow'}
                >
                    <Info className="size-3.5 group-hover:scale-110 transition-transform" />
                </button>
            </h3>

            <div className={`flex flex-col ${columns === 2 ? '' : 'md:flex-row'} divide-y ${columns === 2 ? 'divide-y' : 'md:divide-y-0 md:divide-x'} divide-[var(--color-card-border)]`}>

                {/* ── ORIGIN column ── */}
                <div className="flex-1 p-3 bg-blue-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="size-3" />
                        {tt?.from_address || 'Origin (Sent)'}
                    </h5>
                    <div className="space-y-3">
                        {originActors.length > 0
                            ? originActors.map((change) => {
                                const matchingFee = balanceChanges.fungible_fee_balance_changes?.find((f) => sanitizeText(f.entity_address) === sanitizeText(change.entity_address));
                                const nftWithdrawals = (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => nft.entity_address === change.entity_address && (nft.removed?.length ?? 0) > 0);
                                // NFT deposits that belong to this origin address — show them here instead of destination
                                const nftDepositsForOrigin = (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => nft.entity_address === change.entity_address && (nft.added?.length ?? 0) > 0);
                                const isCM = isConsensusManager(change.entity_address);

                                const fungibleBurned = isFungibleBurned(change.resource_address) && !change.is_fee;

                                return (
                                    <div key={'s-' + change.entity_address + '-' + change.resource_address} className={isCM ? 'rounded-xl border border-blue-500/20 bg-blue-500/5 p-2' : ''}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1 pl-2">
                                                <AddressDisplay label={tt?.from_address || 'From'} address={change.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} showConsensusInfo={isCM} network={network} hideLabel={true} />
                                            </div>
                                            {(() => {
                                                if (!change.entity_address.startsWith('account_')) return null;
                                                const hasPositiveFungible = parseFloat(change.balance_change || '0') > 0;
                                                const hasPositiveNft = (balanceChanges.non_fungible_balance_changes ?? []).some((nft) => nft.entity_address === change.entity_address && (nft.added?.length ?? 0) > 0);
                                                if (!hasPositiveFungible && !hasPositiveNft) return null;

                                                const resourceSenders = group.filter(c =>
                                                    c.resource_address === change.resource_address &&
                                                    parseFloat(c.balance_change || '0') < 0 &&
                                                    !c.is_fee
                                                );
                                                const { method, title, color, bg } = classifySource(resourceSenders, tt, { isStakingTx: isStakingInferred });
                                                return <SourceBadge method={method} color={color} bg={bg} title={title} label={tt?.method_label || 'Recibido vía:'} />;
                                            })()}
                                        </div>
                                        <div className="space-y-1">
                                            <BalanceChangeRow
                                                change={change}
                                                t={t}
                                                onResourceClick={onResourceClick}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                readingMode={readingMode}
                                                network={network}
                                                side="sender"
                                                locale={locale}
                                                hideSign={fungibleBurned}
                                                iconOverride={fungibleBurned ? <IconFlame className="text-orange-600 dark:text-orange-400 size-3.5" /> : undefined}
                                                colorOverride={fungibleBurned ? "text-orange-600 dark:text-orange-400" : undefined}
                                            />

                                            {matchingFee && !change.is_fee && (
                                                /* Only show fee under the first resource (XRD) for staking txs to avoid redundancy */
                                                !(isStake && change.resource_address !== getXrdAddress(network)) && (
                                                    <div className="pl-4 border-l-2 border-[var(--color-card-border)] opacity-80 scale-95 origin-left">
                                                        <BalanceChangeRow change={{ ...matchingFee, resource_address: matchingFee.resource_address || getXrdAddress(network), is_fee: true }} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="sender" locale={locale} />
                                                    </div>
                                                )
                                            )}
                                            {nftWithdrawals.map((nft) => {
                                                const allAddedIds = new Set((balanceChanges.non_fungible_balance_changes ?? []).flatMap(c => c.added ?? []));
                                                const isBurnedNft = (nft.removed || []).every(id => !allAddedIds.has(id));
                                                return <NftTransferCard key={'nft-s-' + nft.resource_address} resourceAddress={nft.resource_address} ids={nft.removed || []} type="removed" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="sender" locale={locale} isBurned={isBurnedNft} />;
                                            })}
                                            {/* NFT deposits for this origin address — consolidated here */}
                                            {nftDepositsForOrigin.map((nft) => (
                                                <NftTransferCard key={'nft-s-dep-' + nft.resource_address} resourceAddress={nft.resource_address} ids={nft.added || []} type="added" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="sender" locale={locale} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                            : <div className="text-xs text-[var(--color-text-muted)] italic py-2">{tt?.system_generation || 'System component generation'}</div>
                        }
                        {/* Orphan NFT withdrawals — skipped for claim txs (already shown inline with address above) */}
                        {(() => {
                            if (isClaim) return null;
                            const senderAddrs = new Set(originActors.map((s) => s.entity_address));
                            const orphans = (balanceChanges.non_fungible_balance_changes ?? [])
                                .filter((nft) => (nft.removed?.length ?? 0) > 0 && !senderAddrs.has(nft.entity_address) && sanitizeText(nft.entity_address).startsWith('account_'));
                            return orphans.map((nft) => {
                                const matchedOp = isClaim && validatorOps ? (validatorOps[0]) : undefined;
                                const allAddedIds = new Set((balanceChanges.non_fungible_balance_changes ?? []).flatMap(c => c.added ?? []));
                                const isBurnedNft = (nft.removed || []).every(id => !allAddedIds.has(id));
                                return (
                                    <div key={'nft-orphan-s-' + nft.resource_address}>
                                        <div className="pl-2 mb-2">
                                            <AddressDisplay label={tt?.from_address || 'From'} address={nft.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                        </div>
                                        <div className="mt-2">
                                            <NftTransferCard
                                                resourceAddress={nft.resource_address}
                                                ids={nft.removed || []}
                                                type="removed"
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                formatEntity={formatEntity}
                                                onResourceClick={onResourceClick}
                                                readingMode={readingMode}
                                                network={network}
                                                tt={tt}
                                                side="sender"
                                                isClaim={isClaim}
                                                claimXrdTotal={matchedOp?.claimXrd as number}
                                                locale={locale}
                                                isBurned={isBurnedNft}
                                            />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* ── DESTINATION column ── */}
                <div className="flex-1 p-3 bg-[var(--color-accent)]/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[var(--color-accent)] mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="size-3" />
                        {tt?.to_address || 'Destination (Received)'}
                    </h5>
                    <div className="space-y-3">
                        {destActors.length > 0
                            ? destActors.map((change) => {
                                const nftDeposits = (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => nft.entity_address === change.entity_address && (nft.added?.length ?? 0) > 0);
                                const isPayerInOrigin = initiators.has(sanitizeText(change.entity_address));
                                const recipientFee = !isPayerInOrigin
                                    ? balanceChanges.fungible_fee_balance_changes?.find((f) => sanitizeText(f.entity_address) === sanitizeText(change.entity_address))
                                    : null;
                                return (
                                    <div key={'r-' + change.entity_address + '-' + change.resource_address}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1 pl-2">
                                                <AddressDisplay label={tt?.to_address || 'To'} address={change.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                            </div>
                                            {(() => {
                                                if (!change.entity_address.startsWith('account_')) return null;
                                                const hasPositiveFungible = parseFloat(change.balance_change || '0') > 0;
                                                const hasPositiveNft = nftDeposits.length > 0;
                                                if (!hasPositiveFungible && !hasPositiveNft) return null;

                                                const resourceSenders = group.filter(c =>
                                                    c.resource_address === change.resource_address &&
                                                    parseFloat(c.balance_change || '0') < 0 &&
                                                    !c.is_fee
                                                );
                                                const { method, title, color, bg } = classifySource(resourceSenders, tt, { isStakingTx: isStakingInferred });
                                                return <SourceBadge method={method} color={color} bg={bg} title={title} label={tt?.method_label || 'Recibido vía:'} />;
                                            })()}
                                        </div>
                                        <div className="space-y-1">
                                            <BalanceChangeRow
                                                change={change}
                                                t={t}
                                                onResourceClick={onResourceClick}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                readingMode={readingMode}
                                                network={network}
                                                side="receiver"
                                                locale={locale}
                                                hideSign={!change.entity_address.startsWith('account_') && !change.is_fee && parseFloat(change.balance_change || '0') < 0 && isFungibleBurned(change.resource_address)}
                                                iconOverride={!change.entity_address.startsWith('account_') && !change.is_fee && parseFloat(change.balance_change || '0') < 0 && isFungibleBurned(change.resource_address) ? <IconFlame className="text-orange-600 dark:text-orange-400 size-3.5" /> : undefined}
                                                colorOverride={!change.entity_address.startsWith('account_') && !change.is_fee && parseFloat(change.balance_change || '0') < 0 && isFungibleBurned(change.resource_address) ? "text-orange-600 dark:text-orange-400" : undefined}
                                            />
                                            {recipientFee && !change.is_fee && (
                                                <div className="pl-4 border-l-2 border-amber-500/30 opacity-90 scale-95 origin-left">
                                                    <BalanceChangeRow change={{ ...recipientFee, resource_address: recipientFee.resource_address || getXrdAddress(network), is_fee: true }} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="receiver" locale={locale} />
                                                </div>
                                            )}
                                            {nftDeposits.map((nft) => (
                                                <NftTransferCard key={'nft-r-' + nft.resource_address} resourceAddress={nft.resource_address} ids={nft.added || []} type="added" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="receiver" locale={locale} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                            : isUnstake && pairedValidatorOp
                                ? (
                                    /* Unstake destination: validator panel + paired stake claim NFT */
                                    <div className="space-y-1">
                                        <ValidatorInlinePanel
                                            validatorAddress={pairedValidatorOp.validatorAddress}
                                            isStake={false}
                                            isUnstake={true}
                                            isClaim={false}
                                            unstakeLsu={pairedValidatorOp.unstakeLsu}
                                            unstakeXrdExpected={pairedValidatorOp.unstakeXrdExpected}
                                            tt={tt}
                                            onCopy={onCopy}
                                            copiedAddress={copiedAddress}
                                            network={network}
                                            locale={locale}
                                        />
                                        {pairedNftChange && (
                                            <div className="pl-4 border-l-2 border-[var(--color-primary)]/25 scale-95 origin-left">
                                                <NftTransferCard
                                                    resourceAddress={pairedNftChange.resource_address}
                                                    ids={pairedNftChange.added || []}
                                                    type="added"
                                                    onCopy={onCopy}
                                                    copiedAddress={copiedAddress}
                                                    formatEntity={formatEntity}
                                                    onResourceClick={onResourceClick}
                                                    readingMode={readingMode}
                                                    network={network}
                                                    tt={tt}
                                                    side="receiver"
                                                    isStakeClaim={true}
                                                    unstakeXrdExpected={pairedValidatorOp.unstakeXrdExpected}
                                                    locale={locale}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                                : <div className="text-xs text-[var(--color-text-muted)] italic py-2">{tt?.system_burn || 'System component burn'}</div>
                        }
                        {/* Orphan NFT deposits (no matching fungible receiver) — exclude initiator addresses */}
                        {(() => {
                            const receiverAddrs = new Set(destActors.map((r) => r.entity_address));
                            const items = balanceChanges.non_fungible_balance_changes ?? [];
                            const result: React.ReactNode[] = [];
                            for (const nft of items) {
                                if ((nft.added?.length ?? 0) > 0 && !receiverAddrs.has(nft.entity_address) && !initiators.has(sanitizeText(nft.entity_address))) {
                                    const resourceSenders = group.filter(c => c.resource_address === nft.resource_address && parseFloat(c.balance_change || '0') < 0 && !c.is_fee);
                                    const { method, title, color, bg } = classifySource(resourceSenders, tt, { isStakingTx: isStakingInferred });
                                    result.push(
                                        <div key={'nft-orphan-r-' + result.length}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="pl-2">
                                                    <AddressDisplay label={tt?.to_address || 'To'} address={nft.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                                </div>
                                                <SourceBadge method={method} color={color} bg={bg} title={title} label={tt?.method_label || 'Recibido vía:'} />
                                            </div>
                                            <div className="mt-2"><NftTransferCard resourceAddress={nft.resource_address} ids={nft.added || []} type="added" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="receiver" locale={locale} /></div>
                                        </div>
                                    );
                                }
                            }
                            return result;
                        })()}
                        {/* Orphan NFT burns from non-account entities (component vaults) */}
                        {(() => {
                            const receiverAddrs = new Set(destActors.map((r) => r.entity_address));
                            const items = balanceChanges.non_fungible_balance_changes ?? [];
                            const result: React.ReactNode[] = [];
                            for (const nft of items) {
                                if ((nft.removed?.length ?? 0) > 0 && !receiverAddrs.has(nft.entity_address) && !sanitizeText(nft.entity_address).startsWith('account_')) {
                                    const allAddedIds = new Set((balanceChanges.non_fungible_balance_changes ?? []).flatMap(c => c.added ?? []));
                                    const isBurnedNft = (nft.removed || []).every(id => !allAddedIds.has(id));
                                    result.push(
                                        <div key={'nft-orphan-burn-' + result.length}>
                                            <div className="pl-2 mb-2">
                                                <AddressDisplay label={tt?.to_address || 'To'} address={nft.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                            </div>
                                            <div className="mt-2">
                                                <NftTransferCard resourceAddress={nft.resource_address} ids={nft.removed || []} type="removed" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="receiver" locale={locale} isBurned={isBurnedNft} />
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            return result;
                        })()}
                    </div>
                </div>
            </div>

            {/* ── Footer summary ── */}
            <TransferFooter
                senders={originActors}
                receivers={destActors}
                actualFeePaid={actualFeePaid}
                tt={tt}
                resourceAddress={group[0]?.resource_address}
                isResourceBurned={isFungibleBurned(group[0]?.resource_address)}
                mintedNftCount={isUnstake ? (balanceChanges.non_fungible_balance_changes ?? []).reduce((s, n) => s + (n.added?.length || 0), 0) : undefined}
                burnedNftCount={isClaim ? (balanceChanges.non_fungible_balance_changes ?? []).reduce((s, n) => s + (n.removed?.length || 0), 0) : undefined}
                network={network}
                locale={locale}
            />

            <TransactionFlowInfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                tt={tt}
            />
        </div>
    );
}

