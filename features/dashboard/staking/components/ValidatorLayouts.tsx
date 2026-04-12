'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ExternalLink, Server, AlertCircle, Stamp } from 'lucide-react';
import { getStatusColor } from '@/utils/validators';
import { formatXRD, formatNumber, truncateAddress } from '@/utils/formatters';
import { sanitizeText, isValidUrl } from '@/utils/sanitize';
import { HighlightText } from '@/components/ui/HighlightText';
import { SafeImage } from '@/components/ui/SafeImage';
import { StatusLabel, UptimeBar } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge, EntityTagsGrid } from './ValidatorBadges';
import { StatDivider, BizRow } from './ValidatorLayoutPrimitives';
import { ValidatorExpandedBody } from './ValidatorExpandedBody';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLayout } from '@/context/LayoutContext';

/* ─── Shared expand animation config ─────────── */
const EXPAND_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };
import { 
    type LayoutProps,
    type ExpandPanelProps,
    type CopyAddressButtonProps,
    type DelegateButtonProps
} from '../types/components.types';

/* ═════════════════════════════════════════
   LAYOUT 1 — Full width, big photo left sidebar
═════════════════════════════════════════ */
export const Layout1Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
onCopy, copiedAddress, columns, network = 'mainnet',
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);

    return (
        <div className="flex flex-col">
            <div className="flex">
                {/* Sidebar: large photo + uptime */}
                <div
                    className="w-44 sm:w-52 shrink-0 flex flex-col items-center p-4 sm:p-5 border-r border-[var(--color-card-border)] bg-[var(--color-surface)] relative overflow-hidden cursor-pointer self-stretch"
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at top, ${statusColor}, transparent 80%)` }} />
                    <div className="relative z-10 flex-1 flex items-center">
                        <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                            className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover shadow-xl transition-transform duration-300"
                            style={{ border: `2.5px solid ${statusColor}` }} />
                    </div>
                    <div className="w-full mt-auto pt-2"><UptimeBar percent={validator.uptimePercent} t={t} /></div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-black text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                                <HighlightText text={safeName} query={searchQuery} />
                            </h3>
                            <StatusLabel status={validator.status} t={t} />
                            <OnlineBadge online={validator.onlineStatus} labelOn={dt?.details?.online ?? 'Online'} labelOff={dt?.details?.offline ?? 'Offline'} />
                            <ConnectBadge accepts={validator.externalStakeAccepted} labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'} labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'} />
                            <ConnectBadge accepts={validator.acceptsConnect} labelYes={dt?.details?.accepts_connect ?? 'Connect'} labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'} />
                            <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} />
                        </div>

                        <StatDivider items={[
                            {
                                label: dt?.card?.stake ?? 'Total Stake',
                                tooltip: dt?.card?.tooltips?.stake,
                                value: (
                                    <div className="flex items-baseline gap-1.5">
                                                                                <span
                                            className={`transition-colors duration-300 ${validator.delegatedStakePercent > 2 ? 'text-red-500 font-bold' : 'text-[var(--color-text-main)] font-semibold'}`}
                                            title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.stake}
                                        >
                                            {formatXRD(validator.delegatedStake)}
                                        </span>
                                        <span
                                            className={`text-[10px] font-medium transition-colors ${validator.delegatedStakePercent > 2 ? 'text-red-500 opacity-100 font-bold' : 'opacity-50 hover:text-[var(--color-primary)]'}`}
                                            title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.share}
                                        >
                                            ({validator.delegatedStakePercent.toFixed(2)}%)
                                        </span>
                                    </div>
                                )
                            },
                            {
                                label: dt?.card?.fee ?? 'Fee',
                                tooltip: validator.hasPendingFeeChange ? `${dt?.card?.tooltips?.pending_fee} (-> ${validator.upcomingFee}%)` : dt?.card?.tooltips?.fee,
                                value: (
                                    <div className="flex items-center gap-1">
                                        <span>{formatNumber(validator.nominalFee, 2)}%</span>
                                        {validator.hasPendingFeeChange && (
                                            <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                                        )}
                                    </div>
                                )
                            },
                            { label: dt?.card?.apy ?? 'APY', tooltip: dt?.card?.tooltips?.apy, value: `${formatNumber(validator.apyProjection, 2)}%`, accent: '#16a34a' },
                            { label: dt?.details?.effective_fee ?? 'Eff. Fee', tooltip: dt?.details?.effective_fee, value: `${formatNumber(validator.effectiveFee, 2)}%` },
                            { label: dt?.card?.uptime_14d ?? 'Uptime 14d', tooltip: dt?.card?.tooltips?.uptime, value: `${validator.recentUptime.toFixed(2)}%`, accent: '#16a34a' },
                            { label: dt?.details?.delegators ?? 'Delegators', tooltip: dt?.card?.tooltips?.delegators, value: formatNumber(validator.delegators, 0) },
                        ]} />

                        <p className="text-xs text-[var(--color-text-muted)] italic leading-relaxed line-clamp-1">
                            &ldquo;{sanitizeText(validator.description) || (dt?.details?.no_description ?? 'No description provided.')}&rdquo;
                        </p>
                    </div>

                    <div
                        className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-[var(--color-card-border)]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)] min-w-0">
                            {validator.website && isValidUrl(validator.website) && (
                                <a href={validator.website} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors truncate max-w-[200px]">
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{sanitizeText(validator.website)}</span>
                                </a>
                            )}
                            <span className="flex items-center gap-1">
                                <Server className="w-3.5 h-3.5 shrink-0" />
                                {sanitizeText(validator.provider)} ({validator.providerPercent}%)
                            </span>
                            <span className="flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 shrink-0" />
                                {sanitizeText(validator.country)} ({validator.countryPercent}%)
                            </span>
                            <CopyAddressButton address={validator.address} onCopy={onCopy} copiedAddress={copiedAddress} noTruncate />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <EntityTagsGrid tags={validator.tags} t={t} />
                            <DelegateButton
                                label={dt?.card?.stake_button ?? 'Delegar'}
                                title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} />
        </div>
    );
};

/* ═════════════════════════════════════════
   LAYOUT 2 — Medium sidebar
═════════════════════════════════════════ */
export const Layout2Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
onCopy, copiedAddress, columns, network = 'mainnet',
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-1">
                <div
                    className={`${columns === 3 ? 'w-24 sm:w-28' : 'w-36 sm:w-40'} shrink-0 flex flex-col items-center p-2 sm:p-3 border-r border-[var(--color-card-border)] bg-[var(--color-surface)] relative overflow-hidden cursor-pointer self-stretch`}
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at top, ${statusColor}, transparent 80%)` }} />
                    <div className="relative z-10 flex-1 flex items-center">
                        <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                            className={`${columns === 3 ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-24 h-24 sm:w-28 sm:h-28'} rounded-2xl object-cover shadow-xl transition-transform duration-300`}
                            style={{ border: `2px solid ${statusColor}` }} />
                    </div>
                    <div className="w-full mt-auto pt-1.5"><UptimeBar percent={validator.uptimePercent} t={t} size="md" /></div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className={`flex-1 flex flex-col gap-1.5 ${columns === 3 ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3'}`}>
                        <div className={`flex gap-1.5 min-w-0 ${columns === 2 ? 'flex-col items-start' : 'items-center flex-nowrap'}`}>
                            <h3 className="text-sm font-black text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors truncate min-w-0 flex-1">
                                <HighlightText text={safeName} query={searchQuery} />
                            </h3>
                            <div className={`flex items-center gap-1.5 shrink-0 ${columns === 2 ? 'flex-wrap' : ''}`}>
                                <StatusLabel status={validator.status} t={t} compact={columns === 3} />
                                <OnlineBadge online={validator.onlineStatus} labelOn={dt?.details?.online ?? 'Online'} labelOff={dt?.details?.offline ?? 'Offline'} compact={columns === 3} />
                                <ConnectBadge accepts={validator.externalStakeAccepted} labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'} labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'} compact={columns === 3} />
                                <ConnectBadge accepts={validator.acceptsConnect} labelYes={dt?.details?.accepts_connect ?? 'Connect'} labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'} compact={columns === 3} />
                                <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} compact={columns === 3} />
                            </div>
                        </div>
                        <StatDivider items={[
                            {
                                label: dt?.card?.stake ?? 'Stake',
                                tooltip: dt?.card?.tooltips?.stake,
                                value: (
                                    <div className="flex items-baseline gap-1.5">
                                                                                <span
                                            className={`transition-colors duration-300 ${validator.delegatedStakePercent > 2 ? 'text-red-500 font-bold' : 'text-[var(--color-text-main)] font-semibold'}`}
                                            title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.stake}
                                        >
                                            {formatXRD(validator.delegatedStake)}
                                        </span>
                                        <span
                                            className={`text-[10px] font-medium transition-colors ${validator.delegatedStakePercent > 2 ? 'text-red-500 opacity-100 font-bold' : 'opacity-50 hover:text-[var(--color-primary)]'}`}
                                            title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.share}
                                        >
                                            ({validator.delegatedStakePercent.toFixed(2)}%)
                                        </span>
                                    </div>
                                )
                            },
                            {
                                label: dt?.card?.fee ?? 'Fee',
                                tooltip: validator.hasPendingFeeChange ? `${dt?.card?.tooltips?.pending_fee} (-> ${validator.upcomingFee}%)` : dt?.card?.tooltips?.fee,
                                value: (
                                    <div className="flex items-center gap-1">
                                        <span>{formatNumber(validator.nominalFee, 2)}%</span>
                                        {validator.hasPendingFeeChange && (
                                            <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                                        )}
                                    </div>
                                )
                            },
                            { label: dt?.card?.apy ?? 'APY', tooltip: dt?.card?.tooltips?.apy, value: `${formatNumber(validator.apyProjection, 2)}%`, accent: '#16a34a' },
                        ]} />
                        <StatDivider items={[
                            { label: dt?.details?.effective_fee ?? 'Eff. Fee', tooltip: dt?.details?.effective_fee, value: `${formatNumber(validator.effectiveFee, 2)}%` },
                            { label: dt?.card?.uptime_14d ?? 'Uptime 14d', tooltip: dt?.card?.tooltips?.uptime, value: `${validator.recentUptime.toFixed(2)}%`, accent: '#16a34a' },
                            { label: dt?.details?.delegators ?? 'Delegators', tooltip: dt?.card?.tooltips?.delegators, value: formatNumber(validator.delegators, 0) },
                        ]} />
                    </div>

                    <div
                        className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t border-[var(--color-card-border)]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)] min-w-0 flex-wrap">
                            <span className="flex items-center gap-1 shrink-0">
                                <Globe className="w-3 h-3 shrink-0" />
                                <span className="truncate">{sanitizeText(validator.country)}</span>
                            </span>
                            <CopyAddressButton
                                address={validator.address}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                small
                                truncate={true}
                                noTruncate={false}
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <EntityTagsGrid tags={validator.tags} t={t} compact={columns === 3} />
                            <DelegateButton
                                label={dt?.card?.stake_button ?? 'Delegar'}
                                small
                                title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} />
        </div>
    );
};

/* ═════════════════════════════════════════
   LAYOUT 4 — Dense compact
═════════════════════════════════════════ */
export const Layout4Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
onCopy, copiedAddress, columns, network = 'mainnet',
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface)]">
            {/* Fila 1: Imagen y Nombre con Etiquetas */}
            <div className="flex gap-2.5 p-3 items-center">
                <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                    className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 transition-transform duration-300"
                    style={{ border: `1.5px solid ${statusColor}90` }} />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-[var(--color-text-main)] truncate">
                        <HighlightText text={safeName} query={searchQuery} />
                    </h3>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <StatusLabel status={validator.status} t={t} compact />
                        <OnlineBadge online={validator.onlineStatus} labelOn="" labelOff="" compact />
                        <ConnectBadge accepts={validator.externalStakeAccepted} labelYes="" labelNo="" compact />
                        <ConnectBadge accepts={validator.acceptsConnect} labelYes="" labelNo="" compact />
                        <VoteBadge vote={validator.protocolUpdateVote} label="" compact />
                    </div>
                </div>
            </div>

            {/* Row 2: Grid of 6 statistics */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 border-y border-[var(--color-card-border)] bg-[var(--color-surface-hover)]/30">
                <div className="flex flex-col gap-0.5" title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.share}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.card?.stake ?? 'Stake Total'}</span>
                    <span className={`text-[12px] font-black truncate ${validator.delegatedStakePercent > 2 ? 'text-red-500' : 'text-[var(--color-text-main)]'}`}>
                        {formatXRD(validator.delegatedStake)} {validator.delegatedStakePercent > 2 && `(${validator.delegatedStakePercent.toFixed(1)}%)`}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.card?.fee ?? 'Comisión'}</span>
                    <div className="flex items-center gap-1 text-[12px] font-black text-[var(--color-text-main)] truncate">
                        <span>{formatNumber(validator.nominalFee, 1)}%</span>
                        {validator.hasPendingFeeChange && <AlertCircle className="w-2.5 h-2.5 text-amber-500 animate-pulse shrink-0" />}
                    </div>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.card?.apy ?? 'APY'}</span>
                    <span className="text-[12px] font-black text-[#16a34a] truncate">{formatNumber(validator.apyProjection, 2)}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.details?.effective_fee ?? 'Com. Efectiva'}</span>
                    <span className="text-[12px] font-black text-[var(--color-text-main)] truncate">{formatNumber(validator.effectiveFee, 1)}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.card?.uptime_14d ?? 'Uptime 14d'}</span>
                    <span className="text-[12px] font-black" style={{ color: '#16a34a' }}>{validator.recentUptime.toFixed(1)}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] line-clamp-1">{dt?.details?.delegators ?? 'Delegadores'}</span>
                    <span className="text-[12px] font-black text-[var(--color-text-main)] truncate">{formatNumber(validator.delegators, 0)}</span>
                </div>
            </div>

            {/* Fila 3: Footer */}
            <div
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mt-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)] flex-1 min-w-0">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <CopyAddressButton
                        address={validator.address}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        small
                        truncate
                        start={columns === 5 ? 6 : 12}
                        end={columns === 5 ? 6 : 6}
                    />
                </div>
                <DelegateButton
                    label={dt?.card?.stake_button ?? 'Delegar'}
                    small
                    title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                />
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} />
        </div>
    );
};

/* ═════════════════════════════════════════
   LAYOUT 6 — Ultra dense list
   Used for grid 6+
═════════════════════════════════════════ */
export const Layout6Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
onCopy, copiedAddress, columns, network = 'mainnet',
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface)]">
            {/* Fila 1: Foto y Nombre (2 columnas) */}
            <div className="flex gap-2 p-2 items-center">
                <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                    className="w-8 h-8 rounded-lg object-cover shrink-0 transition-transform duration-300"
                    style={{ border: `1px solid ${statusColor}80` }} />
                <h3 className="text-[11px] font-black text-[var(--color-text-main)] truncate leading-tight flex-1">
                    <HighlightText text={safeName} query={searchQuery} />
                </h3>
            </div>

            {/* Fila 2: Etiquetas */}
            <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
                <StatusLabel status={validator.status} t={t} compact />
                <OnlineBadge online={validator.onlineStatus} labelOn="" labelOff="" compact />
                <ConnectBadge accepts={validator.externalStakeAccepted} labelYes="" labelNo="" compact />
                <ConnectBadge accepts={validator.acceptsConnect} labelYes="" labelNo="" compact />
                <VoteBadge vote={validator.protocolUpdateVote} label="" compact />
            </div>

            {/* Row 3: Single-column info */}
            <div className="flex-1 px-2 py-1 border-t border-[var(--color-card-border)] bg-[var(--color-surface-hover)]/20">
                <BizRow
                    label={dt?.card?.stake ?? 'Stake'}
                    value={validator.delegatedStakePercent > 2
                        ? `${formatXRD(validator.delegatedStake)} (${validator.delegatedStakePercent.toFixed(1)}%)`
                        : formatXRD(validator.delegatedStake)
                    }
                    accent={validator.delegatedStakePercent > 2 ? '#dc2626' : 'var(--color-text-main)'}
                    tooltip={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : dt?.card?.tooltips?.share}
                    vertical={columns >= 8}
                />
                <BizRow label={dt?.card?.apy ?? 'APY'} value={`${formatNumber(validator.apyProjection, 1)}%`} accent="#16a34a" vertical={columns >= 8} />
                <BizRow label={dt?.details?.effective_fee ?? 'Eff. Fee'} value={`${formatNumber(validator.effectiveFee, 1)}%`} vertical={columns >= 8} />
                <BizRow label={dt?.card?.uptime_14d ?? 'Uptime'} value={`${validator.recentUptime.toFixed(1)}%`} accent="#16a34a" vertical={columns >= 8} />
                <BizRow label={dt?.details?.delegators ?? 'Del.'} value={formatNumber(validator.delegators, 0)} vertical={columns >= 8} />
            </div>

            {/* Row 4: Footer — SVG Web, SVG Address, Button */}
            <div
                className="flex items-center justify-between gap-1 p-2 border-t border-[var(--color-card-border)] bg-[var(--color-surface)]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors shrink-0" />
                    <div
                        className="p-1 hover:bg-[var(--color-primary)]/10 rounded-md transition-colors cursor-pointer shrink-0"
                        onClick={() => onCopy(validator.address)}
                    >
                        <Stamp className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    </div>
                </div>
                                <DelegateButton
                                label={dt?.card?.stake_button ?? 'Delegar'}
                                small
                                title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                            />
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} />
        </div>
    );
};

/* ─── Shared helpers ──────────────────────────── */

/** Animated expand panel shared by all layout variants */
const ExpandPanel = ({
    isExpanded, validator, t, onCopy, copiedAddress, columns, network = 'mainnet',
}: ExpandPanelProps) => (
    <AnimatePresence initial={false}>
        {isExpanded && (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={EXPAND_TRANSITION}
                className="overflow-hidden"
            >
                <ValidatorExpandedBody
                    validator={validator}
                    t={t}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    columns={columns}
                    network={network}
                />
            </motion.div>
        )}
    </AnimatePresence>
);

/** Copy address button with feedback */
const CopyAddressButton = ({
    address, onCopy, copiedAddress, small = false, truncate = false, noTruncate = false,
    start = 12, end = 6,
}: CopyAddressButtonProps) => {
    const isCopied = !!copiedAddress && copiedAddress === address;
    const displayText = truncate ? truncateAddress(address, start, end) : address;
    return (
        <div
            className={`flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors cursor-pointer min-w-0 font-mono ${small ? 'text-[9px]' : 'text-[10px]'}`}
            onClick={() => onCopy(address)}
        >
            <Stamp className={`shrink-0 text-[var(--color-primary)] ${small ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            <span className={`${noTruncate ? '' : 'truncate'} ${noTruncate ? '' : (small ? 'max-w-[140px]' : 'max-w-[220px] sm:max-w-xs')} ${isCopied ? 'text-green-700 dark:text-green-400' : ''}`}>
                {sanitizeText(displayText)}
            </span>
            <CopyButton value={address} variant="minimal" size="xs" forceCopied={isCopied} className="pointer-events-none" />
        </div>
    );
};

/** Stake/Delegate CTA button */
const DelegateButton = ({
    label, small = false, tiny = false, title,
}: DelegateButtonProps) => {
    const { setShowUnderConstruction } = useLayout();

    return (
        <button
            title={title}
            className={`rounded-xl font-black uppercase tracking-wider text-white whitespace-nowrap active:scale-95 transition-all ${tiny ? 'px-3 py-1 text-[9px] rounded-lg' :
                small ? 'px-4 py-1.5 text-[10px]' :
                    'px-5 py-1.5 text-[11px] shadow-lg'
                }`}
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            onClick={e => {
                e.stopPropagation();
                setShowUnderConstruction(true);
            }}
        >
            {label}
        </button>
    );
};