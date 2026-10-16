/**
 * Manifest builders for the native AccountLocker blueprint: the correct way
 * to airdrop on Radix.
 *
 * A plain transfer fails for every recipient whose account refuses unknown
 * deposits. A locker keeps those tokens in the recipient's name until they
 * claim them, and with `try_direct_send` it still delivers straight away to
 * every account that accepts the deposit.
 *
 * Roles, as `instantiate_simple` sets them: the badge it mints is the owner,
 * the storer (store, airdrop) and, when recovery is allowed, the recoverer.
 * Claiming is open to the claimant account alone: the engine checks the
 * account's owner rule, so the wallet's signature is the authorisation.
 *
 * Shared by the console's locker tools and the MCP server.
 */

import { buildBadgeProofManifest } from './badge-proof-manifest';
import { sumDecimals } from './decimal';

export interface LockerBadgeProof {
  account: string;
  resource: string;
  nonFungibleId?: string;
}

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

const proofOf = (badge: LockerBadgeProof) =>
  buildBadgeProofManifest([
    { accountAddress: badge.account, resourceAddress: badge.resource, nonFungibleId: badge.nonFungibleId || undefined },
  ]);

/**
 * Creates a locker and sends its badge (owner + storer + recoverer) to the
 * account. Without recovery, nothing stored can ever come back to the sender:
 * it stays claimable by its recipient forever.
 */
export function createLockerManifest({
  account,
  allowRecover,
  lockerPackage,
}: {
  account: string;
  allowRecover: boolean;
  lockerPackage: string;
}): string {
  return `CALL_FUNCTION
    Address("${lockerPackage}")
    "AccountLocker"
    "instantiate_simple"
    ${allowRecover}
;
${DEPOSIT_ALL(account)}`;
}

/** One recipient of an airdrop: an amount of a fungible, or specific NFTs. */
export interface LockerClaimant {
  account: string;
  amount?: string;
  nftIds?: string[];
}

/** `ResourceSpecifier`: `Fungible(Decimal)` is 0u8, `NonFungible(ids)` is 1u8. */
const specifier = (c: LockerClaimant) =>
  c.nftIds?.length
    ? `Enum<1u8>(Array<NonFungibleLocalId>(${c.nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ')}))`
    : `Enum<0u8>(Decimal("${c.amount}"))`;

export interface AirdropInput {
  /** Account that holds the tokens and the locker badge. */
  account: string;
  locker: string;
  badge: LockerBadgeProof;
  resource: string;
  claimants: LockerClaimant[];
  /**
   * Deliver straight to every account that accepts the deposit; only the
   * refusals stay in the locker. Off: everything waits to be claimed.
   */
  tryDirectSend: boolean;
}

/**
 * Airdrops one resource to many accounts in one call. The locker takes one
 * bucket with the whole amount and splits it by the claimant map.
 */
export function airdropManifest({ account, locker, badge, resource, claimants, tryDirectSend }: AirdropInput): string {
  const nft = claimants.some((c) => c.nftIds?.length);
  const withdraw = nft
    ? `CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(${claimants.flatMap((c) => c.nftIds ?? []).map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`
    : `CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${sumDecimals(claimants.map((c) => c.amount ?? '0'))}")
;`;

  const entries = claimants.map((c) => `        Address("${c.account}") => ${specifier(c)}`).join(',\n');

  return `${proofOf(badge)}${withdraw}
TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("airdrop")
;
CALL_METHOD
    Address("${locker}")
    "airdrop"
    Map<Address, Enum>(
${entries}
    )
    Bucket("airdrop")
    ${tryDirectSend}
;
${DEPOSIT_ALL(account)}`;
}

export interface RecoverInput {
  account: string;
  locker: string;
  badge: LockerBadgeProof;
  claimant: string;
  resource: string;
  amount?: string;
  nftIds?: string[];
}

/** Takes back what is stored for a claimant (only when the locker allows recovery). */
export function recoverManifest({ account, locker, badge, claimant, resource, amount, nftIds }: RecoverInput): string {
  const call = nftIds?.length
    ? `CALL_METHOD
    Address("${locker}")
    "recover_non_fungibles"
    Address("${claimant}")
    Address("${resource}")
    Array<NonFungibleLocalId>(${nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`
    : `CALL_METHOD
    Address("${locker}")
    "recover"
    Address("${claimant}")
    Address("${resource}")
    Decimal("${amount}")
;`;
  return `${proofOf(badge)}${call}
${DEPOSIT_ALL(account)}`;
}

export interface ClaimInput {
  /** The claimant: the account the tokens were stored for, and where they go. */
  account: string;
  locker: string;
  claims: Array<{ resource: string; amount?: string; nftIds?: string[] }>;
}

/** The claim calls for one locker; what they return stays on the worktop. */
const claimCalls = (account: string, locker: string, claims: ClaimInput['claims']) =>
  claims
    .map((c) =>
      c.nftIds?.length
        ? `CALL_METHOD
    Address("${locker}")
    "claim_non_fungibles"
    Address("${account}")
    Address("${c.resource}")
    Array<NonFungibleLocalId>(${c.nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`
        : `CALL_METHOD
    Address("${locker}")
    "claim"
    Address("${account}")
    Address("${c.resource}")
    Decimal("${c.amount}")
;`,
    )
    .join('\n');

/**
 * Claims stored tokens into the claimant's own account. The engine checks the
 * account's owner rule, which the wallet satisfies by signing with it.
 */
export function claimManifest({ account, locker, claims }: ClaimInput): string {
  return claimFromLockersManifest({ account, lockers: [{ locker, claims }] });
}

/**
 * Claims from several lockers in one transaction: every claim lands on the
 * worktop and one deposit at the end puts it all in the account. Lockers with
 * nothing to claim are left out.
 */
export function claimFromLockersManifest({
  account,
  lockers,
}: {
  account: string;
  lockers: Array<{ locker: string; claims: ClaimInput['claims'] }>;
}): string {
  const calls = lockers
    .filter((l) => l.claims.length > 0)
    .map((l) => claimCalls(account, l.locker, l.claims))
    .join('\n');
  return calls ? `${calls}
${DEPOSIT_ALL(account)}` : '';
}

/* ─── Create and airdrop in one transaction ───────────────────────────────── */

const requireBadge = (badge: string) => `Enum<AccessRule::Protected>(
        Enum<AccessRuleNode::ProofRule>(
            Enum<ProofRule::Require>(
                Enum<ResourceOrNonFungible::Resource>(
                    ${badge}
                )
            )
        )
    )`;

export interface CreateAndAirdropInput {
  account: string;
  allowRecover: boolean;
  lockerPackage: string;
  resourcePackage: string;
  /** The first batch: one resource, up to a batch's worth of claimants. */
  resource: string;
  claimants: LockerClaimant[];
  tryDirectSend: boolean;
}

/**
 * Creates a locker and runs the first airdrop batch with it, in one
 * transaction and one signature.
 *
 * `instantiate_simple` cannot be used here: it returns the new locker, but a
 * manifest has no way to call a component it did not name. So both addresses
 * are reserved up front (the locker's and its badge's), the badge is minted
 * into the reserved address, and the locker is instantiated with the same
 * roles `instantiate_simple` gives it: the badge is owner and storer, and
 * recoverer only when recovery is allowed. The badge goes into the account
 * (a worktop instruction cannot name a reserved address, a method argument
 * can), the account proves it, and the airdrop calls the locker by its
 * reserved name. If any step fails, nothing is
 * created and nothing leaves the account.
 */
export function createLockerAndAirdropManifest(input: CreateAndAirdropInput): string {
  const { account, allowRecover, lockerPackage, resourcePackage, resource, claimants, tryDirectSend } = input;
  const badge = 'NamedAddress("badge")';
  const rule = requireBadge(badge);
  const recoverRule = allowRecover ? rule : 'Enum<AccessRule::DenyAll>()';
  const nft = claimants.some((c) => c.nftIds?.length);
  const withdraw = nft
    ? `CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(${claimants.flatMap((c) => c.nftIds ?? []).map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`
    : `CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${sumDecimals(claimants.map((c) => c.amount ?? '0'))}")
;`;
  const entries = claimants.map((c) => `        Address("${c.account}") => ${specifier(c)}`).join(',\n');

  return `ALLOCATE_GLOBAL_ADDRESS
    Address("${lockerPackage}")
    "AccountLocker"
    AddressReservation("locker_reservation")
    NamedAddress("locker")
;
ALLOCATE_GLOBAL_ADDRESS
    Address("${resourcePackage}")
    "FungibleResourceManager"
    AddressReservation("badge_reservation")
    NamedAddress("badge")
;
CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<OwnerRole::Updatable>(
    ${rule}
    )
    true
    0u8
    Decimal("1")
    Tuple(
        None,
        None,
        None,
        None,
        None,
        None
    )
    Tuple(
        Map<String, Tuple>(
            "name" => Tuple(
                Some(Enum<Metadata::String>("Locker badge")),
                true
            ),
            "account_locker" => Tuple(
                Some(Enum<8u8>(NamedAddress("locker"))),
                true
            )
        ),
        Map<String, Enum>()
    )
    Some(AddressReservation("badge_reservation"))
;
CALL_FUNCTION
    Address("${lockerPackage}")
    "AccountLocker"
    "instantiate"
    Enum<OwnerRole::Updatable>(
    ${rule}
    )
    ${rule}
    ${rule}
    ${recoverRule}
    ${recoverRule}
    Some(AddressReservation("locker_reservation"))
;
${DEPOSIT_ALL(account).trim()}
CALL_METHOD
    Address("${account}")
    "create_proof_of_amount"
    ${badge}
    Decimal("1")
;
${withdraw}
TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("airdrop")
;
CALL_METHOD
    NamedAddress("locker")
    "airdrop"
    Map<Address, Enum>(
${entries}
    )
    Bucket("airdrop")
    ${tryDirectSend}
;
${DEPOSIT_ALL(account)}`;
}
