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

/** What a locker call takes: an amount of a fungible, or some NFTs by id. */
export interface LockerClaimItem {
  resource: string;
  amount?: string;
  nftIds?: string[];
}

/** One locker call that leaves what it returns on the worktop: claim (by the claimant) or recover (by the recoverer). */
const lockerCall = (kind: 'claim' | 'recover', locker: string, claimant: string, item: LockerClaimItem) =>
  item.nftIds?.length
    ? `CALL_METHOD
    Address("${locker}")
    "${kind}_non_fungibles"
    Address("${claimant}")
    Address("${item.resource}")
    Array<NonFungibleLocalId>(${item.nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
;`
    : `CALL_METHOD
    Address("${locker}")
    "${kind}"
    Address("${claimant}")
    Address("${item.resource}")
    Decimal("${item.amount}")
;`;

/** The claimant takes one stored resource; shared with the templates and blocks. */
export const lockerClaimInstruction = (locker: string, claimant: string, item: LockerClaimItem) => lockerCall('claim', locker, claimant, item);

/** The recoverer takes back one stored resource of a claimant; needs the recoverer badge proof earlier. */
export const lockerRecoverInstruction = (locker: string, claimant: string, item: LockerClaimItem) =>
  lockerCall('recover', locker, claimant, item);

/** Takes back what is stored for a claimant (only when the locker allows recovery). */
export function recoverManifest({ account, locker, badge, claimant, resource, amount, nftIds }: RecoverInput): string {
  return `${proofOf(badge)}${lockerRecoverInstruction(locker, claimant, { resource, amount, nftIds })}
${DEPOSIT_ALL(account)}`;
}

/** Everything still stored for one claimant. */
export interface UnclaimedItem {
  claimant: string;
  claims: LockerClaimItem[];
}

/**
 * Takes back several claimants' unclaimed tokens in one transaction: one
 * proof of the recoverer badge, a recover call per stored resource, and one
 * deposit of it all into the account. Returns '' when nothing is stored.
 */
export function recoverAllManifest({
  account,
  locker,
  badge,
  items,
}: {
  account: string;
  locker: string;
  badge: LockerBadgeProof;
  items: UnclaimedItem[];
}): string {
  return withdrawManifest(
    account,
    items.flatMap((item) => item.claims.map((claim) => ({ kind: 'recover' as const, locker, claimant: item.claimant, item: claim, badge }))),
  );
}

/* ─── Taking things out of lockers: claims and recoveries together ────────── */

/**
 * One thing taken out of a locker: a claim (by the claimant, for itself) or a
 * recovery (by the recoverer badge holder, of what waits for someone else).
 */
export type LockerWithdrawal =
  | { kind: 'claim'; locker: string; claimant: string; item: LockerClaimItem }
  | { kind: 'recover'; locker: string; claimant: string; item: LockerClaimItem; badge: LockerBadgeProof };

const badgeKey = (b: LockerBadgeProof) => `${b.resource}:${b.nonFungibleId ?? ''}`;

/**
 * Claims and recoveries from any number of lockers in one transaction: a
 * proof of each recoverer badge needed (once), every call, and one deposit of
 * it all into the signing account. Returns '' when there is nothing to take.
 */
export function withdrawManifest(account: string, withdrawals: LockerWithdrawal[]): string {
  if (!withdrawals.length) return '';
  const badges = new Map<string, LockerBadgeProof>();
  for (const w of withdrawals) if (w.kind === 'recover') badges.set(badgeKey(w.badge), w.badge);
  const proofs = [...badges.values()].map(proofOf).join('');
  const calls = withdrawals.map((w) =>
    w.kind === 'claim' ? lockerClaimInstruction(w.locker, w.claimant, w.item) : lockerRecoverInstruction(w.locker, w.claimant, w.item),
  );
  return `${proofs}${calls.join('\n')}\n${DEPOSIT_ALL(account)}`;
}

/**
 * Recover calls per transaction. Each recover withdraws from the claimant's
 * vault and emits its events; the engine allows 256 events per transaction,
 * so this keeps well under it with room for the deposit at the end.
 */
export const RECOVERS_PER_TRANSACTION = 40;

/** The unclaimed items split into transactions of at most RECOVERS_PER_TRANSACTION calls. */
export function recoverAllBatches(items: UnclaimedItem[], size = RECOVERS_PER_TRANSACTION): UnclaimedItem[][] {
  const batches: UnclaimedItem[][] = [];
  let current: UnclaimedItem[] = [];
  let calls = 0;
  for (const item of items) {
    for (const claim of item.claims) {
      if (calls === size) {
        batches.push(current);
        current = [];
        calls = 0;
      }
      const last = current[current.length - 1];
      if (last?.claimant === item.claimant) last.claims.push(claim);
      else current.push({ claimant: item.claimant, claims: [claim] });
      calls++;
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

export interface ClaimInput {
  /** The claimant: the account the tokens were stored for, and where they go. */
  account: string;
  locker: string;
  claims: LockerClaimItem[];
}

/** The claim calls for one locker; what they return stays on the worktop. */
const claimCalls = (account: string, locker: string, claims: LockerClaimItem[]) =>
  claims.map((c) => lockerClaimInstruction(locker, account, c)).join('\n');

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
