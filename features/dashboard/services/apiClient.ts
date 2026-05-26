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
        } catch (_) {}
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
        } catch (_) {}
        throw new Error(errorMsg);
    }
    return res.json();
}

export async function apiFetchEntityDetails(address: string, network: 'mainnet' | 'stokenet' = 'mainnet', refresh = false): Promise<GatewayEntityDetails> {
    const baseUrl = network === 'stokenet' ? 'https://babylon-stokenet-gateway.radixdlt.com' : 'https://mainnet.radixdlt.com';
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
    const baseUrl = network === 'stokenet' ? 'https://babylon-stokenet-gateway.radixdlt.com' : 'https://mainnet.radixdlt.com';
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
