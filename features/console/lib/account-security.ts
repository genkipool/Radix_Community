/**
 * Who actually controls an account, decided from ledger state alone.
 *
 * A Radix account is governed by its owner role, and there are only two
 * answers the ledger ever gives:
 *
 *   · the rule requires a **signature virtual badge**: the account is its
 *     key. Whoever holds the seed phrase holds the account, and nothing can
 *     be recovered without it.
 *   · the rule requires the **account owner badge**: the account has been
 *     securified. The badge is an ordinary NFT, so the real question moves to
 *     where that NFT lives: inside an Access Controller (multi-factor, with
 *     recovery) or loose in some account (one transferable object away from
 *     losing everything).
 *
 * The badge's local id is not a lookup, it is arithmetic: it is the account's
 * own node id (`blueprint.rs` mints it with `NonFungibleLocalId::bytes` of the
 * account address). So from an address alone this module knows exactly which
 * NFT to ask about, and a caller only needs two Gateway reads.
 *
 * Everything here is pure: the adapters (the console hook, the MCP tool) fetch,
 * this decides. That is what keeps the browser and the agent answering the
 * same question the same way.
 */

import { accountAddressKind, addressNodeIdHex, type AccountAddressKind } from './address-inspect';

/* ─── Well-known resources ───────────────────────────────────────────────── */

/**
 * The three resources this module recognises, read from the network's own
 * `/status/network-configuration` rather than hardcoded: the keys are stable
 * across networks, the addresses are not.
 */
export interface SecurityWellKnown {
  accountOwnerBadge?: string;
  secp256k1SignatureVirtualBadge?: string;
  ed25519SignatureVirtualBadge?: string;
}

export const WELL_KNOWN_KEYS = {
  accountOwnerBadge: 'account_owner_badge',
  secp256k1SignatureVirtualBadge: 'secp256k1_signature_virtual_badge',
  ed25519SignatureVirtualBadge: 'ed25519_signature_virtual_badge',
} as const;

/** Picks the three addresses this module needs out of the well-known map. */
export const pickSecurityWellKnown = (
  wellKnown: Record<string, string> | undefined | null,
): SecurityWellKnown => ({
  accountOwnerBadge: wellKnown?.[WELL_KNOWN_KEYS.accountOwnerBadge],
  secp256k1SignatureVirtualBadge: wellKnown?.[WELL_KNOWN_KEYS.secp256k1SignatureVirtualBadge],
  ed25519SignatureVirtualBadge: wellKnown?.[WELL_KNOWN_KEYS.ed25519SignatureVirtualBadge],
});

/* ─── Reading the owner rule ─────────────────────────────────────────────── */

/** One `require(resource)` / `require(resource:#id#)` term of a rule. */
export interface BadgeRequirement {
  resource: string;
  /** Present when the term names one specific non-fungible. */
  localId?: string;
}

/**
 * An access rule, flattened to what a reader needs to judge it: how many of
 * the badges it lists are needed, and which badges those are.
 *
 * Composite rules are the normal case for a shield: the wallet writes its
 * factors as `CountOf(1, [factor, factor, factor])`, so a reader that only
 * understood a single `Require` would report a 1-of-3 shield as unreadable.
 */
export interface RuleSummary {
  kind: 'allowAll' | 'denyAll' | 'require' | 'anyOf' | 'allOf' | 'countOf' | 'unknown';
  /** How many of `badges` the rule demands; null when that is not a number. */
  threshold: number | null;
  badges: BadgeRequirement[];
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

/** Reads one `requirement` node into the badge it names. */
function requirementOf(node: unknown): BadgeRequirement | null {
  const requirement = asRecord(node);
  const nonFungible = asRecord(requirement.non_fungible);
  const resource =
    (nonFungible.resource_address as string | undefined) ??
    (requirement.resource_address as string | undefined);
  if (!resource) return null;
  const localId = asRecord(nonFungible.local_id).simple_rep as string | undefined;
  return localId ? { resource, localId } : { resource };
}

const PROOF_RULE_KINDS: Record<string, RuleSummary['kind']> = {
  Require: 'require',
  AnyOf: 'anyOf',
  AllOf: 'allOf',
  CountOf: 'countOf',
};

/**
 * Flattens the Gateway's `Protected → ProofRule → …` envelope.
 *
 * (`features/dashboard/utils/resourceUtils.extractRuleAddress` walks the same
 * JSON but flattens it to one display string and only handles the single-badge
 * case; the verdicts below need the terms apart and the composite rules too.)
 */
export function summariseAccessRule(rule: unknown): RuleSummary {
  const root = asRecord(rule);
  const ruleType = root.type as string | undefined;
  if (ruleType === 'AllowAll') return { kind: 'allowAll', threshold: null, badges: [] };
  if (ruleType === 'DenyAll') return { kind: 'denyAll', threshold: null, badges: [] };

  const proofRule = asRecord(asRecord(root.access_rule).proof_rule);
  const kind = PROOF_RULE_KINDS[proofRule.type as string] ?? 'unknown';

  const single = requirementOf(proofRule.requirement ?? root.requirement);
  if (single) return { kind: kind === 'unknown' ? 'require' : kind, threshold: 1, badges: [single] };

  const list = Array.isArray(proofRule.list) ? proofRule.list : [];
  const badges = list.map(requirementOf).filter((badge): badge is BadgeRequirement => !!badge);
  if (badges.length === 0) return { kind, threshold: null, badges: [] };

  const count = proofRule.count;
  const threshold =
    kind === 'allOf' ? badges.length : typeof count === 'number' ? count : kind === 'anyOf' ? 1 : null;
  return { kind, threshold, badges };
}

/** The single badge a rule requires, when it requires exactly one. */
export function badgeRequirementOf(rule: unknown): BadgeRequirement | null {
  const summary = summariseAccessRule(rule);
  return summary.badges.length === 1 ? summary.badges[0] : null;
}

/** What the account's owner role resolves to. */
export type OwnerControl =
  /** The account is its key: only that signature opens it. */
  | {
      kind: 'signature';
      curve: 'secp256k1' | 'ed25519';
      /** Hash of the controlling public key, as the rule states it. */
      publicKeyHash: string;
      /** Whether that hash is the one the address itself encodes. */
      matchesAddress: boolean;
    }
  /** The account has been securified: an NFT owns it. */
  | { kind: 'ownerBadge'; resource: string; localId: string }
  /** Any other rule: a custom badge, or several badges combined. */
  | { kind: 'custom'; summary: RuleSummary }
  | { kind: 'allowAll' }
  | { kind: 'denyAll' }
  | { kind: 'unknown' };

/**
 * Reads the owner role of an account.
 *
 * `address` is not decoration: for a key-controlled account the rule's local id
 * must be the public key hash the address itself encodes, and comparing the two
 * catches an account whose address and owner rule disagree.
 */
export function ownerControlOf(
  ownerRule: unknown,
  address: string,
  wellKnown: SecurityWellKnown,
): OwnerControl {
  const summary = summariseAccessRule(ownerRule);
  if (summary.kind === 'allowAll') return { kind: 'allowAll' };
  if (summary.kind === 'denyAll') return { kind: 'denyAll' };

  const requirement = summary.badges.length === 1 ? summary.badges[0] : null;
  if (!requirement) {
    return summary.badges.length > 1
      ? { kind: 'custom', summary }
      : { kind: 'unknown' };
  }

  const curve =
    requirement.resource === wellKnown.secp256k1SignatureVirtualBadge
      ? ('secp256k1' as const)
      : requirement.resource === wellKnown.ed25519SignatureVirtualBadge
        ? ('ed25519' as const)
        : null;

  if (curve) {
    const publicKeyHash = stripBrackets(requirement.localId ?? '');
    // The address is the entity-type byte followed by that same hash.
    const fromAddress = (addressNodeIdHex(address) ?? '').slice(2);
    return {
      kind: 'signature',
      curve,
      publicKeyHash,
      matchesAddress: publicKeyHash.length > 0 && publicKeyHash === fromAddress,
    };
  }

  if (requirement.resource === wellKnown.accountOwnerBadge && requirement.localId) {
    return { kind: 'ownerBadge', resource: requirement.resource, localId: requirement.localId };
  }

  return { kind: 'custom', summary };
}

const stripBrackets = (localId: string) => localId.replace(/^\[|\]$/g, '');

/* ─── The owner badge an account would use ───────────────────────────────── */

/**
 * The local id of the account owner badge for this account. It is computable
 * from the address, because the engine mints it as the bytes of the account's
 * node id. Lets a caller ask the Gateway where the badge is without first having to
 * find out that the badge exists.
 */
export function ownerBadgeLocalId(address: string): string | null {
  const hex = addressNodeIdHex(address);
  return hex ? `[${hex}]` : null;
}

/* ─── The verdict ────────────────────────────────────────────────────────── */

export type SecurityVerdict =
  /** Owner role is the key's signature: one seed phrase, no recovery. */
  | 'key'
  /** Securified, and the badge sits in an Access Controller. */
  | 'accessController'
  /** Securified, but the badge is loose in an ordinary account. */
  | 'badgeInAccount'
  /** Securified, and the badge is held by something else entirely. */
  | 'badgeElsewhere'
  /** Securified, but the badge could not be located. */
  | 'badgeUnknown'
  /** Owner role is AllowAll: anyone can act as the owner. */
  | 'open'
  /** Owner role is DenyAll or a rule this module does not model. */
  | 'other'
  /** Not an account address, or the state could not be read. */
  | 'unknown';

/**
 * How alarming a verdict is, decided here rather than in each surface so the
 * console and any other reader colour the same answer the same way.
 *
 * `key` is deliberately not "bad": it is the state every wallet account starts
 * in. A loose owner badge is worse than a key, because it adds transferability
 * without adding recovery.
 */
export const VERDICT_SEVERITY: Record<SecurityVerdict, 'good' | 'warn' | 'bad' | 'neutral'> = {
  accessController: 'good',
  key: 'warn',
  badgeInAccount: 'bad',
  badgeElsewhere: 'bad',
  open: 'bad',
  badgeUnknown: 'neutral',
  other: 'neutral',
  unknown: 'neutral',
};

/** A machine-readable finding, so UI and MCP describe the same facts. */
export type SecurityNote =
  /** The rule's key hash is not the one the address encodes. */
  | 'addressRuleMismatch'
  /** The owner badge is held by the very account it governs. */
  | 'badgeHeldBySelf'
  /** Securified with no controller: a single transferable NFT is the account. */
  | 'singleTransferableBadge'
  /** Key-derived from an Olympia (secp256k1) key. */
  | 'olympiaDerived'
  /** The badge lives in a vault whose owner the Gateway did not report. */
  | 'holderUnresolved';

/** Where the owner badge was found. */
export interface BadgeLocation {
  /** Vault holding it. */
  vault?: string;
  /** Global entity owning that vault, whatever its kind. */
  holder?: string;
  /** Entity kind of `holder`, from its bech32m prefix. */
  holderType?: string;
}

export interface AccountSecurity {
  address: string;
  /** Account flavour read from the address bytes (null when not an account). */
  accountKind: AccountAddressKind | null;
  ownerControl: OwnerControl;
  /** The badge that would govern this account once securified. */
  expectedBadge: BadgeRequirement | null;
  /** Where that badge actually is, when the account is securified. */
  badgeLocation: BadgeLocation | null;
  /** The Access Controller governing the account, when there is one. */
  controller: string | null;
  verdict: SecurityVerdict;
  notes: SecurityNote[];
}

export interface AssessInput {
  address: string;
  /** `details.role_assignments.owner.rule` from the Gateway. */
  ownerRule: unknown;
  wellKnown: SecurityWellKnown;
  /** Resolved only when the account turned out to be securified. */
  badgeLocation?: BadgeLocation | null;
}

/**
 * The whole decision, in one place: owner rule plus badge location in, verdict
 * out. Callers fetch in two steps (rule first, and the badge location only when
 * `ownerBadgeLocalId` turns out to be what the rule names), so this
 * tolerates `badgeLocation` being absent.
 */
export function assessAccountSecurity({
  address,
  ownerRule,
  wellKnown,
  badgeLocation = null,
}: AssessInput): AccountSecurity {
  const accountKind = accountAddressKind(address);
  const ownerControl = ownerControlOf(ownerRule, address, wellKnown);
  const notes: SecurityNote[] = [];

  if (accountKind === 'preallocated-secp256k1') notes.push('olympiaDerived');

  const base = {
    address,
    accountKind,
    ownerControl,
    expectedBadge: expectedBadgeFor(address, wellKnown),
    badgeLocation,
    controller: null as string | null,
  };

  switch (ownerControl.kind) {
    case 'signature': {
      if (!ownerControl.matchesAddress) notes.push('addressRuleMismatch');
      return { ...base, verdict: 'key', notes };
    }
    case 'allowAll':
      return { ...base, verdict: 'open', notes };
    case 'denyAll':
    case 'custom':
      return { ...base, verdict: 'other', notes };
    case 'unknown':
      return { ...base, verdict: 'unknown', notes };
    case 'ownerBadge':
      break;
  }

  const holder = badgeLocation?.holder;
  if (!holder) {
    if (badgeLocation) notes.push('holderUnresolved');
    return { ...base, verdict: 'badgeUnknown', notes };
  }

  if (holder.startsWith('accesscontroller_')) {
    return { ...base, controller: holder, verdict: 'accessController', notes };
  }

  notes.push('singleTransferableBadge');
  if (holder === address) notes.push('badgeHeldBySelf');
  return {
    ...base,
    verdict: holder.startsWith('account_') ? 'badgeInAccount' : 'badgeElsewhere',
    notes,
  };
}

/** The `resource:localId` pair whose whereabouts decide a securified account. */
export function expectedBadgeFor(
  address: string,
  wellKnown: SecurityWellKnown,
): BadgeRequirement | null {
  const localId = ownerBadgeLocalId(address);
  if (!localId || !wellKnown.accountOwnerBadge) return null;
  return { resource: wellKnown.accountOwnerBadge, localId };
}

/** Whether the verdict still needs the badge to be located. */
export const needsBadgeLocation = (control: OwnerControl) => control.kind === 'ownerBadge';

/* ─── Access Controller state ────────────────────────────────────────────── */

/** What the controller's own state and roles say about it. */
export interface ControllerConfig {
  address: string;
  /** Minutes before a timed recovery can be confirmed; null when disabled. */
  timedRecoveryDelayMinutes: number | null;
  /** A recovery proposal is in flight (by either the primary or recovery role). */
  recoveryInProgress: boolean;
  /** Someone is trying to pull the controlled badge out of the controller. */
  badgeWithdrawAttempt: boolean;
  /** The primary role has been locked out. */
  primaryRoleLocked: boolean;
  /** The controller can pay its own recovery fees. */
  hasFeeVault: boolean;
  /** The three roles, as the rules the ledger holds for them. */
  roles: {
    primary: RuleSummary | null;
    recovery: RuleSummary | null;
    confirmation: RuleSummary | null;
  };
}

const CONTROLLER_ROLES = ['primary', 'recovery', 'confirmation'] as const;

/**
 * Reads a controller's configuration from its entity details.
 *
 * Deliberately forgiving: this is context shown under a verdict that is already
 * decided, so a reshaped or unreadable state degrades to nulls rather than
 * failing the check that matters.
 */
export function controllerConfigOf(address: string, details: unknown): ControllerConfig {
  const detail = asRecord(asRecord(details).details ?? details);
  const state = asRecord(detail.state);
  const roleRules = explicitRoleRules(detail.role_assignments);

  return {
    address,
    timedRecoveryDelayMinutes:
      typeof state.timed_recovery_delay_minutes === 'number'
        ? state.timed_recovery_delay_minutes
        : null,
    recoveryInProgress:
      isSet(state.primary_role_recovery_attempt) || isSet(state.recovery_role_recovery_attempt),
    badgeWithdrawAttempt:
      state.has_primary_role_badge_withdraw_attempt === true ||
      state.has_recovery_role_badge_withdraw_attempt === true,
    primaryRoleLocked: state.is_primary_role_locked === true,
    hasFeeVault: isSet(state.xrd_fee_vault),
    roles: {
      primary: roleRules.get('primary') ?? null,
      recovery: roleRules.get('recovery') ?? null,
      confirmation: roleRules.get('confirmation') ?? null,
    },
  };
}

/** The explicit rule of each controller role, summarised. */
function explicitRoleRules(roleAssignments: unknown): Map<string, RuleSummary> {
  const entries = asRecord(roleAssignments).entries;
  const rules = new Map<string, RuleSummary>();
  if (!Array.isArray(entries)) return rules;

  for (const entry of entries as UnknownRecord[]) {
    const name = asRecord(entry.role_key).name as string | undefined;
    if (!name || !(CONTROLLER_ROLES as readonly string[]).includes(name)) continue;
    const explicit = asRecord(entry.assignment).explicit_rule;
    if (explicit) rules.set(name, summariseAccessRule(explicit));
  }
  return rules;
}

const isSet = (value: unknown) => value !== null && value !== undefined;
