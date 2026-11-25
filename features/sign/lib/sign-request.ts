/**
 * Barrel for Radix Seal on-ledger manifest builders.
 *
 * Modularized under `./manifests/` by domain:
 *  - `shared.ts` — NF-data schema, metadata guards, proof & batch-mint helpers
 *  - `collection-manifests.ts` — create collection, display metadata, preview
 *  - `sign-manifests.ts` — multi-party invitations & signature minting
 *  - `cipher-manifests.ts` — ROLA + Ledger encryption invites & receipts
 */
export {
  SIGN_NFT_FIELDS,
  nftGlobalId,
  requestKey,
  requestOwnSignatureId,
  RESERVED_COLLECTION_METADATA_KEYS,
  MAX_COLLECTION_META_FIELDS,
  isReservedCollectionMetadataKey,
  splitGlobalId,
  type CollectionMetaField,
} from './manifests/shared';

export {
  buildSignCollectionCreateManifest,
  buildCollectionMetadataManifest,
  buildProvisionPreviewManifest,
  type SignCollectionCreateInput,
  type CollectionMetadataInput,
  type ProvisionPreviewInput,
} from './manifests/collection-manifests';

export {
  resolveRequestSigners,
  buildSignRequestManifest,
  buildSignatureMintManifest,
  buildSignatureOrFirstCollectionManifest,
  type SignRequestInput,
  type SignatureMintInput,
  type SignatureOrFirstCollectionInput,
} from './manifests/sign-manifests';

export {
  buildCipherInviteManifest,
  buildCipherReceiptManifest,
  type CipherInviteInput,
  type CipherReceiptInput,
} from './manifests/cipher-manifests';
