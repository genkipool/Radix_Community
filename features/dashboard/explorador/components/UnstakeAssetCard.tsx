'use client';

import React from 'react';
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { BalanceChangeRow } from './BalanceChangeRow';
import { NftTransferCard } from './NftTransferCard';
import { AddressDisplay } from './EntityBadge';
import { ValidatorInlinePanel } from './ValidatorInlinePanel';
import { TransferFooter } from './TransferFooter';

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
                {tt.asset_transfer || 'Asset Transfers'}
            </h3>

            <div className={`flex flex-col ${columns === 2 ? '' : 'md:flex-row'} divide-y ${columns === 2 ? 'divide-y' : 'md:divide-y-0 md:divide-x'} divide-[var(--color-card-border)]`}>
                {/* ── ORIGIN ── */}
                <div className="flex-1 p-3 bg-red-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5 opacity-80">
                        <ChevronUp className="w-3 h-3" />
                        {tt.from_address || 'Origin (Sent)'}
                    </h5>
                    <div className="space-y-3">
                        {senderAddr && (
                            <div>
                                <AddressDisplay label={tt.from_address || 'From'} address={senderAddr} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel={true} />
                                <div className="space-y-1 mt-2">
                                    {allLsuChanges.map((change, i: number) => (
                                        <BalanceChangeRow key={i} change={change} tt={tt} onResourceClick={onResourceClick} onCopy={onCopy} copiedAddress={copiedAddress} readingMode={readingMode} network={network} side="sender" locale={locale} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DESTINATION ── */}
                <div className="flex-1 p-3 bg-green-500/5">
                    <h5 className="text-[10px] uppercase font-black tracking-widest text-[#16a34a] mb-3 flex items-center gap-1.5 opacity-80">
                        <ChevronDown className="w-3 h-3" />
                        {tt.to_address || 'Destination (Received)'}
                    </h5>
                    <div className="space-y-2">
                        {/* System burn card */}
                        <div className="px-3 py-2 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-muted)] italic flex items-center justify-between gap-4">
                            <span>{tt.system_burn_lsu || 'Quema de token del sistema/red vía Componente'}</span>
                            <span className="font-mono font-bold text-red-500 whitespace-nowrap">
                                −{parseFloat(String(totalLsu)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} <span className="text-[10px] opacity-70">LSU</span>
                            </span>
                        </div>

                        {/* Interleaved: validator → stake claim NFT */}
                        {validatorOps.map((op, i: number) => {
                            const nft = nftAdded[i] ?? null;
                            return (
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
                                        rightLabel={tt.nft_delivered_label || 'NFT Entregado'}
                                        rightContent={<span className="font-mono font-bold text-base tabular-nums text-red-500">−1 <span className="text-xs font-semibold opacity-70">NFT</span></span>}
                                    />
                                    {/* Stake claim NFT — NFT DE RECLAMO / +1 NFT + XRD in elements */}
                                    {nft && (
                                        <div className="pl-4 border-l-2 border-[var(--color-primary)]/25 scale-95 origin-left">
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
                                                side="receiver"
                                                isStakeClaim={true}
                                                unstakeXrdExpected={op.unstakeXrdExpected}
                                                nftReceivedLabel={tt.nft_claim_label || 'NFT de Reclamo'}
                                                locale={locale}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
                network={network}
                locale={locale}
            />
        </div>
    );
}
