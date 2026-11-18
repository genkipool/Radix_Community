'use client';
/**
 * The "On a date" tab of a Babylon account: the account as it was at the end
 * of a UTC day. Its stakes, tokens, NFTs and pool units are drawn by the
 * card's own tabs, fed with what the Gateway answered for that ledger state
 * (`/api/account-at`), stakes valued at what each LSU was worth then.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import type { DashboardDict, GatewayEntityDetails, MarketData, TranslationsT } from '@/features/dashboard/types';
import { BABYLON_FIRST_DAY } from '@/features/dashboard/lib/olympia';
import { getXrdAddress } from '../constants';
import type { StakingEntry } from '../types/models.types';
import { holdingAmount, type Holding } from '../utils/holdings';
import { Stat } from '../olympia/OlympiaParts';
import { formatAmount } from '../olympia/format';
import { AccountStakingTab } from './AccountStakingTab';
import { AccountNftsTab, AccountPoolUnitsTab, AccountTokensTab } from './AccountAssetsTabs';
import { AtDateView } from './AtDateView';

interface AccountAtDay {
    day: string;
    ledger: { state_version: number; epoch: number; proposer_round_timestamp: string };
    entity: GatewayEntityDetails;
    stakingRows: StakingEntry[];
}

function localTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tzOffsetForDay(day: string): number {
    const [y, m, d] = day.split('-').map(Number);
    if (!y || !m || !d) return new Date().getTimezoneOffset();
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTimezoneOffset();
}

function localTimeZoneShort(locale: string): string {
    try {
        const parts = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(new Date());
        return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
        return '';
    }
}

async function fetchAccountAt(address: string, day: string, network: 'mainnet' | 'stokenet', tzOffset: number): Promise<AccountAtDay> {
    const qs = new URLSearchParams({ address, day, network, tzOffset: String(tzOffset) });
    const res = await fetch(`/api/account-at?${qs.toString()}`);
    if (!res.ok) throw new Error(`account-at ${res.status}`);
    return res.json() as Promise<AccountAtDay>;
}

function xrdOf(entity: GatewayEntityDetails, network: string): number {
    const xrd = ((entity.fungible_resources?.items ?? []) as Holding[]).find((i) => i.resource_address === getXrdAddress(network));
    return xrd ? holdingAmount(xrd) : 0;
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
    const today = localTodayStr();
    const tzOffset = day ? tzOffsetForDay(day) : new Date().getTimezoneOffset();
    const tzLabel = localTimeZoneShort(locale);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['account-at', address, network, day, tzOffset],
        queryFn: () => fetchAccountAt(address, day, network, tzOffset),
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
        <AtDateView
            day={day}
            onPick={setDay}
            calendarT={calendarT}
            locale={locale}
            minDate={BABYLON_FIRST_DAY}
            maxDate={today}
            timezoneLabel={tzLabel}
            useLocalTime
            text={{ ...at, stateVersion: tt?.olympia?.state_version, yearEndPrefix: at?.year_end }}
            status={isLoading ? 'loading' : isError || !data ? 'error' : 'ready'}
            stateVersion={data?.ledger.state_version}
        >
            {data && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <Stat label={at?.total ?? ''} value={formatAmount(liquid + staked + unstaking + claim, locale)} tone="accent" />
                        <Stat label={at?.liquid ?? ''} value={formatAmount(liquid, locale)} />
                        <Stat label={at?.staked ?? ''} value={formatAmount(staked, locale)} tone="primary" />
                        <Stat label={at?.unstaking ?? ''} value={formatAmount(unstaking, locale)} tone="secondary" />
                        <Stat label={at?.claim ?? ''} value={formatAmount(claim, locale)} tone="secondary" />
                    </div>
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
                        showPrices={false}
                        address={address}
                        entityData={data.entity}
                        tt={tt}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        network={network}
                        locale={locale}
                    />
                    <AccountNftsTab
                        address={address}
                        entityData={data.entity}
                        tt={tt}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        network={network}
                        locale={locale}
                    />
                    <AccountPoolUnitsTab
                        pastState
                        address={address}
                        entityData={data.entity}
                        tt={tt}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        network={network}
                        locale={locale}
                    />
                </>
            )}
        </AtDateView>
    );
}
