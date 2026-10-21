import type { TransactionInfo, StakeHistoryEntry } from '@/types/radix';
import type { GatewayEntityDetails } from '@/features/dashboard/types';

/* ═══════ API ROUTE HELPERS (browser-side, all requests go through the server) ═══════ */

export async function apiFetchTransactions(
    options: {
        cursor?: string;
        limit?: number;
        address?: string | string[];
        network?: 'mainnet' | 'stokenet';
        tag?: string;
        start?: string;
        end?: string;
    }
): Promise<{ transactions: TransactionInfo[], nextCursor: string | undefined }> {
    const { cursor, limit = 15, address, network = 'mainnet', tag = 'All', start, end } = options;
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    if (address) {
        if (Array.isArray(address)) {
            params.set('address', address.join(','));
        } else {
            params.set('address', address);
        }
    }
    params.set('network', network);
    if (tag !== 'All') params.set('tag', tag);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    // Send the client's IANA timezone so the server computes correct day
    // boundaries for each specific date (handles DST automatically)
    params.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    if (!res.ok) {
        let errorMsg = `API error: ${res.status}`;
        try {
            const errJson = await res.json();
            if (errJson && errJson.error) errorMsg = `API error: ${errJson.error}`;
        } catch (_) { }
        throw new Error(errorMsg);
    }
    return res.json();
}

export async function apiFetchTransactionDetails(intentHash: string, network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, unknown>> {
    const res = await fetch(`/api/transactions/${encodeURIComponent(intentHash)}?network=${network}`);
    if (!res.ok) {
        let errorMsg = `API error: ${res.status}`;
        try {
            const errJson = await res.json();
            if (errJson && errJson.error) errorMsg = `API error: ${errJson.error}`;
        } catch (_) { }
        throw new Error(errorMsg);
    }
    return res.json();
}

/** The entity/details request every explorer card makes, for one address or a batch. */
const entityDetailsBody = (addresses: string[]) => JSON.stringify({
    addresses,
    opt_ins: {
        explicit_metadata: [
            'name', 'symbol', 'icon_url', 'description', 'tags',
            'info_url', 'validator_fee_factor', 'claim_epoch_delay',
            'dapp_definition', 'dapp_definitions', 'pool', 'pool_address',
            'validator', 'claim_nft'
        ],
        ancestor_identities: false,
        component_royalty_vault_balance: false,
        package_royalty_vault_balance: false,
        non_fungible_include_nfids: true,
        dapp_two_way_links: true,
        native_resource_details: true,
    },
    aggregation_level: 'Vault'
});

/** One entity/details request, its items keyed by address, each carrying the ledger state. */
async function postEntityDetails(addresses: string[], network: 'mainnet' | 'stokenet', refresh = false): Promise<Record<string, GatewayEntityDetails>> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/state/entity/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: entityDetailsBody(addresses),
        cache: refresh ? 'no-store' : 'default',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { items?: GatewayEntityDetails[]; ledger_state?: unknown };
    // Inject ledger_state into each item for epoch calculations. A request
    // for one address takes its one item whatever address it reports.
    const items = data.items ?? [];
    return Object.fromEntries(items.map((item) => [
        addresses.length === 1 && items.length === 1 ? addresses[0] : item.address,
        Object.assign(item, { ledger_state: data.ledger_state }),
    ]));
}

// ─── Coalescing ─────────────────────────────────────────────────────────────
// Cards ask for their entity one by one as they mount; asked within the same
// few milliseconds, they share one request (20 addresses each, the Gateway's
// limit) and an address asked twice is asked once. Should a shared request
// fail, each address is asked on its own, so one bad address cannot fail the
// others and every caller sees what a request of its own would have given.

/** How long a request waits for others to join it. Below a frame: nothing a person can see. */
const COALESCE_MS = 10;
const ENTITY_BATCH_LIMIT = 20;

interface Waiter {
    resolve: (details: GatewayEntityDetails) => void;
    reject: (error: unknown) => void;
}

const queued: Record<'mainnet' | 'stokenet', Map<string, Waiter[]>> = { mainnet: new Map(), stokenet: new Map() };
const timers: Partial<Record<'mainnet' | 'stokenet', ReturnType<typeof setTimeout>>> = {};

async function settle(addresses: string[], waiters: Map<string, Waiter[]>, network: 'mainnet' | 'stokenet') {
    const answer = (address: string, found: GatewayEntityDetails | undefined) => {
        for (const waiter of waiters.get(address) ?? []) {
            if (found) waiter.resolve(found);
            else waiter.reject(new Error('Entity not found'));
        }
    };
    try {
        const found = await postEntityDetails(addresses, network);
        for (const address of addresses) answer(address, found[address]);
    } catch (error) {
        if (addresses.length === 1) {
            for (const waiter of waiters.get(addresses[0]) ?? []) waiter.reject(error);
            return;
        }
        await Promise.all(addresses.map((address) => settle([address], waiters, network)));
    }
}

function flush(network: 'mainnet' | 'stokenet') {
    delete timers[network];
    const waiters = queued[network];
    queued[network] = new Map();
    const addresses = [...waiters.keys()];
    for (let i = 0; i < addresses.length; i += ENTITY_BATCH_LIMIT) {
        void settle(addresses.slice(i, i + ENTITY_BATCH_LIMIT), waiters, network);
    }
}

export async function apiFetchEntityDetails(address: string, network: 'mainnet' | 'stokenet' = 'mainnet', refresh = false): Promise<GatewayEntityDetails> {
    // A forced refresh skips the queue: it must not be answered from a shared request.
    if (refresh) {
        const found = (await postEntityDetails([address], network, true))[address];
        if (!found) throw new Error('Entity not found');
        return found;
    }
    return new Promise<GatewayEntityDetails>((resolve, reject) => {
        const waiting = queued[network].get(address);
        if (waiting) waiting.push({ resolve, reject });
        else queued[network].set(address, [{ resolve, reject }]);
        timers[network] ??= setTimeout(() => flush(network), COALESCE_MS);
    });
}

/**
 * Several entities' details, each exactly as {@link apiFetchEntityDetails}
 * returns it; they join the same shared requests, so a card asking for one of
 * them at the same moment adds nothing. Addresses the Gateway does not know
 * are left out.
 */
export async function apiFetchEntityDetailsBatch(addresses: string[], network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, GatewayEntityDetails>> {
    const unique = [...new Set(addresses)];
    const results = await Promise.allSettled(unique.map((address) => apiFetchEntityDetails(address, network)));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected' && !String(r.reason).includes('Entity not found'));
    if (failed) throw failed.reason;
    return Object.fromEntries(unique.flatMap((address, i) => {
        const r = results[i];
        return r.status === 'fulfilled' ? [[address, r.value]] : [];
    }));
}

export async function apiFetchNonFungibleData(resourceAddress: string, localIds: string[], network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, unknown>[]> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/state/non-fungible/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resource_address: resourceAddress,
            non_fungible_ids: localIds.slice(0, 100)
        }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // The gateway returns an array in `non_fungible_ids`
    // We can also inject ledger_state into each NFT if needed, but we injected it in entity details already.
    return (data.non_fungible_ids || []) as Record<string, unknown>[];
}

export async function apiFetchStakeHistory(
    validatorAddress: string,
    network: 'mainnet' | 'stokenet' = 'mainnet'
): Promise<StakeHistoryEntry[]> {
    const params = new URLSearchParams();
    params.set('address', validatorAddress);
    params.set('network', network);

    const res = await fetch(`/api/stake-history?${params.toString()}`);
    if (!res.ok) return [];
    return res.json();
}



export interface RankedAccount {
    address: string;
    /** XRD balance (top_accounts) or the stake position's worth in XRD (top_lsu). */
    amount: string;
    /** top_lsu: the validator the position is with. */
    validator?: string;
}

export type RankingType = 'top_accounts' | 'top_lsu';

/** One page of a ranking of accounts, biggest first. */
export async function apiFetchRanking(
    type: RankingType,
    network: 'mainnet' | 'stokenet' = 'mainnet',
    cursor?: string,
): Promise<{ accounts: RankedAccount[]; nextCursor: string | undefined; partial: boolean }> {
    const params = new URLSearchParams({ type, network });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`/api/rankings?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { accounts?: RankedAccount[]; nextCursor?: string; partial?: boolean };
    return { accounts: data.accounts ?? [], nextCursor: data.nextCursor, partial: !!data.partial };
}

export async function apiFetchHistoricalStakingBalance(
    accountAddress: string,
    stateVersion: number,
    network: 'mainnet' | 'stokenet',
    validatorsData: { validators: import('@/types/radix').Validator[] } | undefined,
    confirmedAt: string | Date
): Promise<number> {
    const GATEWAY_URL = network === 'stokenet'
        ? 'https://gateway-stokenet.radix.community'
        : 'https://mainnet.radixdlt.com';

    const res = await fetch(`${GATEWAY_URL}/state/entity/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            addresses: [accountAddress],
            opt_ins: { fungible_resources: true },
            at_ledger_state: { state_version: stateVersion }
        })
    });

    if (!res.ok) return 0;
    const data = await res.json();

    const accountItem = data.items?.find((i: { address: string }) => i.address === accountAddress);
    if (!accountItem) return 0;

    const fungibles = accountItem.fungible_resources?.items || [];

    const lsuToValidator = new Map<string, string>();
    if (validatorsData?.validators) {
        validatorsData.validators.forEach((v: import('@/types/radix').Validator) => {
            if (v.lsuResource) {
                lsuToValidator.set(v.lsuResource, v.address);
            }
        });
    }

    const extraAddresses: string[] = [];
    const lsuAddressesInAccount: string[] = [];
    for (const f of fungibles) {
        if (lsuToValidator.has(f.resource_address)) {
            lsuAddressesInAccount.push(f.resource_address);
            extraAddresses.push(f.resource_address);
            const valAddr = lsuToValidator.get(f.resource_address)!;
            extraAddresses.push(valAddr);
        }
    }

    const historicalRedemptionRates = new Map<string, number>();

    if (extraAddresses.length > 0) {
        try {
            const resExtra = await fetch(`${GATEWAY_URL}/state/entity/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addresses: extraAddresses,
                    at_ledger_state: { state_version: stateVersion }
                })
            });

            if (resExtra.ok) {
                const extraData = await resExtra.json();
                const items = (extraData.items || []) as Array<{
                    address: string;
                    details?: {
                        total_supply?: string;
                        total_minted?: string;
                        state?: {
                            stake_vault?: { balance: string }
                        }
                    };
                    stake_vault?: { balance: string };
                    state?: {
                        stake_vault?: { balance: string }
                    };
                    active_in_epoch?: {
                        stake: string;
                    };
                }>;

                const itemsMap = new Map<string, typeof items[number]>();
                items.forEach((item) => {
                    itemsMap.set(item.address, item);
                });

                for (const lsuAddr of lsuAddressesInAccount) {
                    const valAddr = lsuToValidator.get(lsuAddr)!;
                    const lsuItem = itemsMap.get(lsuAddr);
                    const valItem = itemsMap.get(valAddr);

                    let lsuSupply = 1;
                    if (lsuItem) {
                        lsuSupply = parseFloat(
                            lsuItem.details?.total_supply ??
                            lsuItem.details?.total_minted ??
                            '1'
                        );
                        if (lsuSupply === 0) lsuSupply = 1;
                    }

                    let valStake = 0;
                    if (valItem) {
                        valStake = parseFloat(
                            valItem.stake_vault?.balance ??
                            valItem.details?.state?.stake_vault?.balance ??
                            valItem.state?.stake_vault?.balance ??
                            valItem.active_in_epoch?.stake ??
                            '0'
                        );
                    }

                    const factor = valStake / lsuSupply;
                    if (factor > 0) {
                        historicalRedemptionRates.set(lsuAddr, factor);
                    }
                }
            }
        } catch {
            // Fallback to mathematical discount on error
        }
    }

    let totalStaking = 0;
    const now = new Date();
    const txDate = new Date(confirmedAt);
    const daysDiff = Math.max(0, (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
    const validatorByLsu = new Map((validatorsData?.validators ?? []).map(v => [v.lsuResource, v] as const));

    for (const f of fungibles) {
        if (lsuToValidator.has(f.resource_address)) {
            const amount = Number(f.amount);

            let factor = historicalRedemptionRates.get(f.resource_address);
            if (factor === undefined) {
                const currentVal = validatorByLsu.get(f.resource_address);
                const currentFactor = currentVal?.lsu2xrdFactor || 1;
                const apy = currentVal?.apyProjection || 5.76;
                factor = currentFactor / (1 + (apy / 100) * (daysDiff / 365));
            }

            totalStaking += amount * factor;
        }
    }
    return totalStaking;
}

/**
 * @param fingerprint  The validator set fingerprint the caller wants to see.
 *                     It goes into the URL, so a changed set is a different
 *                     URL and no CDN copy of the old list can answer it.
 */
export async function apiFetchValidators(
    network: 'mainnet' | 'stokenet' = 'mainnet',
    fingerprint?: string,
): Promise<{
    validators: import('@/types/radix').Validator[];
    networkStats: import('@/types/radix').NetworkStats;
    fingerprint?: string;
}> {
    const version = fingerprint ? `&v=${encodeURIComponent(fingerprint)}` : '';
    const res = await fetch(`/api/validators?network=${network}${version}`);
    if (!res.ok) throw new Error(`Validators API error: ${res.status}`);
    return res.json();
}

/** The live validator set fingerprint (see /api/validators/fingerprint). */
export async function apiFetchValidatorSetFingerprint(
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<{ fingerprint: string }> {
    const res = await fetch(`/api/validators/fingerprint?network=${network}`);
    if (!res.ok) throw new Error(`Validators fingerprint API error: ${res.status}`);
    return res.json();
}

/**
 * The protocol-update signal these validators have cast, read from the ledger
 * (see /api/validators/votes). Asked only for the validators the connected
 * wallet owns, whose badge is the actionable one.
 */
export async function apiFetchProtocolVotes(
    addresses: string[],
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<{ votes: Record<string, string> }> {
    if (addresses.length === 0) return { votes: {} };
    const params = new URLSearchParams({ network, addresses: addresses.join(',') });
    const res = await fetch(`/api/validators/votes?${params}`);
    if (!res.ok) throw new Error(`Protocol votes API error: ${res.status}`);
    return res.json();
}

/**
 * Drops the cached signal for a validator, right after one has been signed, so
 * the next read asks the ledger instead of answering from before the vote.
 */
export async function apiForgetProtocolVote(
    address: string,
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<void> {
    const params = new URLSearchParams({ network, address });
    try {
        await fetch(`/api/validators/votes?${params}`, { method: 'DELETE' });
    } catch {
        // Best effort: the cached answer expires on its own soon enough.
    }
}

/**
 * Fetches the available years for validator rewards.
 */
export async function apiFetchValidatorRewardsYears(address: string): Promise<{ years: number[] }> {
    const res = await fetch(`/api/validator-rewards?address=${address}&action=years`);
    if (!res.ok) throw new Error(`Validator rewards years API error: ${res.status}`);
    return res.json();
}

/**
 * Fetches the available years for account rewards.
 */
export async function apiFetchAccountRewardsYears(address: string): Promise<{ years: number[] }> {
    const res = await fetch(`/api/account-rewards?address=${address}&action=years`);
    if (!res.ok) throw new Error(`Account rewards years API error: ${res.status}`);
    return res.json();
}

export async function apiFetchAllNonFungibleIds(resourceAddress: string, network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<string[]> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    let nextCursor: string | undefined = undefined;
    const allIds: string[] = [];
    do {
        const response: globalThis.Response = await fetch(`${baseUrl}/state/non-fungible/ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resource_address: resourceAddress,
                cursor: nextCursor
            }),
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const parsedData = (await response.json()) as {
            non_fungible_ids?: { items?: string[]; next_cursor?: string };
        };
        const ids = parsedData.non_fungible_ids?.items || [];
        allIds.push(...ids);
        nextCursor = parsedData.non_fungible_ids?.next_cursor;
    } while (nextCursor && allIds.length < 1000); // cap at 1000 to prevent infinite loops in UI
    return allIds;
}

export interface NonFungibleLocation {
    /** Vault holding the NFT. */
    vault: string;
    /** Global entity owning that vault, whatever its kind (account, access controller, component…). */
    holder?: string;
    /** `holder` when it is an account. Kept for callers that only display accounts. */
    account?: string;
}

export async function apiFetchNonFungibleLocation(resourceAddress: string, localIds: string[], network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, NonFungibleLocation>> {
    if (localIds.length === 0) return {};
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/state/non-fungible/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resource_address: resourceAddress,
            non_fungible_ids: localIds.slice(0, 100)
        }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    const locationMap: Record<string, NonFungibleLocation> = {};
    for (const item of (data.non_fungible_ids || [])) {
        if (item.owning_vault_address) {
            const ancestor = item.owning_vault_global_ancestor_address as string | undefined;
            locationMap[item.non_fungible_id] = {
                vault: item.owning_vault_address,
                holder: ancestor,
                account: ancestor && ancestor.startsWith('account_') ? ancestor : undefined,
            };
        }
    }
    return locationMap;
}

/**
 * Current value of one key-value store entry, with schema field names
 * (programmatic JSON). Returns null when the key does not exist.
 */
export async function apiFetchKeyValueEntry(
    kvsAddress: string,
    keyJson: { kind: string; value: string },
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<unknown | null> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/state/key-value-store/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_value_store_address: kvsAddress, keys: [{ key_json: keyJson }] }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { entries?: Array<{ value?: { programmatic_json?: unknown } }> };
    return data.entries?.[0]?.value?.programmatic_json ?? null;
}

/**
 * The local ids of a collection an account has held, newest movement first:
 * what entered or left it, read from its transactions that moved that resource.
 * Covers what it no longer holds (sent, deposited or burned), which no vault shows.
 */
export async function apiFetchAccountNftHistory(
    account: string,
    resourceAddress: string,
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<string[]> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/stream/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            limit_per_page: 100,
            affected_global_entities_filter: [account],
            balance_change_resources_filter: [resourceAddress],
            opt_ins: { balance_changes: true },
        }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as {
        items?: Array<{ balance_changes?: { non_fungible_balance_changes?: Array<{ entity_address: string; resource_address: string; added?: string[]; removed?: string[] }> } }>;
    };
    const ids = new Set<string>();
    for (const tx of data.items ?? []) {
        for (const change of tx.balance_changes?.non_fungible_balance_changes ?? []) {
            if (change.entity_address !== account || change.resource_address !== resourceAddress) continue;
            for (const id of [...(change.removed ?? []), ...(change.added ?? [])]) ids.add(id);
        }
    }
    return [...ids];
}
