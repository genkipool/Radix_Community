'use client';

import { useQueries } from '@tanstack/react-query';
import { apiFetchKeyValueEntry } from '@/features/dashboard/services/apiClient';
import type { Network } from '@/features/dashboard/types';
import { parseVoterEntry, type GovernanceItemKind, type VoteSelection } from '../lib/governanceVotes';

export const accountVoteKey = (votersStore: string | null, account: string | null) =>
    ['governance-account-vote', votersStore, account] as const;

/** What each account currently has voted on an item, read from the ledger. */
export function useAccountVotes(votersStore: string | null, kind: GovernanceItemKind, accounts: string[], network: Network) {
    return useQueries({
        queries: accounts.map(account => ({
            queryKey: accountVoteKey(votersStore, account),
            queryFn: async (): Promise<VoteSelection | null> => {
                const entry = await apiFetchKeyValueEntry(votersStore as string, { kind: 'Reference', value: account }, network);
                return parseVoterEntry(entry, kind);
            },
            enabled: !!votersStore,
            staleTime: 30_000,
        })),
        combine: results => ({
            votes: accounts.map((account, i) => ({ account, selection: results[i]?.data ?? null })),
            isLoading: results.some(r => r.isLoading),
        }),
    });
}
