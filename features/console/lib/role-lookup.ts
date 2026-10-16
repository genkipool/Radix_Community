/**
 * Reads access rules and role assignments from Gateway entity details, reduced
 * to what the console can act on: anyone, nobody, a badge, or something more
 * complex. Shared by the pool and locker tools.
 */

/** Who a role resolves to, reduced to what the console can act on. */
export type RuleView =
  | { type: 'allowAll' }
  | { type: 'denyAll' }
  /** Any amount of this resource (fungible or non-fungible) satisfies it. */
  | { type: 'resource'; resource: string }
  /** One specific non-fungible satisfies it. */
  | { type: 'nonFungible'; resource: string; localId: string }
  /** Anything else (amounts, any-of/all-of, a component caller): readable, not actionable. */
  | { type: 'other' };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Gateway access rule → RuleView. The Gateway nests
 * `Protected → ProofRule → Require → Resource | NonFungible`.
 */
export function parseAccessRule(rule: unknown): RuleView {
  const r = obj(rule);
  if (r.type === 'AllowAll') return { type: 'allowAll' };
  if (r.type === 'DenyAll') return { type: 'denyAll' };
  if (r.type !== 'Protected') return { type: 'other' };

  const node = obj(r.access_rule);
  if (node.type !== 'ProofRule') return { type: 'other' };
  const proof = obj(node.proof_rule);
  if (proof.type !== 'Require') return { type: 'other' };
  const req = obj(proof.requirement);
  if (req.type === 'Resource' && str(req.resource)) return { type: 'resource', resource: str(req.resource) };
  if (req.type === 'NonFungible') {
    const nf = obj(req.non_fungible);
    const localId = str(obj(nf.local_id).simple_rep);
    if (str(nf.resource_address) && localId) {
      return { type: 'nonFungible', resource: str(nf.resource_address), localId };
    }
  }
  return { type: 'other' };
}

/** Rule of a Main-module role, resolving "Owner" to the owner rule. */
export function mainRoleRule(roleAssignments: Json, name: string, owner: RuleView): RuleView {
  const entry = arr(roleAssignments.entries)
    .map(obj)
    .find((e) => obj(e.role_key).name === name && obj(e.role_key).module === 'Main');
  if (!entry) return { type: 'other' };
  const assignment = obj(entry.assignment);
  return assignment.resolution === 'Owner' ? owner : parseAccessRule(assignment.explicit_rule);
}

/** The owner rule of an entity, and whether it can still change. */
export function ownerRule(entity: unknown): { rule: RuleView; updatable: boolean } {
  const owner = obj(obj(obj(obj(entity).details).role_assignments).owner);
  return { rule: parseAccessRule(owner.rule), updatable: owner.updater === 'Owner' || owner.updater === 'Object' };
}

/**
 * Whether a resource can leave the accounts that hold it. A resource whose
 * withdrawer role is DenyAll (a soulbound badge or credential) can never be
 * sent: taking it out of the account fails in the engine.
 */
export function canWithdraw(resource: unknown): boolean {
  const roles = obj(obj(obj(resource).details).role_assignments);
  return mainRoleRule(roles, 'withdrawer', ownerRule(resource).rule).type !== 'denyAll';
}

/**
 * The engine's global caller badge (`resource_…glcllr…`): a rule on it means
 * "only calls coming from this component", i.e. a smart contract manages the
 * entity, not a person with a badge.
 */
export const isGlobalCallerBadge = (resource: string) => /^resource_(rdx|tdx_2_)1nfxxxxxxxxxxglcllr/.test(resource);

/** The package-of-direct-caller badge (`…pkcllr…`): only code from one package can act. */
export const isPackageCallerBadge = (resource: string) => /^resource_(rdx|tdx_2_)1nfxxxxxxxxxxpkcllr/.test(resource);

/** Badge the rule asks for, when it is a plain badge the console can present. */
export function badgeOfRule(rule: RuleView): { resource: string; localId?: string } | null {
  if (rule.type === 'resource') return { resource: rule.resource };
  if (rule.type === 'nonFungible') return { resource: rule.resource, localId: rule.localId };
  return null;
}

interface HoldingLike {
  resourceAddress: string;
  ids?: string[];
}

/**
 * Whether an account's holdings satisfy a badge rule, and with which proof.
 * `localId` is set when a non-fungible must be named in the proof.
 */
export function heldBadgeFor(
  rule: RuleView,
  fungibles: HoldingLike[],
  nonFungibles: HoldingLike[],
): { resource: string; localId?: string } | null {
  const badge = badgeOfRule(rule);
  if (!badge) return null;
  if (badge.localId) {
    const held = nonFungibles.find((h) => h.resourceAddress === badge.resource && h.ids?.includes(badge.localId!));
    return held ? badge : null;
  }
  if (fungibles.some((h) => h.resourceAddress === badge.resource)) return { resource: badge.resource };
  const nf = nonFungibles.find((h) => h.resourceAddress === badge.resource && h.ids?.length);
  return nf ? { resource: badge.resource, localId: nf.ids![0] } : null;
}

