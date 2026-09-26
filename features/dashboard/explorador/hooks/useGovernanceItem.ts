'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails, apiFetchKeyValueEntry } from '@/features/dashboard/services/apiClient';
import { extractEntityMeta } from '@/features/dashboard/utils/entityCache';
import type { Network } from '@/features/dashboard/types';
import {
    findStoreAddress, parseGovernanceItem, specFor,
    type GovernanceItem, type GovernanceVote,
} from '../utils/governanceVoteUtils';

export interface GovernanceItemData {
    item: GovernanceItem | null;
    componentName: string | null;
}

/**
 * Loads the proposal or temperature check a vote was cast on, as it stands on
 * the ledger now (title, options, deadline, vote count…). The governance
 * component's state points at the key-value store holding its items.
 */
export function useGovernanceItem(vote: GovernanceVote, network: Network) {
    return useQuery<GovernanceItemData>({
        queryKey: ['governance-item', network, vote.component, vote.kind, vote.itemId],
        queryFn: async () => {
            const component = await apiFetchEntityDetails(vote.component, network);
            const componentName = extractEntityMeta(component)?.name ?? null;
            const store = findStoreAddress(component.details?.state, specFor(vote.kind).storeField);
            if (!store) return { item: null, componentName };
            const entry = await apiFetchKeyValueEntry(store, { kind: 'U64', value: vote.itemId }, network);
            return { item: parseGovernanceItem(entry, vote.kind), componentName };
        },
        staleTime: 60_000,
        retry: 1,
    });
}
