/**
 * Badge proof manifest builder — prepended to transactions that require the
 * caller to present a badge (e.g. metadata updates, restricted withdraws).
 * Ported from the official Radix Console (dapps-monorepo).
 */

import type { BadgeProofSelection } from '../types/console.types';

export const buildBadgeProofManifest = (proofs: BadgeProofSelection[]): string =>
  proofs
    .map(({ accountAddress, resourceAddress, nonFungibleId }) =>
      nonFungibleId
        ? `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${resourceAddress}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${nonFungibleId}"))
;
`
        : `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_amount"
    Address("${resourceAddress}")
    Decimal("1")
;
`,
    )
    .join('');

/**
 * One `create_proof_of_non_fungibles` carrying several local ids of the same
 * resource. The engine keeps the resulting proof in the auth zone for the rest
 * of the transaction, so a batch touching many validators still pays for a
 * single proof instruction rather than one per badge.
 */
export const buildNonFungibleBadgeProof = (
  accountAddress: string,
  resourceAddress: string,
  nonFungibleIds: string[],
): string =>
  nonFungibleIds.length === 0
    ? ''
    : `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${resourceAddress}")
    Array<NonFungibleLocalId>(${nonFungibleIds
      .map((id) => `NonFungibleLocalId("${id}")`)
      .join(', ')})
;
`;
