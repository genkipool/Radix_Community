'use client';
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { getStatusColor } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { CloseButton } from '@/components/ui/CloseButton';
import { isValidUrl, sanitizeText } from '@/utils/sanitize';
import { SafeImage } from '@/components/ui/SafeImage';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge, EntityTagsGrid } from './ValidatorBadges';
import { ValidatorExpandedBody } from './ValidatorExpandedBody';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLayout } from '@/context/LayoutContext';
import { type ValidatorDetailViewProps } from '../types';
import { SwipeableContainer } from '@/components/ui/SwipeableContainer';

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
    direction: propDirection = 0,
    setDirection,
}) => {
    const { setShowUnderConstruction } = useLayout();
    const statusColor = getStatusColor(validator.status);
    const safeName = sanitizeText(validator.name);
    const isAddrCopied = !!copiedAddress && copiedAddress === validator.address;

    const activeDirection = propDirection;

    return (
        <div
            className="relative w-full rounded-[20px] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-[0_32px_80px_rgba(0,0,0,0.45),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] flex flex-col"
            onClick={e => e.stopPropagation()}
        >
            <AnimatePresence mode="popLayout" initial={false} custom={activeDirection}>
                <SwipeableContainer
                    key={validator.address}
                    itemKey={validator.address}
                    direction={activeDirection}
                    setDirection={setDirection || (() => { })}
                    onPrev={onPrev}
                    onNext={onNext}
                    className="flex-1 flex flex-col min-h-0 relative touch-none bg-[var(--color-surface)]"
                >
                    {/* ══════════════════════════════════════════
                        ROW 1 — HEADER
                    ══════════════════════════════════════════ */}
                    <div className="relative grid grid-cols-[auto_1fr] items-center gap-0 p-[14px] sm:p-5 border-b border-[var(--color-card-border)] bg-[var(--color-surface)] overflow-hidden" style={{ '--status-color': statusColor } as React.CSSProperties}>
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

                        {/* Col 2 — Identity + Close */}
                        <div className="relative z-10 min-w-0 flex flex-col gap-2 row-start-1 col-start-2">
                            <div className="flex items-center justify-between gap-4">
                                <h2 className="font-black text-[var(--color-text-main)] tracking-tight leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis text-[16px] sm:text-[clamp(18px,2.5vw,28px)] flex-1">
                                    {safeName}
                                </h2>

                                <CloseButton
                                    onClose={onClose}
                                    title="Cerrar"
                                    iconSize={20}
                                />
                            </div>

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
                                    <code className={`text-[11px] font-mono text-[var(--color-text-muted)] group-hover/addr:text-[var(--color-primary)] transition-colors min-w-0 ${isAddrCopied ? '!text-[#16a34a]' : ''}`}>
                                        <span className="hidden sm:inline">{validator.address}</span>
                                        <span className="inline sm:hidden">{validator.address.slice(0, 8)}...{validator.address.slice(-8)}</span>
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
                                    className="self-start sm:self-auto shrink-0 px-[18px] py-[6px] rounded-[10px] text-xs font-bold text-white border-none cursor-pointer whitespace-nowrap transition-all duration-150 ease-out shadow-[0_4px_12px_color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:opacity-90 active:scale-[0.96]"
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
                    </div>

                    {/* ══════════════════════════════════════════
                        ROWS 2 + 3 — Body
                    ══════════════════════════════════════════ */}
                    <div className="overflow-y-visible flex-1 touch-pan-y custom-scrollbar [&>.veb]:!border-t-0">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[15px] p-[14px] sm:px-6 sm:py-[18px] border-t border-[var(--color-card-border)] bg-[var(--color-surface)] shrink-0 items-stretch sm:items-center">
                        <p className="text-[13px] text-[var(--color-text-muted)] font-medium leading-[1.4] m-0 flex-1 hidden sm:block">
                            {dt?.card?.stake_hint ?? 'Delegate your XRD to this validator and start earning rewards.'}
                        </p>
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                            <EntityTagsGrid tags={validator.tags} t={t} />
                            <Button
                                variant="primary"
                                className="!h-[38px] !px-8 !rounded-[10px] !text-[13px] !font-bold whitespace-nowrap shrink-0 !transition-all duration-200 w-full sm:w-auto justify-center hover:!opacity-90 active:!scale-[0.97]"
                                onClick={e => {
                                    e.stopPropagation();
                                    setShowUnderConstruction(true);
                                }}
                            >
                                {dt?.card?.stake_button ?? 'Stake'}
                            </Button>
                        </div>
                    </div>
                </SwipeableContainer>
            </AnimatePresence>
        </div>
    );
};