import { describe, it, expect } from 'vitest';
import { extractResourceCreations, decodeMetadataValue, parseNftFieldNames } from '@/features/dashboard/explorador/utils/resourceCreationUtils';
import type { GatewayEvent } from '@/features/dashboard/types';

// Synthetic receipt shaped like CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
// with an empty map (0 NFTs). Addresses and metadata are made up.
const RES = 'resource_rdx1_test_collection';
const BADGE = 'resource_rdx1_test_owner_badge';

// SBOR metadata values: String (0x00), Url (0x0d), Array<String> (0x80), Address (0x08)
const hex = (t: string) => Array.from(new TextEncoder().encode(t), b => b.toString(16).padStart(2, '0')).join('');
const len = (t: string) => new TextEncoder().encode(t).length.toString(16).padStart(2, '0');
const sborString = (t: string) => `5c2200010c${len(t)}${hex(t)}`;
const sborUrl = (t: string) => `5c220d010c${len(t)}${hex(t)}`;
const sborStrings = (items: string[]) => `5c228001200c${items.length.toString(16).padStart(2, '0')}${items.map(t => len(t) + hex(t)).join('')}`;
const SBOR_ADDRESS = `5c22080180${'11'.repeat(30)}`;
const ICON = 'https://example.com/collection-icon.png';

const meta = (name: string, hex: string) => ({
    substate_id: { entity_address: RES, substate_type: 'MetadataModuleEntry' },
    value: { substate_data: { key: { name }, value: { data_struct: { struct_data: { hex } } } } },
});
const rule = (role_key: string, type: string) => ({
    substate_id: { entity_address: RES, substate_type: 'RoleAssignmentModuleRuleEntry' },
    value: { substate_data: { key: { role_key, object_module_id: 'Main' }, value: { access_rule: { type } } } },
});

const stateUpdates = {
    new_global_entities: [{ entity_address: RES, entity_type: 'GlobalNonFungibleResource' }],
    created_substates: [
        meta('name', sborString('Sample Collection')),
        meta('symbol', sborString('SMPL')),
        meta('icon_url', sborUrl(ICON)),
        meta('tags', sborStrings(['sample', 'signing'])),
        meta('issuer', SBOR_ADDRESS),
        rule('depositor', 'AllowAll'),
        rule('withdrawer', 'DenyAll'),
        rule('burner', 'DenyAll'),
        rule('freezer', 'DenyAll'),
        {
            substate_id: { entity_address: RES, substate_type: 'RoleAssignmentModuleFieldOwnerRole' },
            value: { substate_data: { value: { owner_role: { rule: { access_rule: { type: 'ProofRule', proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: BADGE } } } } } } } } },
        },
        { substate_id: { entity_address: RES, substate_type: 'NonFungibleResourceManagerFieldIdType' }, value: { substate_data: { value: { non_fungible_id_type: 'Integer' } } } },
        { substate_id: { entity_address: RES, substate_type: 'NonFungibleResourceManagerFieldMutableFields' }, value: { substate_data: { value: { mutable_fields: [{ name: 'key_image_url', index: 2 }] } } } },
        { substate_id: { entity_address: RES, substate_type: 'TypeInfoModuleFieldTypeInfo' }, value: { substate_data: { value: { details: { blueprint_info: { features: ['track_total_supply', 'vault_freeze', 'vault_recall', 'mint', 'burn'] } } } } } },
    ],
};

const events = [{
    name: 'MintNonFungibleResourceEvent',
    emitter: { entity: { entity_address: RES } },
    data: { fields: [{ field_name: 'ids', kind: 'Array', elements: [] }] },
}] as unknown as GatewayEvent[];

const manifest = `CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Array<Tuple>(
        Tuple(
            Enum<1u8>(
                "DataSchema"
            ),
            Enum<1u8>(
                Enum<0u8>(
                    Array<String>(
                        "name",
                        "key_image_url",
                        "signer"
                    )
                )
            )
        )
    )
    Array<String>(
        "key_image_url"
    )`;

describe('resourceCreationUtils', () => {
    it('decodes String, Url and Array<String> metadata and skips addresses', () => {
        expect(decodeMetadataValue(sborString('SMPL'))).toBe('SMPL');
        expect(decodeMetadataValue(sborUrl('https://example.com'))).toBe('https://example.com');
        expect(decodeMetadataValue(sborStrings(['sample', 'signing']))).toEqual(['sample', 'signing']);
        expect(decodeMetadataValue(SBOR_ADDRESS)).toBeNull();
        expect(decodeMetadataValue('zz')).toBeNull();
    });

    it('reads the NFT field names, not the mutable field list', () => {
        expect(parseNftFieldNames(manifest)).toEqual(['name', 'key_image_url', 'signer']);
        expect(parseNftFieldNames('CALL_METHOD')).toEqual([]);
    });

    it('describes an empty NFT collection from its receipt', () => {
        const [c] = extractResourceCreations(stateUpdates, events, manifest);
        expect(c).toMatchObject({
            address: RES,
            kind: 'non_fungible',
            name: 'Sample Collection',
            symbol: 'SMPL',
            tags: ['sample', 'signing'],
            initialSupply: '0',
            idType: 'Integer',
            mutableFields: ['key_image_url'],
            nftFields: ['name', 'key_image_url', 'signer'],
            ownerBadge: BADGE,
            roles: { transfer: 'nobody', mint: 'owner', burn: 'nobody', recall: 'owner' },
        });
        expect(c.iconUrl).toBe(ICON);
    });

    it('counts NFTs minted at creation and ignores transactions that create nothing', () => {
        const minted = [{ ...events[0], data: { fields: [{ field_name: 'ids', kind: 'Array', elements: [{}, {}] }] } }] as unknown as GatewayEvent[];
        expect(extractResourceCreations(stateUpdates, minted, manifest)[0].initialSupply).toBe('2');
        expect(extractResourceCreations({ new_global_entities: [] }, events, manifest)).toEqual([]);
        expect(extractResourceCreations(undefined)).toEqual([]);
    });

    it('treats a missing role as nobody when the feature was left out', () => {
        const noMint = {
            ...stateUpdates,
            created_substates: stateUpdates.created_substates.map(s => s.substate_id.substate_type === 'TypeInfoModuleFieldTypeInfo'
                ? { ...s, value: { substate_data: { value: { details: { blueprint_info: { features: ['burn'] } } } } } }
                : s),
        };
        expect(extractResourceCreations(noMint)[0].roles.mint).toBe('nobody');
    });
});
