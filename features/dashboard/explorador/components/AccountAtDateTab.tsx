'use client';
/**
 * The "On a date" tab of a Babylon account: the account as it was at the end
 * of a UTC day. Its stakes and tokens are drawn by the card's own Staking and
 * Tokens tabs, fed with what the Gateway answered for that ledger state
 * (`/api/account-at`), stakes valued at what each LSU was worth then.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import type { DashboardDict, GatewayEntityDetails, MarketData, TranslationsT } from '@/features/dashboard/types';
import { BABYLON_FIRST_DAY } from '@/features/dashboard/lib/olympia';
import { getXrdAddress } from '../constants';
import type { StakingEntry } from '../types/models.types';
import { Stat, Section, Loading, ErrorText, Empty } from '../olympia/OlympiaParts';
import { fill } from '../olympia/dict';
import { formatAmount } from '../olympia/format';
import { AccountStakingTab } from './AccountStakingTab';
import { AccountTokensTab } from './AccountAssetsTabs';
import { DayPicker, dayLabel } from './DayPicker';

interface AccountAtDay {
    day: string;
    ledger: { state_version: number; epoch: number; proposer_round_timestamp: string };
    entity: GatewayEntityDetails;
    stakingRows: StakingEntry[];
}

async function fetchAccountAt(address: string, day: string, network: 'mainnet' | 'stokenet'): Promise<AccountAtDay> {
    const qs = new URLSearchParams({ address, day, network });
    const res = await fetch(`/api/account-at?${qs.toString()}`);
    if (!res.ok) throw new Error(`account-at ${res.status}`);
    return res.json() as Promise<AccountAtDay>;
}

type Vaulted = { resource_address: string; amount?: string; vaults?: { items?: { amount?: string }[] } };

function xrdOf(entity: GatewayEntityDetails, network: string): number {
    const items = (entity.fungible_resources?.items ?? []) as Vaulted[];
    const xrd = items.find((i) => i.resource_address === getXrdAddress(network));
    if (!xrd) return 0;
    return Number(xrd.amount ?? (xrd.vaults?.items ?? []).reduce((s, v) => s + Number(v.amount ?? 0), 0));
}

export function AccountAtDateTab({ address, network, t, locale, onCopy, copiedAddress, marketData, calendarT }: {
    address: string;
    network: 'mainnet' | 'stokenet';
    t?: Partial<TranslationsT>;
    locale: string;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    marketData?: MarketData;
    calendarT?: CalendarTranslations;
}) {
    const tt = t?.dashboard?.transactions;
    const at = tt?.account_summary?.at_date;
    const [day, setDay] = useState('');
    const today = new Date().toISOString().slice(0, 10);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['account-at', address, network, day],
        queryFn: () => fetchAccountAt(address, day, network),
        enabled: !!day,
        // A past day never changes; today does.
        staleTime: day && day < today ? Infinity : 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
    });

    const liquid = data ? xrdOf(data.entity, network) : 0;
    const sum = (f: (r: StakingEntry) => number) => (data?.stakingRows ?? []).reduce((s, r) => s + f(r), 0);
    const staked = sum((r) => r.xrdInStake);
    const unstaking = sum((r) => r.xrdInUnstake);
    const claim = sum((r) => r.xrdInClaim);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <DayPicker day={day} onPick={setDay} calendarT={calendarT} placeholder={at?.pick ?? ''} locale={locale} minDate={BABYLON_FIRST_DAY} maxDate={today} />
                <p className="text-[11px] text-[var(--color-text-muted)]">{fill(at?.desc, { from: dayLabel(BABYLON_FIRST_DAY, locale), to: dayLabel(today, locale) })}</p>
            </div>
            {!day ? (
                <Empty text={at?.empty} />
            ) : isLoading ? (
                <Loading text={at?.loading} />
            ) : isError || !data ? (
                <ErrorText text={at?.error} />
            ) : (
                <div className="space-y-2">
                    <Section
                        title={fill(at?.state, { date: dayLabel(day, locale) })}
                        aside={<span className="text-[10px] font-mono text-[var(--color-text-muted)]">{tt?.olympia?.state_version} {data.ledger.state_version.toLocaleString(locale)}</span>}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <Stat label={at?.total ?? ''} value={formatAmount(liquid + staked + unstaking + claim, locale)} tone="accent" />
                            <Stat label={at?.liquid ?? ''} value={formatAmount(liquid, locale)} />
                            <Stat label={at?.staked ?? ''} value={formatAmount(staked, locale)} tone="primary" />
                            <Stat label={at?.unstaking ?? ''} value={formatAmount(unstaking, locale)} tone="secondary" />
                            <Stat label={at?.claim ?? ''} value={formatAmount(claim, locale)} tone="secondary" />
                        </div>
                    </Section>
                    <AccountStakingTab
                        stakingRows={data.stakingRows}
                        tt={tt}
                        dt={t?.dashboard as DashboardDict | undefined}
                        network={network}
                        locale={locale}
                        marketData={marketData}
                        currentEpoch={data.ledger.epoch}
                    />
                    <AccountTokensTab
                        address={address}
                        entityData={data.entity}
                        tt={tt}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        network={network}
                        locale={locale}
                    />
                </div>
            )}
        </div>
    );
}
