import { describe, it, expect } from 'vitest';
import { extractResourceCreations, decodeMetadataValue, parseNftFieldNames } from '@/features/dashboard/explorador/utils/resourceCreationUtils';
import type { GatewayEvent } from '@/features/dashboard/types';

// Trimmed receipt of txid_rdx12rde6u42ycgvynxr5828xdms5h28nzzjndj6q9z83u7v6c0nn7dsp383xw:
// CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY with an empty map (0 NFTs).
const RES = 'resource_rdx1nfe2dyryeefpzps8tu669j07v6ua4yrk0vh4773m00a4u3d2twg4xt';
const BADGE = 'resource_rdx1nf89ryugl2ytuh7lfcrpt7ghudnfah7gdcwwjw6y3e6v5cwrr5tfxs';

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
        meta('name', '5c2200010c0e47454e4b49504f4f4c205345414c'),
        meta('symbol', '5c2200010c05475345414c'),
        meta('icon_url', '5c220d010c4568747470733a2f2f72616469782e67656e6b69706f6f6c2e636f6d2f696d672f6c6f676f2f6c6f676f5f52616469785f47656e6b69506f6f6c5f626c616e636f2e77656270'),
        meta('tags', '5c228001200c020a72616469782d7365616c077369676e696e67'),
        meta('issuer', '5c22080180516b3e711cea896d4639f52096595e1dbd69b92f819ca7fc4694006b5ecf'),
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
        expect(decodeMetadataValue('5c2200010c05475345414c')).toBe('GSEAL');
        expect(decodeMetadataValue('5c220d010c1b68747470733a2f2f72616469782e67656e6b69706f6f6c2e636f6d')).toBe('https://radix.genkipool.com');
        expect(decodeMetadataValue('5c228001200c020a72616469782d7365616c077369676e696e67')).toEqual(['radix-seal', 'signing']);
        expect(decodeMetadataValue('5c22080180516b3e711cea896d4639f52096595e1dbd69b92f819ca7fc4694006b5ecf')).toBeNull();
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
            name: 'GENKIPOOL SEAL',
            symbol: 'GSEAL',
            tags: ['radix-seal', 'signing'],
            initialSupply: '0',
            idType: 'Integer',
            mutableFields: ['key_image_url'],
            nftFields: ['name', 'key_image_url', 'signer'],
            ownerBadge: BADGE,
            roles: { transfer: 'nobody', mint: 'owner', burn: 'nobody', recall: 'owner' },
        });
        expect(c.iconUrl).toMatch(/^https:\/\/radix\.genkipool\.com\//);
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
