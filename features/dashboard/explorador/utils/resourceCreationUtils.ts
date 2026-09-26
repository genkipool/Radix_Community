import { sanitizeText } from '@/utils/sanitize';
import type { GatewayEvent, GatewayField } from '@/features/dashboard/types';

/** Who can perform an action on a freshly created resource. */
export type RoleHolder = 'anyone' | 'owner' | 'restricted' | 'nobody';

export interface ResourceCreation {
    address: string;
    kind: 'non_fungible' | 'fungible';
    name: string | null;
    symbol: string | null;
    description: string | null;
    iconUrl: string | null;
    tags: string[];
    /** NFTs minted (non-fungible) or units minted (fungible) inside the same transaction. */
    initialSupply: string;
    /** Non-fungible id kind: Integer, RUID, String or Bytes. */
    idType: string | null;
    divisibility: number | null;
    /** Field names every NFT of the collection carries. */
    nftFields: string[];
    mutableFields: string[];
    roles: {
        transfer: RoleHolder;
        mint: RoleHolder;
        burn: RoleHolder;
        recall: RoleHolder;
    };
    /** Badge whose holder owns (controls) the resource, when the owner rule asks for one. */
    ownerBadge: string | null;
}

interface Substate {
    substate_id?: { entity_address?: string; substate_type?: string };
    value?: { substate_data?: unknown };
}

interface StateUpdates {
    created_substates?: Substate[];
    new_global_entities?: Array<{ entity_address?: string; entity_type?: string }>;
}

/* ── SBOR metadata values ─────────────────
   The gateway sends metadata entries as raw SBOR. The creation card only needs
   the text-like variants, so this reads String, Url and Array<String> and
   ignores the rest (addresses, numbers…). */

function hexToBytes(hex: string): Uint8Array | null {
    if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) return null;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

function readVarint(bytes: Uint8Array, pos: number): [number, number] {
    let value = 0;
    let shift = 0;
    while (pos < bytes.length) {
        const b = bytes[pos++];
        value += (b & 0x7f) * 2 ** shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
    }
    return [value, pos];
}

function readString(bytes: Uint8Array, pos: number): [string, number] {
    const [len, start] = readVarint(bytes, pos);
    const text = new TextDecoder().decode(bytes.subarray(start, start + len));
    return [text, start + len];
}

const SBOR_PREFIX = 0x5c;
const KIND_ENUM = 0x22;
const KIND_ARRAY = 0x20;
const KIND_STRING = 0x0c;
const META_STRING = 0x00;
const META_URL = 0x0d;
const META_STRING_ARRAY = 0x80;

/** Decodes a metadata value into a string or a string list; anything else is null. */
export function decodeMetadataValue(hex: string): string | string[] | null {
    const bytes = hexToBytes(hex);
    if (!bytes || bytes.length < 5 || bytes[0] !== SBOR_PREFIX || bytes[1] !== KIND_ENUM) return null;
    const variant = bytes[2];
    let pos = 4; // prefix, enum kind, variant, field count (always 1)
    try {
        if (variant === META_STRING || variant === META_URL) {
            if (bytes[pos++] !== KIND_STRING) return null;
            return readString(bytes, pos)[0];
        }
        if (variant === META_STRING_ARRAY) {
            if (bytes[pos++] !== KIND_ARRAY || bytes[pos++] !== KIND_STRING) return null;
            const [count, afterCount] = readVarint(bytes, pos);
            pos = afterCount;
            const items: string[] = [];
            for (let i = 0; i < count; i++) {
                const [s, next] = readString(bytes, pos);
                items.push(s);
                pos = next;
            }
            return items;
        }
    } catch {
        return null;
    }
    return null;
}

/* ── Roles ───────────────────────────────── */

function ruleToHolder(ruleType: string | undefined): RoleHolder {
    if (ruleType === 'AllowAll') return 'anyone';
    if (ruleType === 'DenyAll') return 'nobody';
    return 'restricted';
}

/**
 * A role missing from the creation falls back to the owner, but only when the
 * resource was built with the matching feature; without it nobody can act.
 */
function resolveRole(rules: Map<string, string>, role: string, feature: string | null, features: string[]): RoleHolder {
    const explicit = rules.get(role);
    if (explicit) return ruleToHolder(explicit);
    if (feature && !features.includes(feature)) return 'nobody';
    return feature ? 'owner' : 'anyone';
}

/* ── Manifest ────────────────────────────── */

/**
 * Field names of the NFT data struct, read from the CREATE_NON_FUNGIBLE_RESOURCE
 * type metadata: Tuple(Enum<1u8>("StructName"), Enum<1u8>(Enum<0u8>(Array<String>(…)))).
 */
export function parseNftFieldNames(manifest: string): string[] {
    const start = manifest.search(/CREATE_NON_FUNGIBLE_RESOURCE/);
    if (start < 0) return [];
    const block = manifest.slice(start);
    const m = block.match(/Enum<1u8>\(\s*"[^"]*"\s*\),\s*Enum<1u8>\(\s*Enum<0u8>\(\s*Array<String>\(([^)]*)\)/);
    if (!m) return [];
    return Array.from(m[1].matchAll(/"([^"]*)"/g), x => sanitizeText(x[1]));
}

/* ── Supply ──────────────────────────────── */

function mintedSupply(events: GatewayEvent[], address: string, kind: ResourceCreation['kind']): string {
    let nftCount = 0;
    let fungible = 0;
    for (const ev of events) {
        if (sanitizeText(ev.emitter?.entity?.entity_address || '') !== address) continue;
        const fields: GatewayField[] = ev.data?.fields ?? [];
        if (ev.name === 'MintNonFungibleResourceEvent') {
            const ids = fields.find(f => f.field_name === 'ids') as (GatewayField & { elements?: unknown[] }) | undefined;
            nftCount += ids?.elements?.length ?? 0;
        } else if (ev.name === 'MintFungibleResourceEvent') {
            const amount = fields.find(f => f.field_name === 'amount');
            fungible += parseFloat(String(amount?.value ?? '0')) || 0;
        }
    }
    return kind === 'non_fungible' ? String(nftCount) : String(fungible);
}

/* ── Entry point ─────────────────────────── */

/** Reads a nested value from the loosely typed substate payload. */
function pick(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Every resource the transaction created, described from its receipt. */
export function extractResourceCreations(
    stateUpdates: StateUpdates | undefined,
    events: GatewayEvent[] = [],
    manifest = '',
): ResourceCreation[] {
    const created = (stateUpdates?.new_global_entities ?? [])
        .filter(e => e.entity_type === 'GlobalNonFungibleResource' || e.entity_type === 'GlobalFungibleResource');
    if (created.length === 0) return [];

    const substates = stateUpdates?.created_substates ?? [];
    // The manifest lists field names per instruction; with several collections they can't be told apart.
    const nftCount = created.filter(e => e.entity_type === 'GlobalNonFungibleResource').length;
    const nftFieldNames = nftCount === 1 ? parseNftFieldNames(manifest) : [];

    return created.map(entity => {
        const address = sanitizeText(entity.entity_address || '');
        const kind: ResourceCreation['kind'] = entity.entity_type === 'GlobalNonFungibleResource' ? 'non_fungible' : 'fungible';
        const own = substates.filter(s => sanitizeText(s.substate_id?.entity_address || '') === address);
        const dataOf = (type: string) => own.find(s => s.substate_id?.substate_type === type)?.value?.substate_data;

        const metadata = new Map<string, string | string[]>();
        const rules = new Map<string, string>();
        let features: string[] = [];
        let ownerBadge: string | null = null;

        for (const s of own) {
            const data = s.value?.substate_data;
            if (!data) continue;
            switch (s.substate_id?.substate_type) {
                case 'MetadataModuleEntry': {
                    const key = pick(data, 'key.name');
                    const hex = pick(data, 'value.data_struct.struct_data.hex');
                    if (typeof key === 'string' && typeof hex === 'string') {
                        const decoded = decodeMetadataValue(hex);
                        if (decoded !== null) metadata.set(key, decoded);
                    }
                    break;
                }
                case 'RoleAssignmentModuleRuleEntry': {
                    const role = pick(data, 'key.role_key');
                    if (pick(data, 'key.object_module_id') === 'Main' && typeof role === 'string') {
                        rules.set(role, String(pick(data, 'value.access_rule.type') ?? ''));
                    }
                    break;
                }
                case 'RoleAssignmentModuleFieldOwnerRole': {
                    const req = pick(data, 'value.owner_role.rule.access_rule.proof_rule.requirement');
                    const badge = pick(req, 'non_fungible.resource_address') ?? pick(req, 'resource');
                    if (typeof badge === 'string') ownerBadge = sanitizeText(badge);
                    break;
                }
                case 'TypeInfoModuleFieldTypeInfo': {
                    const list = pick(data, 'value.details.blueprint_info.features');
                    features = Array.isArray(list) ? list.map(String) : [];
                    break;
                }
            }
        }

        const text = (key: string) => {
            const v = metadata.get(key);
            return typeof v === 'string' && v.trim() ? sanitizeText(v) : null;
        };
        const tags = metadata.get('tags');
        const idType = pick(dataOf('NonFungibleResourceManagerFieldIdType'), 'value.non_fungible_id_type');
        const mutable = pick(dataOf('NonFungibleResourceManagerFieldMutableFields'), 'value.mutable_fields');
        const divisibility = pick(dataOf('FungibleResourceManagerFieldDivisibility'), 'value.divisibility');

        return {
            address,
            kind,
            name: text('name'),
            symbol: text('symbol'),
            description: text('description'),
            iconUrl: text('icon_url'),
            tags: Array.isArray(tags) ? tags.map(t => sanitizeText(t)) : [],
            initialSupply: mintedSupply(events, address, kind),
            idType: typeof idType === 'string' ? idType : null,
            divisibility: typeof divisibility === 'number' ? divisibility : null,
            nftFields: kind === 'non_fungible' ? nftFieldNames : [],
            mutableFields: Array.isArray(mutable) ? mutable.map(f => sanitizeText(String(pick(f, 'name') ?? ''))).filter(Boolean) : [],
            roles: {
                transfer: resolveRole(rules, 'withdrawer', null, features),
                mint: resolveRole(rules, 'minter', 'mint', features),
                burn: resolveRole(rules, 'burner', 'burn', features),
                recall: resolveRole(rules, 'recaller', 'vault_recall', features),
            },
            ownerBadge,
        };
    });
}
