'use client';
import React from 'react';
import { ExternalLink, Globe, Server } from 'lucide-react';
import { type Validator, type StakeHistoryEntry } from '@/types/radix';
import { formatXRD, formatNumber } from '@/utils/formatters';
import { sanitizeText, isValidUrl } from '@/utils/sanitize';
import { getUptimeColor, getUptimeTooltipText } from '@/utils/validators';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge } from './ValidatorBadges';
import { Label, DR, AR } from './ValidatorExpandedPrimitives';
import { StakeEvolutionChart, StakeHistoryChart } from './ValidatorStakeCharts';
import { useLiveProposals } from './LiveProposals';
import type { TranslationsT, DashboardDict } from '@/features/dashboard/types';
import { type MarketData } from '@/features/dashboard/types/core.types';
import { RewardsCsvModal } from './RewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';

type LiveProposalsResult = ReturnType<typeof useLiveProposals>;

const fp = (n: number, locale?: string, d = 2) => `${formatNumber(n, d, locale)}%`;

/* ─────────────────────────────────────────
   ProfileBlock
───────────────────────────────────────── */
export const ProfileBlock = ({
    validator, dt, t, onCopy, copiedAddress, className = '', isModal, noTruncate = false, onDownloadCsv,
}: {
    validator: Validator;
    dt?: DashboardDict;
    t?: TranslationsT;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    className?: string;
    isModal?: boolean;
    noTruncate?: boolean;
    onDownloadCsv?: (address: string) => void;
}) => {
    const tech = [
        validator.country && { icon: <Globe className="w-3 h-3" />, k: dt?.details?.country ?? 'País', v: sanitizeText(validator.country) },
        validator.provider && { icon: <Server className="w-3 h-3" />, k: dt?.details?.provider ?? 'Proveedor', v: sanitizeText(validator.provider) },
        validator.version && { k: dt?.details?.version ?? 'Versión', v: sanitizeText(validator.version), hi: 'var(--color-primary)' as string },
    ].filter(Boolean) as { icon?: React.ReactNode; k: string; v: string; hi?: string }[];

    return (
        <div className={`veb-block veb-profile ${className}`}>
            <div className="veb-desc-wrap">
                <Label>{dt?.details?.profile ?? 'Perfil del validador'}</Label>
                <p className={`veb-desc-text ${validator.description ? 'veb-desc-has' : 'veb-desc-empty'}`}>
                    {validator.description
                        ? `"${sanitizeText(validator.description)}"`
                        : (dt?.details?.no_description ?? 'Sin descripción proporcionada.')}
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
                    <OnlineBadge online={validator.onlineStatus} labelOn={dt?.details?.online ?? 'En línea'} labelOff={dt?.details?.offline ?? 'Offline'} />
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
                <AR
                    label={dt?.details?.address ?? 'Validator Address'}
                    addr={validator.address}
                    onCopy={onCopy}
                    copied={!!copiedAddress && copiedAddress === validator.address}
                    isModal={isModal}
                    noTruncate={noTruncate}
                    onDownloadCsv={onDownloadCsv}
                />
                {validator.ownerAddress && (
                    <AR
                        label={dt?.details?.owner_address ?? 'Owner Address'}
                        addr={validator.ownerAddress}
                        onCopy={onCopy}
                        copied={!!copiedAddress && copiedAddress === validator.ownerAddress}
                        isModal={isModal}
                        noTruncate={noTruncate}
                    />
                )}
                {validator.ownerBadge && (
                    <AR
                        label={dt?.details?.owner_badge ?? 'Owner Badge'}
                        addr={validator.ownerBadge}
                        onCopy={onCopy}
                        copied={!!copiedAddress && (copiedAddress === validator.ownerBadge || copiedAddress === `[${validator.ownerBadge}]`)}
                        brackets={!validator.ownerBadge.startsWith('[')}
                        isModal={isModal}
                        noTruncate={noTruncate}
                    />
                )}
                <AR
                    label={dt?.details?.lsu_resource ?? 'LSU Resource'}
                    addr={validator.lsuResource}
                    onCopy={onCopy}
                    copied={!!copiedAddress && copiedAddress === validator.lsuResource}
                    isModal={isModal}
                    noTruncate={noTruncate}
                />
                {validator.claimTokenResourceAddress && (
                    <AR
                        label={dt?.details?.nft_claim ?? 'NFT Claim'}
                        addr={validator.claimTokenResourceAddress}
                        onCopy={onCopy}
                        copied={!!copiedAddress && copiedAddress === validator.claimTokenResourceAddress}
                        isModal={isModal}
                        noTruncate={noTruncate}
                    />
                )}
                {validator.publicKey && (
                    <AR 
                        label={dt?.details?.public_key ?? 'Public Key'} 
                        addr={validator.publicKey} 
                        onCopy={onCopy}
                        copied={!!copiedAddress && (copiedAddress === validator.publicKey || copiedAddress === `[${validator.publicKey}]`)}
                        brackets
                        isModal={isModal}
                        noTruncate={noTruncate}
                    />
                )}
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
    dt?: DashboardDict;
    className?: string;
    locale?: string;
}) => (
    <div className={`veb-block veb-delegation ${className}`}>
        <Label>{dt?.details?.delegation ?? 'Resumen de delegación'}</Label>
        <div className="veb-drows">
            <DR label={dt?.details?.delegated_stake ?? 'Stake delegado'} value={formatXRD(validator.delegatedStake, locale)} sub={`${validator.delegatedStakePercent.toFixed(2)}% de la red`} />
            <DR label={dt?.details?.delegators ?? 'Delegadores'} value={validator.delegators.toLocaleString(locale)} />
            <DR label={dt?.details?.owner_delegation ?? 'Stake del Dueño'} value={formatNumber(validator.ownerDelegation, 4, locale)} />
            <DR label={dt?.details?.apy_projection ?? 'Proyección APY'} value={fp(validator.apyProjection, locale)} />
            <DR label={dt?.card?.fee ?? 'Comisión'} value={fp(validator.nominalFee, locale)} sub={`${fp(validator.effectiveFee, locale)} efectiva`} />
            <DR label={dt?.details?.lsu_factor ?? 'Factor LSU → XRD'} value={validator.lsu2xrdFactor > 0 ? `1 LSU = ${formatNumber(validator.lsu2xrdFactor, 8, locale)} XRD` : '—'} />
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
    dt?: DashboardDict;
    live: LiveProposalsResult;
    className?: string;
    locale?: string;
}) => {
    const uRC = getUptimeColor(validator.recentUptime);
    const uTC = getUptimeColor(validator.totalUptime);

    return (
        <div className={`veb-block veb-uptimes ${className}`}>
            <div className="veb-perf-section">
                <Label title={dt?.details?.performance_14d_tooltip}>{dt?.details?.performance_14d ?? 'Rendimiento por Época en 14 días'}</Label>
                <div className="veb-drows">
                    <DR label={dt?.card?.uptime ?? 'Uptime'} value={<span className="veb-u-pct" style={{ color: uRC }}>{validator.recentUptime.toFixed(2)}%</span>} tooltip={getUptimeTooltipText(validator.recentUptime, true, dt?.details)} />
                    <DR label={dt?.details?.proposals_made ?? 'Completadas'} value={<span className="veb-made">{live.recentMade.toLocaleString(locale)}</span>} tooltip={dt?.details?.proposals_made_tooltip} />
                    <DR label={dt?.details?.proposals_missed ?? 'Perdidas'} value={<span className="veb-missed">{live.recentMissed.toLocaleString(locale)}</span>} tooltip={dt?.details?.proposals_missed_tooltip} />
                </div>
            </div>
            <div className="veb-perf-section mt-4">
                <Label title={dt?.details?.performance_total_tooltip}>{dt?.details?.performance_total ?? 'Rendimiento por Época en total'}</Label>
                <div className="veb-drows">
                    <DR label={dt?.card?.uptime ?? 'Uptime'} value={<span className="veb-u-pct" style={{ color: uTC }}>{validator.totalUptime.toFixed(2)}%</span>} tooltip={getUptimeTooltipText(validator.totalUptime, false, dt?.details)} />
                    <DR label={dt?.details?.proposals_made ?? 'Completadas'} value={<span className="veb-total-made">{live.totalMade.toLocaleString(locale)}</span>} tooltip={dt?.details?.proposals_made_tooltip} />
                    <DR label={dt?.details?.proposals_missed ?? 'Perdidas'} value={<span className="veb-total-missed">{live.totalMissed.toLocaleString(locale)}</span>} tooltip={dt?.details?.proposals_missed_tooltip} />
                </div>
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
    t?: TranslationsT;
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
                <div className="veb-chart-empty">{t?.stakes?.no_activity ?? 'Sin actividad de stake'}</div>
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
    t?: TranslationsT;
    locale: string;
    className?: string;
}) => (
    <div className={`veb-block veb-chart-panel veb-activity ${className}`}>
        <div className="veb-chart-header">
            <Label>{t?.stakes?.history_title ?? 'Actividad de Stake (30 días)'}</Label>
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
                <div className="veb-chart-empty">{t?.stakes?.no_activity ?? 'Sin actividad de stake'}</div>
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
    dt?: DashboardDict;
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
                            <th className="veb-th text-left">{dt?.details?.epoch ?? 'Época'}</th>
                            <th className="veb-th text-center">{dt?.details?.proposals_made ?? 'Completadas'}</th>
                            <th className="veb-th text-center">{dt?.details?.proposals_missed ?? 'Perdidas'}</th>
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