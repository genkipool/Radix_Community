'use client';
import React, { useEffect } from 'react';
import { registerAddressForPolling, unregisterAddressForPolling } from '@/services/liveDataStore';
import { Activity, ShieldCheck, Users, Globe, Server, ExternalLink } from 'lucide-react';
import type { Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';
import { SummaryInlineRow } from './EntityPanelShared';
import { VoteBadge } from '@/features/dashboard/staking/components/ValidatorBadges';
import { formatXRDFull, formatXRDExact, formatPercent, formatDisplayUrl } from '@/utils/formatters';

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
    isSuccess?: boolean;
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
    stakeAmount?: number;
    unstakeAmount?: number;
    claimAmount?: number;
    unstakes?: { amount: number; epoch: number }[];
    currentEpoch?: number;
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
        ? (a.length > 20 ? `${a.slice(0, 12)}...${a.slice(-8)}` : a)
        : (a.length > 16 ? `${a.slice(0, 8)}...${a.slice(-6)}` : a);

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
                    value={`[${trunc(validator.publicKey)}]`}
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
 * User Position / Stake Metrics
 */
function ValidatorPositionMetrics({
    stakeAmount, unstakeAmount, claimAmount, unstakes, currentEpoch, locale, dt, renderRow
}: Partial<ValidatorMetricsProps>) {
    if (stakeAmount === undefined && unstakeAmount === undefined && claimAmount === undefined) return null;

    const as = dt?.transactions?.account_summary;
    const Row = (renderRow || SummaryInlineRow) as React.ComponentType<MetricRowProps>;
    const labelPosition = as?.your_position || 'Tu Posición';

    // Helper to format remaining time based on epochs
    const formatRemainingTime = (targetEpoch: number, current: number) => {
        if (!current || targetEpoch <= current) return 'Ready to claim';
        const epochsRemaining = targetEpoch - current;
        const totalMinutes = epochsRemaining * 5;

        if (totalMinutes < 60) return `~${totalMinutes}m remaining`;

        const hours = Math.floor(totalMinutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            const remainingHours = hours % 24;
            return `~${days}d ${remainingHours}h remaining`;
        }
        return `~${hours}h remaining`;
    };

    return (
        <div className="flex-1 flex flex-col">
            <SectionHeader label={labelPosition} />
            <div className="veb-drows flex-1 flex flex-col justify-between">
                {stakeAmount !== undefined && (
                    <Row
                        label={as?.stake_xrd || 'Stake XRD'}
                        value={formatXRDFull(stakeAmount, locale)}
                        mono
                        accentValue
                    />
                )}
                {unstakeAmount !== undefined && (
                    <div className="flex flex-col gap-1">
                        <Row
                            label={as?.unstake_xrd || 'Unstake XRD'}
                            value={formatXRDFull(unstakeAmount, locale)}
                            mono
                            isDanger
                        />
                        {unstakes && unstakes.length > 0 && currentEpoch !== undefined && (
                            <div className="pl-4 pr-1 mt-1 flex flex-col gap-1.5 border-l-2 border-[var(--color-card-border)]/50 ml-1">
                                {unstakes.map((u, i) => (
                                    <div key={`${u.epoch}-${u.amount}-${i}`} className="flex justify-between items-center text-[10px]">
                                        <span className="text-[var(--color-text-muted)] font-mono">{formatXRDFull(u.amount, locale)}</span>
                                        <span className="text-[var(--color-warning)]/80 text-[9px] font-medium tracking-wide">
                                            {formatRemainingTime(u.epoch, currentEpoch)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {claimAmount !== undefined && (
                    <Row
                        label={as?.claim_xrd || 'Claim XRD'}
                        value={formatXRDFull(claimAmount, locale)}
                        mono
                        isSuccess
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Status Pill Helper (Internal to match Staking design)
 */
function StatusPill({
    label,
    color,
    icon: Icon
}: {
    label: string;
    color: string;
    icon: React.ElementType
}) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold leading-none align-middle transition-all duration-300"
            style={{
                color,
                borderColor: `${color}45`,
                backgroundColor: `${color}15`,
            }}
        >
            <Icon size={12} className="shrink-0" />
            <span className="mt-[1px]">{label}</span>
        </span>
    );
}

/**
 * Profile / Social Metrics
 */
export function ValidatorProfileMetrics({
    validator, dt, className = ""
}: Partial<ValidatorMetricsProps> & { className?: string }) {
    if (!validator) return null;
    const dd: Partial<DashboardDict['details']> = dt?.details || {};
    const st: Partial<DashboardDict['status']> = dt?.status || {};

    const profileLabel = dd.profile || 'Perfil de Staking';

    // Design Colors from Staking Primitives
    const colorSuccess = '#16a34a';
    const colorWarning = '#d97706';

    // The protocol-update vote is rendered by the shared VoteBadge below.
    const voteValue = validator.protocolUpdateVote;

    return (
        <div className={`flex-1 flex flex-col ${className}`}>
            <SectionHeader label={profileLabel} />
            <div className="flex flex-col gap-y-2">
                {validator.description && (
                    <p className="text-[13px] text-[var(--color-text-muted)] leading-normal">
                        &quot;{validator.description}&quot;
                    </p>
                )}
                {validator.website && (
                    <div className="flex items-center gap-2">
                        <a
                            href={validator.website}
                            rel="noreferrer"
                            target="_blank"
                            className="text-[13px] text-[var(--color-primary)] hover:underline truncate font-medium flex items-center gap-1.5"
                        >
                            {formatDisplayUrl(validator.website)}
                            <ExternalLink size={14} className="opacity-70" />
                        </a>
                    </div>
                )}

                {(() => {
                    type TechItem = { icon?: React.ReactNode; k: string; v: string; hi?: string };
                    const techItems = ([
                        validator.country ? { icon: <Globe className="size-3" />, k: dd.country ?? 'Country', v: validator.country } : null,
                        validator.provider ? { icon: <Server className="size-3" />, k: dd.provider ?? 'Provider', v: validator.provider } : null,
                        validator.version ? { k: dd.version ?? 'Version', v: validator.version, hi: 'var(--color-primary)' } : null
                    ] as (TechItem | null)[]).filter((f): f is TechItem => !!f);

                    if (techItems.length === 0) return null;

                    return (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {techItems.map((f) => (
                                <span key={f.k} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]/50 px-2 py-0.5 rounded-md border border-[var(--color-card-border)]/50">
                                    {f.icon && <span className="opacity-70">{f.icon}</span>}
                                    <span className="font-bold uppercase tracking-tight opacity-50">{f.k}:</span>
                                    <span className="font-semibold text-[var(--color-text-main)]" style={f.hi ? { color: f.hi } : undefined}>{f.v}</span>
                                </span>
                            ))}
                        </div>
                    );
                })()}
                <div className="flex flex-wrap gap-2 pt-1">
                    <StatusPill
                        icon={Activity}
                        label={validator.status === 'active' ? (st.active || 'Activo') : (st.inactive || 'Inactivo')}
                        color={validator.status === 'active' ? colorSuccess : colorWarning}
                    />
                    <StatusPill
                        icon={ShieldCheck}
                        label={validator.onlineStatus ? (dd.online || 'En línea') : (dd.offline || 'Desconectado')}
                        color={validator.onlineStatus ? colorSuccess : colorWarning}
                    />
                    <StatusPill
                        icon={Users}
                        label={validator.externalStakeAccepted ? (dd.accepts_stake || 'Acepta Stake') : (dd.no_accepts_stake || 'Cerrado')}
                        color={validator.externalStakeAccepted ? colorSuccess : colorWarning}
                    />
                    <StatusPill
                        icon={Users}
                        label={validator.acceptsConnect ? (dd.accepts_connect || 'Acepta Conexión') : (dd.no_accepts_connect || 'Privado')}
                        color={validator.acceptsConnect ? colorSuccess : colorWarning}
                    />
                    {/* Same control as the collapsed card: display for anyone,
                        an actionable "Vote <name>" for the validator's owner. */}
                    <VoteBadge
                        vote={voteValue}
                        label={dd.vote ?? 'Vote'}
                        validator={validator}
                        actionLabel={dd.vote_action ?? 'Votar'}
                        namedAction={dd.vote_action_named ?? 'Votar {name}'}
                    />
                </div>
            </div>
        </div>
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
    const tips = dt?.card?.tooltips;
    const Row = renderRow || SummaryInlineRow;

    const delegationLabel = dd.validator_staking_summary || dd.delegation || 'Delegation Overview';

    return (
        <div className="flex-1 flex flex-col">
            <SectionHeader label={delegationLabel} hide={hideHeader} />
            <div className="veb-drows flex-1 flex flex-col justify-between">
                {validator.delegatedStake != null && (
                    <Row
                        label={dd.validator_delegated_stake || dd.delegated_stake || 'Delegated Stake'}
                        value={formatXRDFull(validator.delegatedStake, locale)}
                        secondaryValue={validator.delegatedStakePercent != null ? `${formatPercent(validator.delegatedStakePercent, 2, locale)} ${dd.of_the_network || 'of the network'}` : undefined}
                        tooltip={formatXRDExact(validator.delegatedStake, locale)}
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
                        value={formatXRDFull(validator.ownerStake, locale)}
                        mono
                    />
                )}
                {validator.apy != null && (
                    <Row
                        label={dd.validator_apy_projection || dd.apy_projection || 'APY Projection'}
                        value={formatPercent(validator.apy, 2, locale)}
                        accentValue
                    />
                )}
                {validator.nominalFee != null && (
                    <Row
                        label={dd.validator_nominal_fee || dd.nominal_fee || 'Fee'}
                        value={formatPercent(validator.nominalFee, 2, locale)}
                        secondaryValue={validator.effectiveFee != null ? `${formatPercent(validator.effectiveFee, 2, locale)} ${dd.effective || 'effective'}` : undefined}
                        tooltip={validator.effectiveFee != null ? tips?.effective_fee : tips?.fee}
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
    useEffect(() => {
        if (validator?.address) {
            registerAddressForPolling(validator.address);
            return () => unregisterAddressForPolling(validator.address);
        }
    }, [validator?.address]);

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
                    value={formatPercent(validator.recentUptime, 2, locale)}
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
                    value={validator.totalUptime != null ? formatPercent(validator.totalUptime, 2, locale) : '—'}
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
                <ValidatorPositionMetrics {...props} />
            </div>
            <div className="space-y-0">
                <ValidatorProfileMetrics {...props} />
            </div>
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
