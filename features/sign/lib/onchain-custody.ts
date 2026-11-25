/**
 * Barrel for server-side on-ledger chain-of-custody verification.
 *
 * Modularized under `./custody/`:
 *  - `gateway-reads.ts` — NF data, consensus commits, NF location & owner rules
 *  - `signer-lookup.ts` — request resolution & single/batch signer verification
 *  - `integrity.ts` — collection standard, role-lock & metadata inspection
 */
export {
  allAccountNonFungibleResources,
  entityDetails,
  entityDetailsWithLedger,
  fetchLedgerTimestampNow,
  metadataString,
  sealFromOwnerRule,
  type EntityDetailsItem,
} from './gateway-seal';

export {
  collectionOwnedByAccount,
  collectionSealBelongsTo,
  ledgerCommit,
  ledgerCommitsBatch,
  ledgerTimestamp,
  nfData,
  nfFieldMap,
  nfOwnerAccount,
  nfRecords,
  type LedgerCommit,
  type NfRecord,
} from './custody/gateway-reads';

export {
  findAllSignerSignatures,
  findSignerSignature,
  findSignerSignatures,
  resolveSealRequest,
  type SignerBatchResult,
  type SignerSignature,
} from './custody/signer-lookup';

export {
  inspectCollectionIntegrity,
  type CollectionCustomMeta,
  type CollectionIntegrity,
} from './custody/integrity';
