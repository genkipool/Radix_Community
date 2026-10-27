/**
 * Who stands behind an engine caller badge.
 *
 * A role a DEX gives its pools reads "the global caller badge, id [hash]":
 * only calls coming from one component pass. The id is the Blake2b-256 hash
 * of the SBOR-encoded `GlobalCaller::GlobalObject(address)`, so it cannot be
 * read back into an address, only checked against candidates. The package
 * caller badge keeps the package's node id as it is, so that one decodes.
 */
import { blake2b } from 'blakejs';

import { decodeAddressNodeId, encodeAddress } from './address-inspect';
import type { GatewayPost } from './resource-holders';
import { entityRoles, isGlobalCallerBadge, isPackageCallerBadge, type RuleView } from './role-lookup';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Local id of the global caller badge of `address`, as the Gateway prints it (`[…]`). */
export function globalCallerId(address: string): string | null {
  const node = decodeAddressNodeId(address);
  if (!node) return null;
  // 5c = SBOR payload, 22 00 01 = enum variant 0 with one field, 80 = a Reference.
  return `[${toHex(blake2b(Uint8Array.from([0x5c, 0x22, 0x00, 0x01, 0x80, ...node]), undefined, 32))}]`;
}

/** Network part of a prefix: `rdx`, `tdx_2_`… */
const networkOf = (address: string) => {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  return hrp.slice(hrp.indexOf('_') + 1);
};

/** The package a package-of-direct-caller rule names, decoded from its id. */
export function packageOfCallerRule(rule: RuleView): string | null {
  if (rule.type !== 'nonFungible' || !isPackageCallerBadge(rule.resource)) return null;
  const hex = rule.localId.match(/^\[([0-9a-f]{60})\]$/i)?.[1];
  if (!hex) return null;
  const bytes = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  return encodeAddress(`package_${networkOf(rule.resource)}`, bytes);
}

/** The candidate whose global caller badge the rule asks for, or null. */
export function matchGlobalCaller(rule: RuleView, candidates: string[]): string | null {
  if (rule.type !== 'nonFungible' || !isGlobalCallerBadge(rule.resource)) return null;
  const want = rule.localId.toLowerCase();
  return candidates.find((c) => globalCallerId(c) === want) ?? null;
}

/**
 * The component behind a global caller rule on `entity`. The component that
 * created the entity is in its first transaction, so that one is checked:
 * the hash confirms the match, nothing is guessed.
 */
export async function findGlobalCaller(post: GatewayPost, entity: string, rules: RuleView[]): Promise<Record<string, string>> {
  const wanted = rules.filter((r) => r.type === 'nonFungible' && isGlobalCallerBadge(r.resource));
  if (!wanted.length) return {};
  const page = await post<{ items?: { affected_global_entities?: string[] }[] }>('/stream/transactions', {
    affected_global_entities_filter: [entity],
    order: 'Asc',
    limit_per_page: 1,
    opt_ins: { affected_global_entities: true },
  });
  const candidates = (page.items?.[0]?.affected_global_entities ?? []).filter((a) => !a.startsWith('resource_'));
  const found: Record<string, string> = {};
  for (const rule of wanted) {
    const match = matchGlobalCaller(rule, candidates);
    if (match && rule.type === 'nonFungible') found[rule.localId] = match;
  }
  return found;
}

/** When an entity appeared, when it was last used, and what its first transaction made it the caller of. */
export interface EntityOrigin {
  createdAt: string | null;
  lastActivityAt: string | null;
  /** Entities of its first transaction whose roles ask for its global caller badge. */
  controls: string[];
}

type StreamPage = { items?: { confirmed_at?: string | null; affected_global_entities?: string[] }[] };

/** Entities read from the first transaction, at most. */
const MAX_CONTROLLED = 40;
const DETAILS_BATCH = 20;

/**
 * Where a component comes from: its first and latest transactions, and which
 * of the entities created with it answer to it. Those entities' roles ask for
 * the component's global caller badge, which the hash confirms; entities it
 * came to control later are not in that first transaction, so not listed.
 */
export async function entityOrigin(post: GatewayPost, entity: string): Promise<EntityOrigin> {
  const stream = (order: 'Asc' | 'Desc') =>
    post<StreamPage>('/stream/transactions', {
      affected_global_entities_filter: [entity],
      order,
      limit_per_page: 1,
      opt_ins: { affected_global_entities: order === 'Asc' },
    });
  const [first, last] = await Promise.all([stream('Asc'), stream('Desc')]);
  const id = globalCallerId(entity);
  const candidates = (first.items?.[0]?.affected_global_entities ?? [])
    .filter((a) => a !== entity && !a.startsWith('account_') && !isGlobalCallerBadge(a) && !isPackageCallerBadge(a))
    .slice(0, MAX_CONTROLLED);
  const controls: string[] = [];
  for (let i = 0; i < candidates.length && id; i += DETAILS_BATCH) {
    const page = await post<{ items: unknown[] }>('/state/entity/details', { addresses: candidates.slice(i, i + DETAILS_BATCH) });
    for (const item of page.items ?? []) {
      const answersToIt = entityRoles(item).some(
        (r) => r.rule.type === 'nonFungible' && isGlobalCallerBadge(r.rule.resource) && r.rule.localId.toLowerCase() === id,
      );
      const address = (item as { address?: string }).address;
      if (answersToIt && address) controls.push(address);
    }
  }
  return {
    createdAt: first.items?.[0]?.confirmed_at ?? null,
    lastActivityAt: last.items?.[0]?.confirmed_at ?? null,
    controls,
  };
}
