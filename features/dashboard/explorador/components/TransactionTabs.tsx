'use client';

import React, { useState } from 'react';
import { Activity, Check, Copy, FileJson, List, Terminal } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import type { Dictionary } from '@/types/i18n';
import { AssetTransferGroup } from './AssetTransferGroup';
import { UnstakeAssetCard } from './UnstakeAssetCard';
import { LockFeePanel, AuthBadgePanel } from './TransactionAuthPanels';
import { TransactionDetailsTab } from './TransactionDetailsTab';
import { EntitiesSection } from './EntitiesSection';
import { FeesDistributionSection } from './FeesDistributionSection';
import { ProtocolVoteCard } from './ProtocolVoteCard';
import { OracleUpdateSection, AirdropSection } from './TransactionSummaryPanels';
import { parseManifest, resolveAirdropData } from '../utils/parseManifest';
import { ValidatorInlinePanel } from './ValidatorInlinePanel';

import { getTransactionFlags } from '../utils/transactionUtils';

import type { TranslationsT } from '@/features/dashboard/types';
import { getResourceGroups, getAllSenderAddresses, getRealTransferAddresses, getNftOnlyGroups } from '../utils/balanceChangeUtils';



import { TransactionTabsProps, BalanceChanges, FungibleChange, NonFungibleChange, ValidatorOp } from '../types';

/* ── Loading skeleton ──────────────────── */
function TransactionDetailsSkeleton({ tt }: { tt: TranslationsT['dashboard']['transactions'] }) {
    return (
        <div className="p-5 space-y-4 animate-pulse">
            <div className="h-3 w-1/3 bg-[var(--color-surface)] rounded" />
            <div className="h-20 bg-[var(--color-surface)] rounded-xl" />
            <div className="h-3 w-2/3 bg-[var(--color-surface)] rounded" />
            <div className="grid grid-cols-2 gap-3">
                <div className="h-16 bg-[var(--color-surface)] rounded-xl" />
                <div className="h-16 bg-[var(--color-surface)] rounded-xl" />
            </div>
            <p className="text-xs text-center text-[var(--color-text-muted)] pt-1 !mt-6">
                {tt.loading_details || 'Loading transaction details...'}
            </p>
        </div>
    );
}

/* ══════════════════════════════════════════
   TransactionTabs — pure tab orchestrator
   Updated to filter out protocol internal fee movements (Consensus Manager).
══════════════════════════════════════════ */
const TransactionTabs = ({
    details, tx, t, onCopy, copiedAddress, onResourceClick, formatEntity, readingMode, network, columns, timezone, locale,
}: TransactionTabsProps) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'raw'>('summary');
    const tt = (t?.dashboard?.transactions ?? {}) as TranslationsT['dashboard']['transactions'];
    const dt = (t?.dashboard ?? {}) as TranslationsT['dashboard'];

    if (!details) {
        return (
            <div className="pt-4 border-t border-[var(--color-card-border)]">
                <TransactionDetailsSkeleton tt={tt} />
            </div>
        );
    }

    const { receipt, manifest_instructions } = details;
    const parsed = parseManifest(String(manifest_instructions || ''));
    const balanceChanges = details?.balance_changes as BalanceChanges | undefined;
    const airdropData = resolveAirdropData(parsed.candiesMatch, balanceChanges);
    const actualFeePaid = parseFloat(sanitizeText(String(tx.feePaid || '0'))).toFixed(4).replace(/\.?0+$/, '');

    /* ── Resource groups for asset transfer cards ── */
    const resourceGroups = getResourceGroups(balanceChanges, network);
    const allSenderAddresses = getAllSenderAddresses(balanceChanges);
    const realTransferAddresses = getRealTransferAddresses(balanceChanges);

    /* ── NFT-only groups ── */
    const nftOnlyGroups = getNftOnlyGroups(balanceChanges, resourceGroups.length);

    // Shared props passed to most child panels
    const shared = { tt, onCopy, copiedAddress, onResourceClick, network, columns };

    return (
        <div
            className="flex flex-col mt-4 pt-4 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50 rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {/* ── Tab bar ── */}
            <div className="flex items-center gap-1 border-b border-[var(--color-card-border)] p-2 overflow-x-auto hide-scrollbar">
                {(['summary', 'details', 'raw'] as const).map(tab => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-[var(--color-surface)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                    >
                        {tab === 'summary' && <><Activity className="w-3.5 h-3.5" />{tt.summary || 'Summary'}</>}
                        {tab === 'details' && <><List className="w-3.5 h-3.5" />{tt.details || 'Details'}</>}
                        {tab === 'raw' && <><FileJson className="w-3.5 h-3.5" />{tt.raw_receipt || 'Raw Receipt'}</>}
                    </button>
                ))}
            </div>

            <div className="p-4 sm:p-5 text-sm">

                {/* ══ SUMMARY ══ */}
                {activeTab === 'summary' && (
                    <div className="space-y-6">

                        {/* Message payload */}
                        {tx.message && (
                            <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
                                <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                    {tt.message_payload || 'Message Payload'}
                                </h3>
                                <div className="p-4 sm:p-5 text-xs sm:text-sm font-mono break-words text-[var(--color-text-main)] leading-relaxed">
                                    &quot;{sanitizeText(String(tx.message || ''))}&quot;
                                </div>
                            </div>
                        )}

                        {/* Validator info for stake/unstake/claim — supports multiple validators */}
                        {(() => {
                            const classes: string[] = (tx.manifestClasses as string[]) ?? (details?.manifest_classes as string[]) ?? [];
                            const { isStake, isUnstake, isClaim } = getTransactionFlags(classes);
                            if (!isStake && !isUnstake && !isClaim) return null;

                            // Use per-validator ops if available, fall back to legacy single-validator
                            const ops: ValidatorOp[] = (tx.validatorOps as ValidatorOp[])?.length
                                ? (tx.validatorOps as ValidatorOp[])
                                : tx.validatorAddress
                                    ? [{ validatorAddress: tx.validatorAddress as string, stakeXrd: tx.stakeXrd as number, unstakeLsu: tx.unstakeXrd as number, claimXrd: tx.claimXrd as number }]
                                    : [];
                            if (ops.length === 0) return null;

                            return (
                                <div className="space-y-3">
                                    {ops.map((op, i: number) => (
                                        <ValidatorInlinePanel
                                            key={op.validatorAddress + i}
                                            validatorAddress={op.validatorAddress}
                                            isStake={isStake}
                                            isUnstake={isUnstake}
                                            isClaim={isClaim}
                                            stakeXrd={op.stakeXrd as number}
                                            unstakeLsu={op.unstakeLsu as number}
                                            unstakeXrdExpected={op.unstakeXrdExpected as number}
                                            claimXrd={op.claimXrd as number}
                                            tt={tt}
                                            dt={dt}
                                            onCopy={onCopy}
                                            copiedAddress={copiedAddress}
                                            network={network}
                                        />
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Asset transfers */}
                        {(() => {
                            const classes: string[] = (tx.manifestClasses as string[]) ?? (details?.manifest_classes as string[]) ?? [];
                            const { isClaim: isClaimTx, isUnstake: isUnstakeTx } = getTransactionFlags(classes);

                            if (isUnstakeTx && resourceGroups.length > 0) {
                                // ── UNSTAKE: single merged card (all LSUs from same account) ──
                                const allLsuChanges: FungibleChange[] = balanceChanges?.fungible_balance_changes ?? [];
                                const nftAdded: NonFungibleChange[] = (balanceChanges?.non_fungible_balance_changes ?? []).filter((n) => (n?.added ?? []).length > 0);
                                const senderAddr = allLsuChanges[0]?.entity_address;
                                const totalLsu = allLsuChanges.reduce((sum: number, c) => sum + Math.abs(parseFloat(c.balance_change || '0')), 0);
                                const fmtNum = (n: number) => parseFloat(n.toFixed(4)).toLocaleString(undefined, { maximumFractionDigits: 4 });

                                return (
                                    <UnstakeAssetCard
                                        senderAddr={senderAddr as string}
                                        allLsuChanges={allLsuChanges}
                                        totalLsu={totalLsu}
                                        fmtNum={fmtNum}
                                        nftAdded={nftAdded}
                                        validatorOps={tx.validatorOps ?? []}
                                        actualFeePaid={actualFeePaid}
                                        tt={tt}
                                        onCopy={onCopy}
                                        copiedAddress={copiedAddress}
                                        onResourceClick={shared.onResourceClick}
                                        formatEntity={formatEntity}
                                        readingMode={readingMode}
                                        network={network}
                                        columns={columns}
                                    />
                                );
                            }

                            const allGroups = [...resourceGroups, ...nftOnlyGroups];
                            const filteredGroups = allGroups.filter(g => {
                                // Skip a group if it ONLY contains fee entries for addresses that already have "real" transfers elsewhere
                                const hasRealTransferInGroup = g.some(c => !c.is_fee);
                                if (hasRealTransferInGroup) return true;

                                // If the group is purely fees, check if any of its addresses are NO-SHOWS (meaning they are already nested)
                                // Standard: If a group is only fees, and there's at least one non-fee transfer in the whole tx,
                                // we might want to hide it if all its members are already represented.
                                return g.some(c => !realTransferAddresses.has(sanitizeText(c.entity_address)));
                            });

                            // If the whole transaction is ONLY fees (no real transfers at all), hide the section as per user request
                            if (realTransferAddresses.size === 0) return null;

                            return filteredGroups.map((group, idx) => (
                                <AssetTransferGroup
                                    key={'rg' + idx}
                                    group={group}
                                    balanceChanges={balanceChanges as BalanceChanges}
                                    allSenderAddresses={allSenderAddresses}
                                    realTransferAddresses={realTransferAddresses}
                                    actualFeePaid={actualFeePaid}
                                    t={t as TranslationsT}
                                    formatEntity={formatEntity}
                                    readingMode={readingMode}
                                    isClaim={isClaimTx}
                                    validatorOps={tx.validatorOps}
                                    {...shared}
                                />
                            ));
                        })()}

                        {/* NFT-only transfers: pass a synthetic group so AssetTransferGroup's
                            orphan-NFT detection handles rendering within the same card design */}
                        {nftOnlyGroups.map((group, idx) => (
                            <AssetTransferGroup key={'nft-rg' + idx} group={group} balanceChanges={balanceChanges as BalanceChanges} allSenderAddresses={allSenderAddresses} realTransferAddresses={realTransferAddresses} actualFeePaid={actualFeePaid} t={t as TranslationsT} formatEntity={formatEntity} readingMode={readingMode} {...shared} />
                        ))}

                        {/* Lock Fee */}
                        {parsed.lockFeeAmount && (
                            <LockFeePanel lockFeeAmount={parsed.lockFeeAmount} lockFeeAccount={parsed.lockFeeAccount} mainAction={parsed.mainAction} nftId={parsed.nftId} actualFeePaid={actualFeePaid} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                        )}

                        {/* Auth Badge */}
                        {parsed.badgeResource && parsed.badgeAmount && (
                            <AuthBadgePanel badgeResource={parsed.badgeResource} badgeAmount={parsed.badgeAmount} badgeOrigin={parsed.badgeOrigin} t={t as TranslationsT} readingMode={readingMode} {...shared} />
                        )}

                        <OracleUpdateSection updates={parsed.oracleUpdates} {...shared} />
                        <AirdropSection airdropData={airdropData} {...shared} />

                        {receipt?.events !== undefined && (receipt.events?.length ?? 0) > 0 && (
                            <ProtocolVoteCard
                                events={receipt.events ?? []}
                                affectedEntities={(details.affected_global_entities ?? []).map(e => typeof e === 'string' ? e : e.address)}
                                manifestInstructions={manifest_instructions ?? ''}
                                {...shared}
                            />
                        )}

                        <FeesDistributionSection details={details} tx={tx} readingMode={readingMode} {...shared} />
                        <EntitiesSection variant="affected" details={details} {...shared} />
                        <EntitiesSection variant="created" details={details} {...shared} />
                    </div>
                )}

                {/* ══ DETAILS ══ */}
                {activeTab === 'details' && (
                    <TransactionDetailsTab details={details} tx={tx} tt={tt} te={t?.events ?? {} as Dictionary['events']} onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} network={network} timezone={timezone} locale={locale} />
                )}

                {/* ══ RAW ══ */}
                {activeTab === 'raw' && (
                    <div className="space-y-4">
                        <h3 className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold flex items-center justify-between px-1">
                            <span className="flex items-center gap-1.5">
                                <FileJson className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                {tt.raw_receipt || 'Raw Receipt'}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCopy(JSON.stringify(details, null, 2));
                                }}
                                className={`p-1.5 rounded-md transition-colors ${copiedAddress === JSON.stringify(details, null, 2) ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
                                title={tt.copy_raw || 'Copy Raw JSON'}
                            >
                                {copiedAddress === JSON.stringify(details, null, 2) ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </h3>
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-[var(--color-card-border)] text-xs font-mono text-green-400/90 shadow-inner overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar whitespace-pre">
                            {JSON.stringify(details, null, 2)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export { TransactionTabs };
