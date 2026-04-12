'use client';
import React from 'react';
import { ExternalLink, Globe, Server } from 'lucide-react';
import { type Validator, type StakeHistoryEntry } from '@/types/radix';
import { formatXRD, formatNumber } from '@/utils/formatters';
import { sanitizeText, isValidUrl } from '@/utils/sanitize';
import { StatusLabel } from './ValidatorDetailComponents';
import { OnlineBadge, ConnectBadge, VoteBadge } from './ValidatorBadges';
import { Label, DR, AR } from './ValidatorExpandedPrimitives';
import { StakeEvolutionChart, StakeHistoryChart } from './ValidatorStakeCharts';
import { useLiveProposals } from './LiveProposals';
import type { TranslationsT, DashboardDict } from '@/features/dashboard/types';

type LiveProposalsResult = ReturnType<typeof useLiveProposals>;

const fp = (n: number, d = 2) => `${formatNumber(n, d)}%`;

/* ─────────────────────────────────────────
   ProfileBlock
───────────────────────────────────────── */
export const ProfileBlock = ({
    validator, dt, t, onCopy, copiedAddress, className = '',
}: {
    validator: Validator;
    dt?: DashboardDict;
    t?: TranslationsT;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    className?: string;
}) => {
    const tech = [
        validator.country  && { icon: <Globe className="w-3 h-3" />, k: dt?.details?.country   ?? 'País',      v: sanitizeText(validator.country) },
        validator.provider && { icon: <Server className="w-3 h-3" />, k: dt?.details?.provider  ?? 'Proveedor', v: sanitizeText(validator.provider) },
        validator.version  && {                                          k: dt?.details?.version   ?? 'Versión',   v: sanitizeText(validator.version), hi: 'var(--color-primary)' as string },
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
                        className="veb-link" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span>{sanitizeText(validator.website)}</span>
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
                <AR label={dt?.details?.address ?? 'Dirección del Validador'} addr={validator.address} onCopy={onCopy} copied={!!copiedAddress && copiedAddress === validator.address} />
                <AR label={dt?.details?.lsu_resource ?? 'Recurso LSU'} addr={validator.lsuResource} onCopy={onCopy} copied={!!copiedAddress && copiedAddress === validator.lsuResource} />
                {validator.publicKey && (
                    <AR label={dt?.details?.public_key ?? 'Clave Pública'} addr={validator.publicKey} onCopy={onCopy}
                        copied={!!copiedAddress && (copiedAddress === validator.publicKey || copiedAddress === `[${validator.publicKey}]`)}
                        brackets />
                )}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────
   DelegationBlock
───────────────────────────────────────── */
export const DelegationBlock = ({
    validator, dt, className = '',
}: {
    validator: Validator;
    dt?: DashboardDict;
    className?: string;
}) => (
    <div className={`veb-block veb-delegation ${className}`}>
        <Label>{dt?.details?.delegation ?? 'Resumen de delegación'}</Label>
        <div className="veb-drows">
            <DR label={dt?.details?.delegated_stake ?? 'Stake delegado'}   value={formatXRD(validator.delegatedStake)}      sub={`${validator.delegatedStakePercent.toFixed(2)}% de la red`} />
            <DR label={dt?.details?.delegators ?? 'Delegadores'}            value={validator.delegators.toLocaleString()} />
            <DR label={dt?.details?.owner_delegation ?? 'Stake del Dueño'} value={formatXRD(validator.ownerDelegation)} />
            <DR label={dt?.details?.apy_projection ?? 'Proyección APY'}    value={fp(validator.apyProjection)} />
            <DR label={dt?.card?.fee ?? 'Comisión'}                         value={fp(validator.nominalFee)} sub={`${fp(validator.effectiveFee)} efectiva`} />
            <DR label={dt?.details?.lsu_factor ?? 'Factor LSU → XRD'}      value={validator.lsu2xrdFactor > 0 ? `1 LSU = ${formatNumber(validator.lsu2xrdFactor, 8)} XRD` : '—'} />
        </div>
    </div>
);

/* ─────────────────────────────────────────
   PerformanceBlock
───────────────────────────────────────── */
export const PerformanceBlock = ({
    validator, dt, live, className = '',
}: {
    validator: Validator;
    dt?: DashboardDict;
    live: LiveProposalsResult;
    className?: string;
}) => {
    const uRC = '#16a34a'; // Unified green
    const uTC = '#16a34a'; // Unified green

    return (
        <div className={`veb-block veb-uptimes ${className}`}>
            <div className="veb-perf-section">
                <Label title={dt?.details?.performance_14d_tooltip}>{dt?.details?.performance_14d ?? 'Rendimiento por Época en 14 días'}</Label>
                <div className="veb-drows">
                    <DR label={dt?.card?.uptime ?? 'Uptime'} value={<span className="veb-u-pct" style={{ color: uRC }}>{validator.recentUptime.toFixed(2)}%</span>} />
                    <DR label={dt?.details?.proposals_made   ?? 'Completadas'} value={<span className="veb-made">{live.recentMade.toLocaleString()}</span>} />
                    <DR label={dt?.details?.proposals_missed ?? 'Perdidas'}    value={<span className="veb-missed">{live.recentMissed.toLocaleString()}</span>} />
                </div>
            </div>
            <div className="veb-perf-section mt-4">
                <Label title={dt?.details?.performance_total_tooltip}>{dt?.details?.performance_total ?? 'Rendimiento por Época en total'}</Label>
                <div className="veb-drows">
                    <DR label={dt?.card?.uptime ?? 'Uptime'} value={<span className="veb-u-pct" style={{ color: uTC }}>{validator.totalUptime.toFixed(2)}%</span>} />
                    <DR label={dt?.details?.proposals_made   ?? 'Completadas'} value={<span className="veb-made">{live.totalMade.toLocaleString()}</span>} />
                    <DR label={dt?.details?.proposals_missed ?? 'Perdidas'}    value={<span className="veb-missed">{live.totalMissed.toLocaleString()}</span>} />
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
export const HistoryBlock = ({
    live, epochRows, dt, className = '',
}: {
    live: LiveProposalsResult;
    epochRows: Validator['epochPerformance'];
    dt?: DashboardDict;
    className?: string;
}) => (
    <div className={`veb-block veb-epochs-panel veb-history ${className}`}>
        <div className="veb-epochs">
            <div className="veb-epochs-header">
                <Label>{dt?.details?.epoch_history ?? 'Epoch History'}</Label>
                <span className="veb-live-badge">{dt?.details?.live ?? 'Live'}</span>
            </div>
            <table className="veb-table">
                <thead>
                    <tr className="veb-th-row">
                        <th className="veb-th text-left">{dt?.details?.epoch   ?? 'Época'}</th>
                        <th className="veb-th text-center">{dt?.details?.proposals_made   ?? 'Completadas'}</th>
                        <th className="veb-th text-center">{dt?.details?.proposals_missed ?? 'Perdidas'}</th>
                    </tr>
                </thead>
                <tbody>
                    {live.liveEpoch && (
                        <tr className="veb-tr-live">
                            <td className="veb-td">
                                <span className="veb-epoch-live-cell">
                                    <span className="veb-epoch-num">{live.liveEpoch}</span>
                                    <span className="veb-live-tag">live</span>
                                </span>
                            </td>
                            <td className="veb-td text-center"><span className="veb-num-made">{live.epochMade.toLocaleString()}</span></td>
                            <td className="veb-td text-center"><span className="veb-num-missed">{live.epochMissed.toLocaleString()}</span></td>
                        </tr>
                    )}
                    {epochRows.map((ep, i) => (
                        <tr key={i} className="veb-tr">
                            <td className="veb-td"><span className="veb-epoch-num">{ep.epoch}</span></td>
                            <td className="veb-td text-center"><span className="veb-num-made">{ep.completedProposals.toLocaleString()}</span></td>
                            <td className="veb-td text-center"><span className="veb-num-missed">{ep.missedProposals.toLocaleString()}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);