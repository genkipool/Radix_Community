'use client';

import React from 'react';
import { Wallet, Landmark } from 'lucide-react';
import { BalanceChangeRow } from './BalanceChangeRow';
import { NftTransferCard } from './NftTransferCard';
import { AddressDisplay } from './EntityBadge';
import { ValidatorInlinePanel } from './ValidatorInlinePanel';
import { TransferFooter } from './TransferFooter';
import { getXrdAddress } from '../constants';
import { IconFlame, IconBolt } from './TransactionIcons';

import { UnstakeAssetCardProps } from '../types';

export function UnstakeAssetCard({
    senderAddr, allLsuChanges, totalLsu, fmtNum: _fmtNum, nftAdded, validatorOps,
    actualFeePaid, tt, onCopy, copiedAddress, onResourceClick, formatEntity, readingMode, network, columns, locale,
}: UnstakeAssetCardProps) {
    return (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mb-4 last:mb-0">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                {tt?.asset_transfer || 'Asset Transfers'}
            </h3>

            <div className={`flex flex-col ${columns === 2 ? '' : 'md:flex-row'} divide-y ${columns === 2 ? 'divide-y' : 'md:divide-y-0 md:divide-x'} divide-[var(--color-card-border)]`}>
                {/* ── ORIGIN ── */}
                <div className="flex-1 p-3 bg-blue-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="w-3 h-3" />
                        {tt?.from_address || 'Origin (Sent)'}
                    </h5>
                    <div className="space-y-3">
                        {senderAddr && (
                            <div>
                                <AddressDisplay label={tt?.from_address || 'From'} address={senderAddr} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                <div className="space-y-1 mt-2">
                                    {allLsuChanges.map((change, i: number) => (
                                        <BalanceChangeRow 
                                            key={i} 
                                            change={change} 
                                            tt={tt} 
                                            onResourceClick={onResourceClick} 
                                            onCopy={onCopy} 
                                            copiedAddress={copiedAddress} 
                                            readingMode={readingMode} 
                                            network={network} 
                                            side="sender" 
                                            locale={locale} 
                                            hideSign={true}
                                            iconOverride={<IconFlame className="text-orange-600 dark:text-orange-400 w-3.5 h-3.5" />}
                                            titleOverride={tt?.lsu_burn_explanation}
                                            colorOverride="text-orange-600 dark:text-orange-400"
                                        />
                                    ))}

                                    {/* Network Fee - Origin Side */}
                                    {actualFeePaid && parseFloat(actualFeePaid) > 0 && (
                                        <div className="pl-4 border-l-2 border-[var(--color-card-border)] opacity-80 scale-95 origin-left mt-1">
                                            <BalanceChangeRow
                                                change={{
                                                    balance_change: `-${actualFeePaid}`,
                                                    resource_address: getXrdAddress(network),
                                                    entity_address: senderAddr,
                                                    is_fee: true,
                                                }}
                                                tt={tt}
                                                onResourceClick={onResourceClick}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                readingMode={readingMode}
                                                network={network}
                                                side="sender"
                                                locale={locale}
                                            />
                                        </div>
                                    )}

                                    {/* Stake Claim NFT (+1 NFT) - Origin Side */}
                                    {validatorOps.map((op, i: number) => {
                                        const nft = nftAdded[i] ?? null;
                                        if (!nft) return null;
                                        return (
                                            <div key={'unstake-origin-nft-' + i} className="pl-4 border-l-2 border-[var(--color-primary)]/25 scale-95 origin-left mt-2">
                                                <NftTransferCard
                                                    resourceAddress={nft.resource_address}
                                                    ids={nft.added || []}
                                                    type="added"
                                                    onCopy={onCopy}
                                                    copiedAddress={copiedAddress}
                                                    formatEntity={formatEntity}
                                                    onResourceClick={onResourceClick}
                                                    readingMode={readingMode}
                                                    network={network}
                                                    tt={tt}
                                                    side="sender"
                                                    isStakeClaim={true}
                                                    unstakeXrdExpected={op.unstakeXrdExpected}
                                                    nftReceivedLabel={tt?.nft_claim_label || 'NFT de Reclamo'}
                                                    locale={locale}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DESTINATION ── */}
                <div className="flex-1 p-3 bg-[var(--color-accent)]/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[var(--color-accent)] mb-3 flex items-center gap-1.5 opacity-80">
                        <Landmark className="w-3 h-3" />
                        {tt?.to_address || 'Destination (Received)'}
                    </h5>
                    <div className="space-y-2">

                        {/* Interleaved: validator → stake claim NFT */}
                        {validatorOps.map((op, i: number) => (
                            <div key={'unstake-dest-' + i} className="space-y-1">
                                {/* Validator panel — NFT ENTREGADO / -1 NFT */}
                                <ValidatorInlinePanel
                                    validatorAddress={op.validatorAddress}
                                    isStake={false}
                                    isUnstake={true}
                                    isClaim={false}
                                    unstakeLsu={op.unstakeLsu}
                                    unstakeXrdExpected={op.unstakeXrdExpected}
                                    tt={tt}
                                    onCopy={onCopy}
                                    copiedAddress={copiedAddress}
                                    network={network}
                                    locale={locale}
                                    rightLabel={tt?.nft_delivered_label || 'NFT Entregado'}
                                    rightContent={
                                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-black" title={tt?.claim_nft_presented_tooltip}>
                                            <IconBolt className="w-4 h-4" />
                                            <span className="text-base tabular-nums">1</span>
                                            <span className="text-xs font-semibold opacity-70">NFT</span>
                                        </div>
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Footer summary ── */}
            <TransferFooter
                senders={[{ 
                    balance_change: `-${totalLsu}`, 
                    resource_address: allLsuChanges[0]?.resource_address ?? '',
                    entity_address: senderAddr || ''
                }]}
                receivers={[]}
                actualFeePaid={actualFeePaid}
                tt={tt}
                resourceAddress={allLsuChanges[0]?.resource_address}
                mintedNftCount={nftAdded.reduce((s, n) => s + (n?.added?.length || 0), 0)}
                network={network}
                locale={locale}
            />
        </div>
    );
}
