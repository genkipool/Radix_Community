'use client';

import { useQuery } from '@tanstack/react-query';
import { olympiaApi } from '@/features/dashboard/services/olympiaApi';
import type { Network } from '@/features/dashboard/types';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';

const GATEWAY_URLS: Record<Network, string> = {
    mainnet: 'https://mainnet.radixdlt.com',
    stokenet: 'https://stokenet.radixdlt.com',
};

const BABYLON_LAUNCH_MS = Date.parse('2023-09-28T00:00:00Z');
const MAX_PAGES_PER_MONTH = 3;
const PAGE_LIMIT = 100;

interface StreamTxLite {
    confirmed_at?: string;
}

interface StreamTxResponse {
    items?: StreamTxLite[];
    next_cursor?: string;
}

function toLocalDateStr(iso: string): string | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchMonthTxDaysDirect(
    accountAddress: string,
    network: Network,
    year: number,
    monthIndex: number,
    signal?: AbortSignal,
): Promise<string[]> {
    const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    if (monthEnd.getTime() < BABYLON_LAUNCH_MS) {
        return [];
    }

    const nowMs = Date.now();
    const effectiveStartMs = Math.max(monthStart.getTime(), BABYLON_LAUNCH_MS);
    const base = GATEWAY_URLS[network];
    const days = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES_PER_MONTH; page++) {
        const body: Record<string, unknown> = {
            affected_global_entities_filter: [accountAddress],
            from_ledger_state: { timestamp: new Date(effectiveStartMs).toISOString() },
            limit_per_page: PAGE_LIMIT,
            order: 'Desc',
            ...(monthEnd.getTime() < nowMs
                ? { at_ledger_state: { timestamp: monthEnd.toISOString() } }
                : {}),
            ...(cursor ? { cursor } : {}),
        };

        const res = await fetch(`${base}/stream/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
        if (!res.ok) break;

        const data = (await res.json()) as StreamTxResponse;
        for (const item of data.items ?? []) {
            if (!item.confirmed_at) continue;
            const localDay = toLocalDateStr(item.confirmed_at);
            if (localDay) days.add(localDay);
        }

        if (!data.next_cursor) break;
        cursor = data.next_cursor;
    }

    return Array.from(days);
}

/**
 * Fetches the set of local `YYYY-MM-DD` days in the visible calendar month that
 * contain at least one Babylon transaction for `accountAddress`.
 *
 * Calls the public Radix Gateway directly from the browser with empty `opt_ins`
 * (zero Vercel invocations, zero Redis commands, zero server bandwidth) and
 * caches past months indefinitely in React Query.
 */
export function useAccountMonthTxDays({
    accountAddress,
    network,
    year,
    monthIndex,
    enabled,
}: {
    accountAddress: string;
    network: Network;
    year: number;
    monthIndex: number;
    enabled: boolean;
}) {
    const now = new Date();
    const isPastMonth =
        year < now.getFullYear() ||
        (year === now.getFullYear() && monthIndex < now.getMonth());

    return useQuery({
        queryKey: ['account-month-tx-days', network, accountAddress, year, monthIndex],
        queryFn: ({ signal }) =>
            fetchMonthTxDaysDirect(accountAddress, network, year, monthIndex, signal),
        enabled,
        staleTime: isPastMonth ? CACHE_TIMES.INFINITY : CACHE_TIMES.MEDIUM,
        gcTime: CACHE_TIMES.LONG,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

/**
 * Fetches all local `YYYY-MM-DD` days in an Olympia year (2021–2023) that have
 * at least one real Olympia transaction (`transactionId !== null`).
 * One cached request per year covers all 12 months with `staleTime: Infinity`.
 */
export function useOlympiaYearTxDays({
    olympiaAddress,
    year,
    enabled,
}: {
    olympiaAddress?: string | null;
    year: number;
    enabled: boolean;
}) {
    const isOlympiaYear = year >= 2021 && year <= 2023;

    return useQuery({
        queryKey: ['olympia-year-tx-days', olympiaAddress ?? '', year],
        queryFn: async () => {
            const res = await olympiaApi.accountMoves(olympiaAddress!, year);
            if (!res) return [];
            const days = new Set<string>();
            for (const move of res.moves) {
                if (!move.transactionId) continue;
                const localDay = toLocalDateStr(move.timestamp);
                if (localDay) days.add(localDay);
            }
            return Array.from(days);
        },
        enabled: enabled && Boolean(olympiaAddress) && isOlympiaYear,
        staleTime: CACHE_TIMES.INFINITY,
        gcTime: CACHE_TIMES.LONG,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
