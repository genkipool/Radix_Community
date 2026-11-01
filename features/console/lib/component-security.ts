/**
 * What the console can tell about a component's safety, as findings ranked by
 * severity, for the component info card (and the MCP server).
 *
 * Like the pool checks, these read permissions from the ledger, never code:
 * who owns the component, what its roles let anyone do, whether its metadata
 * and royalties can change, whether a dApp vouches for it, what the tokens in
 * its vaults let their issuers do, and what it controls. A component's code is
 * its package's, and a Radix package can never be changed after publishing.
 * Pure: the hook brings the Gateway data.
 */

import { isXrd, managerBadgeRisks, roleCanAct } from './pool-safety';
import { entityRoles, isGlobalCallerBadge, isPackageCallerBadge, ownerRule, type RuleView } from './role-lookup';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type ComponentFindingSeverity = 'danger' | 'warning' | 'info' | 'ok';

export type ComponentFinding =
  /** Anyone can act as the owner: change its metadata, royalties and roles. */
  | { id: 'ownerAnyone'; severity: 'danger' }
  | { id: 'ownerXrd'; severity: 'danger' }
  | { id: 'ownerBadgeMintable'; severity: 'warning' }
  | { id: 'ownerBadgeSupply'; severity: 'warning'; supply: number }
  | { id: 'ownerBadge'; severity: 'info'; badge: string }
  | { id: 'ownerComponent'; severity: 'info'; controller: string | null }
  | { id: 'ownerNobody'; severity: 'ok' }
  /** A role of its own (not the owner's) that lets everyone in. */
  | { id: 'roleAnyone'; severity: 'info'; role: string }
  | { id: 'holdsRecallable' | 'holdsFreezable'; severity: 'warning'; resource: string }
  | { id: 'royaltiesOn'; severity: 'info'; methods: number }
  | { id: 'royaltiesChangeable'; severity: 'info' }
  | { id: 'packageRoyalties'; severity: 'info'; blueprints: number }
  | { id: 'verified'; severity: 'ok'; dapp: string; name: string }
  | { id: 'unverified'; severity: 'info' }
  | { id: 'metadataChangeable'; severity: 'info' }
  | { id: 'metadataLocked'; severity: 'ok' }
  /** Entities whose roles ask for this component's caller badge. */
  | { id: 'controls'; severity: 'info'; entities: string[] }
  | { id: 'young'; severity: 'info'; days: number }
  | { id: 'packageImmutable'; severity: 'ok'; pkg: string };

export type ComponentFindingId = ComponentFinding['id'];

const RANK: Record<ComponentFindingSeverity, number> = { danger: 0, warning: 1, info: 2, ok: 3 };

/** A component younger than this is worth pointing out. */
export const YOUNG_DAYS = 7;

/** Methods with a royalty, from a component's or a blueprint's `royalty_config`. */
export function royaltyMethods(config: unknown): number {
  const c = obj(config);
  if (c.is_enabled !== true) return 0;
  const rules = arr(c.method_rules).map(obj);
  return rules.filter((r) => Number(obj(r.royalty_amount).amount ?? 0) > 0).length;
}

export interface ComponentSecurityInput {
  address: string;
  /** Gateway details of the component, with its royalty config. */
  details: unknown;
  /** Global caller badge id → component, for the owner rule. */
  ownerCallers?: Record<string, string>;
  /** Details of the owner badge resource, when the owner is a badge. */
  ownerBadgeDetails?: unknown;
  /** Name of the dApp the component is two-way linked to. */
  dappName?: string;
  /** Blueprints of its package that charge royalties. */
  packageRoyaltyBlueprints?: number;
  /** Tokens in its vaults, with their Gateway details. */
  holdings?: Array<{ resource: string; details: unknown }>;
  /** Entities whose roles ask for this component's caller badge. */
  controls?: string[];
  /** When its first transaction was confirmed. */
  createdAt?: string | null;
  now?: number;
}

const callerOf = (rule: RuleView, callers: Record<string, string>) =>
  rule.type === 'nonFungible' && isGlobalCallerBadge(rule.resource) ? (callers[rule.localId] ?? null) : null;

function ownerFindings(details: unknown, ownerCallers: Record<string, string>, badgeDetails: unknown): ComponentFinding[] {
  if (!obj(obj(obj(obj(details).details).role_assignments).owner).rule) return [];
  const { rule } = ownerRule(details);
  if (rule.type === 'denyAll') return [{ id: 'ownerNobody', severity: 'ok' }];
  if (rule.type === 'allowAll') return [{ id: 'ownerAnyone', severity: 'danger' }];
  if (rule.type === 'nonFungible' && (isGlobalCallerBadge(rule.resource) || isPackageCallerBadge(rule.resource))) {
    return [{ id: 'ownerComponent', severity: 'info', controller: callerOf(rule, ownerCallers) }];
  }
  if (rule.type !== 'resource' && rule.type !== 'nonFungible') return [];
  const findings: ComponentFinding[] = [{ id: 'ownerBadge', severity: 'info', badge: rule.resource }];
  if (isXrd(rule.resource)) return [{ id: 'ownerXrd', severity: 'danger' }];
  for (const risk of managerBadgeRisks(rule.resource, badgeDetails ?? null, rule.type === 'resource')) {
    if (risk.kind === 'mintable') findings.push({ id: 'ownerBadgeMintable', severity: 'warning' });
    else if (risk.kind === 'supply') findings.push({ id: 'ownerBadgeSupply', severity: 'warning', supply: risk.supply });
  }
  return findings;
}

const metadataItems = (details: unknown) => [...arr(obj(obj(details).explicit_metadata).items), ...arr(obj(obj(details).metadata).items)].map(obj);
const isLocked = (details: unknown, key: string) => metadataItems(details).some((m) => m.key === key && m.is_locked === true);

/** Every finding for the component, worst first. */
export function componentFindings({
  address,
  details,
  ownerCallers = {},
  ownerBadgeDetails,
  dappName = '',
  packageRoyaltyBlueprints = 0,
  holdings = [],
  controls = [],
  createdAt,
  now = Date.now(),
}: ComponentSecurityInput): ComponentFinding[] {
  const d = obj(obj(details).details);
  const findings: ComponentFinding[] = [...ownerFindings(details, ownerCallers, ownerBadgeDetails)];
  const roles = entityRoles(details);

  for (const role of roles) {
    if (role.module === 'Main' && !role.viaOwner && role.rule.type === 'allowAll') {
      findings.push({ id: 'roleAnyone', severity: 'info', role: role.name });
    }
  }

  // The tokens it holds: what their issuers can do to its vaults.
  for (const { resource, details: token } of holdings) {
    if (!token || isXrd(resource)) continue;
    if (roleCanAct(token, 'recaller')) findings.push({ id: 'holdsRecallable', severity: 'warning', resource });
    if (roleCanAct(token, 'freezer')) findings.push({ id: 'holdsFreezable', severity: 'warning', resource });
  }

  const methods = royaltyMethods(d.royalty_config);
  if (methods > 0) findings.push({ id: 'royaltiesOn', severity: 'info', methods });
  const setter = roles.find((r) => r.module === 'Royalty' && r.name === 'royalty_setter');
  if (setter && !(setter.fixed && setter.rule.type === 'denyAll')) findings.push({ id: 'royaltiesChangeable', severity: 'info' });
  if (packageRoyaltyBlueprints > 0) findings.push({ id: 'packageRoyalties', severity: 'info', blueprints: packageRoyaltyBlueprints });

  const dapp = str(d.two_way_linked_dapp_address);
  findings.push(dapp ? { id: 'verified', severity: 'ok', dapp, name: dappName } : { id: 'unverified', severity: 'info' });

  const metadataSetter = roles.find((r) => r.module === 'Metadata' && r.name === 'metadata_setter');
  const renamable = !!metadataSetter && !(metadataSetter.fixed && metadataSetter.rule.type === 'denyAll') && !(isLocked(details, 'name') && isLocked(details, 'icon_url'));
  if (metadataSetter) findings.push(renamable ? { id: 'metadataChangeable', severity: 'info' } : { id: 'metadataLocked', severity: 'ok' });

  const controlled = controls.filter((e) => e !== address);
  if (controlled.length) findings.push({ id: 'controls', severity: 'info', entities: controlled });

  if (createdAt) {
    const days = Math.floor((now - Date.parse(createdAt)) / 86_400_000);
    if (days >= 0 && days < YOUNG_DAYS) findings.push({ id: 'young', severity: 'info', days });
  }

  const pkg = str(d.package_address);
  if (pkg) findings.push({ id: 'packageImmutable', severity: 'ok', pkg });

  return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
