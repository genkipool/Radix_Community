import { describe, it, expect } from 'vitest';
import { validatorLocation, validatorVersion, shortVersion } from '@/features/dashboard/staking/lib/validatorNode';
import { buildValidatorStats } from '@/features/dashboard/staking/lib/validatorStats';
import type { Validator } from '@/types/radix';

const validator = (overrides: Partial<Validator> = {}) => ({
    country: '',
    countryCode: '',
    version: '',
    delegatedStake: 1000,
    delegatedStakePercent: 0.5,
    nominalFee: 2,
    apyProjection: 6,
    effectiveFee: 0.12,
    recentUptime: 99.9,
    delegators: 42,
    ...overrides,
}) as Validator;

describe('validatorLocation', () => {
    it('names the observed country in the reader language', () => {
        const v = validator({ node: { countryCode: 'DE', online: true, acceptsConnections: true, version: null, commit: null, lastSeen: 1 } });
        expect(validatorLocation(v, 'es')).toEqual({ code: 'DE', name: 'Alemania' });
        expect(validatorLocation(v, 'en')).toEqual({ code: 'DE', name: 'Germany' });
    });

    it('falls back to the published metadata, then to nothing', () => {
        expect(validatorLocation(validator({ country: 'Moon' }))).toEqual({ code: null, name: 'Moon' });
        expect(validatorLocation(validator())).toBeNull();
    });
});

describe('validatorVersion', () => {
    it('prefers the observed version and reads empty as unknown', () => {
        const node = { countryCode: null, online: true, acceptsConnections: true, version: 'v1.3.1', commit: null, lastSeen: 1 };
        expect(validatorVersion(validator({ version: 'v1.0', node }))).toBe('v1.3.1');
        expect(validatorVersion(validator({ version: 'v1.0' }))).toBe('v1.0');
        expect(validatorVersion(validator())).toBeNull();
    });

    it('shortens to the release for tight spaces', () => {
        expect(shortVersion('v1.3.0.2-6a5a9c9')).toBe('v1.3.0.2');
        expect(shortVersion('1.2.3')).toBe('v1.2.3');
        expect(shortVersion('custom-build')).toBe('custom-build');
    });
});

describe('buildValidatorStats', () => {
    it('shows stake, fee, APY, then uptime, delegators and version; no effective fee', () => {
        const keys = buildValidatorStats(validator({ version: 'v1.3.1' }), undefined, 'en').map((s) => s.key);
        expect(keys).toEqual(['stake', 'fee', 'apy', 'uptime', 'delegators', 'version']);
    });
});
