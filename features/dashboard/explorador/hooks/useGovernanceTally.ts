'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchGovernanceTally } from '@/features/dashboard/services/apiClient';
import type { Network } from '@/features/dashboard/types';
import type { GovernanceVote } from '../utils/governanceVoteUtils';

/**
 * Weighted tally of the vote's proposal or temperature check, as published by
 * the governance dApp's vote collector (mainnet only). Null when that dApp has
 * no known collector.
 */
export function useGovernanceTally(vote: GovernanceVote, network: Network) {
    return useQuery({
        queryKey: ['governance-tally', vote.component, vote.kind, vote.itemId, vote.account],
        queryFn: () => apiFetchGovernanceTally({ component: vote.component, type: vote.kind, id: vote.itemId, account: vote.account }),
        enabled: network === 'mainnet',
        staleTime: 60_000,
        retry: 1,
    });
}
