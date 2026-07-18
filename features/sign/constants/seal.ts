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
  // Cleared for a fresh Stokenet redeploy with the admin-badge + editable
  // metadata manifest; paste the new resource address here after deploying.
  [RadixNetworkId.Stokenet]: '',
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

/** App-hosted path to the brand image (served from /public), used by the
 *  client-side PDF watermark, which fetches and rasterises it same-origin. */
export const SEAL_IMAGE_PATH = '/SVGs/radix-seal.svg';

/**
 * Stable, domain-INDEPENDENT URL of the seal SVG (GitHub raw, `public/SVGs`).
 * This is what every seal / collection NFT bakes into its `key_image_url`, so
 * a change of the app's own domain never breaks the on-ledger image, and
 * editing the SVG in the repo updates the image for every minted NFT at once
 * (the ledger stores the URL, not the bytes).
 */
export const SEAL_IMAGE_URL =
  'https://raw.githubusercontent.com/genkipool/Radix_Community/main/public/SVGs/radix-seal.svg';

/**
 * `info_url` metadata of the brand resource: the full Radix Seal documentation
 * directory on GitHub (renders its README.md). Domain independent, so wallets
 * always resolve it regardless of the app's own domain.
 */
export const SEAL_INFO_URL =
  'https://github.com/genkipool/Radix_Community/tree/main/doc';

/**
 * URL baked into on-ledger `key_image_url` / `icon_url`. Returns the stable
 * GitHub-hosted URL. The `origin` argument is kept for call-site compatibility
 * but no longer used: the seal image must not depend on the app's own domain.
 */
export function sealImageUrl(_origin?: string): string {
  return SEAL_IMAGE_URL;
}
