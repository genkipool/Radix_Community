'use client';

import { useQuery } from '@tanstack/react-query';
import type { Network } from '@/features/dashboard/types';
import { apiFetchGovernanceTally } from '../services/governanceApi';
import type { GovernanceItemKind } from '../lib/governanceVotes';

export interface TallyTarget {
    component: string;
    kind: GovernanceItemKind;
    itemId: string;
    /** Adds this account's voting power to the response. */
    account?: string | null;
    /** Adds the N largest voters. */
    top?: number;
}

export const tallyKey = (t: TallyTarget) =>
    ['governance-tally', t.component, t.kind, t.itemId, t.account ?? null, t.top ?? 0] as const;

/**
 * Weighted tally of a proposal or temperature check, as published by the
 * governance system's vote collector (mainnet only). Null when that system
 * has no known collector.
 */
export function useGovernanceTally(target: TallyTarget, network: Network, enabled = true) {
    return useQuery({
        queryKey: tallyKey(target),
        queryFn: () => apiFetchGovernanceTally({
            component: target.component, type: target.kind, id: target.itemId, account: target.account, top: target.top,
        }),
        enabled: enabled && network === 'mainnet',
        staleTime: 60_000,
        retry: 1,
    });
}
