/**
 * features/dashboard/explorador/utils/componentCall.ts
 *
 * What a transaction asked a component to do and what that changed, for the
 * calls no dedicated card explains (a bot's or dApp's own settings, a counter,
 * a stored value). Pure helpers over the manifest and the receipt: no React,
 * no requests.
 */

import { methodCalls, PLUMBING_METHOD } from './parseManifest';
import { addressNodeIdHex, decodeFixedFields, type StoredField } from './oraclePrices';

/** One argument of the call, as written in the manifest. */
export type CallArgument =
    | { kind: 'address'; value: string }
    | { kind: 'decimal' | 'integer' | 'string' | 'bool' | 'id'; value: string }
    | { kind: 'other'; value: string };

export interface ComponentCall {
    component: string;
    method: string;
    args: CallArgument[];
}

/** A stored entry the transaction rewrote, with its fields before and after. */
export interface StoredChange {
    /** The store the entry lives in. */
    store: string;
    /** The entry's key: an address when it is one the manifest names, its raw bytes otherwise. */
    key: { address: string } | { hex: string };
    before: StoredField[] | null;
    after: StoredField[] | null;
}

const SIMPLE_ARG = /Address\("([^"]+)"\)|(?:Precise)?Decimal\("([^"]+)"\)|NonFungibleLocalId\("([^"]+)"\)|"((?:[^"\\]|\\.)*)"|\b(-?\d+)(?:u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)\b|\b(true|false)\b/g;

/** The arguments of a call when all are plain values; one raw entry when they nest (maps, tuples, buckets). */
export function callArguments(body: string, method: string): CallArgument[] {
    const rest = body.slice(body.indexOf(`"${method}"`) + method.length + 2).trim();
    if (!rest) return [];
    if (/\b(Map|Tuple|Array|Enum|Bucket|Proof|Expression)\s*[<(]/.test(rest)) return [{ kind: 'other', value: rest }];
    const args: CallArgument[] = [];
    for (const m of rest.matchAll(SIMPLE_ARG)) {
        if (m[1] !== undefined) args.push({ kind: 'address', value: m[1] });
        else if (m[2] !== undefined) args.push({ kind: 'decimal', value: m[2] });
        else if (m[3] !== undefined) args.push({ kind: 'id', value: m[3] });
        else if (m[4] !== undefined) args.push({ kind: 'string', value: m[4] });
        else if (m[5] !== undefined) args.push({ kind: 'integer', value: m[5] });
        else if (m[6] !== undefined) args.push({ kind: 'bool', value: m[6] });
    }
    return args;
}

/** The calls a transaction makes on components, leaving out fees, proofs and moving funds. */
export function componentCalls(manifest: string | undefined): ComponentCall[] {
    return methodCalls(manifest ?? '')
        .filter((call) => call.target.startsWith('component_') && !PLUMBING_METHOD.test(call.method))
        .map((call) => ({ component: call.target, method: call.method, args: callArguments(call.body, call.method) }));
}

interface UpdatedSubstate {
    substate_id?: { entity_address?: string; substate_type?: string; substate_key?: { key_hex?: string } };
    previous_value?: { substate_data?: { value?: { data?: { struct_data?: { hex?: string | null } } } } };
    new_value?: { substate_data?: { value?: { data?: { struct_data?: { hex?: string | null } } } } };
}

/**
 * The key-value entries the transaction rewrote or wrote for the first time.
 * Keys that are one of `addresses` (a resource, an account) come back as that
 * address, so the card can name them.
 */
export function storedChanges(substates: { updated?: UpdatedSubstate[]; created?: UpdatedSubstate[] }, addresses: string[]): StoredChange[] {
    const byKey = new Map<string, string>(addresses.flatMap((address) => {
        const id = addressNodeIdHex(address);
        return id ? [[`5c80${id}`, address] as const] : [];
    }));
    const changes: StoredChange[] = [];
    const read = (entry: UpdatedSubstate, created: boolean) => {
        const id = entry.substate_id;
        if (id?.substate_type !== 'GenericKeyValueStoreEntry' || !id.entity_address) return;
        const keyHex = id.substate_key?.key_hex?.toLowerCase() ?? '';
        const address = byKey.get(keyHex);
        const value = created ? (entry as { value?: UpdatedSubstate['new_value'] }).value : entry.new_value;
        changes.push({
            store: id.entity_address,
            key: address ? { address } : { hex: keyHex },
            before: created ? null : decodeFixedFields(entry.previous_value?.substate_data?.value?.data?.struct_data?.hex),
            after: decodeFixedFields(value?.substate_data?.value?.data?.struct_data?.hex),
        });
    };
    for (const entry of substates.updated ?? []) read(entry, false);
    for (const entry of substates.created ?? []) read(entry, true);
    return changes;
}
