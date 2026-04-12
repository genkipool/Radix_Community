'use client';
import React from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStatusColor } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { isValidUrl, sanitizeText } from '@/utils/sanitize';
import { SafeImage } from '@/components/ui/SafeImage';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge } from './ValidatorBadges';
import { ValidatorExpandedBody } from './ValidatorExpandedBody';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLayout } from '@/context/LayoutContext';
import { type ValidatorDetailViewProps } from '../types';

export const ValidatorDetailView: React.FC<ValidatorDetailViewProps> = ({
    validator,
    onClose,
    onPrev,
    onNext,
    t,
    dt,
    copiedAddress,
    copyAddress,
    network = 'mainnet',
}) => {
    const { setShowUnderConstruction } = useLayout();
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const isAddrCopied = !!copiedAddress && copiedAddress === validator.address;

    return (
        <div
            className="relative w-full rounded-[20px] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-[0_32px_80px_rgba(0,0,0,0.45),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] flex flex-col"
            onClick={e => e.stopPropagation()}
        >
            {/* ══════════════════════════════════════════
                ROW 1 — HEADER (4 columns)
            ══════════════════════════════════════════ */}
            <div className="relative grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] grid-rows-[auto_auto] sm:grid-rows-1 items-center gap-[10px] sm:gap-0 p-[14px] sm:p-5 border-b border-[var(--color-card-border)] bg-[var(--color-surface)] overflow-hidden" style={{ '--status-color': statusColor } as React.CSSProperties}>
                {/* Gradient glow from status color */}
                <div className="absolute inset-0 pointer-events-none z-0" style={{ background: `linear-gradient(135deg, ${statusColor}22 0%, transparent 60%)` }} />

                {/* Col 1 — Photo */}
                <div className="relative z-10 row-start-1 col-start-1 shrink-0 flex flex-col items-center mr-[12px] sm:mr-5">
                    <div className="w-[72px] h-[72px] sm:w-[110px] sm:h-[110px] rounded-[16px] sm:rounded-[22px] border-[2.5px] overflow-hidden shrink-0 transition-all duration-300 hover:scale-[1.04]" style={{ borderColor: statusColor, boxShadow: `0 0 28px ${statusColor}45` }}>
                        <SafeImage
                            src={validator.iconUrl}
                            alt={safeName}
                            fallbackName={safeName}
                            className="w-full h-full object-cover block"
                            loading="eager"
                        />
                    </div>
                </div>

                {/* Col 2 — Identity */}
                <div className="relative z-10 min-w-0 flex flex-col gap-2 row-start-1 col-start-2 sm:pr-4">
                    {/* Name */}
                    <h2 className="font-black text-[var(--color-text-main)] tracking-tight leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis text-[16px] sm:text-[clamp(18px,2.5vw,28px)]">{safeName}</h2>

                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <StatusLabel status={validator.status} t={t} />
                        <OnlineBadge
                            online={validator.onlineStatus}
                            labelOn={dt?.details?.online ?? 'Online'}
                            labelOff={dt?.details?.offline ?? 'Offline'}
                        />
                        <ConnectBadge
                            accepts={validator.externalStakeAccepted}
                            labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'}
                            labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'}
                        />
                        <ConnectBadge
                            accepts={validator.acceptsConnect}
                            labelYes={dt?.details?.accepts_connect ?? 'Accepts Connection'}
                            labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'}
                        />
                        <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} />
                    </div>

                    {/* Website */}
                    {validator.website && isValidUrl(validator.website) && (
                        <a
                            href={validator.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-[5px] text-xs font-medium text-[var(--color-primary)] no-underline max-w-[340px] overflow-hidden whitespace-nowrap text-ellipsis transition-opacity hover:opacity-80 hover:underline"
                            onClick={e => e.stopPropagation()}
                        >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span>{sanitizeText(validator.website)}</span>
                        </a>
                    )}

                    {/* Validator address + delegate CTA */}
                    <div className="flex flex-col sm:flex-row sm:items-center items-start gap-[6px] sm:gap-[10px] min-w-0">
                        <div
                            className="flex items-center gap-[6px] cursor-pointer min-w-0 group/addr"
                            onClick={e => { e.stopPropagation(); copyAddress(validator.address); }}
                        >
                            <code className={`text-[11px] font-mono text-[var(--color-text-muted)] group-hover/addr:text-[var(--color-primary)] whitespace-nowrap overflow-hidden text-ellipsis transition-colors min-w-0 ${isAddrCopied ? '!text-[#16a34a]' : ''}`}>
                                {validator.address}
                            </code>
                            <CopyButton
                                value={validator.address}
                                variant="minimal"
                                size="xs"
                                forceCopied={isAddrCopied}
                                className="pointer-events-none shrink-0"
                            />
                        </div>
                        <button
                            className="self-start sm:self-auto shrink-0 px-[18px] py-[6px] rounded-[10px] text-xs font-extrabold uppercase tracking-[0.06em] text-white border-none cursor-pointer whitespace-nowrap transition-all duration-150 ease-out shadow-[0_4px_12px_color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_color-mix(in_srgb,var(--color-primary)_40%,transparent)] active:scale-[0.96]"
                            style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-primary)))` }}
                            onClick={e => {
                                e.stopPropagation();
                                setShowUnderConstruction(true);
                            }}
                        >
                            {dt?.card?.stake_button ?? 'Stake'}
                        </button>
                    </div>
                </div>

                {/* Col 3 — Prev / Next navigation */}
                <div className="relative z-10 flex flex-row sm:flex-col gap-1.5 p-0 sm:px-3 sm:border-x sm:border-[var(--color-card-border)] self-auto sm:self-stretch justify-end sm:justify-center row-start-1 col-start-3">
                    <button
                        className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-[var(--color-card-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] cursor-pointer transition-all hover:not-disabled:border-[var(--color-primary)] hover:not-disabled:text-[var(--color-primary)] hover:not-disabled:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={onPrev}
                        disabled={!onPrev}
                        aria-label="Validator anterior"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-[var(--color-card-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] cursor-pointer transition-all hover:not-disabled:border-[var(--color-primary)] hover:not-disabled:text-[var(--color-primary)] hover:not-disabled:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={onNext}
                        disabled={!onNext}
                        aria-label="Validador siguiente"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Col 4 — Close */}
                <div className="relative z-10 hidden sm:flex items-center justify-center pl-3 self-stretch row-start-1 col-start-4">
                    <button 
                        className="flex items-center justify-center w-[38px] h-[38px] rounded-[10px] border border-[color-mix(in_srgb,#dc2626_30%,transparent)] bg-[color-mix(in_srgb,#dc2626_8%,transparent)] text-[#dc2626] cursor-pointer transition-all shrink-0 hover:bg-[color-mix(in_srgb,#dc2626_18%,transparent)] hover:border-[#dc2626] hover:scale-105 active:scale-[0.95]" 
                        onClick={onClose} 
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                ROWS 2 + 3 — Body (veb-classic-grid)
            ══════════════════════════════════════════ */}
            <div className="overflow-y-visible flex-1 custom-scrollbar [&>.veb]:!border-t-0">
                <ValidatorExpandedBody
                    validator={validator}
                    t={t}
                    onCopy={copyAddress}
                    copiedAddress={copiedAddress}
                    columns={1}
                    network={network}
                    hideCta
                />
            </div>

            {/* ══════════════════════════════════════════
                FOOTER — CTA
            ══════════════════════════════════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[10px] sm:gap-5 p-[14px] sm:px-6 sm:py-[14px] border-t border-[var(--color-card-border)] bg-[var(--color-surface)] shrink-0 items-stretch">
                <p className="text-[13px] text-[var(--color-text-muted)] font-medium leading-[1.4] m-0 flex-1">
                    {dt?.card?.stake_hint ?? 'Delegate your XRD to this validator and start earning rewards.'}
                </p>
                <Button
                    variant="primary"
                    className="!h-[38px] !px-8 !rounded-[10px] !text-[13px] !font-bold !uppercase !tracking-wider whitespace-nowrap shrink-0 !transition-all duration-200 w-full sm:w-auto justify-center hover:!opacity-90 active:!scale-[0.97]"
                    onClick={e => {
                        e.stopPropagation();
                        setShowUnderConstruction(true);
                    }}
                >
                    {dt?.card?.stake_button ?? 'Stake'}
                </Button>
            </div>
        </div>
    );
};