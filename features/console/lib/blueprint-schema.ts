/**
 * Parsing of on-ledger blueprint schemas.
 *
 * A package schema (Gateway `/state/entity/page/schemas`, SBOR-decoded to
 * programmatic JSON via the Radix Engine Toolkit) is a tuple of
 * `(type_kinds, type_metadata, type_validations)` arrays indexed by local
 * type id. Function inputs are tuples whose metadata carries the argument
 * names; their kinds carry the argument type references.
 */

/* ─── Programmatic-JSON SBOR node ─────────────────────────────────────────── */

export interface SborNode {
  kind: string;
  value?: string;
  variant_id?: string;
  fields?: SborNode[];
  elements?: SborNode[];
  element_kind?: string;
}

/* ─── Parsed schema ───────────────────────────────────────────────────────── */

export interface TypeRef {
  kind: 'wellKnown' | 'local';
  id: number;
}

export interface ParsedSchema {
  /** Option<String> type name per local type id */
  typeNames: Array<string | null>;
  /** Named-field child names per local type id (function input tuples) */
  childNames: Array<string[] | null>;
  /** Field type refs per local type id when the type is a tuple */
  tupleFields: Array<TypeRef[] | null>;
}

const SOME = '1';
const NAMED_FIELDS = '0';
const TUPLE_KIND = '14';

const optionString = (node: SborNode | undefined): string | null =>
  node?.variant_id === SOME && node.fields?.[0]?.kind === 'String'
    ? (node.fields[0].value ?? null)
    : null;

const optionNamedFields = (node: SborNode | undefined): string[] | null => {
  if (node?.variant_id !== SOME) return null;
  const childNames = node.fields?.[0];
  if (childNames?.variant_id !== NAMED_FIELDS) return null;
  const names = childNames.fields?.[0]?.elements ?? [];
  return names.flatMap((name) => (name.kind === 'String' && name.value !== undefined ? [name.value] : []));
};

const typeRef = (node: SborNode): TypeRef | null => {
  const raw = node.fields?.[0]?.value;
  if (raw === undefined) return null;
  const id = Number(raw);
  if (Number.isNaN(id)) return null;
  return { kind: node.variant_id === '0' ? 'wellKnown' : 'local', id };
};

/** Parses a decoded schema payload into indexable lookup tables. */
export function parseSchema(decoded: SborNode): ParsedSchema {
  const [kinds, metadata] = decoded.fields ?? [];
  const kindElements = kinds?.elements ?? [];
  const metadataElements = metadata?.elements ?? [];

  return {
    typeNames: metadataElements.map((entry) => optionString(entry.fields?.[0])),
    childNames: metadataElements.map((entry) => optionNamedFields(entry.fields?.[1])),
    tupleFields: kindElements.map((entry) =>
      entry.variant_id === TUPLE_KIND
        ? (entry.fields?.[0]?.elements ?? []).flatMap((ref) => {
            const resolved = typeRef(ref);
            return resolved ? [resolved] : [];
          })
        : null,
    ),
  };
}

/* ─── Type hints ──────────────────────────────────────────────────────────── */

const WELL_KNOWN_NAMES: Record<number, string> = {
  1: 'Bool',
  2: 'I8',
  3: 'I16',
  4: 'I32',
  5: 'I64',
  6: 'I128',
  7: 'U8',
  8: 'U16',
  9: 'U32',
  10: 'U64',
  11: 'U128',
  12: 'String',
  64: 'Any',
  65: 'Bytes',
  66: 'Unit',
  161: 'Bucket',
  162: 'Proof',
  167: 'Vault',
  170: 'KeyValueStore',
  171: 'AddressReservation',
  192: 'Decimal',
  193: 'PreciseDecimal',
  194: 'NonFungibleLocalId',
};

export function wellKnownTypeName(id: number): string {
  if (WELL_KNOWN_NAMES[id]) return WELL_KNOWN_NAMES[id];
  if (id >= 128 && id < 160) return 'Address';
  if (id >= 160 && id < 192) return 'Own';
  return `Type#${id}`;
}

export const resolveTypeHint = (ref: TypeRef, schema: ParsedSchema): string =>
  ref.kind === 'wellKnown'
    ? wellKnownTypeName(ref.id)
    : schema.typeNames[ref.id] ?? 'Any';

/* ─── Blueprint functions ─────────────────────────────────────────────────── */

export type BlueprintReceiver = 'function' | 'method' | 'mutMethod';

export interface BlueprintFunctionInput {
  name: string;
  typeHint: string;
}

export interface BlueprintFunction {
  name: string;
  receiver: BlueprintReceiver;
  /** Null when the input schema could not be resolved (raw args fallback) */
  inputs: BlueprintFunctionInput[] | null;
}

interface GatewayFunctionEntry {
  input?: {
    type_id?: {
      schema_hash?: string;
      local_type_id?: { id?: number; kind?: string };
    };
  };
  receiver_info?: { receiver?: string } | null;
}

function receiverOf(entry: GatewayFunctionEntry): BlueprintReceiver {
  const receiver = entry.receiver_info?.receiver;
  if (receiver === 'SelfRefMut') return 'mutMethod';
  if (receiver === 'SelfRef') return 'method';
  return 'function';
}

/**
 * Resolves the function map of a gateway blueprint definition against the
 * package's decoded schemas (keyed by schema hash).
 */
export function resolveBlueprintFunctions(
  functions: Record<string, GatewayFunctionEntry>,
  schemasByHash: Record<string, ParsedSchema>,
): BlueprintFunction[] {
  return Object.entries(functions).map(([name, entry]) => {
    const typeId = entry.input?.type_id;
    const localTypeId = typeId?.local_type_id;
    let inputs: BlueprintFunctionInput[] | null = null;

    if (localTypeId?.kind === 'WellKnown') {
      // A well-known input tuple has no declared arguments
      inputs = [];
    } else if (localTypeId?.kind === 'SchemaLocal' && typeId?.schema_hash) {
      const schema = schemasByHash[typeId.schema_hash];
      const id = localTypeId.id;
      if (schema && id !== undefined) {
        const names = schema.childNames[id];
        const fieldRefs = schema.tupleFields[id];
        if (fieldRefs) {
          inputs = fieldRefs.map((ref, index) => ({
            name: names?.[index] ?? `arg${index}`,
            typeHint: resolveTypeHint(ref, schema),
          }));
        }
      }
    }

    return { name, receiver: receiverOf(entry), inputs };
  });
}

/** Methods the wallet reserves for itself — never callable from a dApp. */
export const RESERVED_METHODS = new Set(['lock_fee', 'lock_contingent_fee']);

/** Example manifest value per type hint, used as input placeholder. */
export function typeHintExample(typeHint: string): string {
  switch (typeHint) {
    case 'Bool': return 'true';
    case 'I8': return '10i8';
    case 'I16': return '10i16';
    case 'I32': return '10i32';
    case 'I64': return '10i64';
    case 'I128': return '10i128';
    case 'U8': return '10u8';
    case 'U16': return '10u16';
    case 'U32': return '10u32';
    case 'U64': return '10u64';
    case 'U128': return '10u128';
    case 'String': return '"text"';
    case 'Decimal': return 'Decimal("10")';
    case 'PreciseDecimal': return 'PreciseDecimal("10")';
    case 'NonFungibleLocalId': return 'NonFungibleLocalId("#1#")';
    case 'Bucket': return 'Bucket("bucket1")';
    case 'Proof': return 'Proof("proof1")';
    case 'Address': return 'Address("account_...")';
    case 'Array': return 'Array<String>("a", "b")';
    case 'Tuple': return 'Tuple("a", 1u8)';
    case 'Own': return 'Address("internal_...")';
    case 'Enum': return 'Enum<0u8>()';
    default: return 'Enum<0u8>()';
  }
}
