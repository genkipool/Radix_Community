import logger from '@/lib/logger';
import { summarizeOwnerUnlocks, type PendingOwnerUnlock } from '@/features/dashboard/explorador/utils/ownerUnlocks';
import { pendingFeeChange, type FeeChangeRequest } from '@/features/dashboard/explorador/utils/feeChange';
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

/** A validator with a commission change waiting to take effect. */
export interface FeeChange {
    validator: string;
    /** Percent, as shown. */
    current: number;
    next: number;
    epoch: number;
}

/** What the validator list shows about validators that are about to change. */
export interface ValidatorWatch {
    ownerUnlocks: OwnerUnlock[];
    feeChanges: FeeChange[];
}

interface ListPage {
    ledger_state?: { epoch?: number };
    validators?: {
        items?: {
            address: string;
            state?: {
                pending_owner_stake_unit_withdrawals?: PendingOwnerUnlock[];
                validator_fee_factor?: string;
                validator_fee_change_request?: FeeChangeRequest | null;
            };
        }[];
        next_cursor?: string;
    };
}

/** How long a read is kept; the list moves by the epoch, five minutes. */
const FRESH_MS = 60_000;

const cache = new Map<Network, { at: number; watch: ValidatorWatch }>();
const reading = new Map<Network, Promise<ValidatorWatch>>();

/**
 * Both lists come out of one walk of the validator list. Every validator's state
 * comes with it, so a page per hundred validators is the whole read: no request
 * per validator.
 */
async function read(network: Network): Promise<ValidatorWatch> {
    const base = gatewayRestBase(network);
    const ownerUnlocks: OwnerUnlock[] = [];
    const feeChanges: FeeChange[] = [];
    let epoch = 0;
    let cursor: string | undefined;
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
            const unlock = summarizeOwnerUnlocks(item.state?.pending_owner_stake_unit_withdrawals, epoch);
            if (unlock) ownerUnlocks.push({ validator: item.address, ...unlock });
            const fee = pendingFeeChange(item.state, epoch);
            if (fee) feeChanges.push({ validator: item.address, ...fee });
        }
        cursor = page.validators?.next_cursor ?? undefined;
    } while (cursor);
    return {
        // The one that frees up first at the top.
        ownerUnlocks: ownerUnlocks.toSorted((a, b) => a.nextEpoch - b.nextEpoch || b.unlocking - a.unlocking),
        // The one that takes effect first at the top.
        feeChanges: feeChanges.toSorted((a, b) => a.epoch - b.epoch || (b.next - b.current) - (a.next - a.current)),
    };
}

/**
 * The validators about to change: owners unlocking LSUs, commissions about to
 * move. Kept for a minute in this instance, and a read already under way is
 * shared, so a crowd of visitors makes one set of Gateway requests.
 */
export async function readValidatorWatch(network: Network): Promise<ValidatorWatch> {
    const cached = cache.get(network);
    if (cached && Date.now() - cached.at < FRESH_MS) return cached.watch;
    let pending = reading.get(network);
    if (!pending) {
        pending = read(network)
            .then(watch => {
                cache.set(network, { at: Date.now(), watch });
                return watch;
            })
            .catch(err => {
                logger.error({ err, network }, '[validatorWatch] Read failed: %s', err instanceof Error ? err.message : String(err));
                // A stale list is better than none.
                if (cached) return cached.watch;
                throw err;
            })
            .finally(() => reading.delete(network));
        reading.set(network, pending);
    }
    return pending;
}
