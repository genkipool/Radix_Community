import { describe, it, expect, vi, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import en from '@/features/sign/locales/en.json';
import es from '@/features/sign/locales/es.json';
import {
  DEFAULT_AUDIT_FILTERS,
  buildSignerDirectory,
  computeAuditKpis,
  filterAuditRecords,
  finalizeAuditRecords,
  groupCollectionNfts,
  type CollectionAuditResponse,
} from '@/features/sign/lib/collection-audit';
import {
  buildAuditJsonPackage,
  recordsToAuditCsv,
  sanitizeCsvCell,
  signersToAuditCsv,
} from '@/features/sign/lib/audit-export';
import { buildAuditReportPdf } from '@/features/sign/lib/audit-pdf';
import {
  inspectCollectionIntegrity,
  type EntityDetailsItem,
  type LedgerCommit,
  type NfRecord,
  type SignerBatchResult,
} from '@/features/sign/lib/onchain-custody';

const COLLECTION = 'resource_tdx_2_1nfcollection0000000000000000000000000';
const SEAL_RES = 'resource_tdx_2_1n2dnu585z0c6hsl9tvlqaufnrxstepwpdjv5tumvrslqq77t7dgrwm';
const ISSUER = 'account_tdx_2_12issuer00000000000000000000000000000000';
const SIGNER_A = 'account_tdx_2_12signera0000000000000000000000000000000';
const SIGNER_B = 'account_tdx_2_12signerb0000000000000000000000000000000';
const DOC_HASH_1 = 'a'.repeat(64);
const DOC_HASH_2 = 'b'.repeat(64);
const DOC_HASH_3 = 'c'.repeat(64);

function makeNf(
  fields: Record<string, string>,
  stateVersion: number,
): NfRecord {
  return { fields, stateVersion };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collection-audit domain engine', () => {
  it('groups multi-party invite batches, deduplicates local initiator signature, and separates solo/cipher records', () => {
    const map = new Map<string, NfRecord>([
      [
        '#1#',
        makeNf(
          {
            kind: 'invite',
            document_hash: DOC_HASH_1,
            signer: ISSUER,
            signer_index: '0',
            signer_count: '2',
            first_id: '1',
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-20T10:00:00.000Z',
          },
          100,
        ),
      ],
      [
        '#2#',
        makeNf(
          {
            kind: 'invite',
            document_hash: DOC_HASH_1,
            signer: SIGNER_A,
            signer_index: '1',
            signer_count: '2',
            first_id: '1',
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-20T10:00:00.000Z',
          },
          100,
        ),
      ],
      [
        '#3#',
        makeNf(
          {
            kind: 'signature',
            document_hash: DOC_HASH_1,
            signer: ISSUER,
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-20T10:00:00.000Z',
          },
          100,
        ),
      ],
      [
        '#4#',
        makeNf(
          {
            kind: 'signature',
            document_hash: DOC_HASH_2,
            signer: ISSUER,
            request: '',
            issued_at: '2026-11-21T12:00:00.000Z',
          },
          200,
        ),
      ],
      [
        '#5#',
        makeNf(
          {
            kind: 'cipher-signature',
            document_hash: DOC_HASH_3,
            signer: ISSUER,
            request: '',
            issued_at: '2026-11-22T09:00:00.000Z',
          },
          300,
        ),
      ],
    ]);

    const drafts = groupCollectionNfts(COLLECTION, map);
    expect(drafts).toHaveLength(3);

    const multi = drafts.find((d) => d.kind === 'multi_request')!;
    expect(multi.requiredSigners).toEqual([ISSUER, SIGNER_A]);
    expect(multi.nftIds).toEqual(['#1#', '#2#', '#3#']);
    expect(multi.anomalies).toEqual([]);
    expect(multi.localInitiatorSignature?.nftGlobalId).toBe(`${COLLECTION}:#3#`);

    const solo = drafts.find((d) => d.kind === 'solo_signature')!;
    expect(solo.docHash).toBe(DOC_HASH_2);

    const cipher = drafts.find((d) => d.kind === 'cipher_signature')!;
    expect(cipher.docHash).toBe(DOC_HASH_3);
  });

  it('flags incomplete invite batches and clock mismatches without falsely accusing legacy non-ISO timestamps', () => {
    const map = new Map<string, NfRecord>([
      // Missing #2# of signer_count=2
      [
        '#1#',
        makeNf(
          {
            kind: 'invite',
            document_hash: DOC_HASH_1,
            signer: SIGNER_A,
            signer_index: '0',
            signer_count: '2',
            first_id: '1',
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-20T10:00:00.000Z',
          },
          100,
        ),
      ],
      // Backdated ISO issued_at (>10m gap) -> clock_mismatch
      [
        '#3#',
        makeNf(
          {
            kind: 'signature',
            document_hash: DOC_HASH_2,
            signer: ISSUER,
            request: '',
            issued_at: '2026-11-01T00:00:00.000Z',
          },
          200,
        ),
      ],
      // Legacy non-ISO locale date -> clockAgrees = null, NO anomaly
      [
        '#4#',
        makeNf(
          {
            kind: 'signature',
            document_hash: DOC_HASH_3,
            signer: ISSUER,
            request: '',
            issued_at: '07/19/2026 17:17:25',
          },
          300,
        ),
      ],
    ]);

    const drafts = groupCollectionNfts(COLLECTION, map);
    const commits = new Map<number, LedgerCommit>([
      [
        100,
        {
          confirmedAt: '2026-11-20T10:00:30.000Z',
          intentHash: 'txid_tdx_2_1batch0000',
        },
      ],
      [
        200,
        {
          confirmedAt: '2026-11-21T12:00:00.000Z',
          intentHash: 'txid_tdx_2_1backdated',
        },
      ],
      [
        300,
        {
          confirmedAt: '2026-11-22T12:00:00.000Z',
          intentHash: 'txid_tdx_2_1legacy000',
        },
      ],
    ]);

    const records = finalizeAuditRecords(drafts, commits, new Map());
    const incomplete = records.find((r) => r.docHash === DOC_HASH_1)!;
    expect(incomplete.status).toBe('anomaly');
    expect(incomplete.anomalies).toContain('incomplete_invite_batch');

    const backdated = records.find((r) => r.docHash === DOC_HASH_2)!;
    expect(backdated.status).toBe('anomaly');
    expect(backdated.anomalies).toContain('clock_mismatch');

    const legacy = records.find((r) => r.docHash === DOC_HASH_3)!;
    expect(legacy.status).toBe('recorded');
    expect(legacy.clockAgrees).toBeNull();
    expect(legacy.anomalies).toEqual([]);
  });

  it('resolves multi-party compliance, directory, filtering (date, status, alias, hash) and KPIs', () => {
    const map = new Map<string, NfRecord>([
      [
        '#1#',
        makeNf(
          {
            kind: 'invite',
            document_hash: DOC_HASH_1,
            signer: SIGNER_A,
            signer_index: '0',
            signer_count: '2',
            first_id: '1',
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-10T08:00:00.000Z',
          },
          100,
        ),
      ],
      [
        '#2#',
        makeNf(
          {
            kind: 'invite',
            document_hash: DOC_HASH_1,
            signer: SIGNER_B,
            signer_index: '1',
            signer_count: '2',
            first_id: '1',
            request: `${COLLECTION}:#1#`,
            issued_at: '2026-11-10T08:00:00.000Z',
          },
          100,
        ),
      ],
      [
        '#3#',
        makeNf(
          {
            kind: 'signature',
            document_hash: DOC_HASH_2,
            signer: ISSUER,
            request: '',
            issued_at: '2026-11-24T14:00:00.000Z',
          },
          200,
        ),
      ],
    ]);

    const drafts = groupCollectionNfts(COLLECTION, map);
    const commits = new Map<number, LedgerCommit>([
      [
        100,
        {
          confirmedAt: '2026-11-10T08:00:10.000Z',
          intentHash: 'txid_tdx_2_1req001',
        },
      ],
      [
        150,
        {
          confirmedAt: '2026-11-10T09:00:00.000Z',
          intentHash: 'txid_tdx_2_1sigA',
        },
      ],
      [
        200,
        {
          confirmedAt: '2026-11-24T14:00:10.000Z',
          intentHash: 'txid_tdx_2_1solo01',
        },
      ],
    ]);

    const signerResults = new Map<string, SignerBatchResult>([
      [
        SIGNER_A,
        {
          hasVerifiedSeal: true,
          hasOwnCollection: true,
          sealNftGlobalId: `${SEAL_RES}:{aaaa}`,
          ownCollectionAddresses: ['resource_tdx_2_1nfsiga'],
          signaturesByHash: new Map([
            [
              DOC_HASH_1,
              [
                {
                  stateVersion: 150,
                  issuedAt: '2026-11-10T08:59:55.000Z',
                  resourceAddress: 'resource_tdx_2_1nfsiga',
                  localId: '#1#',
                  nftGlobalId: 'resource_tdx_2_1nfsiga:#1#',
                },
              ],
            ],
          ]),
        },
      ],
      [
        SIGNER_B,
        {
          hasVerifiedSeal: false,
          hasOwnCollection: false,
          signaturesByHash: new Map(),
        },
      ],
      [
        ISSUER,
        {
          hasVerifiedSeal: true,
          hasOwnCollection: true,
          signaturesByHash: new Map(),
        },
      ],
    ]);

    const records = finalizeAuditRecords(drafts, commits, signerResults);
    // Sorted newest-first
    expect(records[0].docHash).toBe(DOC_HASH_2);
    expect(records[1].docHash).toBe(DOC_HASH_1);
    expect(records[1].status).toBe('partial');
    expect(records[1].signedCount).toBe(1);
    expect(records[1].totalSigners).toBe(2);
    expect(records[1].signers[0].inviteNftGlobalId).toBe(`${COLLECTION}:#1#`);
    expect(records[1].signers[0].nftGlobalId).toBe('resource_tdx_2_1nfsiga:#1#');
    expect(records[1].signers[1].inviteNftGlobalId).toBe(`${COLLECTION}:#2#`);
    expect(records[1].signers[1].nftGlobalId).toBeNull();

    const dir = buildSignerDirectory(records, signerResults);
    const signerAEntry = dir.find((s) => s.account === SIGNER_A)!;
    expect(signerAEntry.sealNftGlobalId).toBe(`${SEAL_RES}:{aaaa}`);
    expect(signerAEntry.ownCollectionAddresses).toEqual(['resource_tdx_2_1nfsiga']);
    expect(signerAEntry.nftRefs).toEqual(
      expect.arrayContaining([
        { kind: 'invite', nftGlobalId: `${COLLECTION}:#1#`, docHash: DOC_HASH_1 },
        { kind: 'signature', nftGlobalId: 'resource_tdx_2_1nfsiga:#1#', docHash: DOC_HASH_1 },
      ]),
    );

    const directory = buildSignerDirectory(records, signerResults);
    const entryA = directory.find((s) => s.account === SIGNER_A)!;
    const entryB = directory.find((s) => s.account === SIGNER_B)!;
    expect(entryA.hasVerifiedSeal).toBe(true);
    expect(entryA.signedCount).toBe(1);
    expect(entryA.pendingCount).toBe(0);
    expect(entryB.hasVerifiedSeal).toBe(false);
    expect(entryB.pendingCount).toBe(1);

    const aliasOf = (acc: string) =>
      acc === SIGNER_B ? 'Intervención General' : undefined;

    // Filter by date window
    const nov24 = filterAuditRecords(
      records,
      { ...DEFAULT_AUDIT_FILTERS, fromDate: '2026-11-20', toDate: '2026-11-25' },
      aliasOf,
    );
    expect(nov24).toHaveLength(1);
    expect(nov24[0].docHash).toBe(DOC_HASH_2);

    // Filter by local alias
    const byAlias = filterAuditRecords(
      records,
      { ...DEFAULT_AUDIT_FILTERS, query: 'intervención' },
      aliasOf,
    );
    expect(byAlias).toHaveLength(1);
    expect(byAlias[0].docHash).toBe(DOC_HASH_1);

    const kpis = computeAuditKpis(records);
    expect(kpis.totalRecords).toBe(2);
    expect(kpis.completeCount).toBe(1);
    expect(kpis.pendingCount).toBe(1);
    expect(kpis.completionRate).toBe(50);
    expect(kpis.uniqueSigners).toBe(3);
  });

  it('inspects collection integrity roles and custom metadata accurately', () => {
    const item: EntityDetailsItem = {
      address: COLLECTION,
      metadata: {
        items: [
          {
            key: 'radix_sign_collection',
            value: { typed: { type: 'String', value: 'v1' } },
            is_locked: true,
          },
          {
            key: 'radix_seal',
            value: { typed: { type: 'GlobalAddress', value: SEAL_RES } },
            is_locked: true,
          },
          {
            key: 'department',
            value: { typed: { type: 'String', value: 'Contratación Pública' } },
            is_locked: true,
          },
        ],
      },
      details: {
        total_supply: '4',
        total_burned: '0',
        non_fungible_data_mutable_fields: [],
        role_assignments: {
          owner: {
            updater: 'None',
            rule: {
              type: 'Protected',
              access_rule: {
                type: 'ProofRule',
                proof_rule: {
                  type: 'Require',
                  requirement: {
                    type: 'NonFungible',
                    non_fungible: {
                      resource_address: SEAL_RES,
                      local_id: { simple_rep: '{ruid}' },
                    },
                  },
                },
              },
            },
          },
          entries: [
            {
              role_key: { module: 'Main', name: 'burner' },
              assignment: { resolution: 'Explicit', explicit_rule: { type: 'DenyAll' } },
              updater_roles: [{ module: 'Main', name: 'burner_updater' }],
            },
            {
              role_key: { module: 'Main', name: 'burner_updater' },
              assignment: { resolution: 'Explicit', explicit_rule: { type: 'DenyAll' } },
              updater_roles: [],
            },
            {
              role_key: { module: 'Main', name: 'non_fungible_data_updater' },
              assignment: { resolution: 'Explicit', explicit_rule: { type: 'DenyAll' } },
              updater_roles: [
                { module: 'Main', name: 'non_fungible_data_updater_updater' },
              ],
            },
            {
              role_key: { module: 'Main', name: 'non_fungible_data_updater_updater' },
              assignment: { resolution: 'Explicit', explicit_rule: { type: 'DenyAll' } },
              updater_roles: [],
            },
          ],
        },
      },
    };

    const integrity = inspectCollectionIntegrity(item, SEAL_RES, ISSUER);
    expect(integrity.hasMarker).toBe(true);
    expect(integrity.officialBrand).toBe(true);
    expect(integrity.ownerLocked).toBe(true);
    expect(integrity.burnDenied).toBe(true);
    expect(integrity.dataImmutable).toBe(true);
    expect(integrity.issuerVerified).toBe(true);
    expect(integrity.totalBurned).toBe(0);
    expect(integrity.customMetadata).toEqual([
      { key: 'department', value: 'Contratación Pública', locked: true },
    ]);

    // Real Mainnet collections with `non_fungible_data_mutable_fields: ['key_image_url']`
    // and `non_fungible_data_updater: Owner` still lock every evidentiary field.
    const withMutableIcon: EntityDetailsItem = {
      ...item,
      details: {
        ...item.details,
        non_fungible_data_mutable_fields: ['key_image_url'],
        role_assignments: {
          ...item.details!.role_assignments,
          entries: item.details!.role_assignments!.entries!.map((e) =>
            e.role_key?.name === 'non_fungible_data_updater'
              ? { ...e, assignment: { resolution: 'Owner' } }
              : e,
          ),
        },
      },
    };
    expect(inspectCollectionIntegrity(withMutableIcon, SEAL_RES, ISSUER).dataImmutable).toBe(true);

    // Mutating an evidentiary field (e.g. `document_hash`) must fail `dataImmutable`.
    const withMutableHash: EntityDetailsItem = {
      ...withMutableIcon,
      details: {
        ...withMutableIcon.details,
        non_fungible_data_mutable_fields: ['document_hash'],
      },
    };
    expect(inspectCollectionIntegrity(withMutableHash, SEAL_RES, ISSUER).dataImmutable).toBe(false);
  });
});

describe('audit exporters (CSV, JSON & PDF)', () => {
  const sampleAudit: CollectionAuditResponse = {
    found: true,
    networkId: 2,
    collection: COLLECTION,
    ledgerStateVersion: 9876543,
    ledgerTimestamp: '2026-11-25T04:00:00.000Z',
    totalSupply: 1,
    scannedFromId: 1,
    scannedToId: 1,
    hasMoreOlder: false,
    issuer: {
      account: ISSUER,
      name: 'Ministerio Demo',
      symbol: 'MIN',
      orgName: 'Ministerio de Economía (Demo)',
      orgUrl: 'https://economia.example',
      iconUrl: null,
    },
    integrity: {
      hasMarker: true,
      officialBrand: true,
      ownerLocked: true,
      burnDenied: true,
      dataImmutable: true,
      issuerVerified: true,
      totalBurned: 0,
      customMetadata: [],
    },
    records: [
      {
        id: `${COLLECTION}:#1#`,
        kind: 'multi_request',
        docHash: DOC_HASH_1,
        requestKey: `${COLLECTION}:#1#`,
        nftIds: ['#1#'],
        firstNumericId: 1,
        stateVersion: 100,
        committedAt: '2026-11-24T10:00:00.000Z',
        issuedAt: '2026-11-24T09:59:50.000Z',
        txId: 'txid_tdx_2_1sample00000000000000000000000000000',
        clockAgrees: true,
        status: 'complete',
        anomalies: [],
        requiredSigners: [SIGNER_A],
        signers: [
          {
            account: SIGNER_A,
            index: 0,
            signed: true,
            signedAt: '2026-11-24T10:05:00.000Z',
            txId: 'txid_tdx_2_1signed00000000000000000000000000000',
            nftGlobalId: 'resource_tdx_2_1nfsiga:#1#',
            clockAgrees: true,
          },
        ],
        signedCount: 1,
        totalSigners: 1,
      },
    ],
    signers: [
      {
        account: SIGNER_A,
        hasVerifiedSeal: true,
        hasOwnCollection: true,
        invitedCount: 1,
        signedCount: 1,
        pendingCount: 0,
        cipherCount: 0,
        firstActivityAt: '2026-11-24T10:05:00.000Z',
        lastActivityAt: '2026-11-24T10:05:00.000Z',
      },
    ],
  };

  it('neutralizes CSV formula injection and respects GDPR local alias opt-in', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(sanitizeCsvCell('Normal, "Org"')).toBe('"Normal, ""Org"""');

    const csvNoAliases = recordsToAuditCsv(sampleAudit, sampleAudit.records, {
      includeAliases: false,
      aliasOf: () => '=EVIL()',
    });
    expect(csvNoAliases.startsWith('\uFEFF')).toBe(true);
    expect(csvNoAliases).not.toContain('signer_local_alias_non_onchain');
    expect(csvNoAliases).not.toContain('=EVIL()');

    const csvWithAliases = signersToAuditCsv(sampleAudit, sampleAudit.signers, {
      includeAliases: true,
      aliasOf: () => '=EVIL()',
    });
    expect(csvWithAliases).toContain('local_alias_non_onchain');
    expect(csvWithAliases).toContain("'=EVIL()");
  });

  it('produces a SHA-256 verifiable JSON package', async () => {
    const pkg = await buildAuditJsonPackage(
      sampleAudit,
      sampleAudit.records,
      sampleAudit.signers,
      DEFAULT_AUDIT_FILTERS,
      { includeAliases: false, exportedAt: '2026-11-25T05:00:00.000Z' },
    );
    expect(pkg.schema).toBe('radix-seal-audit/v1');
    expect(pkg.isTestnet).toBe(true);
    expect(pkg.integrityDigestSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds a valid multi-section Stokenet audit PDF with clickable explorer links', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const bytes = await buildAuditReportPdf({
      audit: sampleAudit,
      records: sampleAudit.records,
      signers: sampleAudit.signers,
      kpis: computeAuditKpis(sampleAudit.records),
      filters: DEFAULT_AUDIT_FILTERS,
      labels: es.sign.collection.audit.pdf,
      kindLabels: es.sign.collection.audit.records.kinds,
      locale: 'es-ES',
      origin: 'https://radix.example',
      auditUrl: `https://radix.example/es/console/sign-collection?tab=audit&collection=${COLLECTION}`,
      includeAliases: true,
      aliasOf: () => 'María López',
    });

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
    const raw = new TextDecoder('latin1').decode(
      await reloaded.save({ useObjectStreams: false }),
    );
    expect(raw).toContain('/dashboard/tx/txid_tdx_2_1sample');
    expect(raw).toContain('network=stokenet');
  });

  it('maintains 100% key parity between en.json and es.json for audit dictionary', () => {
    const collectKeys = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k;
        return v && typeof v === 'object' && !Array.isArray(v)
          ? collectKeys(v as Record<string, unknown>, path)
          : [path];
      });
    expect(collectKeys(en.sign.collection.audit)).toEqual(
      collectKeys(es.sign.collection.audit),
    );
  });
});
