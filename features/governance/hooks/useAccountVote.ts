'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchKeyValueEntry } from '@/features/dashboard/services/apiClient';
import type { Network } from '@/features/dashboard/types';
import { parseVoterEntry, type GovernanceItemKind } from '../lib/governanceVotes';

export const accountVoteKey = (votersStore: string | null, account: string | null) =>
    ['governance-account-vote', votersStore, account] as const;

/** What an account currently has voted on an item, read from the ledger. */
export function useAccountVote(votersStore: string | null, kind: GovernanceItemKind, account: string | null, network: Network) {
    return useQuery({
        queryKey: accountVoteKey(votersStore, account),
        queryFn: async () => {
            const entry = await apiFetchKeyValueEntry(votersStore as string, { kind: 'Reference', value: account as string }, network);
            return parseVoterEntry(entry, kind);
        },
        enabled: !!votersStore && !!account,
        staleTime: 30_000,
    });
}
