/**
 * Safety checks for native pools, read from Gateway entity details.
 *
 * A pool's manager rule asks for "any amount of the badge resource", so the
 * badge is only as private as the resource is scarce: with XRD, a public NFT
 * collection or a token someone can still mint, every other holder is a
 * manager too and can drain the reserves (proved on resim). And a reserve
 * token whose issuer can recall or freeze it can be taken out of, or locked
 * in, the pool's vaults whatever the manager rule says.
 *
 * Shared by the create form, the pool info view and the MCP server.
 */

import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { isGlobalCallerBadge, isPackageCallerBadge, mainRoleRule, ownerRule } from './role-lookup';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

/** Why a resource cannot guard a pool on its own. */
export type BadgeProblem =
  /** XRD: every account on the network holds some. */
  | 'xrd'
  /** The account that would hold it does not. */
  | 'notHeld'
  /** Other accounts hold part of the supply (or the supply is unknown). */
  | 'sharedSupply'
  /** More can be minted, now or after a role change. */
  | 'mintable';

/** What a reserve token's issuer can do to the pool's vaults. */
export type ReserveRisk = 'recallable' | 'freezable';

const XRD_ADDRESSES = new Set(Object.values(RADIX_TOKEN_ADDRESSES).map((a) => a.XRD));

/** XRD on any network the app knows. */
export const isXrd = (resource: string) => XRD_ADDRESSES.has(resource);

/**
 * Whether a resource role can act, now or later: its rule or the rule of its
 * updater lets someone in. A role the Gateway does not list counts as able to
 * act, so an unexpected shape errs on the side of a warning.
 */
export function roleCanAct(resource: unknown, role: string): boolean {
  const roles = obj(obj(obj(resource).details).role_assignments);
  const owner = ownerRule(resource).rule;
  return (
    mainRoleRule(roles, role, owner).type !== 'denyAll' ||
    mainRoleRule(roles, `${role}_updater`, owner).type !== 'denyAll'
  );
}

interface HoldingLike {
  resourceAddress: string;
  amount?: string;
  ids?: string[];
}

export interface BadgeCheckInput {
  resource: string;
  /** Gateway entity details of the badge resource; null when unknown. */
  details: unknown;
  /** The holdings of the account that will hold the badge. */
  fungibles: HoldingLike[];
  nonFungibles: HoldingLike[];
}

/**
 * Problems that keep an existing resource from guarding a pool. Empty means
 * the account holds the whole supply and nobody can mint more: only it can
 * ever present the badge.
 */
export function badgeProblems({ resource, details, fungibles, nonFungibles }: BadgeCheckInput): BadgeProblem[] {
  if (isXrd(resource)) return ['xrd'];
  const problems: BadgeProblem[] = [];
  const fungible = fungibles.find((h) => h.resourceAddress === resource);
  const nonFungible = nonFungibles.find((h) => h.resourceAddress === resource);
  const held = fungible ? Number(fungible.amount ?? 0) : (nonFungible?.ids?.length ?? 0);
  if (!(held > 0)) problems.push('notHeld');

  const supply = Number(obj(obj(details).details).total_supply ?? NaN);
  // A truncated id list undercounts what is held: that only adds a warning.
  if (!(supply > 0) || held < supply) problems.push('sharedSupply');
  if (!details || roleCanAct(details, 'minter')) problems.push('mintable');
  return problems;
}

/** What the issuer of a reserve token can do to the pool's vaults. */
export function reserveRisks(details: unknown): ReserveRisk[] {
  if (!details) return [];
  return [
    roleCanAct(details, 'recaller') && ('recallable' as const),
    roleCanAct(details, 'freezer') && ('freezable' as const),
  ].filter((r): r is ReserveRisk => !!r);
}

/** Why an existing pool's manager badge may be in more than one pair of hands. */
export type ManagerBadgeRisk =
  | { kind: 'xrd' }
  | { kind: 'mintable' }
  /** More than one unit or NFT exists: each holder is a manager. */
  | { kind: 'supply'; supply: number };

/**
 * Risks of a pool's manager badge seen from outside, without knowing who
 * holds it: XRD, a badge that can still be minted, or one with a supply above
 * one. Only a rule on a whole resource is at risk.
 */
export function managerBadgeRisks(resource: string, details: unknown, wholeResource: boolean): ManagerBadgeRisk[] {
  if (isXrd(resource)) return [{ kind: 'xrd' }];
  // Minting never recreates an id that exists: a one-id rule stays with its holder.
  // A caller badge is the engine's: it names a component or package, not a holder.
  if (!details || !wholeResource || isGlobalCallerBadge(resource) || isPackageCallerBadge(resource)) return [];
  const risks: ManagerBadgeRisk[] = [];
  if (roleCanAct(details, 'minter')) risks.push({ kind: 'mintable' });
  const supply = Number(obj(obj(details).details).total_supply ?? 0);
  if (supply > 1) risks.push({ kind: 'supply', supply });
  return risks;
}
