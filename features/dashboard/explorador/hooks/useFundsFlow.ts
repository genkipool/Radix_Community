'use client';

import { useQuery } from '@tanstack/react-query';
import type { Network } from '@/features/dashboard/types';
import type { DestinationHint, FundsFlow } from '../utils/fundsFlow';

export type AccountFunds = FundsFlow & { more: boolean };

async function get<T>(address: string, network: Network, hints: boolean): Promise<T> {
    const res = await fetch(`/api/funds-flow?address=${encodeURIComponent(address)}&network=${network}${hints ? '&hints=1' : ''}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<T>;
}

/** Where an account's XRD came from and went, over its latest transactions. */
export function useFundsFlow(address: string, network: Network) {
    return useQuery({
        queryKey: ['funds-flow', network, address],
        queryFn: () => get<AccountFunds>(address, network, false),
        staleTime: 120_000,
    });
}

/** What the account's biggest destinations do with the XRD: asked once the flow is on screen. */
export function useDestinationHints(address: string, network: Network, enabled: boolean) {
    return useQuery({
        queryKey: ['funds-flow-hints', network, address],
        queryFn: async () => (await get<{ hints: Record<string, DestinationHint> }>(address, network, true)).hints,
        enabled,
        staleTime: 120_000,
        retry: 1,
    });
}
