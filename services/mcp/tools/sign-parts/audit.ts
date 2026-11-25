/**
 * MCP tools for auditing Radix Seal signing collections and inspecting an
 * account's Seal insignias and owned signing collections.
 */
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import {
  buildAuditJsonPackage,
  recordsToAuditCsv,
  signersToAuditCsv,
} from '@/features/sign/lib/audit-export';
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
import { RADIX_ACCOUNT_RE, RADIX_RESOURCE_RE } from '@/features/sign/lib/network';
import { buildAuditUrl } from '@/features/sign/lib/share';
import {
  cliBanner,
  cliKeyValues,
  cliRender,
  cliSection,
  cliTable,
} from '../../cli';
import { defineMcpTool } from '../../registry';
import { localeSchema } from '../schemas';
import { formatDomainProof, resolveSealNetwork } from './network';

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
      .describe(
        'Signing collection resource address (resource_rdx1… for mainnet or resource_tdx_2_1… for stokenet).',
      ),
    network: z
      .enum(['mainnet', 'stokenet'])
      .optional()
      .describe(
        'Optional Radix network; auto-detected from the collection prefix when omitted, or verified to match.',
      ),
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
      .enum([
        'all',
        'multi_request',
        'solo_signature',
        'cosign_signature',
        'cipher',
      ])
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
      .describe(
        'Optional BLAKE2b-256 document hash (or prefix) to locate records for a file.',
      ),
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
      .describe(
        'Optional upper NFT integer id for paging older records (e.g. scannedFromId - 1).',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_AUDIT_PAGE_LIMIT)
      .optional()
      .describe(
        `Maximum number of NFTs to scan from the newest end (1–${MAX_AUDIT_PAGE_LIMIT}).`,
      ),
    format: z
      .enum(['summary', 'csv_records', 'csv_signers', 'json'])
      .default('summary')
      .describe(
        'Output format: human-readable "summary", Excel-safe "csv_records" / "csv_signers", or SHA-256 verifiable "json".',
      ),
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
          [
            'Result',
            'not found (missing or lacks radix_sign_collection = v1 marker)',
          ],
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
        [
          'Holder / Issuer',
          result.issuer.orgName || result.issuer.name || '(unnamed)',
        ],
        ['Domain proof', formatDomainProof(result.issuer.domainVerification)],
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
        [
          'Standard v1 & brand',
          integritySummary.standardOk ? 'VERIFIED' : 'WARNING',
        ],
        [
          'Locked custody chain',
          integritySummary.custodyOk ? 'VERIFIED' : 'WARNING',
        ],
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
              r.kind === 'multi_request'
                ? `${r.signedCount}/${r.totalSigners}`
                : String(r.signers.length),
              `${r.docHash.slice(0, 12)}…${r.docHash.slice(-8)}`,
              r.txId ?? '—',
            ]),
          )
        : 'No records match the selected filters.',
      cliSection(`Participating Radix accounts (${filteredSigners.length})`),
      filteredSigners.length > 0
        ? cliTable(
            [
              'Account',
              'Seal verified',
              'Invited',
              'Signed',
              'Pending',
              'Last activity',
            ],
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
      .describe(
        'Optional Radix network; auto-detected from account prefix when omitted, or verified to match.',
      ),
    sealResource: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe(
        'Optional Radix Seal brand resource override (useful when testing a freshly deployed Mainnet or Stokenet Seal before env redeploy).',
      ),
    collections: z
      .array(z.string().regex(RADIX_RESOURCE_RE))
      .max(20)
      .optional()
      .describe(
        'Optional known signing collection addresses to inspect alongside vault holdings (needed for brand-new collections with 0 minted NFTs).',
      ),
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
