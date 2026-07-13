/**
 * Radix Seal — the brand/standard behind the self-custody Certificate
 * Authority. One brand resource is deployed ONCE per network (its address is
 * then fixed here, mirroring `features/wallet/constants/radix-addresses.ts`).
 * Every user's attestation collection references it as its insignia.
 */
import { RadixNetworkId } from '@/features/wallet/constants/network';

/**
 * Fixed Radix Seal brand-resource address per network. Filled in after the
 * one-time deploy (buildRadixSealDeployManifest). Empty string = not yet
 * deployed on that network; the feature still works, the insignia check is
 * simply skipped.
 *
 * v2 (2026-07): the brand is now OPEN-MINT (anyone self-mints their own
 * soulbound seal NFT, RUID ids) so it doubles as each user's owner insignia
 * for their signing collection. The old locked v1 brand cannot serve that
 * role — redeploy and paste the new address here.
 */
export const RADIX_SEAL: Record<number, string> = {
  [RadixNetworkId.Mainnet]: '',
  [RadixNetworkId.Stokenet]: 'resource_tdx_2_1n2dnu585z0c6hsl9tvlqaufnrxstepwpdjv5tumvrslqq77t7dgrwm',
};

export function radixSealAddress(networkId: number): string {
  return RADIX_SEAL[networkId] ?? '';
}

/* ─── Metadata keys (part of the on-ledger standard) ──────────────────────── */

/** Resource/NFT metadata key pointing at the brand resource. */
export const RADIX_SEAL_STANDARD_KEY = 'radix_seal';

/** Resource metadata marker used to discover a user's collection on-ledger. */
export const COLLECTION_MARKER_KEY = 'radix_seal_collection';
export const COLLECTION_MARKER_VALUE = 'v1';

/**
 * Marker for a user's SIGNING collection (multi-party flow): the per-user
 * resource whose owner/minter is their own seal NFT, holding their invitation
 * and signature NFTs.
 */
export const SIGN_COLLECTION_MARKER_KEY = 'radix_sign_collection';
export const SIGN_COLLECTION_MARKER_VALUE = 'v1';

/* ─── Display defaults ────────────────────────────────────────────────────── */

export const RADIX_SEAL_NAME = 'Radix Seal';
export const DEFAULT_COLLECTION_NAME = 'Radix Seal Attestations';

/** Stable app-hosted path to the brand image (served from /public). */
export const SEAL_IMAGE_PATH = '/seal/radix-seal.svg';

/** Absolute URL for the seal image — required for on-ledger `icon_url`. */
export function sealImageUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${SEAL_IMAGE_PATH}`;
}
