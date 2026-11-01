'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Lock, Percent, TrendingDown, TrendingUp, Unlock, Info } from 'lucide-react';
import { StatCard } from './StatCard';
import { UnlockCalendar } from './UnlockCalendar';
import { NetworkHealthSection } from './NetworkHealthSection';
import { SellPressureGauge } from './SellPressureGauge';
import { UnlockAccountsTable } from './UnlockAccountsTable';
import { apiFetchNetworkUnstaking } from '../services/apiClient';
import { formatPercent, formatXRD } from '@/utils/formatters';
import type { Network, TranslationsT } from '../types';
import type { Validator } from '@/types/radix';
import type { MarketData } from '@/services/marketData';

interface NetworkInsightsPanelProps {
    network: Network;
    /** All the XRD staked, to put the locked figure in proportion. */
    totalStaked: number;
    /** False while the panel is folded: nothing is read or refreshed then. */
    open: boolean;
    dt?: Partial<TranslationsT['dashboard']>;
    locale: string;
    /** The validator set, when at hand: names the validators in the table, and in the staking view adds how current and how spread out it is. */
    validators?: Validator[];
    /** Staking view: adds the network-health section. */
    showHealth?: boolean;
    t?: Partial<TranslationsT>;
    onCopy: (address: string) => void;
    copiedAddress: string | null;
    /** Price and volume, for setting the wave against what the market trades. */
    marketData?: MarketData | null;
}

/** How a figure moved: null while the earlier figure is not known. */
function change(now: number | null, before: number | null): { amount: number; percent: number | null } | null {
    if (now === null || before === null) return null;
    const amount = now - before;
    return { amount, percent: before > 0 ? (amount / before) * 100 : null };
}

function Change({ value, locale }: { value: NonNullable<ReturnType<typeof change>>; locale: string }) {
    const Icon = value.amount >= 0 ? TrendingUp : TrendingDown;
    const sign = value.amount >= 0 ? '+' : '−';
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className="size-4 shrink-0" />
            {sign}{formatXRD(Math.abs(value.amount), locale)} XRD
            {value.percent !== null && ` (${sign}${formatPercent(Math.abs(value.percent), 1, locale)})`}
        </span>
    );
}

/**
 * The network's staking flow: how much XRD is on its way out of staking, how
 * that is moving, and the day each part unlocks. A second row of cards in the
 * style of the ones above it, with the calendar under them — no box of its own.
 *
 * Mounted only once opened, and it stops polling while folded, so a visitor who
 * never opens it costs nothing.
 */
export function NetworkInsightsPanel({ network, totalStaked, open, dt, locale, validators, showHealth = false, marketData, t: translations, onCopy, copiedAddress }: NetworkInsightsPanelProps) {
    const t = dt?.insights;
    const { data, isError } = useQuery({
        queryKey: ['network-unstaking', network],
        queryFn: () => apiFetchNetworkUnstaking(network),
        enabled: open,
        staleTime: 30_000,
        // The server works the figures out in the background: look often until they are all in
        // (the first reading takes a few seconds), then once a minute.
        refetchInterval: (query) => {
            if (!open) return false;
            const d = query.state.data;
            return !d || d.updatedAt === null || d.unbonding === null || d.unbonding7dAgo === null ? 4_000 : 60_000;
        },
    });

    const hasVaults = !!data?.updatedAt;
    const unbonding = data?.unbonding ?? null;
    // Reading the ledger back can lag the vaults by a few seconds, and a card says so instead of showing a dash.
    const reading = !isError && unbonding === null;
    const unclaimed = hasVaults && unbonding !== null ? Math.max(0, data.pending - unbonding) : null;
    const change24 = data ? change(data.unbonding, data.unbonding24hAgo) : null;
    const change7d = data ? change(data.unbonding, data.unbonding7dAgo) : null;
    const xrd = (n: number) => `${formatXRD(n, locale)} XRD`;
    const exact = (n: number) => `${Math.round(n).toLocaleString(locale)} XRD`;

    return (
        <div>
            {isError && !data ? (
                <p className="text-sm text-[var(--color-text-muted)]">{t?.unavailable ?? 'The figure is not available right now.'}</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <StatCard
                            wrap
                            icon={<Lock className="size-5" />}
                            label={t?.unbonding ?? 'Unlocking now'}
                            value={unbonding !== null ? xrd(unbonding) : '---'}
                            accent
                            description={t?.unbonding_desc}
                            fullValue={unbonding !== null ? exact(unbonding) : undefined}
                            isLoading={reading}
                        />
                        <StatCard
                            wrap
                            icon={<Percent className="size-5" />}
                            label={t?.share ?? 'Share of total stake'}
                            value={unbonding !== null && totalStaked > 0 ? formatPercent((unbonding / totalStaked) * 100, 2, locale) : '---'}
                            description={t?.share_desc}
                            isLoading={reading}
                        />
                        <StatCard
                            wrap
                            icon={<TrendingUp className="size-5" />}
                            label={t?.change_24h ?? 'Change in 24 h'}
                            value={change24 ? <Change value={change24} locale={locale} /> : '---'}
                            description={t?.change_desc}
                            isLoading={reading || change24 === null}
                        />
                        <StatCard
                            wrap
                            icon={<TrendingUp className="size-5" />}
                            label={t?.change_7d ?? 'Change in 7 days'}
                            value={change7d ? <Change value={change7d} locale={locale} /> : '---'}
                            description={t?.change_desc}
                            isLoading={reading || change7d === null}
                        />
                        <StatCard
                            wrap
                            icon={<Unlock className="size-5" />}
                            label={t?.unclaimed ?? 'Unlocked, not claimed'}
                            value={unclaimed !== null ? xrd(unclaimed) : '---'}
                            description={t?.unclaimed_desc}
                            fullValue={unclaimed !== null ? exact(unclaimed) : undefined}
                            isLoading={reading}
                        />
                        <StatCard
                            wrap
                            icon={<ArrowDownToLine className="size-5" />}
                            label={t?.pending ?? 'In the withdraw vaults'}
                            value={hasVaults ? xrd(data.pending) : '---'}
                            description={t?.pending_desc}
                            fullValue={hasVaults ? exact(data.pending) : undefined}
                            isLoading={!hasVaults}
                        />
                    </div>

                    {/* One more row of cards: how current and how spread out the validator set is. */}
                    {showHealth && validators && validators.length > 0 && <NetworkHealthSection validators={validators} dt={dt} locale={locale} />}

                    {data && data.schedule.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
                            <UnlockCalendar schedule={data.schedule} dt={dt} locale={locale} />
                            <SellPressureGauge
                                dt={dt}
                                locale={locale}
                                unbonding={data.unbonding}
                                unbonding7dAgo={data.unbonding7dAgo}
                                totalStaked={totalStaked}
                                schedule={data.schedule}
                                priceUsd={marketData?.priceUsd}
                                volumeUsd={marketData?.totalVolumeUsd}
                            />
                        </div>
                    )}

                    {data && data.accounts.length > 0 && (
                        <UnlockAccountsTable
                            accounts={data.accounts}
                            unattributedXrd={data.unattributedXrd}
                            total={data.unbonding ?? 0}
                            network={network}
                            locale={locale}
                            t={translations}
                            dt={dt}
                            validators={validators}
                            marketData={marketData}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                        />
                    )}
                </>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                <Info className="size-4 shrink-0 mt-px" />
                <span>{t?.note}</span>
            </p>
            {hasVaults && (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                    {t?.updated ?? 'Updated'} {new Date(data.updatedAt!).toLocaleString(locale)} · {data.validators} {t?.validators ?? 'validators counted'}
                </p>
            )}
        </div>
    );
}
