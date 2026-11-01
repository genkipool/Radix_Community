/**
 * Gathers what the pool and component security findings are drawn from, with
 * any Gateway POST function: the browser's (the console cards) and the
 * server's (the MCP tools) run the same requests, so the two cannot disagree.
 */

import { entityOrigin, findGlobalCaller, type EntityOrigin } from './caller-badge';
import { componentFindings, royaltyMethods, type ComponentFinding } from './component-security';
import type { KnownTokens } from './known-tokens';
import type { ManagerMoves } from './pool-history';
import type { PoolState } from './pool-lookup';
import type { PoolSecurityInput } from './pool-security';
import type { GatewayPost } from './resource-holders';
import { isGlobalCallerBadge, isPackageCallerBadge, ownerRule } from './role-lookup';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The Gateway's limit of addresses per details request. */
const DETAILS_BATCH = 20;
/** Tokens of a component's vaults whose issuers are checked: the first of each kind the Gateway lists. */
const MAX_HOLDINGS = 20;

/** Metadata the findings read: names, symbols and icons (and whether each is locked). */
const METADATA = ['name', 'symbol', 'icon_url', 'description', 'info_url', 'tags'];

/** Entity details by address, with the dApp two-way links; unknown addresses are left out. */
export async function fetchSecurityDetails(post: GatewayPost, addresses: string[]): Promise<Record<string, unknown>> {
  const unique = [...new Set(addresses.filter(Boolean))];
  const out: Record<string, unknown> = {};
  for (let i = 0; i < unique.length; i += DETAILS_BATCH) {
    const page = await post<{ items?: Json[] }>('/state/entity/details', {
      addresses: unique.slice(i, i + DETAILS_BATCH),
      opt_ins: { dapp_two_way_links: true, explicit_metadata: METADATA },
    });
    for (const item of page.items ?? []) if (str(item.address)) out[str(item.address)] = item;
  }
  return out;
}

export const metadataText = (details: unknown, key: string) =>
  str(obj(obj(arr(obj(obj(details).explicit_metadata).items).map(obj).find((m) => m.key === key)?.value).typed).value);

const isCaller = (resource: string) => isGlobalCallerBadge(resource) || isPackageCallerBadge(resource);

/**
 * Everything `poolFindings` reads for a pool: the entities it points at (unit,
 * reserves, manager badge or component), then what that component points at
 * (its dApp, its own owner). The caller brings what it already has: the
 * resolved callers, the DEX token list, the history and the holders.
 */
export async function gatherPoolSecurity(
  post: GatewayPost,
  state: PoolState,
  extras: { callers: Record<string, string>; knownTokens: KnownTokens; managerMoves?: ManagerMoves | null; topShare?: number | null },
): Promise<PoolSecurityInput> {
  const { manager } = state;
  const managerComponent =
    manager.type === 'nonFungible' && isGlobalCallerBadge(manager.resource) ? (extras.callers[manager.localId] ?? null) : null;
  const managerBadge = (manager.type === 'resource' || manager.type === 'nonFungible') && !isCaller(manager.resource) ? manager.resource : null;
  const details = await fetchSecurityDetails(post, [
    state.address,
    state.poolUnit,
    ...state.resources,
    ...(managerBadge ? [managerBadge] : []),
    ...(managerComponent ? [managerComponent] : []),
  ]);

  const component = managerComponent ? details[managerComponent] : undefined;
  const dapp = str(obj(obj(component).details).two_way_linked_dapp_address);
  const controllerRule = component ? ownerRule(component).rule : null;
  const [dappDetails, controllerCallers] = await Promise.all([
    dapp ? fetchSecurityDetails(post, [dapp]).catch(() => ({})) : Promise.resolve({}),
    managerComponent && controllerRule?.type === 'nonFungible' && isGlobalCallerBadge(controllerRule.resource)
      ? findGlobalCaller(post, managerComponent, [controllerRule]).catch(() => ({}))
      : Promise.resolve({}),
  ]);

  return {
    state,
    details: { ...details, ...dappDetails },
    callers: extras.callers,
    controllerCallers,
    knownTokens: extras.knownTokens,
    managerMoves: extras.managerMoves,
    topShare: extras.topShare,
  };
}

export interface ComponentInfo {
  details: unknown;
  packageAddress: string;
  blueprint: string;
  profile: { name: string; description: string; iconUrl: string; infoUrl: string };
  /** Methods of the component that charge a royalty. */
  royaltyMethods: number;
  fungibles: number;
  nonFungibles: number;
}

export interface ComponentState {
  info: ComponentInfo;
  findings: ComponentFinding[];
  origin: EntityOrigin | null;
  ownerCallers: Record<string, string>;
  packageDetails: unknown;
  /** Blueprints of its package that charge royalties. */
  packageRoyaltyBlueprints: number;
}

/**
 * A component and everything its findings read: its royalty config, its
 * owner (resolved to a component, or its badge's details), its dApp, the
 * tokens it holds, its package and where it comes from. Null when the address
 * is not a component.
 */
export async function fetchComponentState(post: GatewayPost, address: string): Promise<ComponentState | null> {
  const page = await post<{ items?: unknown[] }>('/state/entity/details', {
    addresses: [address],
    opt_ins: { component_royalty_config: true, dapp_two_way_links: true, explicit_metadata: METADATA },
  });
  const details = page.items?.[0];
  const d = obj(obj(details).details);
  if (!details || d.type !== 'Component') return null;

  const info: ComponentInfo = {
    details,
    packageAddress: str(d.package_address),
    blueprint: [str(d.blueprint_name), str(d.blueprint_version)].filter(Boolean).join(' '),
    profile: {
      name: metadataText(details, 'name'),
      description: metadataText(details, 'description'),
      iconUrl: metadataText(details, 'icon_url'),
      infoUrl: metadataText(details, 'info_url'),
    },
    royaltyMethods: royaltyMethods(d.royalty_config),
    fungibles: arr(obj(obj(details).fungible_resources).items).length,
    nonFungibles: arr(obj(obj(details).non_fungible_resources).items).length,
  };

  const owner = ownerRule(details).rule;
  const ownerBadge = (owner.type === 'resource' || owner.type === 'nonFungible') && !isCaller(owner.resource) ? owner.resource : null;
  const dapp = str(d.two_way_linked_dapp_address);
  const held = [
    ...arr(obj(obj(details).fungible_resources).items).slice(0, MAX_HOLDINGS),
    ...arr(obj(obj(details).non_fungible_resources).items).slice(0, MAX_HOLDINGS),
  ]
    .map((i) => str(obj(i).resource_address))
    .filter(Boolean);

  const [related, ownerCallers, packageRoyaltyBlueprints, origin, packageDetails] = await Promise.all([
    fetchSecurityDetails(post, [...(ownerBadge ? [ownerBadge] : []), ...(dapp ? [dapp] : []), ...held]),
    owner.type === 'nonFungible' && isGlobalCallerBadge(owner.resource)
      ? findGlobalCaller(post, address, [owner]).catch(() => ({}) as Record<string, string>)
      : Promise.resolve({} as Record<string, string>),
    info.packageAddress
      ? post<{ items?: { royalty_config?: unknown }[] }>('/state/package/page/blueprints', { package_address: info.packageAddress })
          .then((p) => (p.items ?? []).filter((b) => royaltyMethods(b.royalty_config) > 0).length)
          .catch(() => 0)
      : Promise.resolve(0),
    entityOrigin(post, address).catch(() => null),
    info.packageAddress ? fetchSecurityDetails(post, [info.packageAddress]).then((m) => m[info.packageAddress] ?? null) : Promise.resolve(null),
  ]);

  const findings = componentFindings({
    address,
    details,
    ownerCallers,
    ownerBadgeDetails: ownerBadge ? related[ownerBadge] : undefined,
    dappName: dapp ? metadataText(related[dapp], 'name') : '',
    packageRoyaltyBlueprints,
    holdings: held.map((resource) => ({ resource, details: related[resource] })),
    controls: origin?.controls ?? [],
    createdAt: origin?.createdAt,
  });

  return { info, findings, origin, ownerCallers, packageDetails, packageRoyaltyBlueprints };
}
