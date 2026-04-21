import type { TransactionInfo, StakeHistoryEntry } from '@/types/radix';
import type { GatewayEntityDetails } from '@/features/dashboard/types';

/* ═══════ API ROUTE HELPERS (browser-side, all requests go through the server) ═══════ */

export async function apiFetchTransactions(
    options: {
        cursor?: string;
        limit?: number;
        address?: string;
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
    if (address) params.set('address', address);
    params.set('network', network);
    if (tag !== 'All') params.set('tag', tag);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    // Send the client's IANA timezone so the server computes correct day
    // boundaries for each specific date (handles DST automatically)
    params.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    const res = await fetch(`/api/transactions?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export async function apiFetchTransactionDetails(intentHash: string, network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, unknown>> {
    const res = await fetch(`/api/transactions/${encodeURIComponent(intentHash)}?network=${network}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export async function apiFetchEntityDetails(address: string, network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<GatewayEntityDetails> {
    const res = await fetch(`/api/entity/${encodeURIComponent(address)}?network=${network}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export async function apiFetchNonFungibleData(resourceAddress: string, localIds: string[], network: 'mainnet' | 'stokenet' = 'mainnet'): Promise<Record<string, unknown>[]> {
    const res = await fetch('/api/nft-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceAddress, localIds, network }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
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
