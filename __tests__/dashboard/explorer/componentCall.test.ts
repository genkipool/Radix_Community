import { describe, it, expect } from 'vitest';
import { callArguments, componentCalls, storedChanges } from '@/features/dashboard/explorador/utils/componentCall';
import { addressNodeIdHex, decodeFixedFields } from '@/features/dashboard/explorador/utils/oraclePrices';

const ACCOUNT = 'account_rdx1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const COMPONENT = 'component_rdx1cccccccccccccccccccccccccccccccccccccccccccccccccccc';
const TOKEN = 'resource_rdx1tkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';
const BADGE = 'resource_rdx1tbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const STORE = 'internal_keyvaluestore_rdx1kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';

/** A Decimal as SBOR: 24 little-endian bytes of value × 10^18. */
const decimal = (value: bigint) => {
    let n = value * 10n ** 18n;
    if (n < 0n) n += 1n << 192n;
    let hex = '';
    for (let i = 0; i < 24; i++) { hex += (n & 0xffn).toString(16).padStart(2, '0'); n >>= 8n; }
    return 'a0' + hex;
};
const tuple = (...fields: string[]) => `5c21${fields.length.toString(16).padStart(2, '0')}${fields.join('')}`;

const MANIFEST = `CALL_METHOD
    Address("${ACCOUNT}")
    "lock_fee"
    Decimal("10")
;
CALL_METHOD
    Address("${ACCOUNT}")
    "create_proof_of_amount"
    Address("${BADGE}")
    Decimal("1")
;
CALL_METHOD
    Address("${COMPONENT}")
    "set_data"
    Address("${TOKEN}")
    Decimal("-1")
    Decimal("-1")
    Decimal("98925.5")
;
`;

describe('componentCalls', () => {
    it('keeps the call to the component and its plain arguments, without fees or proofs', () => {
        expect(componentCalls(MANIFEST)).toEqual([{
            component: COMPONENT,
            method: 'set_data',
            args: [
                { kind: 'address', value: TOKEN },
                { kind: 'decimal', value: '-1' },
                { kind: 'decimal', value: '-1' },
                { kind: 'decimal', value: '98925.5' },
            ],
        }]);
    });

    it('reads strings, integers and bools, and leaves nested values raw', () => {
        expect(callArguments('CALL_METHOD Address("x") "go" "hello" 5u32 true', 'go')).toEqual([
            { kind: 'string', value: 'hello' },
            { kind: 'integer', value: '5' },
            { kind: 'bool', value: 'true' },
        ]);
        expect(callArguments('CALL_METHOD Address("x") "go" Map<Address, Decimal>(Address("y") => Decimal("1"))', 'go')).toEqual([
            { kind: 'other', value: 'Map<Address, Decimal>(Address("y") => Decimal("1"))' },
        ]);
    });
});

describe('decodeFixedFields', () => {
    it('reads every field of a tuple of plain values, and a bare value', () => {
        expect(decodeFixedFields(tuple(decimal(7n), '0901000000', '0101'))).toEqual([
            { kind: 'decimal', value: '7' },
            { kind: 'integer', value: '1' },
            { kind: 'bool', value: 'true' },
        ]);
        expect(decodeFixedFields('5c' + decimal(-2n))).toEqual([{ kind: 'decimal', value: '-2' }]);
        expect(decodeFixedFields('5c0c0568656c6c6f')).toBeNull(); // a string
    });
});

describe('storedChanges', () => {
    it('names the entry by the address it is keyed on and gives both sides', () => {
        const key = `5c80${addressNodeIdHex(TOKEN)}`;
        const entry = (hex: string) => ({ substate_data: { value: { data: { struct_data: { hex } } } } });
        const changes = storedChanges({
            updated: [
                { substate_id: { entity_address: 'internal_vault_rdx1x', substate_type: 'FungibleVaultFieldBalance' } },
                {
                    substate_id: { entity_address: STORE, substate_type: 'GenericKeyValueStoreEntry', substate_key: { key_hex: key } },
                    previous_value: entry(tuple(decimal(5n), decimal(1n), decimal(98424n))),
                    new_value: entry(tuple(decimal(5n), decimal(1n), decimal(98925n))),
                },
            ],
        }, [TOKEN]);
        expect(changes).toEqual([{
            store: STORE,
            key: { address: TOKEN },
            before: [{ kind: 'decimal', value: '5' }, { kind: 'decimal', value: '1' }, { kind: 'decimal', value: '98424' }],
            after: [{ kind: 'decimal', value: '5' }, { kind: 'decimal', value: '1' }, { kind: 'decimal', value: '98925' }],
        }]);
    });
});
