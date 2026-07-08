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

export async function apiFetchEntityDetails(address: string, network: 'mainnet' | 'stokenet' = 'mainnet', refresh = false): Promise<GatewayEntityDetails> {
    const baseUrl = network === 'stokenet' ? 'https://gateway-stokenet.radix.community' : 'https://mainnet.radixdlt.com';
    const res = await fetch(`${baseUrl}/state/entity/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            addresses: [address],
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
        }),
        cache: refresh ? 'no-store' : 'default',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (!data.items || data.items.length === 0) throw new Error("Entity not found");

    // Inject ledger_state into the returned item for epoch calculations
    const item = data.items[0];
    item.ledger_state = data.ledger_state;
    return item as GatewayEntityDetails;
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

export async function apiFetchValidators(
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<{ validators: import('@/types/radix').Validator[]; networkStats: import('@/types/radix').NetworkStats }> {
    const res = await fetch(`/api/validators?network=${network}`);
    if (!res.ok) throw new Error(`Validators API error: ${res.status}`);
    return res.json();
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
        const parsedData: any = await response.json();
        const ids = (parsedData.non_fungible_ids?.items || []) as string[];
        allIds.push(...ids);
        nextCursor = parsedData.non_fungible_ids?.next_cursor;
    } while (nextCursor && allIds.length < 1000); // cap at 1000 to prevent infinite loops in UI
    return allIds;
}

export async function apiFetchNonFungibleLocation(resourceAddress: string, localIds: string[], network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, string>> {
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
    
    const locationMap: Record<string, string> = {};
    for (const item of (data.non_fungible_ids || [])) {
        if (item.owning_vault_address) {
            locationMap[item.non_fungible_id] = item.owning_vault_address;
        }
    }
    return locationMap;
}
