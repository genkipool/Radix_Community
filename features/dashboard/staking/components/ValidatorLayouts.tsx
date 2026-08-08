'use client';

import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { Globe, ExternalLink, Server, Stamp, Check, Users, Cable, Download, Plus } from 'lucide-react';
import { getStatusColor } from '@/utils/validators';
import { truncateAddress, formatDisplayUrl } from '@/utils/formatters';
import { sanitizeText, isValidUrl } from '@/utils/sanitize';
import { HighlightText } from '@/components/ui/HighlightText';
import { SafeImage } from '@/components/ui/SafeImage';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge, EntityTagsGrid } from './ValidatorBadges';
import { StatDivider, StatCell, BizRow } from './ValidatorLayoutPrimitives';
import { ValidatorShareActions, validatorPageUrl } from './ValidatorShareActions';
import { QrPopover } from '@/components/ui/QrPopover';
import { buildValidatorStats } from '../lib/validatorStats';
import { ValidatorExpandedBody } from './ValidatorExpandedBody';
import { CopyButton } from '@/components/ui/CopyButton';
import { StakingPopup } from './StakingPopup';

/* ─── Shared expand animation config ─────────── */
const EXPAND_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };
import type { DashboardDict, Network } from '../../types';
import {
    type LayoutProps,
    type ExpandPanelProps,
    type CopyAddressButtonProps,
    type DelegateButtonProps
} from '../types/components.types';

/** Internal CSV download button helper */
const CsvButton = ({ onClick, showText = true, title }: { onClick: () => void; showText?: boolean; title?: string }) => {
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`flex items-center hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors group shrink-0 ${showText ? 'gap-1.5 px-2 py-1 rounded-lg' : 'p-1 rounded-md'}`}
            title={title}
        >
            <Download className="size-3.5" />
            {showText && <span className="text-[10px] font-black uppercase tracking-tight">CSV</span>}
        </button>
    );
};

/* ─── Photo widths, shared with the share row under each photo ─── */
const PHOTO_1COL = 'w-32 sm:w-36';
const photo2Col = (columns: number) => (columns === 3 ? 'w-16 sm:w-20' : 'w-24 sm:w-28');

/**
 * Sharing at the top-right corner of a compact card, phone included.
 *
 * The phone used to get the three glyphs laid out across the header. They ended
 * up a fingertip apart, where hitting the intended one takes aim: the menu
 * gives each target a whole row with its name beside it, which is also the only
 * way to say that the third one opens the phone's own share sheet.
 */
const ShareCorner = ({
    validator, dt, locale, network,
}: Pick<LayoutProps, 'validator' | 'locale'> & { dt?: Partial<DashboardDict>; network?: Network }) => (
    <ValidatorShareActions
        validator={validator} dt={dt} locale={locale} network={network}
        variant="menu"
        className="-mr-1.5 ml-auto flex shrink-0 items-center self-start sm:mr-0"
    />
);

/* ==============================═══════════
   LAYOUT 1 — Full width, big photo left sidebar
==============================═══════════ */
export const Layout1Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
    onCopy, copiedAddress, columns, network = 'mainnet', marketData, locale, onDownloadCsv,
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const stats = buildValidatorStats(validator, dt, locale);

    return (
        <div className="flex flex-col h-full">
            <div className="flex">
                {/* Sidebar: large photo + share */}
                <div
                    className="w-44 sm:w-52 shrink-0 flex flex-col items-center p-4 pb-2 sm:p-5 sm:pb-2.5 border-r border-[var(--color-card-border)] bg-[var(--color-surface)] relative overflow-hidden cursor-pointer self-stretch"
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at top, ${statusColor}, transparent 80%)` }} />
                    <div className="relative z-10 flex-1 flex items-center">
                        <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                            className={`${PHOTO_1COL} h-32 sm:h-36 rounded-2xl object-cover shadow-xl transition-transform duration-300`}
                            style={{ border: `2.5px solid ${statusColor}` }} />
                    </div>
                    {/* Same width as the photo, so the outer icons sit on its edges */}
                    <div className={`${PHOTO_1COL} mt-auto pt-2`}>
                        <ValidatorShareActions validator={validator} dt={dt} locale={locale} network={network} />
                    </div>
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
                            <ConnectBadge accepts={validator.externalStakeAccepted} labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'} labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'} icon={Users} />
                            <ConnectBadge accepts={validator.acceptsConnect} labelYes={dt?.details?.accepts_connect ?? 'Connect'} labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'} icon={Cable} />
                            <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} />
                        </div>

                        <StatDivider items={stats} />

                        <p className="text-xs text-[var(--color-text-muted)] italic leading-relaxed line-clamp-1">
                            &ldquo;{sanitizeText(validator.description) || (dt?.details?.no_description ?? 'No description provided.')}&rdquo;
                        </p>
                    </div>

                    <div
                        className="block w-full text-left flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-[var(--color-card-border)] mt-auto cursor-auto"
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                    >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)] min-w-0">
                            {validator.website && isValidUrl(validator.website) && (
                                <a href={validator.website} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors truncate max-w-[200px] cursor-pointer">
                                    <ExternalLink className="size-3.5 shrink-0" />
                                    <span className="truncate" title={sanitizeText(validator.website)}>{formatDisplayUrl(validator.website)}</span>
                                </a>
                            )}
                            <span className="flex items-center gap-1 cursor-default" title={`${sanitizeText(validator.provider)} (${validator.providerPercent}%)`}>
                                <Server className="size-3.5 shrink-0" />
                                {sanitizeText(validator.provider)} ({validator.providerPercent}%)
                            </span>
                            <span className="flex items-center gap-1 cursor-default" title={`${sanitizeText(validator.country)} (${validator.countryPercent}%)`}>
                                <Globe className="size-3.5 shrink-0" />
                                {sanitizeText(validator.country)} ({validator.countryPercent}%)
                            </span>
                            <div className="flex items-center gap-2 min-w-0">
                                <CopyAddressButton address={validator.address} onCopy={onCopy} copiedAddress={copiedAddress} />
                                {onDownloadCsv && <CsvButton onClick={() => onDownloadCsv(validator.address)} title={dt?.details?.download_rewards_tooltip} />}
                                <QrPopover
                                    url={validatorPageUrl(validator.address, locale ?? 'en', network)}
                                    label={dt?.card?.qr ?? 'Show QR'}
                                    hint={dt?.card?.qr_hint}
                                    className="hidden sm:flex"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <EntityTagsGrid tags={validator.tags} t={t} />
                            <DelegateButton
                                label={dt?.card?.stake_button ?? 'Delegate'}
                                validator={validator}
                                t={t}
                                title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} marketData={marketData} locale={locale} onDownloadCsv={onDownloadCsv} />
        </div>
    );
};

/* ==============================═══════════
   LAYOUT 2 — Medium sidebar
==============================═══════════ */
export const Layout2Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
    onCopy, copiedAddress, columns, network = 'mainnet', marketData, locale, onDownloadCsv
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const stats = buildValidatorStats(validator, dt, locale, { compact: columns === 3 });

    return (
        <div className={`flex flex-col h-full ${!isExpanded ? 'min-h-[200px]' : ''}`}>
            <div className={`flex ${!isExpanded ? 'flex-1' : ''}`}>
                <div
                    className={`${columns === 3 ? 'w-24 sm:w-28' : 'w-36 sm:w-40'} shrink-0 flex flex-col items-center p-2 sm:p-3 border-r border-[var(--color-card-border)] bg-[var(--color-surface)] relative overflow-hidden cursor-pointer self-stretch`}
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at top, ${statusColor}, transparent 80%)` }} />
                    <div className="relative z-10 py-4 sm:py-6">
                        <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                            className={`${photo2Col(columns)} ${columns === 3 ? 'h-16 sm:h-20' : 'h-24 sm:h-28'} rounded-2xl object-cover shadow-xl transition-transform duration-300`}
                            style={{ border: `2px solid ${statusColor}` }} />
                    </div>
                    {/* Same width as the photo, so the outer icons sit on its edges.
                        At three columns that width is 64px, and full-size glyphs
                        filled it end to end: smaller ones leave a gap to aim at. */}
                    <div className={`${photo2Col(columns)} mt-auto pt-1.5`}>
                        <ValidatorShareActions
                            validator={validator} dt={dt} locale={locale} network={network}
                            size={columns === 3 ? 'cardSmall' : 'card'}
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className={`flex flex-col gap-1.5 ${columns === 3 ? 'p-2.5 sm:p-3.5' : 'p-2 sm:p-3'} ${!isExpanded ? 'flex-1' : ''}`}>
                        <div className={`flex gap-1.5 min-w-0 ${columns === 2 ? 'flex-col items-start' : 'items-center flex-nowrap'}`}>
                            <h3 className="text-sm font-black text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors truncate min-w-0 flex-1">
                                <HighlightText text={safeName} query={searchQuery} />
                            </h3>
                            <div className={`flex items-center gap-1.5 shrink-0 ${columns === 2 ? 'flex-wrap' : ''}`}>
                                <StatusLabel status={validator.status} t={t} compact={columns === 3} />
                                <OnlineBadge online={validator.onlineStatus} labelOn={dt?.details?.online ?? 'Online'} labelOff={dt?.details?.offline ?? 'Offline'} compact={columns === 3} />
                                <ConnectBadge accepts={validator.externalStakeAccepted} labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'} labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'} compact={columns === 3} icon={Users} />
                                <ConnectBadge accepts={validator.acceptsConnect} labelYes={dt?.details?.accepts_connect ?? 'Connect'} labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'} compact={columns === 3} icon={Cable} />
                                <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} compact={columns === 3} />
                            </div>
                        </div>
                        <StatDivider items={stats.slice(0, 3)} />
                        <StatDivider items={stats.slice(3)} />
                    </div>

                    <div
                        className={`block w-full text-left flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t border-[var(--color-card-border)] ${!isExpanded ? 'mt-auto' : ''} cursor-auto`}
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)] min-w-0 flex-wrap">
                            {sanitizeText(validator.country) && (
                                <span className="flex items-center gap-1 shrink-0 cursor-default" title={sanitizeText(validator.country)}>
                                    <Globe className="size-3 shrink-0" />
                                    <span className="truncate">{sanitizeText(validator.country)}</span>
                                </span>
                            )}
                            <div className="flex items-center gap-2 min-w-0">
                                <CopyAddressButton
                                    address={validator.address}
                                    onCopy={onCopy}
                                    copiedAddress={copiedAddress}
                                    small
                                    truncate={true}
                                    noTruncate={false}
                                    start={columns === 3 ? 6 : 12}
                                    end={columns === 3 ? 6 : 12}
                                />
                                {onDownloadCsv && <CsvButton onClick={() => onDownloadCsv(validator.address)} showText={columns !== 3} title={dt?.details?.download_rewards_tooltip} />}
                                <QrPopover
                                    url={validatorPageUrl(validator.address, locale ?? 'en', network)}
                                    label={dt?.card?.qr ?? 'Show QR'}
                                    hint={dt?.card?.qr_hint}
                                    className="hidden sm:flex"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <EntityTagsGrid tags={validator.tags} t={t} compact={columns === 3} />
                            <DelegateButton
                                label={dt?.card?.stake_button ?? 'Delegate'}
                                validator={validator}
                                t={t}
                                small
                                title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} marketData={marketData} locale={locale} onDownloadCsv={onDownloadCsv} />
        </div>
    );
};

/* ==============================═══════════
   LAYOUT 4 — Dense compact
==============================═══════════ */
export const Layout4Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
    onCopy, copiedAddress, columns, network = 'mainnet', marketData, locale, onDownloadCsv
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const stats = buildValidatorStats(validator, dt, locale, { compact: true });

    return (
        <div className={`flex flex-col h-full bg-[var(--color-surface)] ${!isExpanded ? 'min-h-[220px]' : ''}`}>
            {/* Row 1: Image and Name with Labels */}
            <div className="flex gap-2.5 p-3 items-center">
                <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                    className="size-12 rounded-xl object-cover shadow-md shrink-0 transition-transform duration-300"
                    style={{ border: `1.5px solid ${statusColor}90` }} />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-[var(--color-text-main)] truncate">
                        <HighlightText text={safeName} query={searchQuery} />
                    </h3>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <StatusLabel status={validator.status} t={t} compact />
                        <OnlineBadge online={validator.onlineStatus} labelOn="" labelOff="" compact />
                        <ConnectBadge accepts={validator.externalStakeAccepted} labelYes="" labelNo="" compact icon={Users} />
                        <ConnectBadge accepts={validator.acceptsConnect} labelYes="" labelNo="" compact icon={Cable} />
                        <VoteBadge vote={validator.protocolUpdateVote} label="" compact />
                    </div>
                </div>
                {/* Sharing, at the far end of the header. This layout serves
                    both the phone and the 4/5-column grid, and each gets what
                    fits: the three icons where there is width to spare, the
                    dots menu where a row of them would crowd the name. */}
                <ShareCorner validator={validator} dt={dt} locale={locale} network={network} />
            </div>

            {/* Row 2: Grid of 6 statistics */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 border-y border-[var(--color-card-border)] bg-[var(--color-surface-hover)]/30">
                {stats.map(({ key, ...stat }) => <StatCell key={key} {...stat} />)}
            </div>

            {/* Row 3: Footer */}
            <div
                className={`block w-full text-left flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${!isExpanded ? 'mt-auto' : ''} cursor-auto`}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)] flex-1 min-w-0">
                    {sanitizeText(validator.country) && (
                        <span title={sanitizeText(validator.country)} className="shrink-0 cursor-default">
                            <Globe className="size-3.5" />
                        </span>
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                        <CopyAddressButton
                            address={validator.address}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            small
                            truncate
                            start={columns === 5 ? 6 : 12}
                            end={columns === 5 ? 6 : 6}
                        />
                        {onDownloadCsv && <CsvButton onClick={() => onDownloadCsv(validator.address)} showText={false} title={dt?.details?.download_rewards_tooltip} />}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <EntityTagsGrid tags={validator.tags} t={t} compact />
                    <DelegateButton
                        label={dt?.card?.stake_button ?? 'Delegate'}
                        validator={validator}
                        t={t}
                        small
                        title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                    />
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} marketData={marketData} locale={locale} onDownloadCsv={onDownloadCsv} />
        </div>
    );
};

/* ==============================═══════════
   LAYOUT 6 — Ultra dense list
   Used for grid 6+
==============================═══════════ */
export const Layout6Col = ({
    validator, searchQuery, isExpanded, t, onExpand: _onExpand,
    onCopy, copiedAddress, columns, network = 'mainnet', marketData, locale, onDownloadCsv,
}: LayoutProps) => {
    const dt = t?.dashboard;
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const stats = buildValidatorStats(validator, dt, locale, { compact: true });

    return (
        <div className={`flex flex-col h-full bg-[var(--color-surface)] ${!isExpanded ? 'min-h-[220px]' : ''}`}>
            {/* Row 1: Photo and Name (2 columns) */}
            <div className="flex gap-2 p-2 items-center">
                <SafeImage src={validator.iconUrl} alt={safeName} fallbackName={safeName}
                    className="size-8 rounded-lg object-cover shrink-0 transition-transform duration-300"
                    style={{ border: `1px solid ${statusColor}80` }} />
                <h3 className="text-[11px] font-black text-[var(--color-text-main)] truncate leading-tight flex-1">
                    <HighlightText text={safeName} query={searchQuery} />
                </h3>
                {/* Only the dots: this list is dense enough that the name is
                    already truncating. */}
                <ValidatorShareActions
                    validator={validator} dt={dt} locale={locale} network={network}
                    variant="menu"
                    className="flex shrink-0 items-center"
                />
            </div>

            {/* Row 2: Labels */}
            <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
                <StatusLabel status={validator.status} t={t} compact />
                <OnlineBadge online={validator.onlineStatus} labelOn="" labelOff="" compact />
                <ConnectBadge accepts={validator.externalStakeAccepted} labelYes="" labelNo="" compact icon={Users} />
                <ConnectBadge accepts={validator.acceptsConnect} labelYes="" labelNo="" compact icon={Cable} />
                <VoteBadge vote={validator.protocolUpdateVote} label="" compact />
            </div>

            {/* Row 3: Single-column info */}
            <div className={`px-2 py-1 border-t border-[var(--color-card-border)] bg-[var(--color-surface-hover)]/20 ${!isExpanded ? 'flex-1' : ''}`}>
                {stats.map(({ key, ...stat }) => <BizRow key={key} {...stat} vertical={columns >= 8} />)}
            </div>

            {/* Row 4: Footer — SVG Web, SVG Address, Button */}
            <div
                className={`block w-full text-left flex items-center justify-between gap-1 p-2 border-t border-[var(--color-card-border)] bg-[var(--color-surface)] ${!isExpanded ? 'mt-auto' : ''} cursor-auto`}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
            >
                <div className={`flex items-center ${columns >= 8 ? 'gap-1' : 'gap-2'}`}>
                    {validator.website && isValidUrl(validator.website) ? (
                        <a href={validator.website} target="_blank" rel="noopener noreferrer" title={formatDisplayUrl(validator.website)}>
                            <Globe className="size-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors shrink-0" />
                        </a>
                    ) : sanitizeText(validator.country) ? (
                        <span title={sanitizeText(validator.country)} className="shrink-0 cursor-default">
                            <Globe className="size-3.5 text-[var(--color-text-muted)]" />
                        </span>
                    ) : null}
                    <CopyStampIcon
                        address={validator.address}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                    />
                    {onDownloadCsv && <CsvButton onClick={() => onDownloadCsv(validator.address)} showText={false} title={dt?.details?.download_rewards_tooltip} />}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <EntityTagsGrid tags={validator.tags} t={t} compact />
                    <DelegateButton
                        label={dt?.card?.stake_button ?? 'Delegate'}
                        validator={validator}
                        t={t}
                        small
                        compact={columns >= 8}
                        title={validator.delegatedStakePercent > 2 ? dt?.card?.tooltips?.share_warning : undefined}
                    />
                </div>
            </div>

            <ExpandPanel isExpanded={isExpanded} validator={validator} t={t} onCopy={onCopy} copiedAddress={copiedAddress} columns={columns} network={network} marketData={marketData} locale={locale} onDownloadCsv={onDownloadCsv} />
        </div>
    );
};

/* ─── Shared helpers ──────────────────────────── */

/** Animated expand panel shared by all layout variants */
const ExpandPanel = ({
    isExpanded, validator, t, onCopy, copiedAddress, columns, network = 'mainnet', marketData, locale, onDownloadCsv,
}: ExpandPanelProps) => (
    <AnimatePresence initial={false}>
        {isExpanded && (
            <m.div
                className="overflow-hidden w-full"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 1, height: 0 }}
                transition={EXPAND_TRANSITION}
            >
                <div className="min-h-[300px]">
                    <ValidatorExpandedBody
                        validator={validator}
                        t={t}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        columns={columns}
                        network={network}
                        marketData={marketData}
                        locale={locale}
                        onDownloadCsv={onDownloadCsv}
                    />
                </div>
            </m.div>
        )}
    </AnimatePresence>
);

/** Stamp icon with Check feedback for compact layouts (grid 6+) */
const CopyStampIcon = ({
    address, onCopy, copiedAddress,
}: { address: string; onCopy: (a: string) => void; copiedAddress: string | null }) => {
    const [localCopied, setLocalCopied] = useState(false);
    const isCopied = localCopied || (!!copiedAddress && copiedAddress === address);

    const handleAddressCopy = () => {
        onCopy(address);
        setLocalCopied(true);
        setTimeout(() => setLocalCopied(false), 2000);
    };

    return (
        <button type="button"
            className="p-1 hover:bg-[var(--color-primary)]/10 rounded-md transition-colors cursor-pointer shrink-0"
            onClick={handleAddressCopy}
            title={address}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isCopied ? (
                    <m.div key="check" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Check className="size-3.5 text-green-500" />
                    </m.div>
                ) : (
                    <m.div key="stamp" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Stamp className="size-3.5 text-[var(--color-primary)]" />
                    </m.div>
                )}
            </AnimatePresence>
        </button>
    );
};

/** Copy address button with feedback */
const CopyAddressButton = ({
    address, onCopy, copiedAddress, small = false, truncate = false, noTruncate = false,
    start = 12, end = 6,
}: CopyAddressButtonProps) => {
    const isCopied = !!copiedAddress && copiedAddress === address;
    const displayText = truncate ? truncateAddress(address, start, end) : address;
    return (
        <div
            role="button"
            tabIndex={0}
            className={`flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer min-w-0 font-mono ${small ? 'text-[10px] leading-tight' : 'text-[11px] leading-tight'}`}
            onClick={() => onCopy(address)}
            onKeyDown={(e) => e.key === 'Enter' && onCopy(address)}
            title={address}
        >
            <Stamp className={`shrink-0 text-[var(--color-primary)] ${small ? 'size-3' : 'size-3.5'}`} />
            <span className={`block translate-y-[0.5px] ${noTruncate ? '' : 'truncate'} ${noTruncate ? '' : (small ? 'max-w-[140px]' : 'max-w-[220px] sm:max-w-xs')} ${isCopied ? 'text-green-700 dark:text-green-400' : ''}`}>
                {sanitizeText(displayText)}
            </span>
            <CopyButton value={address} variant="minimal" size="xs" forceCopied={isCopied} className="pointer-events-none !p-0 !border-0 !min-h-0 !min-w-0 translate-y-[-0.5px]" />
        </div>
    );
};

/** Stake/Delegate CTA button wrapped in StakingPopup */
const DelegateButton = ({
    label, validator, t, small = false, tiny = false, title, compact = false,
}: DelegateButtonProps) => {
    return (
        <StakingPopup validator={validator} t={t}>
            <button
                type="button"
                title={title}
                className={`rounded-xl font-bold text-white whitespace-nowrap hover:opacity-90 transition-opacity duration-300 ${tiny ? 'px-3 py-1 text-[9px] rounded-lg' :
                    small ? (compact ? 'w-8 h-7 flex items-center justify-center p-0' : 'px-4 py-1.5 text-[10px]') :
                        'px-5 py-1.5 text-[11px] shadow-lg'
                    }`}
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-primary)))' }}
                onClick={e => e.stopPropagation()}
            >
                {compact ? <Plus className="size-3.5" /> : label}
            </button>
        </StakingPopup>
    );
};