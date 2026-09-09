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
): string => {
  if (nonFungibleIds.length === 0) return '';

  /*
   * One id stays inline; several go one per line. A batch across four
   * validators otherwise puts a ~500-character array on a single line, which
   * the manifest preview can only show by scrolling sideways.
   */
  const ids = nonFungibleIds.map((id) => `NonFungibleLocalId("${id}")`);
  const list =
    ids.length === 1 ? ids[0] : `\n        ${ids.join(',\n        ')}\n    `;

  return `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${resourceAddress}")
    Array<NonFungibleLocalId>(${list})
;
`;
};
