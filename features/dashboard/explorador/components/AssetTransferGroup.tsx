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
import type { TranslationsT } from '@/features/dashboard/types';

import { IconFlame } from './TransactionIcons';
import { TransactionFlowInfoModal } from './TransactionFlowInfoModal';

export function AssetTransferGroup({
    group, balanceChanges, allSenderAddresses, realTransferAddresses,
    actualFeePaid, tt: _tt, t,
    onCopy, copiedAddress, onResourceClick, formatEntity, readingMode, network,
    isClaim, isUnstake, validatorOps, pairedValidatorOp, pairedNftChange, columns,
    locale,
}: AssetTransferGroupProps) {
    const tt = _tt || ({} as TranslationsT['dashboard']['transactions']);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    
    const senders = group.filter(c => {
        const isNegative = parseFloat(c.balance_change) < 0;
        if (!isNegative) return false;

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

    const receivers = group.filter(c => {
        const isPositive = parseFloat(c.balance_change) > 0;
        if (!isPositive) return false;

        if (!c.is_fee) return true;

        const hasRealInGroup = group.some(oc => oc.entity_address === c.entity_address && !oc.is_fee);
        if (hasRealInGroup) return false;

        const hasRealInWholeTx = realTransferAddresses.has(sanitizeText(c.entity_address));
        if (hasRealInWholeTx) return false;

        return true;
    });

    // If after filtering we have NO senders AND NO receivers, we hide the whole card.
    // This happens for a group (usually XRD) that only contains fees for addresses already shown in other cards.
    if (senders.length === 0 && receivers.length === 0) return null;
    const { method: sourceMethod, title: sourceTitle, color: sourceColor, bg: sourceBg } =
        classifySource(senders, tt);

    return (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mb-4 last:mb-0">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    {tt.asset_transfer || 'Asset Transfers'}
                </div>
                <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="p-1 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border border-transparent hover:border-[var(--color-card-border)] group"
                    title={tt.tx_flow_info_title || 'How to read our transaction flow'}
                >
                    <Info className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </button>
            </h3>

            <div className={`flex flex-col ${columns === 2 ? '' : 'md:flex-row'} divide-y ${columns === 2 ? 'divide-y' : 'md:divide-y-0 md:divide-x'} divide-[var(--color-card-border)]`}>

                {/* ── ORIGIN column ── */}
                <div className="flex-1 p-3 bg-red-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[#ef4444] mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="w-3 h-3" />
                        {tt.from_address || 'Origin (Sent)'}
                    </h5>
                    <div className="space-y-3">
                        {senders.length > 0
                            ? senders.map((change, i: number) => {
                                const matchingFee = balanceChanges.fungible_fee_balance_changes?.find((f) => sanitizeText(f.entity_address) === sanitizeText(change.entity_address));
                                const nftWithdrawals = (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => nft.entity_address === change.entity_address && (nft.removed?.length ?? 0) > 0);
                                const isCM = isConsensusManager(change.entity_address);

                                // For claim txs: pair the i-th removed claim NFT with this validator sender
                                const claimNftChanges = isClaim
                                    ? (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => (nft.removed?.length ?? 0) > 0)
                                    : [];
                                const pairedClaimNft = isClaim ? (claimNftChanges[i] ?? null) : null;
                                const pairedOp = isClaim && validatorOps ? (validatorOps[i] ?? validatorOps[0]) : null;

                                return (
                                    <div key={'s' + i} className={isCM ? 'rounded-xl border border-blue-500/20 bg-blue-500/5 p-2' : ''}>
                                        <div className="pl-2 mb-2">
                                            <AddressDisplay label={tt.from_address || 'From'} address={change.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} showConsensusInfo={isCM} network={network} hideLabel={true} />
                                        </div>
                                        <div className="space-y-1">
                                            <BalanceChangeRow change={change} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="sender" locale={locale} />

                                            {matchingFee && !change.is_fee && (
                                                <div className="pl-4 border-l-2 border-[var(--color-card-border)] opacity-80 scale-95 origin-left">
                                                    <BalanceChangeRow change={{ ...matchingFee, resource_address: matchingFee.resource_address || getXrdAddress(network), is_fee: true }} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="sender" locale={locale} />
                                                </div>
                                            )}
                                            {nftWithdrawals.map((nft, ni: number) => (
                                                <NftTransferCard key={'nft-s-' + ni} resourceAddress={nft.resource_address} ids={nft.removed || []} type="removed" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="sender" locale={locale} />
                                            ))}
                                            {/* Claim NFT — address + nested card with left border, +1 NFT (origin side) */}
                                            {pairedClaimNft && (
                                                <div className="pl-4 border-l-2 border-[var(--color-primary)]/25 mt-1">
                                                    <div className="scale-95 origin-left">
                                                        {/* SYSTEM CARD replacement for Claim origin address */}
                                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/5 mb-1.5">
                                                            <IconFlame className="text-orange-600 w-3.5 h-3.5 shrink-0" />
                                                            <span className="text-[10px] uppercase font-black text-orange-700 dark:text-orange-400 tracking-wider">
                                                                {tt.claim_card_system_burn || 'System Card / Smart Contract (Burn)'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            <NftTransferCard
                                                                resourceAddress={pairedClaimNft.resource_address}
                                                                ids={pairedClaimNft.removed || []}
                                                                type="added"
                                                                onCopy={onCopy}
                                                                copiedAddress={copiedAddress}
                                                                formatEntity={formatEntity}
                                                                onResourceClick={onResourceClick}
                                                                readingMode={readingMode}
                                                                network={network}
                                                                tt={tt}
                                                                side="sender"
                                                                isClaim={true}
                                                                isClaimRedeemed={true}
                                                                nftReceivedLabel={tt?.claim_nft_redeemed_label || 'NFT Canjeado'}
                                                                claimXrdTotal={pairedOp?.claimXrd as number}
                                                                locale={locale}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                            : <div className="text-xs text-[var(--color-text-muted)] italic py-2">{tt.system_generation || 'System component generation'}</div>
                        }
                        {/* Orphan NFT withdrawals — skipped for claim txs (already shown inline with address above) */}
                        {(() => {
                            if (isClaim) return null;
                            const senderAddrs = new Set(senders.map((s) => s.entity_address));
                            const orphans = (balanceChanges.non_fungible_balance_changes ?? [])
                                .filter((nft) => (nft.removed?.length ?? 0) > 0 && !senderAddrs.has(nft.entity_address));
                            return orphans.map((nft, ni: number) => {
                                const matchedOp = isClaim && validatorOps ? (validatorOps[ni] ?? validatorOps[0]) : undefined;
                                return (
                                    <div key={'nft-orphan-s-' + ni}>
                                        <div className="pl-2 mb-2">
                                            <AddressDisplay label={tt.from_address || 'From'} address={nft.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
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
                                            />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* ── DESTINATION column ── */}
                <div className="flex-1 p-3 bg-green-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[#16a34a] mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="w-3 h-3" />
                        {tt.to_address || 'Destination (Received)'}
                    </h5>
                    <div className="space-y-3">
                        {receivers.length > 0
                            ? receivers.map((change, i: number) => {
                                const nftDeposits = (balanceChanges.non_fungible_balance_changes ?? []).filter((nft) => nft.entity_address === change.entity_address && (nft.added?.length ?? 0) > 0);
                                const isPayerInOrigin = allSenderAddresses.has(sanitizeText(change.entity_address));
                                const recipientFee = !isPayerInOrigin
                                    ? balanceChanges.fungible_fee_balance_changes?.find((f) => sanitizeText(f.entity_address) === sanitizeText(change.entity_address))
                                    : null;
                                return (
                                    <div key={'r' + i}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1 pl-2">
                                                <AddressDisplay label={tt.to_address || 'To'} address={change.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                            </div>
                                            <SourceBadge method={sourceMethod} color={sourceColor} bg={sourceBg} title={sourceTitle} label={tt.method_label || 'Recibido vía:'} />
                                        </div>
                                        <div className="space-y-1">
                                            <BalanceChangeRow change={change} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="receiver" locale={locale} />
                                            {recipientFee && !change.is_fee && (
                                                <div className="pl-4 border-l-2 border-amber-500/30 opacity-90 scale-95 origin-left">
                                                    <BalanceChangeRow change={{ ...recipientFee, resource_address: recipientFee.resource_address || getXrdAddress(network), is_fee: true }} t={t} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="receiver" locale={locale} />
                                                </div>
                                            )}
                                            {nftDeposits.map((nft, ni: number) => (
                                                <NftTransferCard key={'nft-r-' + ni} resourceAddress={nft.resource_address} ids={nft.added || []} type="added" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="receiver" locale={locale} />
                                            ))}
                                            {/* Claim txs: show each removed claim NFT nested below XRD row — NFT Presentado / -1 NFT / XRD in elements */}
                                            {isClaim && (balanceChanges.non_fungible_balance_changes ?? [])
                                                .filter((nft) => nft.entity_address === change.entity_address && (nft.removed?.length ?? 0) > 0)
                                                .map((nft, ni: number) => {
                                                    const matchedOp = validatorOps ? (validatorOps[ni] ?? validatorOps[0]) : undefined;
                                                    return (
                                                        <div key={'claim-dest-' + ni} className="pl-4 border-l-2 border-[var(--color-primary)]/25 scale-95 origin-left">
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
                                                                side="receiver"
                                                                isClaim={true}
                                                                isClaimAuthorized={true}
                                                                claimXrdTotal={matchedOp?.claimXrd}
                                                                nftReceivedLabel={tt.nft_presented_label || 'NFT Presentado'}
                                                                locale={locale}
                                                            />
                                                        </div>
                                                    );
                                                })
                                            }

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
                                : <div className="text-xs text-[var(--color-text-muted)] italic py-2">{tt.system_burn || 'System component burn'}</div>
                        }
                        {/* Orphan NFT deposits (no matching fungible receiver) */}
                        {(() => {
                            const receiverAddrs = new Set(receivers.map((r) => r.entity_address));
                            return (balanceChanges.non_fungible_balance_changes ?? [])
                                .filter((nft) => (nft.added?.length ?? 0) > 0 && !receiverAddrs.has(nft.entity_address))
                                .map((nft, ni: number) => (
                                    <div key={'nft-orphan-r-' + ni}>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="pl-2">
                                                <AddressDisplay label={tt.to_address || 'To'} address={nft.entity_address} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                            </div>
                                            <SourceBadge method={sourceMethod} color={sourceColor} bg={sourceBg} title={sourceTitle} label={tt.method_label || 'Recibido vía:'} />
                                        </div>
                                        <div className="mt-2"><NftTransferCard resourceAddress={nft.resource_address} ids={nft.added || []} type="added" onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} onResourceClick={onResourceClick} readingMode={readingMode} network={network} tt={tt} side="receiver" locale={locale} /></div>
                                    </div>
                                ));
                        })()}
                    </div>
                </div>
            </div>

            {/* ── Footer summary ── */}
            <TransferFooter
                senders={senders}
                receivers={receivers}
                actualFeePaid={actualFeePaid}
                tt={tt}
                resourceAddress={group[0]?.resource_address}
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

