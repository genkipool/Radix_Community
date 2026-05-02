'use client';
import React from 'react';
import { ExternalLink, Globe, Server } from 'lucide-react';
import { type Validator, type StakeHistoryEntry } from '@/types/radix';
import { sanitizeText, isValidUrl } from '@/utils/sanitize';
import { getUptimeColor } from '@/utils/validators';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge } from './ValidatorBadges';
import { Label, DR, AR } from './ValidatorExpandedPrimitives';
import { StakeEvolutionChart, StakeHistoryChart } from './ValidatorStakeCharts';
import { useLiveProposals } from './LiveProposals';
import type { TranslationsT, DashboardDict } from '@/features/dashboard/types';
import { type MarketData } from '@/features/dashboard/types/core.types';
import { RewardsCsvModal } from './RewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import {
    ValidatorAddressMetrics,
    ValidatorDelegationMetrics,
    ValidatorPerformanceMetrics,
    type MetricRowProps
} from '@/features/dashboard/explorador/components/ValidatorSummaryMetrics';

type LiveProposalsResult = ReturnType<typeof useLiveProposals>;

/**
 * Adapter for VEB style rows
 */
const renderVebRow = (props: MetricRowProps) => (
    <DR
        label={props.label}
        value={props.children || props.value}
        sub={props.secondaryValue}
        tooltip={props.tooltip}
    />
);

/**
 * Adapter for VEB style address rows
 */
const renderVebAddrRow = (props: MetricRowProps) => (
    <AR
        label={props.label}
        addr={props.rawAddress || ''}
        onCopy={props.onCopy || (() => { })}
        copied={!!props.isCopied}
        brackets={props.label.toLowerCase().includes('badge') || props.label.toLowerCase().includes('key')}
        noTruncate={false}
    />
);

/* ─────────────────────────────────────────
   ProfileBlock
───────────────────────────────────────── */
export const ProfileBlock = ({
    validator, dt, t, onCopy, copiedAddress, className = '', locale, _isModal, _noTruncate = false, _onDownloadCsv,
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    t?: Partial<TranslationsT>;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    className?: string;
    locale?: string;
    _isModal?: boolean;
    _noTruncate?: boolean;
    _onDownloadCsv?: (address: string) => void;
}) => {
    const tech = [
        validator.country && { icon: <Globe className="w-3 h-3" />, k: dt?.details?.country ?? 'Country', v: sanitizeText(validator.country) },
        validator.provider && { icon: <Server className="w-3 h-3" />, k: dt?.details?.provider ?? 'Provider', v: sanitizeText(validator.provider) },
        validator.version && { k: dt?.details?.version ?? 'Version', v: sanitizeText(validator.version), hi: 'var(--color-primary)' as string },
    ].filter(Boolean) as { icon?: React.ReactNode; k: string; v: string; hi?: string }[];

    return (
        <div className={`veb-block veb-profile ${className}`}>
            <div className="veb-desc-wrap">
                <Label>{dt?.details?.profile ?? 'Validator Profile'}</Label>
                <p className={`veb-desc-text ${validator.description ? 'veb-desc-has' : 'veb-desc-empty'}`}>
                    {validator.description
                        ? `"${sanitizeText(validator.description)}"`
                        : (dt?.details?.no_description ?? 'No description provided.')}
                </p>
                {validator.website && isValidUrl(validator.website) && (
                    <a href={validator.website} target="_blank" rel="noopener noreferrer"
                        className="veb-link w-fit max-w-[220px] sm:max-w-none" onClick={e => e.stopPropagation()}>
                        <span className="truncate sm:whitespace-normal">{sanitizeText(validator.website)}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </a>
                )}
            </div>

            <div className="veb-meta">
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusLabel status={validator.status} t={t} />
                    <OnlineBadge online={validator.onlineStatus} labelOn={dt?.details?.online ?? 'Online'} labelOff={dt?.details?.offline ?? 'Offline'} />
                    <ConnectBadge accepts={validator.externalStakeAccepted} labelYes={dt?.details?.accepts_stake ?? 'Accepts Stake'} labelNo={dt?.details?.no_accepts_stake ?? 'No Stake'} />
                    <ConnectBadge accepts={validator.acceptsConnect} labelYes={dt?.details?.accepts_connect ?? 'Accepts Connection'} labelNo={dt?.details?.no_accepts_connect ?? 'No Connect'} />
                    <VoteBadge vote={validator.protocolUpdateVote} label={dt?.details?.vote ?? 'Vote'} />
                </div>
                {tech.length > 0 && (
                    <>
                        <div className="veb-meta-sep" />
                        {tech.map(f => (
                            <span key={f.k} className="veb-techpill">
                                {f.icon && <span className="veb-techpill-icon">{f.icon}</span>}
                                <span className="veb-techpill-k">{f.k}</span>
                                <span className="veb-techpill-v" style={f.hi ? { color: f.hi } : undefined}>{f.v}</span>
                            </span>
                        ))}
                    </>
                )}
            </div>

            <div className="veb-profile-addrs">
                <ValidatorAddressMetrics
                    validator={validator}
                    address={validator.address}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    locale={locale || ''}
                    dt={dt}
                    renderRow={renderVebAddrRow}
                />
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────
   DelegationBlock
───────────────────────────────────────── */
export const DelegationBlock = ({
    validator, dt, className = '', locale,
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    className?: string;
    locale?: string;
}) => (
    <div className={`veb-block veb-delegation ${className}`}>
        <Label>{dt?.details?.delegation ?? 'Delegation Summary'}</Label>
        <div className="veb-drows">
            <ValidatorDelegationMetrics
                validator={validator}
                locale={locale || ''}
                dt={dt}
                renderRow={renderVebRow}
            />
        </div>
    </div>
);

/* ─────────────────────────────────────────
   PerformanceBlock
───────────────────────────────────────── */
export const PerformanceBlock = ({
    validator, dt, live, className = '', locale,
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    live: LiveProposalsResult;
    className?: string;
    locale?: string;
}) => {
    return (
        <div className={`veb-block veb-uptimes ${className}`}>
            <div className="veb-perf-section">
                <ValidatorPerformanceMetrics
                    validator={validator}
                    locale={locale || ''}
                    dt={dt}
                    liveData={live}
                    renderRow={(props) => (
                        <DR
                            label={props.label}
                            value={props.value}
                            tooltip={props.tooltip}
                            hi={props.label.toLowerCase().includes('uptime') ? getUptimeColor(parseFloat(props.value || '0')) : undefined}
                        />
                    )}
                />
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────
   EvolutionBlock
───────────────────────────────────────── */
export const EvolutionBlock = ({
    loading, data, t, locale, className = '',
}: {
    loading: boolean;
    data: { date: string; totalStake: number }[];
    t?: Partial<TranslationsT>;
    locale: string;
    className?: string;
}) => (
    <div className={`veb-block veb-chart-panel veb-evolution ${className}`}>
        <div className="veb-chart-header">
            <Label>{t?.stakes?.evolution_title ?? 'Stake Evolution (3 months)'}</Label>
        </div>
        <div className="veb-chart-content flex-1">
            {loading && data.length === 0 ? (
                <div className="veb-chart-loading"><div className="veb-spinner" /></div>
            ) : data.length === 0 ? (
                <div className="veb-chart-empty">{t?.stakes?.no_activity ?? 'No stake activity'}</div>
            ) : (
                <StakeEvolutionChart data={data} t={t} locale={locale} />
            )}
        </div>
    </div>
);

/* ─────────────────────────────────────────
   ActivityBlock
───────────────────────────────────────── */
export const ActivityBlock = ({
    loading, allHistory, thirtyDays, t, locale, className = '',
}: {
    loading: boolean;
    allHistory: StakeHistoryEntry[];
    thirtyDays: StakeHistoryEntry[];
    t?: Partial<TranslationsT>;
    locale: string;
    className?: string;
}) => (
    <div className={`veb-block veb-chart-panel veb-activity ${className}`}>
        <div className="veb-chart-header">
            <Label>{t?.stakes?.history_title ?? 'Stake Activity (30 days)'}</Label>
            <div className="veb-chart-legend">
                <span className="veb-legend-item"><span className="veb-legend-dot veb-bg-stake" />{t?.stakes?.stake ?? 'Stake'}</span>
                <span className="veb-legend-item"><span className="veb-legend-dot veb-bg-unstake" />{t?.stakes?.unstake ?? 'Unstake'}</span>
                <span className="veb-legend-item"><span className="veb-legend-dot veb-bg-claim" />{t?.stakes?.claim ?? 'Claim'}</span>
            </div>
        </div>
        <div className="veb-chart-content flex-1">
            {loading && allHistory.length === 0 ? (
                <div className="veb-chart-loading"><div className="veb-spinner" /></div>
            ) : allHistory.every(d => d.stake === 0 && d.unstake === 0 && d.claim === 0) ? (
                <div className="veb-chart-empty">{t?.stakes?.no_activity ?? 'No stake activity'}</div>
            ) : (
                <StakeHistoryChart data={thirtyDays} t={t} locale={locale} />
            )}
        </div>
    </div>
);

/* ─────────────────────────────────────────
   HistoryBlock
───────────────────────────────────────── */
interface HistoryBlockProps {
    live: LiveProposalsResult;
    dt?: Partial<DashboardDict>;
    className?: string;
    epochRewards?: Record<number, { fee: number; pool: number }>;
    validatorAddress?: string;
    marketData?: MarketData | null;
    locale?: string;
}

export const HistoryBlock: React.FC<HistoryBlockProps> = ({
    live,
    dt,
    className = '',
    epochRewards = {},
    validatorAddress = '',
    marketData,
    locale
}) => {
    const [modalOpen, setModalOpen] = React.useState(false);
    const { prefetchValidatorRewards } = usePrefetchRewards();

    return (
        <div className={`veb-block veb-epochs-panel veb-history ${className}`}>
            <div className="veb-epochs">
                <div className="veb-epochs-header">
                    <div className="flex items-center gap-2">
                        <Label>{dt?.details?.epoch_history ?? 'Epoch History'}</Label>
                        <button
                            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
                            onPointerEnter={() => prefetchValidatorRewards(validatorAddress)}
                            className="p-1 rounded-lg hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                            title={dt?.details?.download_rewards_tooltip}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </button>
                    </div>
                    <span className="veb-live-badge">{dt?.details?.live ?? 'Live'}</span>
                </div>
                <table className="veb-table">
                    <thead>
                        <tr className="veb-th-row">
                            <th className="veb-th text-left">{dt?.details?.epoch ?? 'Epoch'}</th>
                            <th className="veb-th text-center">{dt?.details?.proposals_made ?? 'Completed'}</th>
                            <th className="veb-th text-center">{dt?.details?.proposals_missed ?? 'Missed'}</th>
                            <th className="veb-th text-right" title={dt?.details?.xrd_reward_fee_tooltip ?? 'Total XRD earned by the validator'}>
                                {dt?.details?.xrd_reward_fee ?? 'Validator'}
                            </th>
                            <th className="veb-th text-right" title={dt?.details?.xrd_reward_pool_tooltip ?? 'Total XRD distributed to delegators'}>
                                {dt?.details?.xrd_reward_pool ?? 'Delegators'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {live.unifiedRows.map((ep) => (
                            <tr key={ep.epoch} className={`veb-tr ${ep.isLive ? 'veb-tr-live' : ''}`}>
                                <td className="veb-td">
                                    <span className={ep.isLive ? "veb-epoch-live-cell" : ""}>
                                        <span className="veb-epoch-num">{ep.epoch}</span>
                                        {ep.isLive && <span className="veb-live-tag">live</span>}
                                    </span>
                                </td>
                                <td className="veb-td text-center"><span className="veb-num-made">{ep.completedProposals.toLocaleString(locale)}</span></td>
                                <td className="veb-td text-center"><span className="veb-num-missed">{ep.missedProposals.toLocaleString(locale)}</span></td>
                                <td className="veb-td text-right">
                                    <span className="text-[var(--color-primary)] font-bold tabular-nums text-[11px]">
                                        {epochRewards[ep.epoch] !== undefined
                                            ? epochRewards[ep.epoch].fee.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                            : ep.isLive ? '—' : '—'}
                                    </span>
                                </td>
                                <td className="veb-td text-right">
                                    <span className="text-[var(--color-text-main)] font-bold tabular-nums text-[11px]">
                                        {epochRewards[ep.epoch] !== undefined
                                            ? epochRewards[ep.epoch].pool.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                            : ep.isLive ? '—' : '—'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modalOpen && (
                <RewardsCsvModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    validatorAddress={validatorAddress}
                    dt={dt}
                    marketData={marketData}
                    locale={locale}
                />
            )}
        </div>
    );
};