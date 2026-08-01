import { describe, it, expect } from 'vitest';
import {
    TOP_VALIDATOR_RANK,
    hasBaitName,
    isIndexableValidator,
    selectIndexableValidators,
} from '@/features/dashboard/lib/validatorIndexing';
import type { Validator } from '@/types/radix';

/** Only the fields the indexing rule reads actually matter here. */
function validator(overrides: Partial<Validator> = {}): Validator {
    return {
        name: 'GenkiPool',
        address: 'validator_rdx1sgenkipool',
        registered: true,
        rank: 200,
        description: '',
        ...overrides,
    } as Validator;
}

describe('hasBaitName', () => {
    it('catches names built to bait', () => {
        expect(hasBaitName('Radix Giveaway Alert')).toBe(true);
        expect(hasBaitName('FreeXRD')).toBe(true);
        expect(hasBaitName('Claim your rewards')).toBe(true);
        expect(hasBaitName('Double your XRD')).toBe(true);
    });

    // The cost of a false positive is dropping a legitimate operator from the
    // sitemap, so these are real mainnet names that must survive the filter.
    it('leaves legitimate operators alone', () => {
        expect(hasBaitName('Financial Freedom 🏴‍☠️ 0% fee')).toBe(false);
        expect(hasBaitName('free for re-use')).toBe(false);
        expect(hasBaitName('GenkiPool')).toBe(false);
        expect(hasBaitName(undefined)).toBe(false);
    });
});

describe('isIndexableValidator', () => {
    it('includes a self-described validator whatever its rank', () => {
        expect(
            isIndexableValidator(validator({ description: 'We run bare metal nodes.', rank: 250 })),
        ).toBe(true);
    });

    it('includes a top-ranked validator even with no description', () => {
        expect(isIndexableValidator(validator({ rank: TOP_VALIDATOR_RANK }))).toBe(true);
    });

    it('excludes an anonymous low-ranked validator', () => {
        expect(isIndexableValidator(validator({ rank: TOP_VALIDATOR_RANK + 1 }))).toBe(false);
    });

    it('treats a whitespace-only description as no description', () => {
        expect(isIndexableValidator(validator({ description: '   ', rank: 300 }))).toBe(false);
    });

    it('excludes unregistered validators, which nobody can stake to', () => {
        expect(
            isIndexableValidator(validator({ registered: false, rank: 1, description: 'Big.' })),
        ).toBe(false);
    });

    it('excludes bait names even when they would otherwise qualify', () => {
        expect(
            isIndexableValidator(
                validator({ name: 'Radix Giveaway Alert', rank: 1, description: 'Stake here.' }),
            ),
        ).toBe(false);
    });
});

describe('selectIndexableValidators', () => {
    it('drops entries with no usable address', () => {
        const selected = selectIndexableValidators([
            validator({ rank: 1 }),
            validator({ rank: 2, address: '' }),
            validator({ rank: 3, address: undefined as unknown as string }),
        ]);
        expect(selected).toHaveLength(1);
        expect(selected[0].rank).toBe(1);
    });

    it('returns an empty list rather than throwing on an empty payload', () => {
        expect(selectIndexableValidators([])).toEqual([]);
    });
});
