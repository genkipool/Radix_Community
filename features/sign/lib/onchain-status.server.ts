/**
 * Server-side Radix Seal on-ledger request status resolver.
 *
 * Single source of truth shared by both `POST /api/sign/onchain-status` and
 * the MCP `check_signing_request` tool so request-key parsing, strict Mainnet
 * vs Stokenet isolation, invitation-batch completeness, and chain-of-custody
 * signature verification never drift or require internal HTTP self-calls.
 */
import { z } from 'zod';
import {
  radixSealAddress,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../constants/seal';
import {
  entityDetails,
  findSignerSignature,
  ledgerCommit,
  metadataString,
  nfData,
  nfOwnerAccount,
  nfRecords,
  sealFromOwnerRule,
} from './onchain-custody';
import {
  DOC_HASH_HEX_RE,
  isSupportedNetworkId,
  networkMatchesCollection,
  networkNameForId,
} from './network';
import { parseRequestKey } from './share';
import { requestKey as formatRequestKey } from './sign-request';
import type { DomainVerificationResult } from './domain-verify';
import { verifyIssuerDomain } from './domain-verify.server';

export const MAX_REQUEST_SIGNERS = 25;

export const onChainStatusInputSchema = z
  .object({
    networkId: z.number().int(),
    docHash: z.string().regex(DOC_HASH_HEX_RE).optional(),
    requestId: z.string().max(600).optional(),
    account: z.string().max(256).optional(),
  })
  .strict();

export type OnChainStatusInput = z.infer<typeof onChainStatusInputSchema>;

export interface OnChainStatusSignatureEntry {
  account: string;
  signed: boolean;
  signedAt: string | null;
  txId: string | null;
  nftGlobalId: string | null;
}

export interface OnChainStatusFound {
  found: true;
  mode: 'seal';
  requestId: string;
  collection: string;
  docHash: string;
  hashMismatch: boolean;
  createdAt: string | null;
  createdTxId: string | null;
  networkId: number;
  requiredSigners: string[];
  signatures: OnChainStatusSignatureEntry[];
  complete: boolean;
  issuer: {
    account?: string;
    collectionName?: string;
    orgName?: string;
    orgWebsite?: string;
    orgLogoUrl?: string;
    domainVerification?: DomainVerificationResult | null;
  };
}

export interface OnChainStatusNotFound {
  found: false;
}

export type OnChainStatusResult = OnChainStatusFound | OnChainStatusNotFound;

export async function getOnChainRequestStatus(
  input: OnChainStatusInput,
): Promise<OnChainStatusResult> {
  const { networkId, docHash, requestId } = input;
  if (!isSupportedNetworkId(networkId)) {
    throw new Error('invalid_network');
  }
  const network = networkNameForId(networkId);

  const parsedKey = requestId ? parseRequestKey(requestId) : null;
  if (!parsedKey) {
    return { found: false };
  }
  const { collection, id: anchorNum } = parsedKey;
  if (!networkMatchesCollection(networkId, collection)) {
    return { found: false };
  }

  // 1. Anchor invitation → doc hash + batch geometry (locked data).
  const anchorData = await nfRecords(network, collection, [`#${anchorNum}#`]);
  const anchorRecord = anchorData.get(`#${anchorNum}#`);
  const anchor = anchorRecord?.fields;
  if (!anchor || anchor.kind !== 'invite' || !anchor.document_hash) {
    return { found: false };
  }

  const created = await ledgerCommit(network, anchorRecord.stateVersion);
  const createdAt = created.confirmedAt;
  const reqDocHash = anchor.document_hash;
  const hashMismatch = !!docHash && docHash !== reqDocHash;
  const firstId = Number.parseInt(anchor.first_id || anchorNum, 10);
  const count = Number.parseInt(anchor.signer_count || '0', 10);
  if (
    !Number.isInteger(firstId) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_REQUEST_SIGNERS
  ) {
    return { found: false };
  }

  // 2. Whole invitation batch → required signer list (must be intact).
  const inviteIds = Array.from({ length: count }, (_, i) => `#${firstId + i}#`);
  const invites = await nfData(network, collection, inviteIds);
  const signers = inviteIds
    .map((id, i) => ({ id, index: i, fields: invites.get(id) }))
    .filter(
      (e) =>
        e.fields?.kind === 'invite' &&
        e.fields.document_hash === reqDocHash &&
        !!e.fields.signer,
    )
    .map((e) => ({ account: e.fields!.signer, index: e.index }));
  if (signers.length !== count) {
    return { found: false };
  }

  // 3. Initiator's collection: marker + issuer identity + owner seal.
  const [collectionItem] = await entityDetails(network, [collection]);
  if (
    metadataString(collectionItem, SIGN_COLLECTION_MARKER_KEY) !==
    SIGN_COLLECTION_MARKER_VALUE
  ) {
    return { found: false };
  }
  const seal = sealFromOwnerRule(collectionItem);
  const issuerAccount = seal
    ? await nfOwnerAccount(network, seal.resource, seal.localId)
    : null;
  const orgWebsite = metadataString(collectionItem, 'org_url') || undefined;
  const domainVerificationPromise = orgWebsite
    ? verifyIssuerDomain({
        orgUrl: orgWebsite,
        collection,
        account: issuerAccount,
      })
    : Promise.resolve(null);

  // 4. Per-signer signature check (chain of custody + official Seal brand).
  const officialSeal = radixSealAddress(networkId);
  const [signatures, domainVerification] = await Promise.all([
    Promise.all(
      signers.map(async (s): Promise<OnChainStatusSignatureEntry> => {
        const found = await findSignerSignature(
          network,
          s.account,
          reqDocHash,
          officialSeal,
        );
        const commit = found
          ? await ledgerCommit(network, found.stateVersion)
          : null;
        return {
          account: s.account,
          signed: !!found,
          signedAt: commit?.confirmedAt ?? null,
          txId: commit?.intentHash ?? null,
          nftGlobalId: found?.nftGlobalId ?? null,
        };
      }),
    ),
    domainVerificationPromise,
  ]);

  return {
    found: true,
    mode: 'seal',
    requestId: formatRequestKey(collection, firstId),
    collection,
    docHash: reqDocHash,
    hashMismatch,
    createdAt,
    createdTxId: created.intentHash,
    networkId,
    requiredSigners: signatures.map((s) => s.account),
    signatures,
    complete: signatures.length > 0 && signatures.every((s) => s.signed),
    issuer: {
      account: issuerAccount ?? undefined,
      collectionName: metadataString(collectionItem, 'name') || undefined,
      orgName: metadataString(collectionItem, 'org_name') || undefined,
      orgWebsite,
      orgLogoUrl: metadataString(collectionItem, 'icon_url') || undefined,
      domainVerification,
    },
  };
}
