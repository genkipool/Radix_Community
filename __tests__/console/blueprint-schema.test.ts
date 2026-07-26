import { describe, it, expect } from 'vitest';
import {
  parseSchema,
  resolveBlueprintFunctions,
  typeHintExample,
  wellKnownTypeName,
  type SborNode,
} from '@/features/console/lib/blueprint-schema';

/* Minimal schema fixture mirroring the decoded Faucet schema shape:
   type 0 = lock_fee input tuple { amount: Decimal(192) }
   type 1 = free input tuple {} */
const SCHEMA_FIXTURE: SborNode = {
  kind: 'Tuple',
  fields: [
    {
      kind: 'Array',
      elements: [
        {
          kind: 'Enum',
          variant_id: '14',
          fields: [
            {
              kind: 'Array',
              elements: [{ kind: 'Enum', variant_id: '0', fields: [{ kind: 'U8', value: '192' }] }],
            },
          ],
        },
        { kind: 'Enum', variant_id: '14', fields: [{ kind: 'Array', elements: [] }] },
      ],
    },
    {
      kind: 'Array',
      elements: [
        {
          kind: 'Tuple',
          fields: [
            { kind: 'Enum', variant_id: '1', fields: [{ kind: 'String', value: 'Faucet_lock_fee_Input' }] },
            {
              kind: 'Enum',
              variant_id: '1',
              fields: [
                {
                  kind: 'Enum',
                  variant_id: '0',
                  fields: [{ kind: 'Array', elements: [{ kind: 'String', value: 'amount' }] }],
                },
              ],
            },
          ],
        },
        {
          kind: 'Tuple',
          fields: [
            { kind: 'Enum', variant_id: '1', fields: [{ kind: 'String', value: 'Faucet_free_Input' }] },
            { kind: 'Enum', variant_id: '0', fields: [] },
          ],
        },
      ],
    },
    { kind: 'Array', elements: [] },
  ],
};

const HASH = 'abc123';

describe('parseSchema', () => {
  it('extracts type names, child names and tuple field refs', () => {
    const parsed = parseSchema(SCHEMA_FIXTURE);
    expect(parsed.typeNames).toEqual(['Faucet_lock_fee_Input', 'Faucet_free_Input']);
    expect(parsed.childNames[0]).toEqual(['amount']);
    expect(parsed.childNames[1]).toBeNull();
    expect(parsed.tupleFields[0]).toEqual([{ kind: 'wellKnown', id: 192 }]);
    expect(parsed.tupleFields[1]).toEqual([]);
  });
});

describe('resolveBlueprintFunctions', () => {
  const schemas = { [HASH]: parseSchema(SCHEMA_FIXTURE) };

  it('resolves argument names, type hints and receivers', () => {
    const functions = resolveBlueprintFunctions(
      {
        lock_fee: {
          input: { type_id: { schema_hash: HASH, local_type_id: { id: 0, kind: 'SchemaLocal' } } },
          receiver_info: { receiver: 'SelfRefMut' },
        },
        free: {
          input: { type_id: { schema_hash: HASH, local_type_id: { id: 1, kind: 'SchemaLocal' } } },
          receiver_info: { receiver: 'SelfRef' },
        },
        new: {
          input: { type_id: { schema_hash: HASH, local_type_id: { id: 99, kind: 'WellKnown' } } },
          receiver_info: null,
        },
      },
      schemas,
    );

    const byName = Object.fromEntries(functions.map((fn) => [fn.name, fn]));
    expect(byName.lock_fee.receiver).toBe('mutMethod');
    expect(byName.lock_fee.inputs).toEqual([{ name: 'amount', typeHint: 'Decimal' }]);
    expect(byName.free.receiver).toBe('method');
    expect(byName.free.inputs).toEqual([]);
    expect(byName.new.receiver).toBe('function');
    expect(byName.new.inputs).toEqual([]);
  });

  it('falls back to null inputs when the schema is missing', () => {
    const functions = resolveBlueprintFunctions(
      {
        mystery: {
          input: { type_id: { schema_hash: 'unknown', local_type_id: { id: 0, kind: 'SchemaLocal' } } },
          receiver_info: { receiver: 'SelfRef' },
        },
      },
      schemas,
    );
    expect(functions[0].inputs).toBeNull();
  });
});

describe('type hints', () => {
  it('names well-known types with range fallbacks', () => {
    expect(wellKnownTypeName(192)).toBe('Decimal');
    expect(wellKnownTypeName(161)).toBe('Bucket');
    expect(wellKnownTypeName(12)).toBe('String');
    expect(wellKnownTypeName(130)).toBe('Address');
    expect(wellKnownTypeName(165)).toBe('Own');
  });

  it('provides manifest-syntax examples per hint', () => {
    expect(typeHintExample('Decimal')).toBe('Decimal("10")');
    expect(typeHintExample('String')).toBe('"text"');
    expect(typeHintExample('SomeCustomStruct')).toBe('Enum<0u8>()');
  });

  /**
   * A placeholder is only useful if it shows the SHAPE. `10i64` says nothing
   * to someone who has never met SBOR, so the field pairs it with a plain
   * language description; the example still has to be right.
   */
  it('gives a usable example for the composite kinds too', () => {
    expect(typeHintExample('Array')).toBe('Array<String>("a", "b")');
    expect(typeHintExample('Tuple')).toBe('Tuple("a", 1u8)');
    expect(typeHintExample('Own')).toBe('Address("internal_...")');
    expect(typeHintExample('Address')).toBe('Address("account_...")');
    expect(typeHintExample('Bucket')).toBe('Bucket("bucket1")');
  });

  it('suffixes every integer example with its own type', () => {
    for (const kind of ['I8', 'I16', 'I32', 'I64', 'I128'] as const) {
      expect(typeHintExample(kind)).toBe(`10${kind.toLowerCase()}`);
    }
    for (const kind of ['U8', 'U16', 'U32', 'U64', 'U128'] as const) {
      expect(typeHintExample(kind)).toBe(`10${kind.toLowerCase()}`);
    }
  });
});
