import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMcpRegistry } from '@/services/mcp/tools';
import { generateSkillMarkdown } from '@/services/mcp/skills';
import * as auditServer from '@/features/sign/lib/collection-audit.server';
import * as custody from '@/features/sign/lib/onchain-custody';
import type { CollectionAuditResponse } from '@/features/sign/lib/collection-audit';

const ctx = { origin: 'https://radix.example' };
const COLLECTION_STOKENET =
  'resource_tdx_2_1ng3g2nj5pfpmdphgz0nrh8z0gtqcxx5z5dn48t85ar0z0zjhefufaw';
const COLLECTION_MAINNET =
  'resource_rdx1nfe2dyryeefpzps8tu669j07v6ua4yrk0vh4773m00a4u3d2twg4xt';
const SIGNER_A =
  'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
const DOC_HASH = 'a'.repeat(64);

const mockAudit: CollectionAuditResponse = {
  found: true,
  networkId: 2,
  collection: COLLECTION_STOKENET,
  ledgerStateVersion: 35700000,
  ledgerTimestamp: '2026-11-25T04:00:00.000Z',
  totalSupply: 2,
  scannedFromId: 1,
  scannedToId: 2,
  hasMoreOlder: false,
  issuer: {
    account: 'account_tdx_2_12issuer0000000000000000000000000000000',
    name: 'Ministerio Demo',
    symbol: 'MIND',
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
      id: `${COLLECTION_STOKENET}:#1#`,
      kind: 'multi_request',
      docHash: DOC_HASH,
      requestKey: `${COLLECTION_STOKENET}:#1#`,
      nftIds: ['#1#'],
      firstNumericId: 1,
      stateVersion: 35699900,
      committedAt: '2026-11-25T03:00:00.000Z',
      issuedAt: '2026-11-25T02:59:55.000Z',
      txId: 'txid_tdx_2_1sampletx000000000000000000000000000',
      clockAgrees: true,
      status: 'complete',
      anomalies: [],
      requiredSigners: [SIGNER_A],
      signers: [
        {
          account: SIGNER_A,
          index: 0,
          signed: true,
          signedAt: '2026-11-25T03:05:00.000Z',
          txId: 'txid_tdx_2_1sigtx00000000000000000000000000000',
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
      firstActivityAt: '2026-11-25T03:05:00.000Z',
      lastActivityAt: '2026-11-25T03:05:00.000Z',
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MCP audit_seal_collection tool', () => {
  it('is registered and documented in SKILL.md', () => {
    const tool = getMcpRegistry()
      .list()
      .find((t) => t.name === 'audit_seal_collection');
    expect(tool).toBeDefined();
    expect(tool?.readOnly).toBe(true);

    const skill = generateSkillMarkdown('https://radix.example');
    expect(skill).toContain('### `audit_seal_collection`');
  });

  it('rejects Mainnet/Stokenet mismatches without hitting the Gateway', async () => {
    const spy = vi.spyOn(auditServer, 'auditSignCollection');
    const res = await getMcpRegistry().call(
      'audit_seal_collection',
      { collection: COLLECTION_MAINNET, network: 'stokenet' },
      ctx,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Network mismatch');
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders summary, CSV exports, and SHA-256 JSON package cleanly', async () => {
    vi.spyOn(auditServer, 'auditSignCollection').mockResolvedValue(mockAudit);

    const summary = await getMcpRegistry().call(
      'audit_seal_collection',
      { collection: COLLECTION_STOKENET, locale: 'es' },
      ctx,
    );
    expect(summary.isError).toBeUndefined();
    const summaryText = summary.content[0].text;
    expect(summaryText).toContain('STOKENET TESTNET');
    expect(summaryText).toContain('Ministerio de Economía (Demo)');
    expect(summaryText).toContain('1/1');
    expect(summaryText).toContain(
      `https://radix.example/es/console/sign-audit?collection=${COLLECTION_STOKENET}`,
    );

    const csv = await getMcpRegistry().call(
      'audit_seal_collection',
      { collection: COLLECTION_STOKENET, format: 'csv_records' },
      ctx,
    );
    expect(csv.content[0].text).toContain('document_hash_blake2b256');
    expect(csv.content[0].text).toContain(DOC_HASH);
    expect(csv.content[0].text).not.toContain('signer_local_alias_non_onchain');

    const signersCsv = await getMcpRegistry().call(
      'audit_seal_collection',
      { collection: COLLECTION_STOKENET, format: 'csv_signers' },
      ctx,
    );
    expect(signersCsv.content[0].text).toContain(SIGNER_A);

    const jsonRes = await getMcpRegistry().call(
      'audit_seal_collection',
      { collection: COLLECTION_STOKENET, format: 'json' },
      ctx,
    );
    const pkg = JSON.parse(jsonRes.content[0].text);
    expect(pkg.schema).toBe('radix-seal-audit/v1');
    expect(pkg.isTestnet).toBe(true);
    expect(pkg.integrityDigestSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('MCP Radix Seal registry & signing tools', () => {
  const ACCOUNT_STOKENET =
    'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
  const ACCOUNT_MAINNET =
    'account_rdx1294nuugua2yk633e75sfvk27rk7knwf0sxw20lzxjsqxkhk08eux56';
  const SEAL_BRAND_STOKENET =
    'resource_tdx_2_1n20d5q2y9p46zrjaw543vcpdmk3dygtlq4uzyw2zvssg48cxsteu3e';
  const SEAL_RUID =
    '{1111111111111111-1111111111111111-1111111111111111-1111111111111111}';
  const SEAL_GLOBAL_STOKENET = `${SEAL_BRAND_STOKENET}:${SEAL_RUID}`;

  it('registers get_seal_account_state and build_seal_manifest in SKILL.md', () => {
    const names = getMcpRegistry()
      .list()
      .map((t) => t.name);
    expect(names).toContain('get_seal_account_state');
    expect(names).toContain('build_seal_manifest');

    const skill = generateSkillMarkdown('https://radix.example');
    expect(skill).toContain('### `get_seal_account_state`');
    expect(skill).toContain('### `build_seal_manifest`');
  });

  it('rejects Mainnet/Stokenet mismatches in get_seal_account_state and build_seal_manifest', async () => {
    const res1 = await getMcpRegistry().call(
      'get_seal_account_state',
      { account: ACCOUNT_MAINNET, network: 'stokenet' },
      ctx,
    );
    expect(res1.isError).toBe(true);
    expect(res1.content[0].text).toContain('Network mismatch');

    const res2 = await getMcpRegistry().call(
      'build_seal_manifest',
      {
        operation: 'create_request',
        account: ACCOUNT_STOKENET,
        collection: COLLECTION_STOKENET,
        docHash: DOC_HASH,
        requiredSigners: [ACCOUNT_MAINNET],
      },
      ctx,
    );
    expect(res2.isError).toBe(true);
    expect(res2.content[0].text).toContain('Network mismatch');
  });

  it('builds statically valid manifests with zero lock_fee across all 6 Seal registry operations', async () => {
    vi.spyOn(auditServer, 'getSealAccountState').mockResolvedValue({
      networkId: 2,
      account: ACCOUNT_STOKENET,
      sealResource: SEAL_BRAND_STOKENET,
      seals: [{ localId: SEAL_RUID, globalId: SEAL_GLOBAL_STOKENET }],
      collections: [
        {
          resourceAddress: COLLECTION_STOKENET,
          name: 'Ministerio Demo',
          symbol: 'MIND',
          orgName: 'Ministerio de Economía',
          orgUrl: 'https://economia.example',
          totalSupply: 3,
          nextId: 4,
          ownerSealGlobalId: SEAL_GLOBAL_STOKENET,
        },
      ],
    });
    vi.spyOn(custody, 'fetchLedgerTimestampNow').mockResolvedValue(
      '2026-11-25T05:00:00.000Z',
    );
    vi.spyOn(custody, 'entityDetails').mockResolvedValue([
      {
        address: COLLECTION_STOKENET,
        details: {
          role_assignments: {
            owner: {
              rule: {
                type: 'Protected',
                access_rule: {
                  type: 'ProofRule',
                  proof_rule: {
                    type: 'Require',
                    requirement: {
                      type: 'NonFungible',
                      non_fungible: {
                        resource_address: SEAL_BRAND_STOKENET,
                        local_id: { simple_rep: SEAL_RUID },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    const cases: Array<Record<string, unknown>> = [
      { operation: 'deploy_brand', network: 'stokenet' },
      {
        operation: 'mint_seal',
        account: ACCOUNT_STOKENET,
        sealResource: SEAL_BRAND_STOKENET,
      },
      {
        operation: 'create_collection',
        account: ACCOUNT_STOKENET,
        sealResource: SEAL_BRAND_STOKENET,
        name: 'Ministerio Demo',
        symbol: 'MIND',
        orgName: 'Ministerio de Economía',
        customMetadata: [{ key: 'area', value: 'Contratación', locked: true }],
      },
      {
        operation: 'update_identity',
        account: ACCOUNT_STOKENET,
        collection: COLLECTION_STOKENET,
        orgName: 'Ministerio Actualizado',
      },
      {
        operation: 'create_request',
        account: ACCOUNT_STOKENET,
        docHash: DOC_HASH,
        requiredSigners: [ACCOUNT_STOKENET, SIGNER_A],
        alsoSign: true,
      },
      {
        operation: 'sign_document',
        account: ACCOUNT_STOKENET,
        docHash: DOC_HASH,
        request: `${COLLECTION_STOKENET}:#1#`,
      },
    ];

    for (const args of cases) {
      const res = await getMcpRegistry().call('build_seal_manifest', args, ctx);
      expect(res.isError, res.content[0]?.text).toBeUndefined();
      const text = res.content[0].text;
      expect(text).toContain('statically validated by the Radix Engine Toolkit');
      expect(text).not.toContain('lock_fee');
    }
  });

  it('discovers 0-supply Mainnet collections via extraCollections and builds Mainnet manifests', async () => {
    const SEAL_BRAND_MAINNET =
      'resource_rdx1nf89ryugl2ytuh7lfcrpt7ghudnfah7gdcwwjw6y3e6v5cwrr5tfxs';
    const SEAL_GLOBAL_MAINNET = `${SEAL_BRAND_MAINNET}:${SEAL_RUID}`;

    vi.spyOn(custody, 'allAccountNonFungibleResources').mockResolvedValue([
      {
        resource_address: SEAL_BRAND_MAINNET,
        vaults: { items: [{ items: [SEAL_RUID] }] },
      },
    ]);
    const mockItems = [
      {
        address: SEAL_BRAND_MAINNET,
        metadata: { items: [] },
      },
      {
        address: COLLECTION_MAINNET,
        metadata: {
          items: [
            {
              key: 'radix_sign_collection',
              value: { typed: { type: 'String', value: 'v1' } },
            },
            {
              key: 'radix_seal',
              value: { typed: { type: 'GlobalAddress', value: SEAL_BRAND_MAINNET } },
            },
            {
              key: 'name',
              value: { typed: { type: 'String', value: 'GENKIPOOL SEAL' } },
            },
            {
              key: 'symbol',
              value: { typed: { type: 'String', value: 'GSEAL' } },
            },
            {
              key: 'org_name',
              value: { typed: { type: 'String', value: 'GENKIPOOL SEAL' } },
            },
          ],
        },
        details: {
          total_supply: '0',
          role_assignments: {
            owner: {
              rule: {
                type: 'Protected',
                access_rule: {
                  type: 'ProofRule',
                  proof_rule: {
                    type: 'Require',
                    requirement: {
                      type: 'NonFungible',
                      non_fungible: {
                        resource_address: SEAL_BRAND_MAINNET,
                        local_id: { simple_rep: SEAL_RUID },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];
    const entitySpy = vi
      .spyOn(custody, 'entityDetails')
      .mockImplementation(async (_net, addresses) =>
        mockItems.filter((item) => addresses.includes(item.address)),
      );
    vi.spyOn(custody, 'collectionSealBelongsTo').mockResolvedValue(true);
    vi.spyOn(custody, 'fetchLedgerTimestampNow').mockResolvedValue(
      '2026-11-25T05:25:00.000Z',
    );

    const stateRes = await getMcpRegistry().call(
      'get_seal_account_state',
      {
        account: ACCOUNT_MAINNET,
        sealResource: SEAL_BRAND_MAINNET,
        collections: [COLLECTION_MAINNET],
      },
      ctx,
    );
    expect(stateRes.isError, stateRes.content[0]?.text).toBeUndefined();
    const stateText = stateRes.content[0].text;
    expect(stateText).toContain('ACCOUNT STATE (MAINNET)');
    expect(stateText).toContain('Owned Seals          1');
    expect(stateText).toContain(SEAL_GLOBAL_MAINNET);
    expect(stateText).toContain('Owned collections    1');
    expect(stateText).toContain(COLLECTION_MAINNET);
    expect(stateText).toContain('GENKIPOOL SEAL');

    const passedCandidates = entitySpy.mock.calls.flatMap((c) => c[1]);
    expect(passedCandidates).toContain(COLLECTION_MAINNET);

    const mainnetCases: Array<Record<string, unknown>> = [
      { operation: 'deploy_brand', network: 'mainnet' },
      {
        operation: 'mint_seal',
        account: ACCOUNT_MAINNET,
        sealResource: SEAL_BRAND_MAINNET,
      },
      {
        operation: 'update_identity',
        account: ACCOUNT_MAINNET,
        collection: COLLECTION_MAINNET,
        orgName: 'GENKIPOOL SEAL',
      },
      {
        operation: 'create_request',
        account: ACCOUNT_MAINNET,
        sealResource: SEAL_BRAND_MAINNET,
        collection: COLLECTION_MAINNET,
        docHash: DOC_HASH,
        requiredSigners: [ACCOUNT_MAINNET],
        alsoSign: true,
      },
    ];

    for (const args of mainnetCases) {
      const res = await getMcpRegistry().call('build_seal_manifest', args, ctx);
      expect(res.isError, res.content[0]?.text).toBeUndefined();
      const text = res.content[0].text;
      expect(text).toContain('(MAINNET)');
      expect(text).toContain('statically validated by the Radix Engine Toolkit');
      expect(text).not.toContain('lock_fee');
      if (args.operation === 'update_identity' || args.operation === 'create_request') {
        expect(text).toContain(SEAL_BRAND_MAINNET);
        expect(text).toContain(SEAL_RUID);
      }
    }
  });

  it('builds sign_document inline with collection creation when account holds a Seal but no collection yet (Web parity)', async () => {
    const SEAL_BRAND_STOKENET =
      'resource_tdx_2_1nt7fs75249xwepan05v4uyp0hq7ret6tlwu4n32tl05tsualxz3x7j';
    const SEAL_RUID =
      '{0123456789abcdef-0123456789abcdef-0123456789abcdef-0123456789abcdef}';
    const SEAL_GLOBAL = `${SEAL_BRAND_STOKENET}:${SEAL_RUID}`;

    vi.spyOn(auditServer, 'getSealAccountState').mockResolvedValue({
      account: SIGNER_A,
      networkId: 2,
      sealResource: SEAL_BRAND_STOKENET,
      seals: [{ localId: SEAL_RUID, globalId: SEAL_GLOBAL }],
      collections: [],
    });
    vi.spyOn(custody, 'fetchLedgerTimestampNow').mockResolvedValue(
      '2026-11-25T19:00:00.000Z',
    );

    const res = await getMcpRegistry().call(
      'build_seal_manifest',
      {
        operation: 'sign_document',
        account: SIGNER_A,
        sealResource: SEAL_BRAND_STOKENET,
        docHash: DOC_HASH,
        request: `${COLLECTION_STOKENET}:#1#`,
      },
      ctx,
    );
    expect(res.isError, res.content[0]?.text).toBeUndefined();
    const text = res.content[0].text;
    expect(text).toContain('(created inline with first signature #1#)');
    expect(text).toContain('CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    expect(text).toContain(DOC_HASH);
    expect(text).toContain(`${COLLECTION_STOKENET}:#1#`);
    expect(text).toContain('statically validated by the Radix Engine Toolkit');
    expect(text).not.toContain('lock_fee');
  });
});
