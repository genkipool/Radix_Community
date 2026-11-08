/**
 * What an account holds of a resource in a Gateway entity/details answer:
 * the `amount` when the aggregation is global, the sum of its vaults when it
 * is per vault (as the explorer cards ask). Shared by server and browser.
 */
export interface Holding {
    resource_address: string;
    amount?: string;
    vaults?: { items?: { amount?: string; items?: string[] }[] };
}

export function holdingAmount(h: Holding): number {
    return Number(h.amount ?? (h.vaults?.items ?? []).reduce((s, v) => s + Number(v.amount ?? 0), 0));
}

/** The non-fungible ids an account holds of a resource, from its vaults. */
export function holdingIds(h: Holding): string[] {
    return (h.vaults?.items ?? []).flatMap((v) => v.items ?? []);
}
