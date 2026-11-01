import { describe, it, expect } from 'vitest';
import {
    versionAdoption, VERSION_FRESH_MS, providerDistribution, countryDistribution, assessDecentralization, nakamoto, hostingShare, releaseOf,
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
    const NOW = 1_800_000_000_000;
    /** An active validator whose version our node saw `ago` ms before NOW. */
    const seen = (version: string, over: Omit<Partial<Validator>, 'node'> = {}, ago = 60_000) =>
        v({ node: { version, lastSeen: NOW - ago }, ...over });

    it('counts the active validators on the newest release against all of them', () => {
        const set = [
            ...Array.from({ length: 5 }, () => seen('v1.4.0.0')),
            ...Array.from({ length: 3 }, () => seen('v1.3.0.2')),
            v(), // unknown
            seen('v1.4.0.0', { status: 'inactive' }), // not active: not counted at all
        ];
        const result = versionAdoption(set, { now: NOW });
        expect(result).toMatchObject({ latest: 'v1.4.0.0', updated: 5, total: 9, unknown: 1 });
        expect(result.percent).toBeCloseTo((5 / 9) * 100);
    });

    it('weighs adoption by the stake delegated to the active validators', () => {
        const result = versionAdoption([
            seen('v1.4.0.0', { delegatedStake: 500_000 }),
            seen('v1.3.0.2', { delegatedStake: 1_000_000 }),
            v({ delegatedStake: 500_000 }), // unknown version: its stake still counts in the total
            seen('v1.4.0.0', { delegatedStake: 9_000_000, status: 'inactive' }),
        ], { now: NOW });
        expect(result).toMatchObject({ updatedStake: 500_000, totalStake: 2_000_000 });
        expect(result.stakePercent).toBeCloseTo(25);
    });

    it('compares numerically, not as text', () => {
        const result = versionAdoption([seen('v1.10.0'), seen('v1.9.0')], { now: NOW });
        expect(result.latest).toBe('v1.10.0');
        expect(result.updated).toBe(1);
    });

    it('treats 1.4.0 and 1.4.0.0 as the same release', () => {
        expect(versionAdoption([seen('v1.4.0'), seen('v1.4.0.0')], { now: NOW }).updated).toBe(2);
    });

    it('counts only versions our node saw in the last 30 minutes, never metadata', () => {
        const result = versionAdoption([
            seen('v1.4.0.0'),
            seen('v1.5.0.0', {}, VERSION_FRESH_MS + 1), // seen too long ago: may have changed since
            v({ version: 'v1.5.0.0' }), // only published in its metadata
        ], { now: NOW });
        expect(result).toMatchObject({ latest: 'v1.4.0.0', updated: 1, total: 3, unknown: 2 });
    });

    it('measures against the release published on GitHub when it is known', () => {
        const result = versionAdoption([
            seen('v1.4.0.0'),
            seen('v1.4.0.0-RC1'), // the same release, as a candidate build: up to date
            seen('v1.3.0.5'),
        ], { release: 'v1.5.0.0', now: NOW });
        // Nobody runs the published v1.5.0.0 yet: it is still the target, and none count.
        expect(result).toMatchObject({ latest: 'v1.5.0.0', source: 'release', updated: 0, total: 3 });

        const current = versionAdoption([seen('v1.4.0.0'), seen('v1.4.0.0-RC1'), seen('v1.3.0.5'), seen('v1.5.0.0')], { release: 'v1.4.0.0', now: NOW });
        // At or past the release counts; below it does not.
        expect(current).toMatchObject({ latest: 'v1.4.0.0', source: 'release', updated: 3, total: 4 });
    });

    it('falls back to the highest release the validators run without a published one', () => {
        expect(versionAdoption([seen('v1.4.0.0'), seen('v1.3.0.5')], { release: null, now: NOW })).toMatchObject({ latest: 'v1.4.0.0', source: 'validators', updated: 1 });
        expect(versionAdoption([seen('v1.4.0.0')], { release: 'not-a-release', now: NOW }).source).toBe('validators');
    });

    it('has no latest version when none is known', () => {
        expect(versionAdoption([v(), v()], { now: NOW })).toMatchObject({ latest: null, updated: 0, total: 2, unknown: 2, percent: 0 });
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
