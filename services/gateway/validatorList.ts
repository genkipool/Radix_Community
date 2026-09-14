/**
 * services/gateway/validatorList.ts
 *
 * The Gateway's validator list, read page by page over REST.
 *
 * Shared by the full validator build and by the validator set fingerprint, so
 * both read the list through the same request and see the same shape.
 */

import logger from '@/lib/logger';
import { withRetry, type Network } from './client';

export const gatewayRestBase = (network: Network) =>
    network === 'stokenet'
        ? 'https://gateway-stokenet.radix.community'
        : 'https://mainnet.radixdlt.com';

/*
 * Opt-ins the REST endpoint takes and the SDK wrapper does not expose:
 *   - validator_active_in_epoch → active_in_epoch.stake
 *   - explicit_metadata         → validator metadata (name, icon, etc.)
 * The state field (stake_unit_resource_address, stake_vault, etc.) is always
 * included in the /state/validators/list response.
 */
const LIST_OPT_INS = {
    validator_active_in_epoch: true,
    explicit_metadata: true,
};

type ListPage<T> = {
    validators?: { items?: T[]; next_cursor?: string };
    items?: T[];
    next_cursor?: string;
};

export async function fetchValidatorListRest<T>(network: Network): Promise<T[]> {
    const restBase = gatewayRestBase(network);
    const items: T[] = [];
    let cursor: string | undefined = undefined;
    do {
        const body: Record<string, unknown> = { limit_per_page: 100, opt_ins: LIST_OPT_INS };
        if (cursor) body.cursor = cursor;
        try {
            // Retried: a rate limit or a 5xx on ONE page used to end the
            // whole walk, and the caller could not tell the difference
            // between "the read broke" and "this network has no validators".
            const data = await withRetry(async () => {
                const res = await fetch(`${restBase}/state/validators/list`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
                }
                return res.json() as Promise<ListPage<T>>;
            });
            const page = data?.validators?.items ?? data?.items ?? [];
            items.push(...page);
            cursor = data?.validators?.next_cursor ?? data?.next_cursor ?? undefined;
        } catch (err) {
            // Nothing read at all: report it. A later page failing is
            // different: the list we have is real and worth keeping, it is
            // just short, and saying nothing about it would be worse.
            if (items.length === 0) throw err;
            logger.error(
                { err, network, gathered: items.length },
                '[fetchValidatorListRest] Page failed; continuing with what was read',
            );
            break;
        }
    } while (cursor);
    return items;
}
