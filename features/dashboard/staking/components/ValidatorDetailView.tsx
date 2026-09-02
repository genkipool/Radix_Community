'use client';
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { getStatusColor } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { CloseButton } from '@/components/ui/CloseButton';
import { isValidUrl, sanitizeText } from '@/utils/sanitize';
import { formatDisplayUrl } from '@/utils/formatters';
import { SafeImage } from '@/components/ui/SafeImage';
import { validatorIconSrc } from '../lib/validatorIcon';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge, EntityTagsGrid } from './ValidatorBadges';
import { ValidatorExpandedBody } from './ValidatorExpandedBody';
import { StakingPopup } from './StakingPopup';
import { CopyButton } from '@/components/ui/CopyButton';
import { ValidatorShareActions } from './ValidatorShareActions';
import { useLanguage } from '@/context/LanguageContext';
import { type ValidatorDetailViewProps } from '../types';
import { SwipeableContainer } from '@/components/ui/SwipeableContainer';

export const ValidatorDetailView: React.FC<ValidatorDetailViewProps> = ({
    validator,
    onClose,
    onPrev,
    onNext,
    prevValidator,
    nextValidator,
    t,
    dt,
    copiedAddress,
    copyAddress,
    network = 'mainnet',
    direction: propDirection = 0,
    setDirection,
    marketData,
}) => {
    // The share link points at the validator's own page in the reader's
    // language; the modal is opened from a view that has no locale prop of its
    // own to pass down.
    const { language } = useLanguage();

    const activeDirection = propDirection;

    /**
     * One validator, rendered as the body of the modal. Used three times: for the
     * validator being read and, while a finger is swiping, for the two
     * neighbours the gesture uncovers, so real figures slide in behind the
     * finger instead of an empty panel.
     */
    const renderValidator = (v: ValidatorDetailViewProps['validator']) => {
        const vStatusColor = getStatusColor(v.status);
        const vSafeName = sanitizeText(v.name);
        const vIsAddrCopied = !!copiedAddress && copiedAddress === v.address;

        return (
            <>
            {/* ==============================════════════
                ROW 1 — HEADER
            ==============================════════════ */}
            <div className="relative grid grid-cols-[auto_1fr] items-center gap-0 p-[14px] sm:p-5 border-b border-[var(--color-card-border)] bg-[var(--color-surface)] overflow-hidden" style={{ '--status-color': vStatusColor } as React.CSSProperties}>
                <div className="absolute inset-0 pointer-events-none z-0" style={{ background: `linear-gradient(135deg, ${vStatusColor}22 0%, transparent 60%)` }} />

                {/* Col 1 — Photo */}
                <div className="relative z-10 row-start-1 col-start-1 shrink-0 flex flex-col items-center mr-[12px] sm:mr-5">
                    <div className="w-[72px] h-[72px] sm:w-[110px] sm:h-[110px] rounded-[16px] sm:rounded-[22px] border-[2.5px] overflow-hidden shrink-0 transition-all duration-300 hover:scale-[1.04]" style={{ borderColor: vStatusColor, boxShadow: `0 0 28px ${vStatusColor}45` }}>
                        <SafeImage
                            src={validatorIconSrc(v.iconUrl, network)}
                            zoomSrc={v.iconUrl}
                            alt={vSafeName}
                            fallbackName={vSafeName}
                            className="w-full h-full object-cover block"
                            loading="eager"
                        />
                    </div>
                </div>

                {/* Col 2 — Identity + Close */}
                <div className="relative z-10 min-w-0 flex flex-col gap-2 row-start-1 col-start-2">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-black text-[var(--color-text-main)] tracking-tight leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis text-[16px] sm:text-[clamp(18px,2.5vw,28px)] flex-1">
                            {vSafeName}
                        </h2>

                        <CloseButton
                            onClose={onClose}
                            title="Cerrar"
                            iconSize={20}
                        />
                    </div>

                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <StatusLabel status={v.status} t={t} />
                        <OnlineBadge
                            online={v.onlineStatus}
                            labelOn={dt?.details?.online ?? 'Online'}
                            labelOff={dt?.details?.offline ?? 'Offline'}
                        />
                        <ConnectBadge
                            accepts={v.externalStakeAccepted}
                            labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'}
                            labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'}
                        />
                        <ConnectBadge
                            accepts={v.acceptsConnect}
                            labelYes={dt?.details?.accepts_connect ?? 'Accepts Connection'}
                            labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'}
                        />
                        <VoteBadge vote={v.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} validator={v} actionLabel={dt?.details?.vote_action ?? 'Votar'} />
                    </div>

                    {/* Website */}
                    {v.website && isValidUrl(v.website) && (
                        <a
                            href={v.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-[5px] text-xs font-medium text-[var(--color-primary)] no-underline w-fit max-w-[220px] sm:max-w-none transition-opacity hover:opacity-80 hover:underline"
                            onClick={e => e.stopPropagation()}
                        >
                            <span className="truncate sm:whitespace-normal">{formatDisplayUrl(v.website)}</span>
                            <ExternalLink className="size-3.5 shrink-0" />
                        </a>
                    )}

                    {/* Addresses + delegate CTA */}
                    <div className="flex flex-col gap-2">
                        {/* Validator address */}
                        <div className="flex flex-col sm:flex-row sm:items-center items-start gap-[6px] sm:gap-[10px] min-w-0">
                            <div role="button" tabIndex={0}
                                className="flex min-w-0 items-center gap-[6px] overflow-hidden cursor-pointer group/addr text-left"
                                onClick={e => { e.stopPropagation(); copyAddress(v.address); }}
                                onKeyDown={e => { if (e.key === 'Enter') copyAddress(v.address); }}
                            >
                                <code className={`min-w-0 truncate text-[11px] font-mono text-[var(--color-text-muted)] group-hover/addr:text-[var(--color-primary)] transition-colors ${vIsAddrCopied ? '!text-[#16a34a]' : ''}`}>
                                    <span className="hidden sm:inline">{v.address || '...'}</span>
                                    <span className="inline sm:hidden">
                                        {v.address ? (
                                            `${v.address.slice(0, 8)}...${v.address.slice(-8)}`
                                        ) : '...'}
                                    </span>
                                </code>
                                <CopyButton
                                    value={v.address}
                                    variant="minimal"
                                    size="xs"
                                    forceCopied={vIsAddrCopied}
                                    className="pointer-events-none shrink-0"
                                />
                            </div>
                            {/* Sharing sits beside the call to action, on
                                its left: this window is where someone
                                decides a v is worth passing on. */}
                            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                                <ValidatorShareActions
                                    validator={v}
                                    dt={dt}
                                    locale={language}
                                    network={network}
                                    size="panel"
                                    className="flex items-center"
                                />
                                <StakingPopup validator={v} t={t}>
                                    <button
                                        type="button"
                                        className="shrink-0 px-[18px] py-[6px] rounded-[10px] text-xs font-bold text-white border-none cursor-pointer whitespace-nowrap transition-all duration-150 ease-out shadow-[0_4px_12px_color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:opacity-90 active:scale-[0.96]"
                                        style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-primary)))` }}
                                    >
                                        {dt?.card?.stake_button ?? 'Stake'}
                                    </button>
                                </StakingPopup>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ==============================════════════
                ROWS 2 + 3 — Body
            ==============================════════════ */}
            <div className="overflow-y-visible flex-1 touch-pan-y custom-scrollbar [&>.veb]:!border-t-0">
                <ValidatorExpandedBody
                    validator={v}
                    t={t}
                    onCopy={copyAddress}
                    copiedAddress={copiedAddress}
                    columns={1}
                    network={network}
                    hideCta
                    isModal
                    marketData={marketData}
                />
            </div>

            {/* ==============================════════════
                FOOTER — CTA
            ==============================════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[15px] p-[14px] sm:px-6 sm:py-[18px] border-t border-[var(--color-card-border)] bg-[var(--color-surface)] shrink-0 items-stretch sm:items-center">
                <p className="text-[13px] text-[var(--color-text-muted)] font-medium leading-[1.4] m-0 flex-1 hidden sm:block">
                    {dt?.card?.stake_hint ?? 'Delegate your XRD to this v and start earning rewards.'}
                </p>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <EntityTagsGrid tags={v.tags} t={t} />
                    {/* On a phone the header scrolls out of reach long
                        before this button does, so the footer carries
                        its own copy. On a desktop both are on screen at
                        once and one is enough. */}
                    <ValidatorShareActions
                        validator={v}
                        dt={dt}
                        locale={language}
                        network={network}
                        size="touch"
                        className="flex items-center sm:hidden"
                    />
                    <StakingPopup validator={v} t={t}>
                        <Button
                            variant="primary"
                            className="!h-[38px] !px-6 sm:!px-8 !rounded-[10px] !text-[13px] !font-bold whitespace-nowrap shrink-0 !transition-all duration-200 w-fit sm:w-auto justify-center hover:!opacity-90 active:!scale-[0.97]"
                        >
                            {dt?.card?.stake_button ?? 'Stake'}
                        </Button>
                    </StakingPopup>
                </div>
            </div>
            </>
        );
    };

    return (
        <div
            className="relative w-full h-full rounded-[20px] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-[0_32px_80px_rgba(0,0,0,0.45),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] flex flex-col cursor-auto text-left"
            onClick={e => e.stopPropagation()}
        >
            <SwipeableContainer
                itemKey={validator.address}
                direction={activeDirection}
                setDirection={setDirection || (() => { })}
                onPrev={onPrev}
                onNext={onNext}
                prevContent={prevValidator ? renderValidator(prevValidator) : null}
                nextContent={nextValidator ? renderValidator(nextValidator) : null}
                className="flex-1 flex flex-col min-h-0 relative touch-none bg-[var(--color-surface)]"
            >
                {renderValidator(validator)}
            </SwipeableContainer>
        </div>
    );
};