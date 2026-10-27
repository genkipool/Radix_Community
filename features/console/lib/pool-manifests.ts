/**
 * Manifest builders for the native pool blueprints (OneResourcePool,
 * TwoResourcePool, MultiResourcePool).
 *
 * Who can do what is fixed by the engine, not by the pool's creator:
 *   • contribute, protected_deposit and protected_withdraw need the pool
 *     manager role. Whoever holds it can move the reserves at will.
 *   • redeem, get_redemption_value and get_vault_amounts are public.
 *   • the owner role sets the metadata of the pool AND of its pool unit, which
 *     the engine creates with the same owner role.
 *
 * So the manager rule is the pool's whole security. These builders never emit
 * AllowAll for it: a pool is always guarded by a badge, either one minted in
 * the same transaction or one the creator already holds.
 *
 * Shared by the console's pool tools, the build-manifest templates and the MCP
 * server, so the three cannot drift apart.
 */

import { inspectAddress } from './address-inspect';
import { buildBadgeProofManifest } from './badge-proof-manifest';
import { escapeManifestString as escape } from './manifest-escape';
import { setStringArrayMetadata, setStringMetadata, setUrlMetadata } from './metadata-manifests';

export const POOL_KINDS = ['one', 'two', 'multi'] as const;
export type PoolKind = (typeof POOL_KINDS)[number];

/** Blueprint name in the pool package for each kind. */
export const POOL_BLUEPRINTS: Record<PoolKind, string> = {
  one: 'OneResourcePool',
  two: 'TwoResourcePool',
  multi: 'MultiResourcePool',
};

export const poolKindOfBlueprint = (blueprint: string | undefined): PoolKind | null =>
  (Object.entries(POOL_BLUEPRINTS).find(([, name]) => name === blueprint)?.[0] as PoolKind) ?? null;

/** How many resources each kind holds (multi: at least two, no upper bound). */
export const poolResourceCount = (kind: PoolKind, count: number) =>
  kind === 'one' ? count === 1 : kind === 'two' ? count === 2 : count >= 2;

/** Who manages a new pool. */
export type PoolManager =
  /** Mint a fresh badge (supply 1, never mintable again) in the same transaction. */
  | { mode: 'newBadge'; badgeName: string; badgeSymbol?: string; badgeDescription?: string; badgeIconUrl?: string }
  /** Guard the pool with a badge resource the creator already holds. */
  | { mode: 'existingBadge'; resource: string };

/** Proof of the manager (or owner) badge, taken from the account that holds it. */
export interface PoolBadgeProof {
  account: string;
  resource: string;
  /** Local id when the badge is a non-fungible; empty for a fungible badge. */
  nonFungibleId?: string;
}

export interface PoolPackages {
  pool: string;
  resource: string;
}

/** Name of the address the new badge gets inside the manifest. */
const BADGE_NAME = 'pool_manager_badge';

/**
 * Everything left on the worktop goes back to the signing account. The signer
 * owns that account, so `deposit_batch` (owner-only) is authorised by the
 * signature itself and works even when the account refuses third-party
 * deposits, where a `try_deposit_*` would abort.
 */
const DEPOSIT_ALL = (account: string) => `
CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;

/**
 * `Protected(BasicRequirement(Require(Resource(<badge>))))`, in the numeric
 * form the rest of the console uses. Holding any amount of the badge resource
 * satisfies it, so it works for fungible and non-fungible badges alike.
 */
const requireResource = (badge: string) =>
  `Enum<2u8>(Enum<0u8>(Enum<0u8>(Enum<1u8>(${badge}))))`;

/** Network part of an address's prefix: `rdx`, `tdx_2_`, `sim`… */
const networkOf = (address: string) => {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  return hrp.slice(hrp.indexOf('_') + 1);
};

/**
 * Whether `address` is a well-formed address of the given kind: valid bech32m
 * checksum, canonical lowercase, nothing around it. Addresses go into the
 * manifest unquoted by any escaping, so this is what keeps a pasted
 * `resource_…")` from closing the literal and adding instructions.
 */
export function isManifestAddress(address: string, prefix: 'account_' | 'resource_' | 'package_'): boolean {
  if (!address.startsWith(prefix) || !/^[a-z0-9_]+$/.test(address)) return false;
  return !!inspectAddress(address)?.checksumValid;
}

/** A template placeholder such as `{account}`: it cannot carry a quote. */
const isPlaceholder = (value: string) => /^\{[a-zA-Z_]+\}$/.test(value);

/** Throws unless every address is well formed and on the account's network. */
function assertPoolAddresses({ account, resources, manager, packages }: CreatePoolInput) {
  const checks: Array<[string, string, Parameters<typeof isManifestAddress>[1]]> = [
    ['account', account, 'account_'],
    ...resources.map((r, i): [string, string, 'resource_'] => [`resource ${i + 1}`, r, 'resource_']),
    ['pool package', packages.pool, 'package_'],
    ['resource package', packages.resource, 'package_'],
  ];
  if (manager.mode === 'existingBadge') checks.push(['manager badge', manager.resource, 'resource_']);
  const network = isPlaceholder(account) ? null : networkOf(account);
  for (const [label, address, prefix] of checks) {
    if (label === 'account' && isPlaceholder(address)) continue;
    if (!isManifestAddress(address, prefix)) throw new Error(`The ${label} "${address}" is not a valid ${prefix.slice(0, -1)} address.`);
    if (network !== null && networkOf(address) !== network) throw new Error(`The ${label} "${address}" is on another network.`);
  }
}

/** The pool's own public profile, written in the creating transaction. */
export interface PoolProfileInit {
  name?: string;
  description?: string;
  iconUrl?: string;
  infoUrl?: string;
}

export interface CreatePoolInput {
  account: string;
  kind: PoolKind;
  resources: string[];
  manager: PoolManager;
  packages: PoolPackages;
  /** Optional: name, description, icon and web of the pool, set in the same transaction. */
  profile?: PoolProfileInit;
}

/** A metadata entry for a resource's initial metadata map; empty values are left out. */
const initEntry = (key: string, value: string | undefined, kind: 'String' | 'Url') =>
  value?.trim() ? `,\n            "${key}" => Tuple(Some(Enum<Metadata::${kind}>("${escape(value.trim())}")), true)` : '';

/**
 * Instantiates a pool whose manager role AND owner role are the badge.
 *
 * With a new badge the manifest reserves the badge address first, mints the
 * badge into that reservation, and references it by name in both rules, so the
 * badge and the pool are created atomically: nobody can see the pool before it
 * is guarded. The badge lands in the creator's account.
 *
 * Throws when an address is malformed or on another network. Whether an
 * existing badge is safe to use is a ledger question: see `pool-safety`.
 */
export function createPoolManifest(input: CreatePoolInput): string {
  assertPoolAddresses(input);
  const { account, kind, resources, manager, packages, profile } = input;
  const badgeRef =
    manager.mode === 'newBadge' ? `NamedAddress("${BADGE_NAME}")` : `Address("${manager.resource}")`;
  const rule = requireResource(badgeRef);

  const mintBadge =
    manager.mode === 'newBadge'
      ? `
ALLOCATE_GLOBAL_ADDRESS
    Address("${packages.resource}")
    "FungibleResourceManager"
    AddressReservation("${BADGE_NAME}_reservation")
    NamedAddress("${BADGE_NAME}")
;
CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<OwnerRole::None>()
    true
    0u8
    Decimal("1")
    Tuple(None, None, None, None, None, None)
    Tuple(
        Map<String, Tuple>(
            "name" => Tuple(Some(Enum<Metadata::String>("${escape(manager.badgeName)}")), true),
            "tags" => Tuple(Some(Enum<Metadata::StringArray>(Array<String>("badge"))), true)${initEntry('symbol', manager.badgeSymbol, 'String')}${initEntry('description', manager.badgeDescription, 'String')}${initEntry('icon_url', manager.badgeIconUrl, 'Url')}
        ),
        Map<String, Enum>()
    )
    Some(AddressReservation("${BADGE_NAME}_reservation"))
;
`
      : '';

  const addresses = resources.map((resource) => `Address("${resource}")`);
  const resourcesArg =
    kind === 'one'
      ? addresses[0] ?? 'Address("")'
      : kind === 'two'
        ? `Tuple(${addresses.join(', ')})`
        : `Array<Address>(${addresses.join(', ')})`;

  // The pool's profile: its address is reserved up front so the same
  // transaction can write to it, proving the owner badge from the account
  // (a new badge is deposited first: a method argument can name a reserved
  // address, a worktop instruction cannot).
  const entries = [
    ['name', profile?.name, 'String'],
    ['description', profile?.description, 'String'],
    ['icon_url', profile?.iconUrl, 'Url'],
    ['info_url', profile?.infoUrl, 'Url'],
  ].filter(([, value]) => value?.trim()) as Array<[string, string, 'String' | 'Url']>;
  const withProfile = entries.length > 0;
  const reservePool = withProfile
    ? `
ALLOCATE_GLOBAL_ADDRESS
    Address("${packages.pool}")
    "${POOL_BLUEPRINTS[kind]}"
    AddressReservation("pool_reservation")
    NamedAddress("pool")
;`
    : '';
  const writeProfile = withProfile
    ? `${manager.mode === 'newBadge' ? DEPOSIT_ALL(account) : ''}
CALL_METHOD
    Address("${account}")
    "create_proof_of_amount"
    ${badgeRef}
    Decimal("1")
;
${entries
  .map(
    ([key, value, type]) => `SET_METADATA
    NamedAddress("pool")
    "${key}"
    Enum<Metadata::${type}>("${escape(value.trim())}")
;`,
  )
  .join('\n')}
`
    : '';

  return `${mintBadge}${reservePool}
CALL_FUNCTION
    Address("${packages.pool}")
    "${POOL_BLUEPRINTS[kind]}"
    "instantiate"
    Enum<OwnerRole::Updatable>(${rule})
    ${rule}
    ${resourcesArg}
    ${withProfile ? 'Some(AddressReservation("pool_reservation"))' : 'None'}
;
${writeProfile}${manager.mode === 'newBadge' && !withProfile ? DEPOSIT_ALL(account) : ''}`;
}

/** Withdraws `amount` of `resource` from the account into a named bucket. */
const withdrawToBucket = (account: string, resource: string, amount: string, bucket: string) => `
CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${amount}")
;
TAKE_FROM_WORKTOP
    Address("${resource}")
    Decimal("${amount}")
    Bucket("${bucket}")
;`;

/**
 * The badge proof a gated call needs. Null only for a pool whose role is
 * AllowAll (a vulnerable pool): its owner must still be able to act on it, for
 * instance to move the reserves out before someone else does.
 */
const proofOf = (badge: PoolBadgeProof | null | undefined) =>
  badge
    ? buildBadgeProofManifest([
        { accountAddress: badge.account, resourceAddress: badge.resource, nonFungibleId: badge.nonFungibleId || undefined },
      ])
    : '';

export interface PoolContribution {
  resource: string;
  amount: string;
}

export interface ContributeInput {
  account: string;
  pool: string;
  kind: PoolKind;
  contributions: PoolContribution[];
  manager: PoolBadgeProof | null;
}

/**
 * Adds liquidity and receives pool units. Needs the manager badge.
 *
 * The engine takes the reserves in the pool's current ratio and hands back
 * whatever does not fit, so the change and the pool units both go back to the
 * account. On an empty pool the first contribution sets the ratio.
 */
export function contributeManifest({ account, pool, kind, contributions, manager }: ContributeInput): string {
  const buckets = contributions.map((_, i) => `contribution_${i + 1}`);
  const withdrawals = contributions
    .map((c, i) => withdrawToBucket(account, c.resource, c.amount, buckets[i]))
    .join('');
  const refs = buckets.map((b) => `Bucket("${b}")`);
  const arg =
    kind === 'one' ? refs[0] : kind === 'two' ? `Tuple(${refs.join(', ')})` : `Array<Bucket>(${refs.join(', ')})`;

  return `${proofOf(manager)}${withdrawals}
CALL_METHOD
    Address("${pool}")
    "contribute"
    ${arg}
;
${DEPOSIT_ALL(account)}`;
}

export interface ReserveMoveInput {
  account: string;
  pool: string;
  kind: PoolKind;
  resource: string;
  amount: string;
  manager: PoolBadgeProof | null;
}

/**
 * Puts tokens into the reserves without minting pool units: every holder's
 * units become worth more. This is how fees or rewards reach a pool.
 */
export function protectedDepositManifest({ account, pool, resource, amount, manager }: ReserveMoveInput): string {
  return `${proofOf(manager)}${withdrawToBucket(account, resource, amount, 'reserve_deposit')}
CALL_METHOD
    Address("${pool}")
    "protected_deposit"
    Bucket("reserve_deposit")
;
`;
}

/**
 * Takes tokens out of the reserves without burning pool units: every holder's
 * units become worth less. The strategy is `Exact` (`Enum<0u8>()`, the manifest
 * parser rejects the named form): precisely `amount` leaves the pool.
 */
export function protectedWithdrawManifest({ account, pool, kind, resource, amount, manager }: ReserveMoveInput): string {
  return `${proofOf(manager)}${withdrawCall(pool, kind, resource, amount)}
${DEPOSIT_ALL(account)}`;
}

/**
 * `protected_withdraw` for one reserve. A one-resource pool has a single vault,
 * so its method takes no resource address: (amount, strategy). The two- and
 * multi-resource ones take (resource, amount, strategy).
 */
const withdrawCall = (pool: string, kind: PoolKind, resource: string, amount: string) => `
CALL_METHOD
    Address("${pool}")
    "protected_withdraw"${kind === 'one' ? '' : `\n    Address("${resource}")`}
    Decimal("${amount}")
    Enum<0u8>()
;`;

export interface ReserveMovesInput {
  account: string;
  pool: string;
  kind: PoolKind;
  direction: 'deposit' | 'withdraw';
  /** One entry per resource to move; empty or zero amounts are left out. */
  moves: Array<{ resource: string; amount: string }>;
  manager: PoolBadgeProof | null;
}

/**
 * Several reserves moved in one transaction, under one proof of the manager
 * badge: protected_deposit or protected_withdraw for each resource with an
 * amount. Withdrawn tokens all go back to the account at the end. Returns ''
 * when no resource has an amount.
 */
export function reserveMovesManifest({ account, pool, kind, direction, moves, manager }: ReserveMovesInput): string {
  const chosen = moves.filter((m) => Number(m.amount) > 0);
  if (!chosen.length) return '';
  if (direction === 'withdraw') {
    return `${proofOf(manager)}${chosen.map((m) => withdrawCall(pool, kind, m.resource, m.amount)).join('')}
${DEPOSIT_ALL(account)}`;
  }
  return (
    proofOf(manager) +
    chosen
      .map(
        (m, i) => `${withdrawToBucket(account, m.resource, m.amount, `reserve_deposit_${i + 1}`)}
CALL_METHOD
    Address("${pool}")
    "protected_deposit"
    Bucket("reserve_deposit_${i + 1}")
;`,
      )
      .join('') +
    '\n'
  );
}

export interface RedeemInput {
  account: string;
  pool: string;
  poolUnit: string;
  amount: string;
}

/** Burns pool units for their share of the reserves. Public: no badge. */
export function redeemManifest({ account, pool, poolUnit, amount }: RedeemInput): string {
  return `${withdrawToBucket(account, poolUnit, amount, 'pool_units')}
CALL_METHOD
    Address("${pool}")
    "redeem"
    Bucket("pool_units")
;
${DEPOSIT_ALL(account)}`;
}

export interface PoolProfileFields {
  name?: string;
  description?: string;
  iconUrl?: string;
  infoUrl?: string;
}

export interface PoolProfileUnitFields extends PoolProfileFields {
  symbol?: string;
}

export interface PoolProfileInput {
  owner: PoolBadgeProof | null;
  pool: string;
  poolUnit: string;
  poolFields: PoolProfileFields;
  unitFields: PoolProfileUnitFields;
}

const profileInstructions = (address: string, fields: PoolProfileUnitFields) =>
  [
    fields.name?.trim() && setStringMetadata(address, 'name', fields.name.trim()),
    fields.symbol?.trim() && setStringMetadata(address, 'symbol', fields.symbol.trim()),
    fields.description?.trim() && setStringMetadata(address, 'description', fields.description.trim()),
    fields.iconUrl?.trim() && setUrlMetadata(address, 'icon_url', fields.iconUrl.trim()),
    fields.infoUrl?.trim() && setUrlMetadata(address, 'info_url', fields.infoUrl.trim()),
  ]
    .filter(Boolean)
    .join('');

/**
 * Writes the pool's and its pool unit's public metadata. Only the fields that
 * carry a value emit an instruction, so this is an update, never a reset.
 * Returns '' when there is nothing to write.
 */
export function poolProfileManifest({ owner, pool, poolUnit, poolFields, unitFields }: PoolProfileInput): string {
  const body = profileInstructions(pool, poolFields) + profileInstructions(poolUnit, unitFields);
  return body ? proofOf(owner) + body : '';
}

/** The tag a retired pool and its pool unit carry, so wallets and explorers can tell. */
export const RETIRED_TAG = 'retired';

export interface ManagePoolInput {
  account: string;
  pool: string;
  kind: PoolKind;
  poolUnit: string;
  /** Reserve per resource; only the non-empty ones are withdrawn. */
  reserves: Record<string, string>;
  manager: PoolBadgeProof | null;
  owner: PoolBadgeProof | null;
  /** Take every reserve out to the account (manager role). */
  empty?: boolean;
  /** Add the retired tag to the pool and its pool unit, keeping their current tags (owner role). */
  retire?: { poolTags: string[]; unitTags: string[] };
  /** Freeze the profile and the owner role of the pool and of its pool unit for good (owner role). */
  lockOwner?: boolean;
}

/**
 * The public profile keys a wallet shows. Locking the owner role alone only
 * stops the role from changing hands: the owner could still rewrite the
 * metadata. So each key is locked too, set or not, which freezes it as it is.
 */
const PROFILE_KEYS = ['name', 'symbol', 'description', 'icon_url', 'info_url', 'tags'];

const withRetiredTag = (tags: string[]) => [...tags.filter((tag) => tag !== RETIRED_TAG), RETIRED_TAG];

/**
 * Winds a pool down in one transaction: empties the reserves, tags the pool
 * and its unit as retired, and locks their owner role. Each step is optional.
 *
 * The order matters: the tags are written before the profile is locked.
 * Locking freezes every profile key and the owner role, so nobody can change
 * the pool's public identity again. The manager role of a native pool
 * cannot be locked or changed (the engine gives it no updater), so the badge
 * still guards contribute and the reserve calls afterwards. Emptying does not
 * burn pool units: whoever else holds units is left with a claim on nothing.
 * Returns '' when no step is chosen.
 */
export function managePoolManifest({
  account,
  pool,
  kind,
  poolUnit,
  reserves,
  manager,
  owner,
  empty,
  retire,
  lockOwner,
}: ManagePoolInput): string {
  const toEmpty = empty ? Object.entries(reserves).filter(([, amount]) => Number(amount) > 0) : [];
  const needsOwner = !!retire || !!lockOwner;
  if (!toEmpty.length && !needsOwner) return '';

  const withdrawals = toEmpty.map(([resource, amount]) => withdrawCall(pool, kind, resource, amount)).join('');
  const emptying = toEmpty.length ? `${proofOf(manager)}${withdrawals}\n${DEPOSIT_ALL(account)}` : '';

  // One badge often fills both roles: its proof is already in the auth zone.
  const sameBadge = !!manager && !!owner && toEmpty.length > 0 && manager.resource === owner.resource;
  const ownerProof = needsOwner && !sameBadge ? proofOf(owner) : '';
  const tags = retire
    ? setStringArrayMetadata(pool, 'tags', withRetiredTag(retire.poolTags)) +
      setStringArrayMetadata(poolUnit, 'tags', withRetiredTag(retire.unitTags))
    : '';
  const lock = lockOwner
    ? [pool, poolUnit]
        .map(
          (address) =>
            PROFILE_KEYS.map(
              (key) => `
LOCK_METADATA
    Address("${address}")
    "${key}"
;`,
            ).join('') +
            `
LOCK_OWNER_ROLE
    Address("${address}")
;`,
        )
        .join('') + '\n'
    : '';

  return `${emptying}${ownerProof}${tags}${lock}`;
}
