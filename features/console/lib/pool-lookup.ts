/**
 * Reads a native pool from Gateway entity details: its kind, resources,
 * reserves, pool unit and, above all, who can manage it.
 *
 * Pure functions over the Gateway JSON so the console, the MCP server and the
 * tests share one reading of the ledger.
 */

import { poolKindOfBlueprint, type PoolKind } from './pool-manifests';
import { mainRoleRule, parseAccessRule, type RuleView } from './role-lookup';

export { badgeOfRule, heldBadgeFor, isGlobalCallerBadge, isPackageCallerBadge, parseAccessRule } from './role-lookup';
/** Who a role resolves to (see role-lookup). */
export type PoolRule = RuleView;

export interface PoolState {
  address: string;
  kind: PoolKind;
  resources: string[];
  /** Reserve per resource address, as decimal strings. */
  reserves: Record<string, string>;
  poolUnit: string;
  manager: PoolRule;
  owner: PoolRule;
  /** False when the owner role is Fixed or None: the metadata can never change hands. */
  ownerUpdatable: boolean;
  /** The pool's `tags` metadata (a retired pool carries "retired"). */
  tags: string[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const metadataValue = (details: Json, key: string) =>
  obj(
    arr(obj(details.metadata).items)
      .map(obj)
      .find((m) => m.key === key)?.value,
  ).typed;

/** The `tags` metadata of any entity's Gateway details. */
export const metadataTags = (entity: unknown): string[] =>
  arr(obj(metadataValue(obj(entity), 'tags')).values).map(str).filter(Boolean);

/** Parses Gateway entity details; null when the entity is not a native pool. */
export function parsePoolState(entity: unknown): PoolState | null {
  const e = obj(entity);
  const details = obj(e.details);
  const kind = poolKindOfBlueprint(str(details.blueprint_name));
  if (!kind) return null;

  const roleAssignments = obj(details.role_assignments);
  const ownerJson = obj(roleAssignments.owner);
  const owner = parseAccessRule(ownerJson.rule);

  const resources = arr(obj(metadataValue(e, 'pool_resources')).values).map(str).filter(Boolean);
  const reserves: Record<string, string> = Object.fromEntries(resources.map((r) => [r, '0']));
  for (const item of arr(obj(e.fungible_resources).items).map(obj)) {
    const resource = str(item.resource_address);
    // Global aggregation gives `amount`; vault aggregation nests it in vaults.
    const amount =
      str(item.amount) ||
      str(obj(arr(obj(item.vaults).items)[0]).amount) ||
      '0';
    if (resource) reserves[resource] = amount;
  }

  return {
    address: str(e.address),
    kind,
    resources: resources.length ? resources : Object.keys(reserves),
    reserves,
    poolUnit: str(obj(metadataValue(e, 'pool_unit')).value),
    manager: mainRoleRule(roleAssignments, 'pool_manager_role', owner),
    owner,
    ownerUpdatable: ownerJson.updater === 'Owner' || ownerJson.updater === 'Object',
    tags: metadataTags(e),
  };
}

/** True when anyone at all can move the reserves: the pool can be drained. */
export const isDrainable = (pool: Pick<PoolState, 'manager'>) => pool.manager.type === 'allowAll';

/**
 * Share of the reserves `units` pool units redeem for, given the unit's total
 * supply. Mirrors the engine's pro-rata redemption (rounded down).
 */
export function redemptionValue(
  reserves: Record<string, string>,
  units: number,
  totalSupply: number,
): Record<string, number> {
  if (!(totalSupply > 0) || !(units > 0)) return Object.fromEntries(Object.keys(reserves).map((r) => [r, 0]));
  const share = Math.min(units / totalSupply, 1);
  return Object.fromEntries(Object.entries(reserves).map(([r, amount]) => [r, Number(amount) * share]));
}
