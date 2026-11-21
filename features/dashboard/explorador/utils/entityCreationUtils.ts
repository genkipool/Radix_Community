import { sanitizeText } from '@/utils/sanitize';
import { decodeMetadataValue } from './resourceCreationUtils';

export type EntityCreationKind =
    | 'package'
    | 'component'
    | 'account'
    | 'identity'
    | 'pool'
    | 'validator'
    | 'locker'
    | 'access_controller'
    | 'other';

export interface EntityCreation {
    address: string;
    entityType: string;
    kind: EntityCreationKind;
    name: string | null;
    description: string | null;
    iconUrl: string | null;
    tags: string[];
    blueprintName: string | null;
    blueprintVersion: string | null;
    packageAddress: string | null;
    /** Blueprint names published inside a newly created Package. */
    blueprints: string[];
    /** Badge resource whose holder owns this entity, when present. */
    ownerBadge: string | null;
    /** Default deposit rule for newly created accounts (Accept / Reject / AllowExisting). */
    defaultDepositRule: string | null;
}

interface Substate {
    substate_id?: { entity_address?: string; substate_type?: string };
    value?: { substate_data?: unknown };
}

interface StateUpdates {
    created_substates?: Substate[];
    new_global_entities?: Array<{ entity_address?: string; entity_type?: string }>;
}

const RESOURCE_ENTITY_TYPES = new Set([
    'GlobalFungibleResource',
    'GlobalNonFungibleResource',
]);

function pick(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
        obj,
    );
}

export function classifyCreatedEntityKind(address: string, entityType: string): EntityCreationKind {
    if (entityType === 'GlobalPackage' || address.startsWith('package_')) return 'package';
    if (entityType === 'GlobalValidator' || address.startsWith('validator_')) return 'validator';
    if (entityType === 'GlobalAccountLocker' || address.startsWith('locker_')) return 'locker';
    if (entityType === 'GlobalAccessController' || address.startsWith('accesscontroller_')) return 'access_controller';
    if (entityType.includes('Pool') || address.startsWith('pool_')) return 'pool';
    if (entityType.includes('Identity') || address.startsWith('identity_')) return 'identity';
    if (entityType.includes('Account') || address.startsWith('account_')) return 'account';
    if (entityType.includes('Component') || address.startsWith('component_')) return 'component';
    return 'other';
}

/**
 * Extracts every non-resource global entity created in a transaction
 * (packages, components, accounts, identities, pools, validators, lockers,
 * access controllers, etc.) along with metadata and structural info from
 * `created_substates`.
 */
export function extractEntityCreations(
    stateUpdates: StateUpdates | undefined,
): EntityCreation[] {
    const created = (stateUpdates?.new_global_entities ?? []).filter((e) => {
        const addr = sanitizeText(e.entity_address || '');
        const type = e.entity_type || '';
        if (!addr) return false;
        if (RESOURCE_ENTITY_TYPES.has(type) || addr.startsWith('resource_')) return false;
        return true;
    });

    if (created.length === 0) return [];

    const substates = stateUpdates?.created_substates ?? [];

    return created.map((entity) => {
        const address = sanitizeText(entity.entity_address || '');
        const entityType = sanitizeText(entity.entity_type || '');
        const kind = classifyCreatedEntityKind(address, entityType);
        const own = substates.filter((s) => sanitizeText(s.substate_id?.entity_address || '') === address);

        const metadata = new Map<string, string | string[]>();
        const blueprintsSet = new Set<string>();
        let blueprintName: string | null = null;
        let blueprintVersion: string | null = null;
        let packageAddress: string | null = null;
        let ownerBadge: string | null = null;
        let defaultDepositRule: string | null = null;

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
                case 'TypeInfoModuleFieldTypeInfo': {
                    const bpName = pick(data, 'value.details.blueprint_info.blueprint_name');
                    const bpVer = pick(data, 'value.details.blueprint_info.blueprint_version');
                    const pkg = pick(data, 'value.details.blueprint_info.package_address');
                    if (typeof bpName === 'string' && bpName.trim()) blueprintName = sanitizeText(bpName);
                    if (typeof bpVer === 'string' && bpVer.trim()) blueprintVersion = sanitizeText(bpVer);
                    if (typeof pkg === 'string' && pkg.trim()) packageAddress = sanitizeText(pkg);
                    break;
                }
                case 'PackageBlueprintDefinitionEntry': {
                    const bpName = pick(data, 'key.blueprint_name');
                    if (typeof bpName === 'string' && bpName.trim()) blueprintsSet.add(sanitizeText(bpName));
                    break;
                }
                case 'RoleAssignmentModuleFieldOwnerRole': {
                    const req = pick(data, 'value.owner_role.rule.access_rule.proof_rule.requirement');
                    const badge = pick(req, 'non_fungible.resource_address') ?? pick(req, 'resource');
                    if (typeof badge === 'string' && badge.trim()) ownerBadge = sanitizeText(badge);
                    break;
                }
                case 'AccountFieldState': {
                    const rule = pick(data, 'value.default_deposit_rule');
                    if (typeof rule === 'string' && rule.trim()) defaultDepositRule = sanitizeText(rule);
                    break;
                }
            }
        }

        const text = (key: string) => {
            const v = metadata.get(key);
            return typeof v === 'string' && v.trim() ? sanitizeText(v) : null;
        };
        const tags = metadata.get('tags');

        return {
            address,
            entityType,
            kind,
            name: text('name'),
            description: text('description'),
            iconUrl: text('icon_url'),
            tags: Array.isArray(tags) ? tags.map((t) => sanitizeText(t)).filter(Boolean) : [],
            blueprintName,
            blueprintVersion,
            packageAddress,
            blueprints: [...blueprintsSet],
            ownerBadge,
            defaultDepositRule,
        };
    });
}
