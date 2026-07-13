/**
 * features/dashboard/utils/resourceUtils.ts
 *
 * Pure utility functions for Radix on-chain resource metadata.
 * Previously duplicated across BalanceChangeRow, NftTransferCard and ValidatorInlinePanel.
 * Single source of truth — import from here.
 */

import type { 
  RoleResolution, 
  ConfigEntry, 
  TranslationsT, 
  MetadataValue,
  GatewayRoleEntry
} from '@/features/dashboard/types';



// ─────────────────────────────────────────
//  getConfigEntries
// ─────────────────────────────────────────
/**
 * Parses a Gateway `role_assignments` object into a flat list of ConfigEntry rows,
 * grouped into admin / roles / metadata. Covers both fungible and NFT resource shapes.
 * Previously duplicated across BalanceChangeRow, ValidatorInlinePanel and NftTransferCard.
 */
export function getConfigEntries(ra: unknown, tt?: Partial<TranslationsT['dashboard']['transactions']>): ConfigEntry[] {
    if (!ra) return [];
    const ROLE_DESC: Record<string, string> = {
        owner:                             tt?.role_desc_owner                  || 'Master authority that can exercise all owner-assigned roles.',
        minter:                            tt?.role_desc_minter                 || 'Can create new tokens and increase supply.',
        minter_updater:                    tt?.role_desc_minter_updater         || 'Can update who has the minter role.',
        burner:                            tt?.role_desc_burner                 || 'Can destroy tokens and reduce supply.',
        burner_updater:                    tt?.role_desc_burner_updater         || 'Can update who has the burner role.',
        freezer:                           tt?.role_desc_freezer                || 'Can freeze/unfreeze token movements in vaults.',
        freezer_updater:                   tt?.role_desc_freezer_updater        || 'Can update who has the freezer role.',
        recaller:                          tt?.role_desc_recaller               || 'Can forcibly retrieve tokens from any vault.',
        recaller_updater:                  tt?.role_desc_recaller_updater       || 'Can update who has the recaller role.',
        depositor:                         tt?.role_desc_depositor              || 'Controls who can deposit tokens into accounts.',
        depositor_updater:                 tt?.role_desc_depositor_updater      || 'Can update who has the depositor role.',
        withdrawer:                        tt?.role_desc_withdrawer             || 'Controls who can withdraw tokens from accounts.',
        withdrawer_updater:                tt?.role_desc_withdrawer_updater     || 'Can update who has the withdrawer role.',
        non_fungible_data_updater:         'Can update NFT data fields after minting.',
        non_fungible_data_updater_updater: 'Can update who has the NFT data updater role.',
        metadata_setter:                   tt?.role_desc_metadata_setter        || 'Can update name, symbol and other metadata.',
        metadata_setter_updater:           tt?.role_desc_metadata_setter_updater|| 'Can update who has the metadata setter role.',
        metadata_locker:                   tt?.role_desc_metadata_locker        || 'Can lock metadata fields to prevent future changes.',
        metadata_locker_updater:           tt?.role_desc_metadata_locker_updater|| 'Can update who has the metadata locker role.',
    };
    const getRoleDesc = (roleName: string, group: ConfigEntry['group']): string => {
        if (ROLE_DESC[roleName]) return ROLE_DESC[roleName];
        const baseName = roleName.replace('_updater', '').replace(/_/g, ' ');
        if (group === 'main') {
            return roleName.endsWith('_updater')
                ? `Can update who has the ${baseName} role.`
                : `Main role controlling access to ${baseName}.`;
        }
        if (group === 'royalty') {
            return roleName.endsWith('_updater')
                ? `Can update who has the royalty role for ${baseName}.`
                : `Manages royalty configuration and assignment for ${baseName}.`;
        }
        return roleName.endsWith('_updater')
            ? `Can update who has the ${baseName} role.`
            : `Controls access to ${baseName}.`;
    };
    const ROLE_GROUP: Record<string, ConfigEntry['group']> = {
        owner: 'admin',
        minter: 'roles', minter_updater: 'roles', burner: 'roles', burner_updater: 'roles',
        freezer: 'roles', freezer_updater: 'roles', recaller: 'roles', recaller_updater: 'roles',
        depositor: 'roles', depositor_updater: 'roles', withdrawer: 'roles', withdrawer_updater: 'roles',
        non_fungible_data_updater: 'roles', non_fungible_data_updater_updater: 'roles',
        metadata_setter: 'metadata', metadata_setter_updater: 'metadata',
        metadata_locker: 'metadata', metadata_locker_updater: 'metadata',
    };
    const ALL_ROLES = [
        'owner', 'minter', 'minter_updater', 'burner', 'burner_updater',
        'freezer', 'freezer_updater', 'recaller', 'recaller_updater',
        'depositor', 'depositor_updater', 'withdrawer', 'withdrawer_updater',
        'non_fungible_data_updater', 'non_fungible_data_updater_updater',
        'metadata_setter', 'metadata_setter_updater',
        'metadata_locker', 'metadata_locker_updater',
    ];
    const resLabel = (resolution: string, explicitType?: string): string => {
        if (resolution === 'Owner')    return tt?.role_resolution_owner     || 'Owner';
        if (resolution === 'Explicit') {
            if (explicitType === 'AllowAll') return tt?.role_resolution_allow_all || 'Allow All';
            if (explicitType === 'DenyAll')  return tt?.role_resolution_deny_all  || 'Deny All';
            return tt?.role_resolution_explicit || 'Explicit';
        }
        return resolution || '—';
    };
    const r = ra as {
        entries?: GatewayRoleEntry[];
        owner?: { rule: { type: string } };
        [key: string]: unknown;
    };
    const entries: ConfigEntry[] = [];
    if (Array.isArray(r.entries)) {
        const processedRoles = new Set<string>();
        if (r.owner) {
            const ownerType: string = r.owner.rule?.type ?? '';
            const ruleAddress = ownerType === 'Protected' ? extractRuleAddress(r.owner.rule) : null;
            entries.push({ name: 'owner', resolution: ownerType === 'Protected' ? (tt?.role_resolution_explicit || 'Explicit') : (ownerType || '—'), updatable: false, desc: ROLE_DESC['owner'] || '', group: 'admin', ruleAddress });
            processedRoles.add('owner');
        }
        const entriesByRole = new Map(r.entries.map((e) => [e?.role_key?.name, e] as const));

        for (const roleName of ALL_ROLES) {
            if (roleName === 'owner') continue;
            const entry = entriesByRole.get(roleName);
            if (!entry) continue;
            processedRoles.add(roleName);
            const resolution: string = entry.assignment?.resolution ?? '';
            const explicitType: string = entry.assignment?.explicit_rule?.type ?? '';
            const ruleAddress = resolution === 'Explicit' && explicitType !== 'AllowAll' && explicitType !== 'DenyAll'
                ? extractRuleAddress(entry.assignment?.explicit_rule) : null;
            const updaterEntry = entriesByRole.get(`${roleName}_updater`);
            const updaterRes: string = updaterEntry?.assignment?.resolution ?? '';
            const updaterExplicit: string = updaterEntry?.assignment?.explicit_rule?.type ?? '';
            const updatable = !roleName.endsWith('_updater') && (updaterRes === 'Owner' || (updaterRes === 'Explicit' && updaterExplicit !== 'DenyAll'));
            entries.push({ name: roleName, resolution: resLabel(resolution, explicitType), updatable, desc: getRoleDesc(roleName, ROLE_GROUP[roleName] || 'roles'), group: ROLE_GROUP[roleName] || 'roles', ruleAddress });
        }
        for (const entry of r.entries) {
            const roleName = entry.role_key?.name;
            if (!roleName || processedRoles.has(roleName)) continue;
            const resolution: string = entry.assignment?.resolution ?? '';
            const explicitType: string = entry.assignment?.explicit_rule?.type ?? '';
            const ruleAddress = resolution === 'Explicit' && explicitType !== 'AllowAll' && explicitType !== 'DenyAll'
                ? extractRuleAddress(entry.assignment?.explicit_rule) : null;
            const updaterEntry = entriesByRole.get(`${roleName}_updater`);
            const updaterRes: string = updaterEntry?.assignment?.resolution ?? '';
            const updaterExplicit: string = updaterEntry?.assignment?.explicit_rule?.type ?? '';
            const updatable = !roleName.endsWith('_updater') && (updaterRes === 'Owner' || (updaterRes === 'Explicit' && updaterExplicit !== 'DenyAll'));
            
            let group: ConfigEntry['group'] = ROLE_GROUP[roleName] || 'roles';
            const moduleStr = entry.role_key?.module;
            if (moduleStr === 'Main') {
                group = 'main';
            } else if (moduleStr === 'Royalty') {
                group = 'royalty';
            }
            
            entries.push({ name: roleName, resolution: resLabel(resolution, explicitType), updatable, desc: getRoleDesc(roleName, group), group, ruleAddress });
        }
        return entries;
    }
    const raFlat = r as Record<string, { rule?: { type: string } }>;
    const processedFlat = new Set<string>();
    for (const key of ALL_ROLES) {
        const val = raFlat[key]; if (!val) continue;
        processedFlat.add(key);
        const ruleType: string = val.rule?.type ?? '';
        const updaterType: string = raFlat[`${key}_updater`]?.rule?.type ?? '';
        const ruleAddress = ruleType === 'Protected' ? extractRuleAddress(val.rule) : null;
        entries.push({ name: key, resolution: ruleType === 'AllowAll' ? (tt?.role_resolution_allow_all || 'Allow All') : ruleType === 'DenyAll' ? (tt?.role_resolution_deny_all || 'Deny All') : ruleType === 'Protected' ? (tt?.role_resolution_explicit || 'Explicit') : ruleType || '—', updatable: !!updaterType && updaterType !== 'DenyAll', desc: getRoleDesc(key, ROLE_GROUP[key] || 'roles'), group: ROLE_GROUP[key] || 'roles', ruleAddress });
    }
    for (const [key, val] of Object.entries(raFlat)) {
        if (key === 'owner' || key === 'entries' || processedFlat.has(key)) continue;
        const v = val as { rule?: { type: string } };
        if (!v || typeof v !== 'object') continue;
        const ruleType: string = v.rule?.type ?? '';
        const updaterType: string = raFlat[`${key}_updater`]?.rule?.type ?? '';
        const ruleAddress = ruleType === 'Protected' ? extractRuleAddress(v.rule) : null;
        entries.push({ name: key, resolution: ruleType === 'AllowAll' ? (tt?.role_resolution_allow_all || 'Allow All') : ruleType === 'DenyAll' ? (tt?.role_resolution_deny_all || 'Deny All') : ruleType === 'Protected' ? (tt?.role_resolution_explicit || 'Explicit') : ruleType || '—', updatable: !!updaterType && updaterType !== 'DenyAll', desc: getRoleDesc(key, ROLE_GROUP[key] || 'roles'), group: ROLE_GROUP[key] || 'roles', ruleAddress });
    }
    return entries;
}

// ─────────────────────────────────────────
//  resolutionTooltip
// ─────────────────────────────────────────
/** Returns a human-readable tooltip for a role resolution value. */
export function resolutionTooltip(resolution: string, tt?: Partial<TranslationsT['dashboard']['transactions']>): string {
    const ownerLabel = tt?.role_resolution_owner    || 'Owner';
    const allowLabel = tt?.role_resolution_allow_all|| 'Allow All';
    const denyLabel  = tt?.role_resolution_deny_all || 'Deny All';
    if (resolution === ownerLabel)  return tt?.role_tooltip_type_owner     || 'Requires the owner badge. Only the owner can exercise this role.';
    if (resolution === allowLabel)  return tt?.role_tooltip_type_allow_all || 'Anyone can exercise this role.';
    if (resolution === denyLabel)   return tt?.role_tooltip_type_deny_all  || 'Nobody can exercise this role — permanently disabled.';
    return tt?.role_tooltip_type_explicit || 'A custom access rule controls who can exercise this role.';
}

// ─────────────────────────────────────────
//  parseTags
// ─────────────────────────────────────────
/**
 * Extracts an array of tag strings from a raw metadata item returned by
 * the Radix Gateway. Handles three different metadata encoding shapes.
 */
export function parseTags(rawItem: unknown): string[] {
  if (!rawItem) return [];
  const item = rawItem as { value?: MetadataValue };
  const t = item.value?.typed;
  if (Array.isArray(t?.values)) return t.values.filter((v): v is string => !!v);
  if (typeof t?.value === 'string' && t.value) return [t.value];
  const elements = item.value?.programmatic_json?.fields?.[0]?.elements;
  if (Array.isArray(elements)) return elements.map((e) => e.value).filter((v): v is string => !!v);
  return [];
}

// ─────────────────────────────────────────
//  normaliseRoles
// ─────────────────────────────────────────
/**
 * Normalises the `role_assignments` object from a resource details response
 * into a flat name→resolution map, regardless of which Gateway shape is returned.
 */
function normaliseRoles(
  ra: unknown,
): Record<string, RoleResolution> {
  const map: Record<string, RoleResolution> = {};
  if (!ra) return map;
  const r = ra as {
    entries?: GatewayRoleEntry[];
    owner?: { rule: { type: string } };
    [key: string]: unknown;
  };

  if (Array.isArray(r.entries)) {
    if (r.owner) map['owner'] = r.owner.rule?.type === 'DenyAll' ? 'deny' : 'active';
    for (const entry of r.entries) {
      const name: string       = entry.role_key?.name ?? '';
      if (!name) continue;
      const resolution: string = entry.assignment?.resolution ?? '';
      const explicit: string   = entry.assignment?.explicit_rule?.type ?? '';
      if (resolution === 'Owner') map[name] = 'active';
      else if (resolution === 'Explicit') {
        if (explicit === 'DenyAll')  map[name] = 'deny';
        else if (explicit === 'AllowAll') map[name] = 'allow_all';
        else map[name] = 'active';
      }
    }
    return map;
  }

  for (const [key, val] of Object.entries(r)) {
    if (key === 'entries' || key === 'owner') continue;
    const ruleType: string = (val as { rule?: { type: string } })?.rule?.type ?? '';
    if (ruleType === 'DenyAll')   map[key] = 'deny';
    else if (ruleType === 'AllowAll') map[key] = 'allow_all';
    else map[key] = 'active';
  }
  return map;
}

// ─────────────────────────────────────────
//  deriveBehaviors
// ─────────────────────────────────────────
/**
 * Derives human-readable behavior descriptions for a resource from its
 * normalised role map. Used in resource detail modals and NFT cards.
 */
export function deriveBehaviors(
  ra: unknown,
  tt?: Partial<TranslationsT['dashboard']['transactions']>,
): string[] {
  const roles = normaliseRoles(ra);
  const isActive   = (n: string) => roles[n] === 'active';
  const isAllowAll = (n: string) => roles[n] === 'allow_all';
  const out: string[] = [];
  const tStr = (val: unknown, fallback: string) => String(val || fallback);

  if (isActive('minter'))  out.push(tStr(tt?.behavior_supply_increase, 'The supply of this asset can be increased.'));
  if (isActive('burner'))  out.push(tStr(tt?.behavior_supply_decrease, 'The supply of this asset can be decreased.'));
  if (!isActive('minter') && !isActive('burner')) out.push(tStr(tt?.behavior_supply_fixed, 'The supply of this asset is fixed.'));

  if (isActive('metadata_setter')) out.push(tStr(tt?.behavior_metadata_changeable, 'Naming and information of this asset can be changed.'));
  else out.push(tStr(tt?.behavior_metadata_fixed, 'Naming and information of this asset is fixed.'));

  if (isActive('withdrawer') && !isAllowAll('withdrawer')) out.push(tStr(tt?.behavior_withdrawable_restricted, 'Withdrawals from accounts require special authority.'));
  if (isActive('depositor')  && !isAllowAll('depositor'))  out.push(tStr(tt?.behavior_depositable_restricted, 'Deposits into accounts require special authority.'));
  if (isActive('freezer'))  out.push(tStr(tt?.behavior_freezable, 'This asset can be frozen by an authority.'));
  if (isActive('recaller')) out.push(tStr(tt?.behavior_recallable, 'This asset can be recalled from vaults by an authority.'));
  if (isActive('non_fungible_data_updater')) out.push(tStr(tt?.behavior_nft_data_changeable, 'NFT data fields can be updated.'));

  return out;
}

// ─────────────────────────────────────────
//  metaKeyLabel
// ─────────────────────────────────────────
/**
 * Returns the i18n label for a metadata key, falling back to the raw key name.
 */
export function metaKeyLabel(key: string, tt?: Partial<TranslationsT['dashboard']['transactions']>): string {
  const dict = tt as unknown as Record<string, string>;
  return String(dict[`meta_key_${key}`] || key);
}

// ─────────────────────────────────────────
//  parseFloatSafe
// ─────────────────────────────────────────
/** Safely parses a string or unknown value to a float. Returns 0 on failure. */
export function parseFloatSafe(value: unknown): number {
  return parseFloat(String(value ?? '0')) || 0;
}

// ─────────────────────────────────────────
//  extractRuleAddress
// ─────────────────────────────────────────
/** Extracts the badge/resource address from a Protected rule in role assignments. */
export function extractRuleAddress(rule: unknown): string | null {
  try {
    const r = rule as Record<string, unknown>;
    const ar = (r?.access_rule as Record<string, unknown>) || {};
    const pr = (ar?.proof_rule as Record<string, unknown>) || {};
    const req = (pr?.requirement || r?.requirement || {}) as Record<string, unknown>;
    const nf = (req?.non_fungible as Record<string, unknown>) || {};

    const resourceAddress = (nf?.resource_address as string) || (req?.resource_address as string);
    if (!resourceAddress) return null;

    if (nf?.local_id) {
      const localIdObj = nf.local_id as string | Record<string, unknown>;
      const localIdStr =
        typeof localIdObj === 'string'
          ? localIdObj
          : ((localIdObj.simple_rep || localIdObj.value || localIdObj.name || '') as string);
      if (localIdStr) {
        return `${resourceAddress}|${localIdStr}`;
      }
    }

    return resourceAddress;
  } catch { return null; }
}

// ─────────────────────────────────────────
//  parseProgrammaticJson
// ─────────────────────────────────────────
/**
 * Recursively parses complex programmatic_json metadata structures into standard JS values.
 * Useful for extracting arrays (like owner_keys) or deep nested object entries from Gateway metadata.
 */

export function parseProgrammaticJson(json: unknown): unknown {
    if (!json) return null;
    if (typeof json !== 'object') return json;

    const jsonObj = json as Record<string, unknown>;

    if (jsonObj.value !== undefined) return jsonObj.value;
    if (jsonObj.hex !== undefined) return jsonObj.hex;

    // Handle Gateway-specific key/hash pairs (like owner_keys)
    const typeKey = jsonObj.key_hash_type || jsonObj.key_type || jsonObj.hash_type;
    const hexKey = jsonObj.hash_hex || jsonObj.key_hex || jsonObj.hex;
    if (typeKey && hexKey) {
        return `${typeKey}(${hexKey})`;
    }

    if (Array.isArray(jsonObj.elements)) {
        return jsonObj.elements.map(parseProgrammaticJson);
    }

    if (Array.isArray(jsonObj.fields)) {
        const parsedFields = jsonObj.fields.map(parseProgrammaticJson);
        const name = jsonObj.variant_name as string | undefined;

        if (name) {
            if (parsedFields.length === 1) return `${name}(${parsedFields[0]})`;
            return { [name]: parsedFields };
        }
        return parsedFields.length === 1 ? parsedFields[0] : parsedFields;
    }

    if (Array.isArray(jsonObj.entries)) {
        
        const obj: Record<string, unknown> = {};
        
        jsonObj.entries.forEach((e: unknown) => {
            const entryObj = e as Record<string, unknown>;
            const key = parseProgrammaticJson(entryObj.key);
            const val = parseProgrammaticJson(entryObj.value);
            obj[String(key)] = val;
        });
        return obj;
    }

    if (jsonObj.variant_name) {
        return jsonObj.variant_name;
    }

    return json;
}

