/**
 * Transactions on Ociswap Precision pool positions, as Ociswap's own
 * manifests write them (`claim_fees.rtm`, `remove_liquidity.rtm`):
 *
 * - claim fees: a proof of the position NFTs is enough; the NFTs stay in the
 *   account and only the earned fees come out.
 * - withdraw: the NFTs go to the pool, which burns them and returns both
 *   tokens. The pool claims the pending fees first, so they come out too.
 *
 * Both are public methods: the pool only checks that the NFTs are its own.
 * Every address and id is validated, since they go into the manifest as is.
 */
import { isManifestAddress } from './pool-manifests';

export interface PositionGroup {
  pool: string;
  lpResource: string;
  ids: string[];
}

/** Integer, string, bytes or RUID local ids, exactly as the manifest writes them. */
const LOCAL_ID = /^(#\d{1,20}#|<[A-Za-z0-9_]{1,64}>|\[[0-9a-f]{2,128}\]|\{[0-9a-f]{16}-[0-9a-f]{16}-[0-9a-f]{16}-[0-9a-f]{16}\})$/;

const networkOf = (address: string) => {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  return hrp.slice(hrp.indexOf('_') + 1);
};

function assertInput(account: string, groups: PositionGroup[]) {
  if (!isManifestAddress(account, 'account_')) throw new Error(`The account "${account}" is not a valid account address.`);
  const network = networkOf(account);
  for (const g of groups) {
    for (const [address, prefix] of [[g.pool, 'component_'], [g.lpResource, 'resource_']] as const) {
      if (!isManifestAddress(address, prefix)) throw new Error(`"${address}" is not a valid ${prefix.slice(0, -1)} address.`);
      if (networkOf(address) !== network) throw new Error(`"${address}" is on another network.`);
    }
    const bad = g.ids.find((id) => !LOCAL_ID.test(id));
    if (bad !== undefined) throw new Error(`"${bad}" is not a valid NFT id.`);
  }
}

const idArray = (ids: string[]) => `Array<NonFungibleLocalId>(${ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})`;

const DEPOSIT_ALL = (account: string) => `CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;`;

/** Claims the earned fees of every position, keeping the positions. */
export function claimFeesManifest(account: string, groups: PositionGroup[]): string {
  const used = groups.filter((g) => g.ids.length > 0);
  if (!used.length) return '';
  assertInput(account, used);
  const calls = used.map(
    (g, i) => `CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${g.lpResource}")
    ${idArray(g.ids)}
;
POP_FROM_AUTH_ZONE
    Proof("positions_${i}")
;
CALL_METHOD
    Address("${g.pool}")
    "claim_fees"
    Proof("positions_${i}")
;`,
  );
  return `${calls.join('\n')}
${DEPOSIT_ALL(account)}
`;
}

/** Withdraws every position: liquidity and pending fees, burning the NFTs. */
export function removePositionsManifest(account: string, groups: PositionGroup[]): string {
  const used = groups.filter((g) => g.ids.length > 0);
  if (!used.length) return '';
  assertInput(account, used);
  const calls = used.map(
    (g, i) => `CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${g.lpResource}")
    ${idArray(g.ids)}
;
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${g.lpResource}")
    ${idArray(g.ids)}
    Bucket("positions_${i}")
;
CALL_METHOD
    Address("${g.pool}")
    "remove_liquidity"
    Bucket("positions_${i}")
;`,
  );
  return `${calls.join('\n')}
${DEPOSIT_ALL(account)}
`;
}
