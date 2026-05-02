'use client';
import React from 'react';
import type { Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';
import { SummaryInlineRow } from './EntityPanelShared';
import { formatXRD } from '@/utils/formatters';

export interface MetricRowProps {
    label: string;
    value?: string;
    secondaryValue?: string;
    mono?: boolean;
    accentValue?: boolean;
    copyable?: boolean;
    onCopy?: () => void;
    isCopied?: boolean;
    children?: React.ReactNode;
    tooltip?: string;
    rawAddress?: string;
    isDanger?: boolean;
    isModal?: boolean;
}

interface ValidatorMetricsProps {
    validator: Validator;
    address: string;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    locale: string;
    dt?: Partial<DashboardDict>;
    renderRow?: (props: MetricRowProps) => React.ReactNode;
    liveData?: {
        recentMade: number;
        recentMissed: number;
        totalMade: number;
        totalMissed: number;
    };
    isModal?: boolean;
}

/**
 * Local Section Header (matches veb-label style)
 */
function SectionHeader({ label, hide }: { label: string; hide?: boolean }) {
    if (hide) return null;
    return (
        <div className="pb-2">
            <h3 className="text-[10.5px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {label}
            </h3>
        </div>
    );
}

/**
 * Technical / Address Metrics
 */
export function ValidatorAddressMetrics({
    validator, address, onCopy, copiedAddress, dt, renderRow, isModal
}: ValidatorMetricsProps) {
    const dd: Partial<DashboardDict['details']> = dt?.details || {};

    const Row = renderRow || SummaryInlineRow;
    const trunc = (a: string) => isModal
        ? (a.length > 40 ? `${a.slice(0, 32)}...${a.slice(-24)}` : a)
        : (a.length > 24 ? `${a.slice(0, 12)}...${a.slice(-8)}` : a);

    return (
        <>
            <Row
                label={dd.address || 'Validator Address'}
                value={trunc(address)}
                rawAddress={address}
                mono
                copyable
                onCopy={() => onCopy(address)}
                isCopied={copiedAddress === address}
                isModal={isModal}
            />
            {validator.ownerAddress && (
                <Row
                    label={dd.owner_address || 'Owner Address'}
                    value={trunc(validator.ownerAddress)}
                    rawAddress={validator.ownerAddress}
                    mono
                    copyable
                    onCopy={() => onCopy(validator.ownerAddress)}
                    isCopied={copiedAddress === validator.ownerAddress}
                    isModal={isModal}
                />
            )}
            {validator.ownerBadge && (
                <Row
                    label={dd.owner_badge || 'Owner Badge'}
                    value={trunc(validator.ownerBadge)}
                    rawAddress={validator.ownerBadge}
                    mono
                    copyable
                    onCopy={() => onCopy(validator.ownerBadge!)}
                    isCopied={copiedAddress === validator.ownerBadge || copiedAddress === `[${validator.ownerBadge}]`}
                    isModal={isModal}
                />
            )}
            {validator.lsuResource && (
                <Row
                    label={dd.lsu_resource || 'LSU Resource'}
                    value={trunc(validator.lsuResource)}
                    rawAddress={validator.lsuResource}
                    mono
                    copyable
                    onCopy={() => onCopy(validator.lsuResource)}
                    isCopied={copiedAddress === validator.lsuResource}
                    isModal={isModal}
                />
            )}
            {validator.claimTokenResourceAddress && (
                <Row
                    label={dd.nft_claim || 'NFT Claim'}
                    value={trunc(validator.claimTokenResourceAddress)}
                    rawAddress={validator.claimTokenResourceAddress}
                    mono
                    copyable
                    onCopy={() => onCopy(validator.claimTokenResourceAddress!)}
                    isCopied={copiedAddress === validator.claimTokenResourceAddress}
                    isModal={isModal}
                />
            )}
            {validator.publicKey && (
                <Row
                    label={dd.public_key || 'Public Key'}
                    value={trunc(validator.publicKey)}
                    rawAddress={validator.publicKey}
                    mono
                    copyable
                    onCopy={() => onCopy(validator.publicKey)}
                    isCopied={copiedAddress === validator.publicKey || copiedAddress === `[${validator.publicKey}]`}
                    isModal={isModal}
                />
            )}
        </>
    );
}

/**
 * Delegation Metrics
 */
export function ValidatorDelegationMetrics({
    validator, locale, dt, renderRow, hideHeader
}: Partial<ValidatorMetricsProps> & { hideHeader?: boolean }) {
    if (!validator) return null;
    const dd: Partial<DashboardDict['details']> = dt?.details || {};
    const Row = renderRow || SummaryInlineRow;

    const delegationLabel = dd.validator_staking_summary || dd.delegation || 'Delegation Overview';

    return (
        <div className="flex-1 flex flex-col">
            <SectionHeader label={delegationLabel} hide={hideHeader} />
            <div className="veb-drows flex-1 flex flex-col justify-between">
                {validator.delegatedStake != null && (
                    <Row
                        label={dd.validator_delegated_stake || dd.delegated_stake || 'Delegated Stake'}
                        value={`${formatXRD(validator.delegatedStake, locale)} XRD`}
                        secondaryValue={`${validator.delegatedStakePercent?.toFixed(2)}% of the network`}
                        mono
                    />
                )}
                {validator.delegators != null && (
                    <Row
                        label={dd.validator_delegators || dd.delegators || 'Delegators'}
                        value={validator.delegators.toLocaleString(locale)}
                    />
                )}
                {validator.ownerStake != null && (
                    <Row
                        label={dd.validator_owner_stake || dd.owner_delegation || 'Owner Stake'}
                        value={`${formatXRD(validator.ownerStake, locale)} XRD`}
                        mono
                    />
                )}
                {validator.apy != null && (
                    <Row
                        label={dd.validator_apy_projection || dd.apy_projection || 'APY Projection'}
                        value={`${(validator.apy * 100).toFixed(2)}%`}
                        accentValue
                    />
                )}
                {validator.nominalFee != null && (
                    <Row
                        label={dd.validator_nominal_fee || dd.nominal_fee || 'Fee'}
                        value={`${(validator.nominalFee * 100).toFixed(1)}%`}
                        secondaryValue={validator.effectiveFee != null ? `${(validator.effectiveFee * 100).toFixed(2)}% effective` : undefined}
                    />
                )}
                {validator.lsu2xrdFactor != null && (
                    <Row
                        label={dd.validator_lsu_factor || dd.lsu_factor || 'LSU to XRD Factor'}
                        value={`1 LSU = ${validator.lsu2xrdFactor === 1 ? '1' : Number(validator.lsu2xrdFactor.toFixed(8)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} XRD`}
                        mono
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Performance Metrics
 */
export function ValidatorPerformanceMetrics({
    validator, locale, dt, renderRow, hideHeader
}: Partial<ValidatorMetricsProps> & { hideHeader?: boolean }) {
    if (!validator) return null;
    const dd: Partial<DashboardDict['details']> = dt?.details || {};
    const Row = renderRow || SummaryInlineRow;

    const label14d = dd.validator_performance_14d || dd.performance_14d || 'Epoch Performance (14 days)';
    const labelTotal = dd.validator_performance_total || dd.performance_total || 'Epoch Performance (Total)';

    return (
        <>
            {/* 14-day Period */}
            <SectionHeader label={label14d} hide={hideHeader} />
            <div className="veb-drows flex-1 flex flex-col justify-between mb-4">
                <Row
                    label={dd.validator_uptime || dd.uptime_recent || 'Uptime'}
                    value={`${(validator.recentUptime * 100).toFixed(2)}%`}
                    accentValue
                />
                <Row
                    label={dd.validator_completed || dd.proposals_made || 'Completed'}
                    value={validator.recentProposalsMade.toLocaleString(locale)}
                />
                <Row
                    label={dd.validator_missed || dd.proposals_missed || 'Missed'}
                    value={validator.recentProposalsMissed.toLocaleString(locale)}
                    isDanger={validator.recentProposalsMissed > 0}
                />
            </div>

            {/* Total Period */}
            <SectionHeader label={labelTotal} hide={hideHeader} />
            <div className="veb-drows flex-1 flex flex-col justify-between">
                <Row
                    label={dd.validator_uptime || dd.uptime_total || 'Uptime'}
                    value={validator.totalUptime != null ? `${(validator.totalUptime * 100).toFixed(2)}%` : '—'}
                    accentValue
                />
                <Row
                    label={dd.validator_completed || dd.proposals_made || 'Completed'}
                    value={validator.totalProposalsMade?.toLocaleString(locale) || '—'}
                />
                <Row
                    label={dd.validator_missed || dd.proposals_missed || 'Missed'}
                    value={validator.totalProposalsMissed?.toLocaleString(locale) || '—'}
                    isDanger={(validator.totalProposalsMissed || 0) > 0}
                />
            </div>
        </>
    );
}

/**
 * Main Summary Component (composition of the above)
 */
export function ValidatorSummaryMetrics(props: ValidatorMetricsProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-0">
                <ValidatorAddressMetrics {...props} />
            </div>
            <div className="space-y-0">
                <ValidatorDelegationMetrics {...props} />
            </div>
            <div className="space-y-0">
                <ValidatorPerformanceMetrics {...props} />
            </div>
        </div>
    );
}
