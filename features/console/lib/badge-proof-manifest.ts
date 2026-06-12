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
