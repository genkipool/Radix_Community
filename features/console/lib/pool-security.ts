/**
 * Everything the console can tell about a native pool's safety, as a list of
 * findings ranked by severity: the pool info card shows the worst few on top
 * and the whole list folded below.
 *
 * These are permission checks read from the ledger, never an audit of code:
 * what each finding says is who can do what, and whether that can change.
 * Pure: the hook brings the Gateway details, the DEX token list and the
 * pool's history, so the same rules run in tests and in the MCP server.
 */

import type { KnownTokens } from './known-tokens';
import type { ManagerMoves } from './pool-history';
import type { PoolState } from './pool-lookup';
import { isXrd, managerBadgeRisks, roleCanAct } from './pool-safety';
import { entityRoles, isGlobalCallerBadge, isPackageCallerBadge, ownerRule, type RuleView } from './role-lookup';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type FindingSeverity = 'danger' | 'warning' | 'info' | 'ok';

export type PoolFinding =
  /** The manager role is AllowAll: anyone can take the reserves. */
  | { id: 'drainable'; severity: 'danger' }
  /** The manager badge is XRD: every account is a manager. */
  | { id: 'xrdBadge'; severity: 'danger' }
  /** A reserve calls itself like a known token but is another one. */
  | { id: 'impersonation'; severity: 'danger'; resource: string; symbol: string; genuine: string }
  | { id: 'badgeMintable'; severity: 'warning' }
  | { id: 'badgeSupply'; severity: 'warning'; supply: number }
  /** Reserves moved without pool units on a pool a person manages. */
  | { id: 'managerMoves'; severity: 'warning'; count: number; lastAt: string | null }
  | { id: 'reserveRecallable' | 'reserveFreezable' | 'reserveWithdrawRestricted'; severity: 'warning'; resource: string }
  | { id: 'reserveMintable' | 'reserveRenamable' | 'reserveDepositRestricted'; severity: 'info'; resource: string }
  /** Anyone can act as the owner of the component that manages the pool. */
  | { id: 'controllerAnyone'; severity: 'warning'; component: string }
  | { id: 'controllerBadge'; severity: 'info'; component: string; badge: string }
  | { id: 'controllerComponent'; severity: 'info'; component: string; controller: string | null }
  | { id: 'controllerNobody'; severity: 'ok'; component: string }
  | { id: 'managerVerified'; severity: 'ok'; component: string; dapp: string; name: string }
  | { id: 'managerUnverified'; severity: 'info'; component: string }
  | { id: 'profileChangeable' | 'unitChangeable'; severity: 'info' }
  | { id: 'profileLocked'; severity: 'ok' }
  | { id: 'concentration'; severity: 'info'; share: number }
  | { id: 'rolesFixed'; severity: 'ok' };

export type PoolFindingId = PoolFinding['id'];

const RANK: Record<FindingSeverity, number> = { danger: 0, warning: 1, info: 2, ok: 3 };

/** A share of the pool units above this is worth pointing out. */
export const CONCENTRATION_SHARE = 0.5;

export interface PoolSecurityInput {
  state: PoolState;
  /** Gateway details by address: the pool, its unit, reserves, manager badge, manager component and its dApp. */
  details: Record<string, unknown>;
  /** Global caller badge id → component, as `findGlobalCaller` resolves them. */
  callers: Record<string, string>;
  /** Who owns the manager component when that is another component (resolved the same way). */
  controllerCallers?: Record<string, string>;
  knownTokens: KnownTokens;
  managerMoves?: ManagerMoves | null;
  /** Share (0–1) of the largest holder of pool units, when known. */
  topShare?: number | null;
}

const metadataItems = (details: unknown) => [
  ...arr(obj(obj(details).explicit_metadata).items),
  ...arr(obj(obj(details).metadata).items),
].map(obj);

const metadataText = (details: unknown, key: string) =>
  str(obj(obj(metadataItems(details).find((m) => m.key === key)?.value).typed).value);

/** Whether a metadata key is locked for good. */
const isLocked = (details: unknown, key: string) => metadataItems(details).some((m) => m.key === key && m.is_locked === true);

/** Whether the role rule lets everyone in now and can never stop doing so. */
const openForGood = (details: unknown, role: string) => {
  const roles = entityRoles(details);
  const found = roles.find((r) => r.module === 'Main' && r.name === role);
  return !!found && found.rule.type === 'allowAll' && found.fixed;
};

/** Whether whoever can set the metadata could still rename it or change its icon. */
const renamable = (details: unknown, keys: string[]) => {
  const setter = entityRoles(details).find((r) => r.module === 'Metadata' && r.name === 'metadata_setter');
  if (!setter || (setter.fixed && setter.rule.type === 'denyAll')) return false;
  return keys.some((key) => !isLocked(details, key));
};

const callerOf = (rule: RuleView, callers: Record<string, string>) =>
  rule.type === 'nonFungible' && isGlobalCallerBadge(rule.resource) ? (callers[rule.localId] ?? null) : null;

function reserveFindings(resource: string, details: unknown, knownTokens: KnownTokens): PoolFinding[] {
  const findings: PoolFinding[] = [];
  const symbol = metadataText(details, 'symbol').trim();
  const genuine = symbol ? knownTokens[symbol.toUpperCase()] : undefined;
  if (symbol.toUpperCase() === 'XRD' && !isXrd(resource)) {
    findings.push({ id: 'impersonation', severity: 'danger', resource, symbol, genuine: genuine ?? '' });
  } else if (genuine && genuine !== resource) {
    findings.push({ id: 'impersonation', severity: 'danger', resource, symbol, genuine });
  }
  // XRD's roles belong to the protocol: nothing a token issuer can do.
  if (!details || isXrd(resource)) return findings;
  if (roleCanAct(details, 'recaller')) findings.push({ id: 'reserveRecallable', severity: 'warning', resource });
  if (roleCanAct(details, 'freezer')) findings.push({ id: 'reserveFreezable', severity: 'warning', resource });
  if (!openForGood(details, 'withdrawer')) findings.push({ id: 'reserveWithdrawRestricted', severity: 'warning', resource });
  if (!openForGood(details, 'depositor')) findings.push({ id: 'reserveDepositRestricted', severity: 'info', resource });
  if (roleCanAct(details, 'minter')) findings.push({ id: 'reserveMintable', severity: 'info', resource });
  if (renamable(details, ['name', 'symbol', 'icon_url'])) findings.push({ id: 'reserveRenamable', severity: 'info', resource });
  return findings;
}

/** Who can act as the owner of the component that manages the pool. */
function controllerFindings(component: string, details: unknown, controllerCallers: Record<string, string>): PoolFinding[] {
  // Without an owner role in the details there is nothing to say.
  if (!obj(obj(obj(obj(details).details).role_assignments).owner).rule) return [];
  const { rule } = ownerRule(details);
  if (rule.type === 'denyAll') return [{ id: 'controllerNobody', severity: 'ok', component }];
  if (rule.type === 'allowAll') return [{ id: 'controllerAnyone', severity: 'warning', component }];
  if (rule.type === 'nonFungible' && (isGlobalCallerBadge(rule.resource) || isPackageCallerBadge(rule.resource))) {
    return [{ id: 'controllerComponent', severity: 'info', component, controller: callerOf(rule, controllerCallers) }];
  }
  if (rule.type === 'resource' || rule.type === 'nonFungible') {
    return [{ id: 'controllerBadge', severity: 'info', component, badge: rule.resource }];
  }
  return [{ id: 'controllerComponent', severity: 'info', component, controller: null }];
}

/** Every finding for the pool, worst first. */
export function poolFindings({ state, details, callers, controllerCallers = {}, knownTokens, managerMoves, topShare }: PoolSecurityInput): PoolFinding[] {
  const findings: PoolFinding[] = [];
  const { manager } = state;
  const managerComponent = callerOf(manager, callers);
  const byBadge = (manager.type === 'resource' || manager.type === 'nonFungible') && !isGlobalCallerBadge(manager.resource) && !isPackageCallerBadge(manager.resource);

  if (manager.type === 'allowAll') findings.push({ id: 'drainable', severity: 'danger' });
  if (byBadge) {
    for (const risk of managerBadgeRisks(manager.resource, details[manager.resource] ?? null, manager.type === 'resource')) {
      if (risk.kind === 'xrd') findings.push({ id: 'xrdBadge', severity: 'danger' });
      else if (risk.kind === 'mintable') findings.push({ id: 'badgeMintable', severity: 'warning' });
      else findings.push({ id: 'badgeSupply', severity: 'warning', supply: risk.supply });
    }
    // On a DEX pool every swap moves reserves this way; with a badge, it is a person.
    if (managerMoves && managerMoves.count > 0) {
      findings.push({ id: 'managerMoves', severity: 'warning', count: managerMoves.count, lastAt: managerMoves.lastAt });
    }
  }

  if (managerComponent) {
    const component = details[managerComponent];
    const dapp = str(obj(obj(component).details).two_way_linked_dapp_address);
    if (dapp) findings.push({ id: 'managerVerified', severity: 'ok', component: managerComponent, dapp, name: metadataText(details[dapp], 'name') });
    else if (component) findings.push({ id: 'managerUnverified', severity: 'info', component: managerComponent });
    findings.push(...controllerFindings(managerComponent, component, controllerCallers));
  }

  for (const resource of state.resources) findings.push(...reserveFindings(resource, details[resource], knownTokens));

  const poolDetails = details[state.address];
  if (poolDetails) {
    findings.push(renamable(poolDetails, ['name', 'icon_url']) ? { id: 'profileChangeable', severity: 'info' } : { id: 'profileLocked', severity: 'ok' });
  }
  if (details[state.poolUnit] && renamable(details[state.poolUnit], ['name', 'symbol', 'icon_url'])) {
    findings.push({ id: 'unitChangeable', severity: 'info' });
  }
  if (state.roles.some((r) => r.name === 'pool_manager_role' && r.fixed)) findings.push({ id: 'rolesFixed', severity: 'ok' });
  if (topShare !== null && topShare !== undefined && topShare > CONCENTRATION_SHARE) {
    findings.push({ id: 'concentration', severity: 'info', share: topShare });
  }

  return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
