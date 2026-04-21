import { describe, it, expect } from 'vitest';
import { isConsensusManager, getEntityType } from '@/features/dashboard/utils/entityUtils';
import type { TranslationsT } from '@/features/dashboard/types';

describe('entityUtils', () => {
    describe('isConsensusManager', () => {
        it('identifies bare consensusmanager', () => {
            expect(isConsensusManager('consensusmanager')).toBe(true);
        });

        it('identifies mainnet consensusmanager', () => {
            expect(isConsensusManager('consensusmanager_rdx1scxxxxxxxxxxcnsmgrxxxxxxxxx000999993157')).toBe(true);
        });

        it('identifies stokenet consensusmanager', () => {
            expect(isConsensusManager('consensusmanager_tdx_2_1scxxxxxxxxxxcnsmgrxxxxxxxxx000999993157')).toBe(true);
        });

        it('rejects regular accounts', () => {
            expect(isConsensusManager('account_rdx1234')).toBe(false);
        });

        it('handles empty strings', () => {
            expect(isConsensusManager('')).toBe(false);
        });
    });

    describe('getEntityType', () => {
        const mockTt = {
            entity_type_account: 'Account',
            entity_type_component: 'Component',
            entity_type_resource: 'Resource',
            entity_type_validator: 'Validator',
            entity_type_package: 'Package',
            entity_type_identity: 'Identity',
            entity_type_unknown: 'Unknown',
        } as TranslationsT['dashboard']['transactions'];

        it('resolves accounts', () => {
            const res = getEntityType('account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6', mockTt);
            expect(res.label).toBe('Account');
            expect(res.color).toContain('text-blue-400');
        });

        it('resolves components (Pool Mother)', () => {
            const res = getEntityType('component_rdx1scv9scv9scv9scv9scv9scv9scv9scv9scv9scv9scv9scv9', mockTt);
            expect(res.label).toBe('Component');
            expect(res.color).toContain('text-purple-600');
        });

        it('resolves resources (XRD)', () => {
            const res = getEntityType('resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', mockTt);
            expect(res.label).toBe('Resource');
            expect(res.color).toContain('text-amber-800');
        });

        it('resolves validators', () => {
            const res = getEntityType('validator_rdx1svjhajkrvar9lc4q045t5n02llhdm95wx2pampdm9tc3fglxdgjc8a', mockTt);
            expect(res.label).toBe('Validator');
            expect(res.color).toContain('text-emerald-700');
        });

        it('resolves packages (Account Locker)', () => {
            const res = getEntityType('package_rdx1pkscv9scv9scv9scv9scv9scv9scv9scv9scv9scv9scv9scv9', mockTt);
            expect(res.label).toBe('Package');
            expect(res.color).toContain('text-cyan-600');
        });

        it('falls back to unknown for unrecognized prefixes', () => {
            const res = getEntityType('something_else_rdx123', mockTt);
            expect(res.label).toBe('Unknown');
        });
    });
});
