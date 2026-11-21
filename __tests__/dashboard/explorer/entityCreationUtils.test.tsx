import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enExplorer from '@/features/dashboard/explorador/locales/en.json';
import {
    classifyCreatedEntityKind,
    extractEntityCreations,
} from '@/features/dashboard/explorador/utils/entityCreationUtils';
import { EntityCreationCard } from '@/features/dashboard/explorador/components/EntityCreationCard';
import type { TranslationsT } from '@/features/dashboard/types';

vi.mock('@/features/dashboard/hooks/useEntityData', () => ({
    useEntityData: vi.fn(() => null),
}));

/** Builds a SBOR MetadataModuleEntry hex string for a UTF-8 String value. */
function encodeSborString(value: string): string {
    const bytes = new TextEncoder().encode(value);
    const header = [0x5c, 0x22, 0x00, 0x01, 0x0c, bytes.length];
    return [...header, ...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('extractEntityCreations & EntityCreationCard', () => {
    const PACKAGE = 'package_tdx_2_1pk8aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const COMPONENT = 'component_tdx_2_1cr8bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const ACCOUNT = 'account_tdx_2_128kdm8cy2exfj4f37r2t7vz6skclvm8dyrgwz76r69ds43f2q4l0dl';
    const IDENTITY = 'identity_tdx_2_128cccccccccccccccccccccccccccccccccccccccccccccccccc';
    const POOL = 'pool_tdx_2_1c5dddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const VALIDATOR = 'validator_tdx_2_1sd5eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const LOCKER = 'locker_tdx_2_1dqffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const ACCESS = 'accesscontroller_tdx_2_1c0gggggggggggggggggggggggggggggggggggggggggggg';
    const RESOURCE = 'resource_tdx_2_1th7w39rfv8dux3egj68femh6e5kp20xruxv8u5ll4j0xnh6enw4kfx';
    const BADGE = 'resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa';

    it('classifies all Radix global entity kinds accurately', () => {
        expect(classifyCreatedEntityKind(PACKAGE, 'GlobalPackage')).toBe('package');
        expect(classifyCreatedEntityKind(COMPONENT, 'GlobalGenericComponent')).toBe('component');
        expect(classifyCreatedEntityKind(ACCOUNT, 'GlobalVirtualEd25519Account')).toBe('account');
        expect(classifyCreatedEntityKind(IDENTITY, 'GlobalIdentity')).toBe('identity');
        expect(classifyCreatedEntityKind(POOL, 'GlobalTwoResourcePool')).toBe('pool');
        expect(classifyCreatedEntityKind(VALIDATOR, 'GlobalValidator')).toBe('validator');
        expect(classifyCreatedEntityKind(LOCKER, 'GlobalAccountLocker')).toBe('locker');
        expect(classifyCreatedEntityKind(ACCESS, 'GlobalAccessController')).toBe('access_controller');
    });

    it('extracts packages, components, accounts, identities and ignores resources', () => {
        const creations = extractEntityCreations({
            new_global_entities: [
                { entity_address: RESOURCE, entity_type: 'GlobalFungibleResource' },
                { entity_address: PACKAGE, entity_type: 'GlobalPackage' },
                { entity_address: COMPONENT, entity_type: 'GlobalGenericComponent' },
                { entity_address: ACCOUNT, entity_type: 'GlobalVirtualEd25519Account' },
                { entity_address: IDENTITY, entity_type: 'GlobalIdentity' },
            ],
            created_substates: [
                {
                    substate_id: { entity_address: PACKAGE, substate_type: 'MetadataModuleEntry' },
                    value: {
                        substate_data: {
                            key: { name: 'name' },
                            value: { data_struct: { struct_data: { hex: encodeSborString('Radix DEX') } } },
                        },
                    },
                },
                {
                    substate_id: { entity_address: PACKAGE, substate_type: 'PackageBlueprintDefinitionEntry' },
                    value: { substate_data: { key: { blueprint_name: 'OrderBook' } } },
                },
                {
                    substate_id: { entity_address: COMPONENT, substate_type: 'TypeInfoModuleFieldTypeInfo' },
                    value: {
                        substate_data: {
                            value: {
                                details: {
                                    blueprint_info: {
                                        blueprint_name: 'OrderBook',
                                        blueprint_version: '1.0.0',
                                        package_address: PACKAGE,
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    substate_id: { entity_address: ACCOUNT, substate_type: 'AccountFieldState' },
                    value: { substate_data: { value: { default_deposit_rule: 'Accept' } } },
                },
                {
                    substate_id: { entity_address: ACCOUNT, substate_type: 'RoleAssignmentModuleFieldOwnerRole' },
                    value: {
                        substate_data: {
                            value: {
                                owner_role: {
                                    rule: {
                                        access_rule: {
                                            proof_rule: {
                                                requirement: { non_fungible: { resource_address: BADGE } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        });

        expect(creations).toHaveLength(4);
        expect(creations.map((c) => c.kind)).toEqual(['package', 'component', 'account', 'identity']);

        const pkg = creations[0];
        expect(pkg.name).toBe('Radix DEX');
        expect(pkg.blueprints).toEqual(['OrderBook']);

        const comp = creations[1];
        expect(comp.blueprintName).toBe('OrderBook');
        expect(comp.blueprintVersion).toBe('1.0.0');
        expect(comp.packageAddress).toBe(PACKAGE);

        const acc = creations[2];
        expect(acc.defaultDepositRule).toBe('Accept');
        expect(acc.ownerBadge).toBe(BADGE);
    });

    it('renders EntityCreationCard for a published package with blueprints', () => {
        const [pkg] = extractEntityCreations({
            new_global_entities: [{ entity_address: PACKAGE, entity_type: 'GlobalPackage' }],
            created_substates: [
                {
                    substate_id: { entity_address: PACKAGE, substate_type: 'MetadataModuleEntry' },
                    value: {
                        substate_data: {
                            key: { name: 'name' },
                            value: { data_struct: { struct_data: { hex: encodeSborString('Radix DEX') } } },
                        },
                    },
                },
                {
                    substate_id: { entity_address: PACKAGE, substate_type: 'PackageBlueprintDefinitionEntry' },
                    value: { substate_data: { key: { blueprint_name: 'OrderBook' } } },
                },
            ],
        });

        render(
            <EntityCreationCard
                creation={pkg}
                creator={ACCOUNT}
                tt={enExplorer.dashboard.transactions as unknown as Partial<TranslationsT['dashboard']['transactions']>}
                onCopy={vi.fn()}
                copiedAddress={null}
                network="stokenet"
            />,
        );

        expect(screen.getByText('New package')).toBeInTheDocument();
        expect(screen.getByText('Radix DEX')).toBeInTheDocument();
        expect(screen.getByText('OrderBook')).toBeInTheDocument();
        expect(screen.getByText(/published with 1 blueprint/i)).toBeInTheDocument();
    });
});
