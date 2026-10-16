/**
 * Who may deposit into an account, as the account itself stores it:
 *
 *   • the default rule: accept anything, accept only resources it already
 *     holds (AllowExisting), or reject everything;
 *   • exceptions per resource: always allowed, or always refused, whatever
 *     the default says;
 *   • authorised depositors: badges whose holder may deposit anything even
 *     when the rules would refuse it.
 *
 * These rules only stop third-party deposits (`try_deposit_*`). The owner's
 * own deposits (`deposit`, `deposit_batch`) always land. Read with the POST
 * function the caller brings (browser, MCP, tests); the manifest builder only
 * writes what differs from the current settings, so it is also an update.
 */

import type { GatewayPost } from './resource-holders';

export const DEFAULT_DEPOSIT_RULES = ['Accept', 'AllowExisting', 'Reject'] as const;
export type DefaultDepositRule = (typeof DEFAULT_DEPOSIT_RULES)[number];

export type ResourcePreference = 'Allowed' | 'Disallowed';

/** A badge allowed to deposit: any amount of a resource, or one specific NFT. */
export interface DepositorBadge {
  resource: string;
  /** Local id when one NFT of the collection is the badge. */
  nftId?: string;
}

export interface DepositSettings {
  defaultRule: DefaultDepositRule;
  /** Exceptions per resource. */
  preferences: Record<string, ResourcePreference>;
  depositors: DepositorBadge[];
}

const sameBadge = (a: DepositorBadge, b: DepositorBadge) => a.resource === b.resource && (a.nftId ?? '') === (b.nftId ?? '');

interface Page<T> {
  items?: T[];
  next_cursor?: string | null;
}

/** Every item of a paginated account endpoint. */
async function readAll<T>(post: GatewayPost, path: string, account: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await post<Page<T>>(path, { account_address: account, ...(cursor ? { cursor } : {}) });
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}

/** The account's deposit settings as the ledger has them now. */
export async function fetchDepositSettings(post: GatewayPost, account: string): Promise<DepositSettings> {
  const [details, preferences, depositors] = await Promise.all([
    post<{ items?: Array<{ details?: { state?: { default_deposit_rule?: string } } }> }>('/state/entity/details', { addresses: [account] }),
    readAll<{ resource_address: string; resource_preference_rule: string }>(post, '/state/account/page/resource-preferences', account),
    readAll<{ badge_type?: string; resource_address: string; non_fungible_id?: string }>(post, '/state/account/page/authorized-depositors', account),
  ]);
  const rule = details.items?.[0]?.details?.state?.default_deposit_rule;
  return {
    defaultRule: (DEFAULT_DEPOSIT_RULES as readonly string[]).includes(rule ?? '') ? (rule as DefaultDepositRule) : 'Accept',
    preferences: Object.fromEntries(
      preferences.map((p) => [p.resource_address, p.resource_preference_rule === 'Disallowed' ? 'Disallowed' : 'Allowed']),
    ),
    depositors: depositors.map((d) => ({ resource: d.resource_address, ...(d.non_fungible_id ? { nftId: d.non_fungible_id } : {}) })),
  };
}

const badgeArg = (badge: DepositorBadge) =>
  badge.nftId
    ? `Enum<ResourceOrNonFungible::NonFungible>(NonFungibleGlobalId("${badge.resource}:${badge.nftId}"))`
    : `Enum<ResourceOrNonFungible::Resource>(Address("${badge.resource}"))`;

const call = (account: string, method: string, ...args: string[]) => `CALL_METHOD
    Address("${account}")
    "${method}"${args.map((a) => `\n    ${a}`).join('')}
;
`;

/*
 * One instruction per account method. The console tool, the manifest
 * templates and the blocks all write them through here, so they never drift.
 */
export const setDefaultDepositRuleInstruction = (account: string, rule: DefaultDepositRule) =>
  call(account, 'set_default_deposit_rule', `Enum<DefaultDepositRule::${rule}>()`);

export const setResourcePreferenceInstruction = (account: string, resource: string, preference: ResourcePreference) =>
  call(account, 'set_resource_preference', `Address("${resource}")`, `Enum<ResourcePreference::${preference}>()`);

export const removeResourcePreferenceInstruction = (account: string, resource: string) =>
  call(account, 'remove_resource_preference', `Address("${resource}")`);

export const addAuthorizedDepositorInstruction = (account: string, badge: DepositorBadge) =>
  call(account, 'add_authorized_depositor', badgeArg(badge));

export const removeAuthorizedDepositorInstruction = (account: string, badge: DepositorBadge) =>
  call(account, 'remove_authorized_depositor', badgeArg(badge));

/**
 * Moves the account from `current` to `next` in one transaction, with a call
 * only for what changed. The account's owner signs it, which is what these
 * methods require. Returns '' when nothing changed.
 */
export function depositSettingsManifest(account: string, current: DepositSettings, next: DepositSettings): string {
  const calls: string[] = [];
  if (next.defaultRule !== current.defaultRule) calls.push(setDefaultDepositRuleInstruction(account, next.defaultRule));
  for (const [resource, preference] of Object.entries(next.preferences)) {
    if (current.preferences[resource] !== preference) calls.push(setResourcePreferenceInstruction(account, resource, preference));
  }
  for (const resource of Object.keys(current.preferences)) {
    if (!(resource in next.preferences)) calls.push(removeResourcePreferenceInstruction(account, resource));
  }
  for (const badge of next.depositors) {
    if (!current.depositors.some((b) => sameBadge(b, badge))) calls.push(addAuthorizedDepositorInstruction(account, badge));
  }
  for (const badge of current.depositors) {
    if (!next.depositors.some((b) => sameBadge(b, badge))) calls.push(removeAuthorizedDepositorInstruction(account, badge));
  }
  return calls.join('');
}
