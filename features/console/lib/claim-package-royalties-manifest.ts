import type { BadgeProofSelection } from '../types/console.types';
import { buildBadgeProofManifest } from './badge-proof-manifest';

export const getClaimPackageRoyaltiesManifest = (
  accountAddress: string,
  entityAddress: string,
  ownerBadge?: BadgeProofSelection
) => {
  const isComponent = entityAddress.startsWith('component_');
  const claimInstruction = isComponent ? 'CLAIM_COMPONENT_ROYALTIES' : 'CLAIM_PACKAGE_ROYALTIES';

  let manifest = '';

  if (ownerBadge) {
    manifest += buildBadgeProofManifest([ownerBadge]);
  }

  manifest += `
${claimInstruction}
    Address("${entityAddress}");

CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP");
`;

  return manifest.trim();
};
