import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { withRetry } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import { GOVERNANCE_SYSTEMS, systemByKey, type GovernanceSystem } from '../config/systems';
import { parseGovernanceItem, type GovernanceItemKind } from '../lib/governanceVotes';
import type { GovernanceEntry } from '../types';
import { pjField, pjNumber, pjText } from '../lib/programmaticJson';

/**
 * Proposals and temperature checks, read straight from each governance
 * component on the ledger. Nothing is registered anywhere else: whatever a
 * component holds is listed, including items created from other front-ends.
 */

export type { GovernanceEntry };

/** Component state field holding each kind's items and their count. */
const STORES: Record<GovernanceItemKind, { store: string; count: string }> = {
    proposal: { store: 'proposals', count: 'proposal_count' },
    temperature_check: { store: 'temperature_checks', count: 'temperature_check_count' },
};

const KEYS_PER_REQUEST = 100;

async function componentState(system: GovernanceSystem): Promise<unknown> {
    const res = await withRetry(() =>
        gatewayPost<{ items?: Array<{ details?: { state?: unknown } }> }>(system.network, '/state/entity/details', {
            addresses: [system.component],
        }),
    );
    return res.items?.[0]?.details?.state ?? null;
}

async function readItems(system: GovernanceSystem, store: string, ids: string[]): Promise<Array<{ id: string; raw: unknown }>> {
    const out: Array<{ id: string; raw: unknown }> = [];
    for (let i = 0; i < ids.length; i += KEYS_PER_REQUEST) {
        const batch = ids.slice(i, i + KEYS_PER_REQUEST);
        const res = await withRetry(() =>
            gatewayPost<{ entries?: Array<{ key?: { programmatic_json?: unknown }; value?: { programmatic_json?: unknown } }> }>(
                system.network,
                '/state/key-value-store/data',
                { key_value_store_address: store, keys: batch.map(value => ({ key_json: { kind: 'U64', value } })) },
            ),
        );
        for (const entry of res.entries ?? []) {
            const id = pjText(entry.key?.programmatic_json);
            if (id !== null) out.push({ id, raw: entry.value?.programmatic_json });
        }
    }
    return out;
}

async function systemEntries(system: GovernanceSystem, kinds: GovernanceItemKind[], only?: string): Promise<GovernanceEntry[]> {
    const state = await componentState(system);
    const entries = await Promise.all(kinds.map(async kind => {
        const store = pjText(pjField(state, STORES[kind].store));
        const count = pjNumber(pjField(state, STORES[kind].count)) ?? 0;
        if (!store || count <= 0) return [];
        const ids = only !== undefined ? [only] : Array.from({ length: count }, (_, i) => String(i));
        const rows = await readItems(system, store, ids);
        return rows.flatMap(({ id, raw }) => {
            const item = parseGovernanceItem(raw, kind);
            return item ? [{ systemKey: system.key, systemName: system.name, kind, id, item }] : [];
        });
    }));
    return entries.flat();
}

/** Every visible proposal and temperature check across all governance systems. */
export async function fetchGovernanceEntries(): Promise<GovernanceEntry[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('governance-entries');

    const perSystem = await Promise.all(
        GOVERNANCE_SYSTEMS.map(system =>
            systemEntries(system, ['proposal', 'temperature_check']).catch(() => [] as GovernanceEntry[]),
        ),
    );
    // The list does not show full texts; leaving them out keeps the payload small.
    return perSystem.flat()
        .filter(e => !e.item.hidden)
        .map(e => ({ ...e, item: { ...e.item, description: null } }));
}

/** One item with its full text, or null when it does not exist. */
export async function fetchGovernanceEntry(systemKey: string, kind: GovernanceItemKind, id: string): Promise<GovernanceEntry | null> {
    'use cache';
    cacheLife('minutes');
    cacheTag('governance-entries', `governance-${systemKey}-${kind}-${id}`);

    const system = systemByKey(systemKey);
    if (!system || !/^\d{1,19}$/.test(id)) return null;
    const [entry] = await systemEntries(system, [kind], id);
    return entry ?? null;
}
