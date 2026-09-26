/**
 * Governance systems running on the Radix ledger.
 *
 * Proposals and temperature checks are read straight from each component's
 * state, so new ones appear on their own. Only a new governance *system* (a
 * new component) needs an entry here. The collector is the service that
 * weighs votes by voting power; it is listed explicitly so the server never
 * fetches a URL taken from a request or from ledger metadata.
 */

export interface GovernanceSystem {
    /** Stable slug used in URLs. */
    key: string;
    name: string;
    network: 'mainnet' | 'stokenet';
    component: string;
    /** Vote collector publishing weighted tallies (`/vote-results`, `/account-votes`). */
    collector: string;
    /** Official front-end of this system. */
    website: string;
}

export const GOVERNANCE_SYSTEMS: readonly GovernanceSystem[] = [
    {
        key: 'radix-dao',
        name: 'Radix DAO',
        network: 'mainnet',
        component: 'component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k',
        collector: 'https://vote.radixdao.org',
        website: 'https://vote.radixdao.org',
    },
    {
        key: 'consultation',
        name: 'Radix Consultation',
        network: 'mainnet',
        component: 'component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt',
        collector: 'https://api-consultation.mountain-top.live',
        website: 'https://consultation.mountain-top.live',
    },
];

export const systemByKey = (key: string) => GOVERNANCE_SYSTEMS.find(s => s.key === key) ?? null;
export const systemByComponent = (component: string) => GOVERNANCE_SYSTEMS.find(s => s.component === component) ?? null;
