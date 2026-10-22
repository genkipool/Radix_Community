import logger from '@/lib/logger';
import { summarizeOwnerUnlocks, type PendingOwnerUnlock } from '@/features/dashboard/explorador/utils/ownerUnlocks';
import { withRetry, type Network } from './client';
import { gatewayRestBase } from './validatorList';

/** A validator whose owner has LSUs in the unlock period. */
export interface OwnerUnlock {
    validator: string;
    unlocking: number;
    parts: number;
    nextEpoch: number;
    lastEpoch: number;
}

interface ListPage {
    ledger_state?: { epoch?: number };
    validators?: {
        items?: { address: string; state?: { pending_owner_stake_unit_withdrawals?: PendingOwnerUnlock[] } }[];
        next_cursor?: string;
    };
}

/** How long a read is kept; the list moves by the epoch, five minutes. */
const FRESH_MS = 60_000;

const cache = new Map<Network, { at: number; unlocks: OwnerUnlock[] }>();
const reading = new Map<Network, Promise<OwnerUnlock[]>>();

/** The validators with an owner unlock under way, the one that frees up first at the top. */
async function read(network: Network): Promise<OwnerUnlock[]> {
    const base = gatewayRestBase(network);
    const unlocks: OwnerUnlock[] = [];
    let epoch = 0;
    let cursor: string | undefined;
    // Every validator's state comes with the list itself, so this is the whole
    // read: a page per hundred validators, no request per validator.
    do {
        const page: ListPage = await withRetry(async () => {
            const res = await fetch(`${base}/state/validators/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit_per_page: 100, ...(cursor ? { cursor } : {}) }),
            });
            if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
            return res.json() as Promise<ListPage>;
        });
        epoch = page.ledger_state?.epoch ?? epoch;
        for (const item of page.validators?.items ?? []) {
            const summary = summarizeOwnerUnlocks(item.state?.pending_owner_stake_unit_withdrawals, epoch);
            if (summary) unlocks.push({ validator: item.address, ...summary });
        }
        cursor = page.validators?.next_cursor ?? undefined;
    } while (cursor);
    return unlocks.toSorted((a, b) => a.nextEpoch - b.nextEpoch || b.unlocking - a.unlocking);
}

/**
 * The validators whose owner is unlocking LSUs. Kept for a minute in this
 * instance, and a read already under way is shared, so a crowd of visitors makes
 * one set of Gateway requests.
 */
export async function readOwnerUnlocks(network: Network): Promise<OwnerUnlock[]> {
    const cached = cache.get(network);
    if (cached && Date.now() - cached.at < FRESH_MS) return cached.unlocks;
    let pending = reading.get(network);
    if (!pending) {
        pending = read(network)
            .then(unlocks => {
                cache.set(network, { at: Date.now(), unlocks });
                return unlocks;
            })
            .catch(err => {
                logger.error({ err, network }, '[ownerUnlocks] Read failed: %s', err instanceof Error ? err.message : String(err));
                // A stale list is better than none.
                if (cached) return cached.unlocks;
                throw err;
            })
            .finally(() => reading.delete(network));
        reading.set(network, pending);
    }
    return pending;
}
