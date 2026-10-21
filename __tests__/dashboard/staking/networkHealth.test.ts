import { describe, it, expect } from 'vitest';
import {
    versionAdoption, providerDistribution, countryDistribution, assessDecentralization, nakamoto, hostingShare, releaseOf,
} from '@/features/dashboard/staking/lib/networkHealth';
import type { Validator } from '@/types/radix';

let n = 0;
const v = (over: Omit<Partial<Validator>, 'node'> & { node?: Partial<NonNullable<Validator['node']>> | null } = {}) => {
    const { node, ...rest } = over;
    return {
        address: `validator_rdx1v${n++}`,
        status: 'active',
        version: '',
        provider: '',
        country: '',
        countryCode: '',
        delegatedStake: 1000,
        node: node === null || node === undefined && !('node' in over) ? null : { countryCode: null, online: true, acceptsConnections: true, version: null, commit: null, lastSeen: 1, ...node },
        ...rest,
    } as Validator;
};
const withProvider = (provider: string | null, count: number, extra: Omit<Partial<Validator>, 'node'> = {}) =>
    Array.from({ length: count }, () => v({ node: { provider }, ...extra }));

describe('releaseOf', () => {
    it('reads releases, padded, and nothing else', () => {
        expect(releaseOf('v1.4.0')).toEqual([1, 4, 0, 0]);
        expect(releaseOf('1.3.0.2-6a5a9c9')).toEqual([1, 3, 0, 2]);
        expect(releaseOf('custom-build')).toBeNull();
        expect(releaseOf(null)).toBeNull();
    });
});

describe('versionAdoption', () => {
    it('counts the active validators on the newest release against all of them', () => {
        const set = [
            ...Array.from({ length: 5 }, () => v({ version: 'v1.4.0.0' })),
            ...Array.from({ length: 3 }, () => v({ version: 'v1.3.0.2' })),
            v({ version: '' }), // unknown
            v({ version: 'v1.4.0.0', status: 'inactive' }), // not active: not counted at all
        ];
        const result = versionAdoption(set);
        expect(result).toMatchObject({ latest: 'v1.4.0.0', updated: 5, total: 9, unknown: 1 });
        expect(result.percent).toBeCloseTo((5 / 9) * 100);
    });

    it('compares numerically, not as text', () => {
        const result = versionAdoption([v({ version: 'v1.10.0' }), v({ version: 'v1.9.0' })]);
        expect(result.latest).toBe('v1.10.0');
        expect(result.updated).toBe(1);
    });

    it('treats 1.4.0 and 1.4.0.0 as the same release', () => {
        expect(versionAdoption([v({ version: 'v1.4.0' }), v({ version: 'v1.4.0.0' })]).updated).toBe(2);
    });

    it('has no latest version when none is known', () => {
        expect(versionAdoption([v(), v()])).toMatchObject({ latest: null, updated: 0, total: 2, unknown: 2, percent: 0 });
    });
});

describe('provider distribution', () => {
    it('shares are over all the active validators, case-insensitive, biggest first', () => {
        const set = [...withProvider('Hetzner', 10), ...withProvider('hetzner', 0), v({ node: { provider: 'AWS' } }), ...withProvider(null, 9)];
        const { shares, total, known } = providerDistribution(set);
        expect(total).toBe(20);
        expect(known).toBe(11);
        expect(shares[0]).toMatchObject({ name: 'Hetzner', count: 10, percent: 50 });
        expect(shares[1]).toMatchObject({ name: 'AWS', count: 1, percent: 5 });
    });

    it('falls back to the provider the validator published', () => {
        const { shares } = providerDistribution([v({ node: null, provider: 'OVH' })]);
        expect(shares).toEqual([expect.objectContaining({ name: 'OVH', count: 1 })]);
    });

    it('weighs by stake too', () => {
        const { shares } = providerDistribution([
            v({ node: { provider: 'A' }, delegatedStake: 900 }), v({ node: { provider: 'B' }, delegatedStake: 100 }),
        ]);
        expect(shares[0]).toMatchObject({ name: 'A', percent: 50, stakePercent: 90 });
    });
});

describe('country distribution', () => {
    it('groups by the observed country', () => {
        const { shares } = countryDistribution([
            v({ node: { countryCode: 'DE' } }), v({ node: { countryCode: 'DE' } }), v({ node: { countryCode: 'US' } }),
        ]);
        expect(shares[0]).toMatchObject({ name: 'Germany', count: 2 });
    });
});

describe('nakamoto', () => {
    it('is the fewest groups holding more than a third', () => {
        expect(nakamoto([40, 30, 30], 100)).toBe(1);
        expect(nakamoto([20, 20, 20, 20, 20], 100)).toBe(2); // 40 > 33.3
        expect(nakamoto([10, 10, 10], 100)).toBeNull(); // all together are not enough
    });
});

describe('assessDecentralization', () => {
    const assess = (set: Validator[]) => assessDecentralization(providerDistribution(set));

    it('is weak when one provider alone holds a third', () => {
        expect(assess([...withProvider('Hetzner', 40), ...withProvider('AWS', 30), ...withProvider('OVH', 30)]))
            .toMatchObject({ level: 'weak', nakamotoValidators: 1 });
    });

    it('is strong when it takes four providers and none holds over a quarter', () => {
        const set = 'ABCDEFGHIJKL'.split('').flatMap(name => withProvider(name, 10)); // 12 providers × 10 of 120
        expect(assess(set)).toMatchObject({ level: 'strong', nakamotoValidators: 5 });
    });

    it('is moderate in between', () => {
        const set = [...withProvider('A', 30), ...withProvider('B', 30), ...withProvider('C', 20), ...withProvider('D', 20)];
        expect(assess(set).level).toBe('moderate');
    });

    it('gives no verdict while too few providers are known', () => {
        const set = [...withProvider('Hetzner', 10), ...withProvider(null, 90)];
        expect(assess(set)).toMatchObject({ level: 'insufficient', coverage: 0.1 });
    });
});

describe('hostingShare', () => {
    it('is the share of the nodes with a known IP kind that sit in datacenters', () => {
        const set = [v({ node: { hosting: true } }), v({ node: { hosting: true } }), v({ node: { hosting: false } }), v({ node: { hosting: null } })];
        expect(hostingShare(set)).toEqual({ percent: (2 / 3) * 100, known: 3 });
        expect(hostingShare([v()])).toBeNull();
    });
});
