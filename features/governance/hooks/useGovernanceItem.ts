'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails, apiFetchKeyValueEntry } from '@/features/dashboard/services/apiClient';
import { extractEntityMeta } from '@/features/dashboard/utils/entityCache';
import type { Network } from '@/features/dashboard/types';
import {
    findStoreAddress, parseGovernanceItem, parseMajorityJudgmentElection, specFor,
    type GovernanceItem, type GovernanceVote,
} from '../lib/governanceVotes';

export interface GovernanceItemData {
    item: GovernanceItem | null;
    componentName: string | null;
}

/**
 * Loads the proposal, temperature check, or election a vote was cast on, as it
 * stands on the ledger now (title, options, candidates, deadline, vote count…).
 * For Majority Judgment elections, also resolves the linked temperature check
 * that stores the election title, description, links, and candidate slate.
 */
export function useGovernanceItem(vote: GovernanceVote, network: Network) {
    return useQuery<GovernanceItemData>({
        queryKey: ['governance-item', network, vote.component, vote.kind, vote.itemId],
        queryFn: async () => {
            const component = await apiFetchEntityDetails(vote.component, network);
            const componentName = extractEntityMeta(component)?.name ?? null;
            const state = component.details?.state;
            const store = findStoreAddress(state, specFor(vote.kind).storeField);
            if (!store) return { item: null, componentName };
            const entry = await apiFetchKeyValueEntry(store, { kind: 'U64', value: vote.itemId }, network);
            if (vote.kind === 'election') {
                const draft = parseMajorityJudgmentElection(entry, null);
                let tcItem: GovernanceItem | null = null;
                if (draft?.temperatureCheckId) {
                    const tcStore = findStoreAddress(state, specFor('temperature_check').storeField);
                    if (tcStore) {
                        const tcEntry = await apiFetchKeyValueEntry(
                            tcStore,
                            { kind: 'U64', value: draft.temperatureCheckId },
                            network,
                        ).catch(() => null);
                        tcItem = tcEntry ? parseGovernanceItem(tcEntry, 'temperature_check') : null;
                    }
                }
                return { item: parseMajorityJudgmentElection(entry, tcItem), componentName };
            }
            return { item: parseGovernanceItem(entry, vote.kind), componentName };
        },
        staleTime: 60_000,
        retry: 1,
    });
}
