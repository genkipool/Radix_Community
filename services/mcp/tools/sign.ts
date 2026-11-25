/**
 * services/mcp/tools/sign.ts
 *
 * Radix Seal signing, verification, audit, and manifest tools for the MCP.
 * Every tool calls the exact same server-side Single Source of Truth modules
 * used by the Web UI and `/api/sign/*` routes (`verify.server.ts`,
 * `onchain-status.server.ts`, `collection-audit.server.ts`, `sign-request.ts`,
 * `radix-seal-manifest.ts`) — zero internal HTTP self-calls and zero duplicated
 * security logic.
 */

import { z } from 'zod';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { SEAL_IMAGE_URL, radixSealAddress } from '@/features/sign/constants/seal';
import {
  DEFAULT_AUDIT_FILTERS,
  computeAuditKpis,
  evaluateIntegritySummary,
  filterAuditRecords,
  filterAuditSigners,
} from '@/features/sign/lib/collection-audit';
import {
  MAX_AUDIT_PAGE_LIMIT,
  auditSignCollection,
  getSealAccountState,
} from '@/features/sign/lib/collection-audit.server';
import {
  DOC_HASH_HEX_RE,
  RADIX_ACCOUNT_RE,
  RADIX_RESOURCE_RE,
  networkIdFromAccount,
  networkIdFromName,
  networkIdFromResource,
  networkMatchesAccount,
  networkMatchesCollection,
  networkNameForId,
  splitNftGlobalId,
} from '@/features/sign/lib/network';
import {
  buildAuditJsonPackage,
  recordsToAuditCsv,
  signersToAuditCsv,
} from '@/features/sign/lib/audit-export';
import {
  entityDetails,
  fetchLedgerTimestampNow,
  sealFromOwnerRule,
} from '@/features/sign/lib/onchain-custody';
import {
  buildRadixSealDeployManifest,
  buildSealMintManifest,
} from '@/features/sign/lib/radix-seal-manifest';
import {
  MAX_COLLECTION_META_FIELDS,
  buildCollectionMetadataManifest,
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureOrFirstCollectionManifest,
  requestKey as formatRequestKey,
  resolveRequestSigners,
} from '@/features/sign/lib/sign-request';
import { getOnChainRequestStatus } from '@/features/sign/lib/onchain-status.server';
import {
  verifyBodySchema,
  verifyCertificateEnvelope,
} from '@/features/sign/lib/verify.server';
import {
  buildAuditUrl,
  parseRequestKey,
} from '@/features/sign/lib/share';
import { staticallyValidateManifest } from '@/services/ret';
import { RADIX_COMMUNITY_ORIGIN, dappDefinitionFor, signingSteps } from '../dapp';
import { localeSchema, networkSchema } from './schemas';

/**
 * Resolves the target Radix network from an explicit parameter or Bech32
 * prefixes (`account`, `collection`, `sealResource`) and enforces strict
 * Mainnet / Stokenet isolation across every supplied address.
 */
function resolveSealNetwork(input: {
  network?: 'mainnet' | 'stokenet';
  account?: string;
  collection?: string;
  sealResource?: string;
  collections?: string[];
  fallback?: RadixNetworkId;
}): { networkId: RadixNetworkId; network: 'mainnet' | 'stokenet' } {
  const inferred =
    (input.account ? networkIdFromAccount(input.account) : null) ??
    (input.collection ? networkIdFromResource(input.collection) : null) ??
    (input.sealResource ? networkIdFromResource(input.sealResource) : null);

  const networkId = input.network
    ? networkIdFromName(input.network)
    : (inferred ?? input.fallback);
  if (networkId == null) {
    throw new Error('Could not determine Radix network from address.');
  }
  const network = networkNameForId(networkId);

  if (input.account && !networkMatchesAccount(networkId, input.account)) {
    throw new Error(`Network mismatch: account "${input.account}" is not on ${network}.`);
  }
  if (input.collection && !networkMatchesCollection(networkId, input.collection)) {
    throw new Error(`Network mismatch: collection "${input.collection}" is not on ${network}.`);
  }
  if (input.sealResource && !networkMatchesCollection(networkId, input.sealResource)) {
    throw new Error(`Network mismatch: sealResource "${input.sealResource}" is not on ${network}.`);
  }
  for (const addr of input.collections ?? []) {
    if (!networkMatchesCollection(networkId, addr)) {
      throw new Error(`Network mismatch: collection "${addr}" is not on ${network}.`);
    }
  }
  return { networkId, network };
}

export const verifyDocumentSignatureTool = defineMcpTool({
  name: 'verify_document_signature',
  title: 'Verify a document-signature certificate',
  description:
    'Verifies a Radix Seal document-attestation certificate (the contents of a .radixsig.json file). Checks every signature against the shared payload — ROLA proofs and/or the on-ledger chain of custody — and reports whether the certificate is complete. It receives ONLY the certificate, never the document itself.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    certificate: z
      .string()
      .min(2)
      .max(200_000)
      .describe('The certificate JSON: the full contents of the .radixsig.json file.'),
  }),
  handler: async ({ certificate }, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(certificate);
    } catch {
      throw new Error('The certificate is not valid JSON.');
    }
    // The file is the envelope itself; tolerate a { envelope } wrapper too.
    const envelope =
      parsed && typeof parsed === 'object' && 'envelope' in parsed
        ? (parsed as { envelope: unknown }).envelope
        : parsed;

    const validated = verifyBodySchema.safeParse({ envelope });
    if (!validated.success) {
      throw new Error('invalid_certificate');
    }

    const data = await verifyCertificateEnvelope(validated.data, {
      expectedOrigin: ctx.origin,
    });

    const net = networkNameForId(data.networkId);
    const status = data.complete
      ? 'COMPLETE: all required signers valid'
      : data.allValid
        ? 'valid, but incomplete (missing required signers)'
        : 'INVALID: one or more signatures failed';

    return cliRender(
      cliBanner('Radix Seal · verify certificate'),
      cliKeyValues([
        ['Status', status],
        ['Document hash', data.docHash],
        ['Message', data.message || undefined],
        ['Signed at', data.timestamp],
        ['Network', net],
        [
          'Required signers',
          data.requiredSigners.length
            ? String(data.requiredSigners.length)
            : 'open set (any valid signer)',
        ],
        [
          'On-ledger custody',
          data.onChainValid === null ? 'n/a' : data.onChainValid ? 'valid' : 'INVALID',
        ],
        [
          'Official Seal insignia',
          data.sealValid === null ? 'n/a' : data.sealValid ? 'valid' : 'INVALID',
        ],
      ]),
      cliSection('Signatures'),
      cliTable(
        ['Signer', 'Valid', 'Required', 'Name', 'Signed at'],
        data.signatures.map((s) => [
          s.signerAccount,
          s.valid ? 'yes' : 'NO',
          s.required ? 'yes' : 'no',
          s.disclosedName ?? '(none)',
          s.signedAt,
        ]),
      ),
    );
  },
});

export const checkSigningRequestTool = defineMcpTool({
  name: 'check_signing_request',
  title: 'Check a Radix Seal signing request',
  description:
    'Reads the on-ledger status of a Radix Seal signing request by its id (the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#"). Returns the required signers, who has signed, and whether the request is complete. Read-only Gateway query.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    requestId: z
      .string()
      .min(6)
      .max(600)
      .describe('Request id: the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#".'),
    network: networkSchema,
    docHash: z
      .string()
      .regex(DOC_HASH_HEX_RE)
      .optional()
      .describe('Optional document hash (blake2b-256, 64 hex chars) to confirm the request anchors the expected file.'),
  }),
  handler: async ({ requestId, network, docHash }) => {
    const data = await getOnChainRequestStatus({
      networkId: networkIdFromName(network),
      requestId,
      docHash,
    });

    if (!data.found) {
      return cliRender(
        cliBanner('Radix Seal · signing request'),
        cliKeyValues([
          ['Request id', requestId],
          ['Network', network],
          ['Result', 'not found (unknown request, or its invitation batch is incomplete)'],
        ]),
      );
    }

    const sigs = data.signatures;
    const signed = sigs.filter((s) => s.signed).length;
    return cliRender(
      cliBanner('Radix Seal · signing request'),
      cliKeyValues([
        ['Request id', data.requestId],
        [
          'Status',
          data.complete ? 'COMPLETE (all signed)' : `pending (${signed}/${sigs.length} signed)`,
        ],
        ['Document hash', data.docHash],
        [
          'Hash match',
          docHash ? (data.hashMismatch ? 'MISMATCH (file differs from request)' : 'matches') : undefined,
        ],
        ['Collection', data.collection],
        ['Network', network],
        ['Issuer account', data.issuer?.account],
        ['Issuer org', data.issuer?.orgName],
        [
          'Domain proof',
          data.issuer?.domainVerification?.domain
            ? data.issuer.domainVerification.verified
              ? `VERIFIED (${data.issuer.domainVerification.domain} via ${data.issuer.domainVerification.method})`
              : `unverified (${data.issuer.domainVerification.domain})`
            : undefined,
        ],
      ]),
      cliSection('Signers'),
      cliTable(
        ['Signer', 'Signed'],
        sigs.map((s) => [s.account, s.signed ? 'yes' : 'no']),
      ),
    );
  },
});

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const auditSealCollectionTool = defineMcpTool({
  name: 'audit_seal_collection',
  title: 'Audit a Radix Seal signing collection',
  description:
    'Read-only audit for any Radix Seal signing collection on Mainnet or Stokenet. Verifies collection integrity (standard marker, official brand, locked soulbound owner rule, burn denied, immutable evidentiary fields), reconstructs multi-party signature batches, cross-checks each required signer on-ledger, filters by date/type/status/hash/signer, and exports summary, CSV, or SHA-256 verifiable JSON.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    collection: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .describe('Signing collection resource address (resource_rdx1… for mainnet or resource_tdx_2_1… for stokenet).'),
    network: z
      .enum(['mainnet', 'stokenet'])
      .optional()
      .describe('Optional Radix network; auto-detected from the collection prefix when omitted, or verified to match.'),
    fromDate: z
      .string()
      .regex(DATE_ISO_RE)
      .optional()
      .describe('Optional inclusive UTC start date (YYYY-MM-DD).'),
    toDate: z
      .string()
      .regex(DATE_ISO_RE)
      .optional()
      .describe('Optional inclusive UTC end date (YYYY-MM-DD).'),
    category: z
      .enum(['all', 'multi_request', 'solo_signature', 'cosign_signature', 'cipher'])
      .default('all')
      .describe('Filter by operation type.'),
    status: z
      .enum(['all', 'complete', 'pending', 'recorded', 'anomaly'])
      .default('all')
      .describe('Filter by compliance status.'),
    docHash: z
      .string()
      .max(128)
      .optional()
      .describe('Optional BLAKE2b-256 document hash (or prefix) to locate records for a file.'),
    signer: z
      .string()
      .max(256)
      .optional()
      .describe('Optional participating Radix account address to filter by.'),
    toId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional upper NFT integer id for paging older records (e.g. scannedFromId - 1).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_AUDIT_PAGE_LIMIT)
      .optional()
      .describe(`Maximum number of NFTs to scan from the newest end (1–${MAX_AUDIT_PAGE_LIMIT}).`),
    format: z
      .enum(['summary', 'csv_records', 'csv_signers', 'json'])
      .default('summary')
      .describe('Output format: human-readable "summary", Excel-safe "csv_records" / "csv_signers", or SHA-256 verifiable "json".'),
    locale: localeSchema,
  }),
  handler: async (args, ctx) => {
    const { networkId } = resolveSealNetwork({
      network: args.network,
      collection: args.collection,
    });

    const result = await auditSignCollection({
      networkId,
      collection: args.collection,
      toId: args.toId,
      limit: args.limit,
    });

    const netLabel =
      networkId === RadixNetworkId.Stokenet ? 'stokenet (TESTNET)' : 'mainnet';

    if (!result.found) {
      return cliRender(
        cliBanner('Radix Seal · audit registry'),
        cliKeyValues([
          ['Collection', args.collection],
          ['Network', netLabel],
          ['Result', 'not found (missing or lacks radix_sign_collection = v1 marker)'],
        ]),
      );
    }

    const filters = {
      ...DEFAULT_AUDIT_FILTERS,
      fromDate: args.fromDate ?? '',
      toDate: args.toDate ?? '',
      category: args.category,
      status: args.status,
      query: args.docHash?.trim() ?? '',
      signerFilter: args.signer?.trim() ?? '',
    };

    const filteredRecords = filterAuditRecords(result.records, filters);
    const filteredSigners = filterAuditSigners(
      result.signers,
      filteredRecords,
      filters,
    );

    if (args.format === 'csv_records') {
      return recordsToAuditCsv(result, filteredRecords, {
        includeAliases: false,
      }).replace(/^\uFEFF/, '');
    }
    if (args.format === 'csv_signers') {
      return signersToAuditCsv(result, filteredSigners, {
        includeAliases: false,
      }).replace(/^\uFEFF/, '');
    }
    if (args.format === 'json') {
      const pkg = await buildAuditJsonPackage(
        result,
        filteredRecords,
        filteredSigners,
        filters,
        { includeAliases: false },
      );
      return JSON.stringify(pkg, null, 2);
    }

    const kpis = computeAuditKpis(filteredRecords);
    const auditUrl = buildAuditUrl({
      origin: ctx.origin,
      locale: args.locale,
      collection: result.collection,
      fromDate: args.fromDate,
      toDate: args.toDate,
    });
    const integrity = result.integrity;
    const integritySummary = evaluateIntegritySummary(integrity);

    return cliRender(
      cliBanner(
        networkId === RadixNetworkId.Stokenet
          ? 'Radix Seal · audit registry (STOKENET TESTNET)'
          : 'Radix Seal · audit registry (Mainnet)',
      ),
      cliKeyValues([
        ['Holder / Issuer', result.issuer.orgName || result.issuer.name || '(unnamed)'],
        [
          'Domain proof',
          result.issuer.domainVerification?.domain
            ? result.issuer.domainVerification.verified
              ? `VERIFIED (${result.issuer.domainVerification.domain} via ${result.issuer.domainVerification.method})`
              : `unverified (${result.issuer.domainVerification.domain})`
            : undefined,
        ],
        ['Collection', result.collection],
        ['Issuing account', result.issuer.account ?? '(unresolved)'],
        ['Network', netLabel],
        [
          'Ledger cutoff',
          result.ledgerStateVersion != null
            ? `#${result.ledgerStateVersion} (${result.ledgerTimestamp ?? 'n/a'})`
            : 'n/a',
        ],
        [
          'Scanned window',
          result.totalSupply > 0
            ? `#${result.scannedFromId}–#${result.scannedToId} of ${result.totalSupply}`
            : '0 records',
        ],
        ['Live audit UI', auditUrl],
      ]),
      cliSection('Cryptographic integrity'),
      cliKeyValues([
        ['Standard v1 & brand', integritySummary.standardOk ? 'VERIFIED' : 'WARNING'],
        ['Locked custody chain', integritySummary.custodyOk ? 'VERIFIED' : 'WARNING'],
        [
          'Immutable (no burn)',
          integritySummary.immutableOk
            ? 'VERIFIED'
            : `WARNING (${integrity.totalBurned} burned)`,
        ],
      ]),
      cliSection('Executive KPIs (filtered scope)'),
      cliKeyValues([
        ['Total records', String(kpis.totalRecords)],
        ['Completed', `${kpis.completeCount} (${kpis.completionRate}%)`],
        ['Pending / partial', String(kpis.pendingCount)],
        ['Unique accounts', String(kpis.uniqueSigners)],
        ['Integrity alerts', String(kpis.anomalyCount)],
      ]),
      cliSection(`Records (${filteredRecords.length})`),
      filteredRecords.length > 0
        ? cliTable(
            ['Date (UTC)', 'Type', 'Status', 'Signers', 'Document hash', 'TxID'],
            filteredRecords.map((r) => [
              r.committedAt ?? '—',
              r.kind,
              r.status,
              r.kind === 'multi_request' ? `${r.signedCount}/${r.totalSigners}` : String(r.signers.length),
              `${r.docHash.slice(0, 12)}…${r.docHash.slice(-8)}`,
              r.txId ?? '—',
            ]),
          )
        : 'No records match the selected filters.',
      cliSection(`Participating Radix accounts (${filteredSigners.length})`),
      filteredSigners.length > 0
        ? cliTable(
            ['Account', 'Seal verified', 'Invited', 'Signed', 'Pending', 'Last activity'],
            filteredSigners.map((s) => [
              s.account,
              s.hasVerifiedSeal ? 'yes' : 'no',
              String(s.invitedCount),
              String(s.signedCount),
              String(s.pendingCount),
              s.lastActivityAt ?? '—',
            ]),
          )
        : 'No participating accounts in this scope.',
      result.hasMoreOlder
        ? `Older records exist before #${result.scannedFromId}. Call again with toId=${result.scannedFromId - 1} to inspect earlier history.`
        : undefined,
    );
  },
});

export const getSealAccountStateTool = defineMcpTool({
  name: 'get_seal_account_state',
  title: 'Inspect an account Radix Seal & signing collections',
  description:
    'Discovers the soulbound Radix Seal insignia NFTs and Seal-owned signing collections held by an account on Mainnet or Stokenet, including each collection supply and next free NFT id (`nextId`). Auto-detects the network from the account prefix.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    account: z
      .string()
      .regex(RADIX_ACCOUNT_RE)
      .describe('Radix account address (account_rdx1… or account_tdx_2_1…).'),
    network: z
      .enum(['mainnet', 'stokenet'])
      .optional()
      .describe('Optional Radix network; auto-detected from account prefix when omitted, or verified to match.'),
    sealResource: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe('Optional Radix Seal brand resource override (useful when testing a freshly deployed Mainnet or Stokenet Seal before env redeploy).'),
    collections: z
      .array(z.string().regex(RADIX_RESOURCE_RE))
      .max(20)
      .optional()
      .describe('Optional known signing collection addresses to inspect alongside vault holdings (needed for brand-new collections with 0 minted NFTs).'),
  }),
  handler: async ({ account, network, sealResource, collections }) => {
    const { networkId, network: netLabel } = resolveSealNetwork({
      network,
      account,
      sealResource,
      collections,
    });

    const state = await getSealAccountState(
      networkId,
      account,
      sealResource,
      collections,
    );

    return cliRender(
      cliBanner(`Radix Seal · account state (${netLabel})`),
      cliKeyValues([
        ['Account', state.account],
        ['Network', netLabel],
        ['Seal brand resource', state.sealResource || '(unset in environment)'],
        ['Owned Seals', String(state.seals.length)],
        ['Owned collections', String(state.collections.length)],
      ]),
      state.seals.length > 0 ? cliSection('Seal insignias') : undefined,
      state.seals.length > 0
        ? cliTable(
            ['Local ID', 'Global ID'],
            state.seals.map((s) => [s.localId, s.globalId]),
          )
        : undefined,
      cliSection('Signing collections'),
      state.collections.length > 0
        ? cliTable(
            ['Collection', 'Name', 'Symbol', 'Org', 'Supply', 'Next ID'],
            state.collections.map((c) => [
              c.resourceAddress,
              c.name ?? '—',
              c.symbol ?? '—',
              c.orgName ?? '—',
              String(c.totalSupply),
              String(c.nextId),
            ]),
          )
        : 'No Seal-owned signing collections found on this account yet.',
    );
  },
});

const customMetaSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(256),
  locked: z.boolean().default(false),
});

export const buildSealManifestTool = defineMcpTool({
  name: 'build_seal_manifest',
  title: 'Build a Radix Seal registry or signing manifest',
  description:
    'Builds and statically validates a ready-to-sign Radix transaction manifest for Radix Seal registry and signing operations: "deploy_brand" (one-time global Seal resource), "mint_seal" (self-mint soulbound Seal), "create_collection" (company/personal signing collection), "update_identity" (edit orgName/orgUrl/name/symbol/logo), "create_request" (multi-party document invitation batch), or "sign_document" (solo or co-signer signature NFT — automatically creates the signing collection inline with first signature #1# when the account holds a Seal but no collection yet, matching the Web UI). Enforces strict Mainnet/Stokenet address isolation and never adds lock_fee.',
  category: 'console',
  readOnly: false,
  inputSchema: z.object({
    operation: z
      .enum([
        'deploy_brand',
        'mint_seal',
        'create_collection',
        'update_identity',
        'create_request',
        'sign_document',
      ])
      .describe('Which Radix Seal registry or signing operation to build.'),
    account: z
      .string()
      .regex(RADIX_ACCOUNT_RE)
      .optional()
      .describe('Acting Radix account address (required for all operations except deploy_brand).'),
    network: z
      .enum(['mainnet', 'stokenet'])
      .optional()
      .describe('Target network ("mainnet" or "stokenet"); auto-detected from account/collection when omitted, or verified to match.'),
    sealResource: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe('Radix Seal brand resource address (defaults to NEXT_PUBLIC_RADIX_SEAL_MAINNET / _STOKENET).'),
    sealGlobalId: z
      .string()
      .max(300)
      .optional()
      .describe('Owner Seal NFT global id ("resource_…:{ruid}"). Auto-resolved from the account/collection when omitted.'),
    collection: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe('Signing collection address. Auto-resolved to the account active collection when omitted for create_request / sign_document.'),
    name: z.string().max(120).optional().describe('Collection display name (create_collection / update_identity).'),
    symbol: z.string().max(12).optional().describe('Short uppercase resource symbol, up to 5 chars.'),
    orgName: z.string().max(200).optional().describe('Formal organisation/institution name (create_collection / update_identity).'),
    orgUrl: z.string().max(300).optional().describe('Organisation website URL (create_collection / update_identity).'),
    logoUrl: z.string().max(500).optional().describe('Logo / icon URL for the Seal or collection.'),
    adminBadge: z
      .string()
      .max(300)
      .optional()
      .describe('Optional admin badge resource/NFT global id for deploy_brand.'),
    customMetadata: z
      .array(customMetaSchema)
      .max(MAX_COLLECTION_META_FIELDS)
      .optional()
      .describe('Optional custom metadata entries written at collection creation (e.g. department, tax_id).'),
    docHash: z
      .string()
      .regex(DOC_HASH_HEX_RE)
      .optional()
      .describe('BLAKE2b-256 document hash (64 lowercase hex chars) for create_request / sign_document.'),
    requiredSigners: z
      .array(z.string().regex(RADIX_ACCOUNT_RE))
      .min(1)
      .max(25)
      .optional()
      .describe('Required signer account addresses (same network!) for create_request.'),
    alsoSign: z
      .boolean()
      .default(true)
      .describe('For create_request: whether the initiator also mints their own signature NFT in the same transaction.'),
    request: z
      .string()
      .max(600)
      .optional()
      .describe('For sign_document: optional request key ("resource_…:#firstId#") being answered; omit for solo signature.'),
    locale: localeSchema,
  }),
  handler: async (args, ctx) => {
    const { networkId, network } = resolveSealNetwork({
      network: args.network,
      account: args.account,
      collection: args.collection,
      sealResource: args.sealResource,
      fallback: RadixNetworkId.Mainnet,
    });
    const netEnum = network;

    const effectiveSealResource = (
      args.sealResource?.trim() || radixSealAddress(networkId)
    ).trim();

    let manifest: string;
    let summaryRows: Array<[string, string | undefined]> = [['Operation', args.operation], ['Network', network]];

    if (args.operation === 'deploy_brand') {
      if (args.adminBadge) {
        const badgeRes = splitNftGlobalId(args.adminBadge).resource;
        if (!networkMatchesCollection(networkId, badgeRes)) {
          throw new Error(`Network mismatch: adminBadge "${args.adminBadge}" is not on ${network}.`);
        }
      }
      manifest = buildRadixSealDeployManifest({
        imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
        origin: RADIX_COMMUNITY_ORIGIN,
        dAppDefinition: dappDefinitionFor(netEnum) || undefined,
        adminBadge: args.adminBadge,
        symbol: args.symbol,
      });
      summaryRows.push(['Symbol', args.symbol || 'SEAL']);
    } else {
      if (!args.account) {
        throw new Error(`"account" is required for operation "${args.operation}".`);
      }
      const account = args.account;

      if (args.operation === 'mint_seal') {
        if (!effectiveSealResource) {
          throw new Error(
            `No Radix Seal brand resource configured for ${network}. Deploy one first with operation "deploy_brand" or pass "sealResource".`,
          );
        }
        manifest = buildSealMintManifest({
          account,
          sealResource: effectiveSealResource,
          imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
        });
        summaryRows.push(['Account', account], ['Seal brand', effectiveSealResource]);
      } else if (args.operation === 'create_collection') {
        let sealGlobalId = args.sealGlobalId?.trim() || '';
        if (!sealGlobalId) {
          const state = await getSealAccountState(
            networkId,
            account,
            effectiveSealResource || undefined,
          );
          sealGlobalId = state.seals[0]?.globalId ?? '';
        }
        if (!sealGlobalId) {
          throw new Error(
            `Account "${account}" holds no Radix Seal NFT yet. Run operation "mint_seal" first (or pass "sealGlobalId").`,
          );
        }
        const sealAddr = effectiveSealResource || splitNftGlobalId(sealGlobalId).resource;
        if (!networkMatchesCollection(networkId, sealAddr)) {
          throw new Error(`Network mismatch: sealGlobalId "${sealGlobalId}" is not on ${network}.`);
        }
        const issuer =
          args.orgName || args.orgUrl || args.logoUrl
            ? {
                orgName: args.orgName?.trim() || undefined,
                orgWebsite: args.orgUrl?.trim() || undefined,
                orgLogoUrl: args.logoUrl?.trim() || undefined,
              }
            : undefined;
        manifest = buildSignCollectionCreateManifest({
          account,
          sealGlobalId,
          sealAddress: sealAddr,
          networkId,
          collectionName: args.name?.trim() || args.orgName?.trim() || '',
          symbol: args.symbol,
          imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
          issuer,
          extraMetadata: args.customMetadata,
        });
        summaryRows.push(['Account', account], ['Owner Seal', sealGlobalId], ['Name', args.name || args.orgName || '(default)']);
      } else if (args.operation === 'update_identity') {
        if (!args.collection) {
          throw new Error('"collection" is required for operation "update_identity".');
        }
        let sealGlobalId = args.sealGlobalId?.trim() || '';
        if (!sealGlobalId) {
          const [colItem] = await entityDetails(netEnum, [args.collection]);
          const owner = sealFromOwnerRule(colItem);
          if (owner) sealGlobalId = `${owner.resource}:${owner.localId}`;
        }
        if (!sealGlobalId) {
          throw new Error(
            `Could not resolve the owner Seal NFT for collection "${args.collection}".`,
          );
        }
        manifest = buildCollectionMetadataManifest({
          account,
          sealGlobalId,
          collection: args.collection,
          name: args.name,
          symbol: args.symbol,
          iconUrl: args.logoUrl,
          orgName: args.orgName,
          orgUrl: args.orgUrl,
        });
        if (!manifest.trim()) {
          throw new Error('Provide at least one field to update (name, symbol, orgName, orgUrl, logoUrl).');
        }
        summaryRows.push(['Account', account], ['Collection', args.collection], ['Owner Seal', sealGlobalId]);
      } else {
        // create_request | sign_document
        if (!args.docHash) {
          throw new Error(`"docHash" (64-hex BLAKE2b-256) is required for "${args.operation}".`);
        }
        if (args.operation === 'create_request') {
          if (!args.requiredSigners?.length) {
            throw new Error('"requiredSigners" is required for "create_request".');
          }
          for (const signer of args.requiredSigners) {
            if (!networkMatchesAccount(networkId, signer)) {
              throw new Error(`Network mismatch: required signer "${signer}" is not on ${network}.`);
            }
          }
        }
        let normalizedRequest = '';
        if (args.operation === 'sign_document' && args.request?.trim()) {
          const parsedReq = parseRequestKey(args.request);
          if (!parsedReq) {
            throw new Error(`Invalid request key "${args.request}". Expected "resource_…:#id#".`);
          }
          if (!networkMatchesCollection(networkId, parsedReq.collection)) {
            throw new Error(`Network mismatch: request "${args.request}" is not on ${network}.`);
          }
          normalizedRequest = formatRequestKey(parsedReq.collection, Number(parsedReq.id));
        }

        const state = await getSealAccountState(
          networkId,
          account,
          effectiveSealResource || undefined,
          args.collection ? [args.collection] : undefined,
        );
        const colInfo = args.collection
          ? state.collections.find((c) => c.resourceAddress === args.collection)
          : state.collections[0];
        if (!colInfo && (args.collection || args.operation === 'create_request')) {
          throw new Error(
            args.collection
              ? `Collection "${args.collection}" was not found as a Seal-owned signing collection of "${account}".`
              : `Account "${account}" has no Seal-owned signing collection yet. Run operation "create_collection" first.`,
          );
        }
        const sealGlobalId =
          args.sealGlobalId?.trim() ||
          colInfo?.ownerSealGlobalId ||
          state.seals[0]?.globalId ||
          '';
        if (!sealGlobalId) {
          throw new Error(
            colInfo
              ? `Could not resolve owner Seal NFT for "${colInfo.resourceAddress}".`
              : `Account "${account}" holds no Radix Seal NFT yet. Run operation "mint_seal" first (or pass "sealGlobalId").`,
          );
        }
        const sealAddr =
          effectiveSealResource || splitNftGlobalId(sealGlobalId).resource;
        if (!networkMatchesCollection(networkId, sealAddr)) {
          throw new Error(
            `Network mismatch: sealGlobalId "${sealGlobalId}" is not on ${network}.`,
          );
        }
        const issuedAt = await fetchLedgerTimestampNow(netEnum);

        if (args.operation === 'create_request') {
          const effectiveSigners = resolveRequestSigners(
            account,
            args.requiredSigners!,
            args.alsoSign,
          );
          manifest = buildSignRequestManifest({
            account,
            sealGlobalId,
            collection: colInfo!.resourceAddress,
            nextId: colInfo!.nextId,
            docHash: args.docHash,
            networkId,
            requiredSigners: effectiveSigners,
            alsoSign: args.alsoSign,
            imageUrl: SEAL_IMAGE_URL,
            issuedAt,
          });
          summaryRows.push(
            ['Account', account],
            ['Collection', colInfo!.resourceAddress],
            ['Request key', formatRequestKey(colInfo!.resourceAddress, colInfo!.nextId)],
            ['Required signers', String(effectiveSigners.length)],
          );
        } else {
          const issuer =
            !colInfo && (args.orgName || args.orgUrl || args.logoUrl)
              ? {
                  orgName: args.orgName?.trim() || undefined,
                  orgWebsite: args.orgUrl?.trim() || undefined,
                  orgLogoUrl: args.logoUrl?.trim() || undefined,
                }
              : undefined;
          manifest = buildSignatureOrFirstCollectionManifest({
            account,
            sealGlobalId,
            sealAddress: sealAddr,
            collection: colInfo?.resourceAddress ?? null,
            nextId: colInfo?.nextId,
            docHash: args.docHash,
            networkId,
            request: normalizedRequest,
            imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
            issuedAt,
            collectionName: args.name?.trim() || args.orgName?.trim() || '',
            symbol: args.symbol,
            issuer,
            extraMetadata: args.customMetadata,
          });
          summaryRows.push(
            ['Account', account],
            [
              'Collection',
              colInfo
                ? colInfo.resourceAddress
                : '(created inline with first signature #1#)',
            ],
            [
              'Signature NFT',
              colInfo
                ? formatRequestKey(colInfo.resourceAddress, colInfo.nextId)
                : '#1# (in newly created collection)',
            ],
            ['Request', normalizedRequest || '(solo signature)'],
          );
        }
      }
    }

    const validation = await staticallyValidateManifest(manifest, netEnum);

    return cliRender(
      cliBanner(`Radix Seal · ${args.operation} (${network})`),
      cliKeyValues(summaryRows),
      cliSection('Transaction manifest'),
      cliCode(manifest, 'rtm'),
      cliNext(signingSteps(ctx.origin, netEnum, args.locale, validation)),
    );
  },
});

export const signTools = [
  verifyDocumentSignatureTool,
  checkSigningRequestTool,
  auditSealCollectionTool,
  getSealAccountStateTool,
  buildSealManifestTool,
];
