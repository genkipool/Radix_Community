import { describe, expect, it } from 'vitest';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import {
  isSupportedNetworkId,
  networkIdFromAccount,
  networkIdFromName,
  networkIdFromResource,
  networkMatchesAccount,
  networkMatchesCollection,
  networkNameForId,
  optionalNetworkNameForId,
  splitNftGlobalId,
} from '@/features/sign/lib/network';
import { evaluateIntegritySummary } from '@/features/sign/lib/collection-audit';
import type { CollectionIntegrity } from '@/features/sign/lib/onchain-custody';
import {
  createAttestationPayload,
  looksLikeEnvelope,
} from '@/features/sign/lib/certificate';
import { buildAuditUrl } from '@/features/sign/lib/share';
import { resolveRequestSigners } from '@/features/sign/lib/sign-request';
import { isPdfFile } from '@/features/sign/lib/signed-pdf';

const MAINNET_COL = 'resource_rdx1n2ekdd2m0jsxjt9wasmu3p49twy2yfalpaa6wf08md46sk8dfmldnd';
const STOKENET_COL = 'resource_tdx_2_1nffscq3pm6s2e9ugup57hqrygpdvcnd2axadjnkdnlxg930agrg9nh';
const MAINNET_ACC = 'account_rdx128y6j78mt0aqv6372evz28hrxp8mn06ccddkr7xppc88hyvynvjdwr';
const STOKENET_ACC = 'account_tdx_2_128y6j78mt0aqv6372evz28hrxp8mn06ccddkr7xppc88hyvynvjdwr';

describe('features/sign/lib/network (SSoT)', () => {
  it('maps network ids and names symmetrically', () => {
    expect(isSupportedNetworkId(RadixNetworkId.Mainnet)).toBe(true);
    expect(isSupportedNetworkId(RadixNetworkId.Stokenet)).toBe(true);
    expect(isSupportedNetworkId(99)).toBe(false);

    expect(networkNameForId(RadixNetworkId.Mainnet)).toBe('mainnet');
    expect(networkNameForId(RadixNetworkId.Stokenet)).toBe('stokenet');
    expect(optionalNetworkNameForId(RadixNetworkId.Mainnet)).toBe('mainnet');
    expect(optionalNetworkNameForId(RadixNetworkId.Stokenet)).toBe('stokenet');
    expect(optionalNetworkNameForId(99)).toBeUndefined();

    expect(networkIdFromName('mainnet')).toBe(RadixNetworkId.Mainnet);
    expect(networkIdFromName('stokenet')).toBe(RadixNetworkId.Stokenet);
  });

  it('infers and enforces strict Mainnet / Stokenet address isolation', () => {
    expect(networkIdFromResource(MAINNET_COL)).toBe(RadixNetworkId.Mainnet);
    expect(networkIdFromResource(STOKENET_COL)).toBe(RadixNetworkId.Stokenet);
    expect(networkIdFromResource('invalid')).toBeNull();

    expect(networkIdFromAccount(MAINNET_ACC)).toBe(RadixNetworkId.Mainnet);
    expect(networkIdFromAccount(STOKENET_ACC)).toBe(RadixNetworkId.Stokenet);
    expect(networkIdFromAccount('invalid')).toBeNull();

    expect(networkMatchesCollection(RadixNetworkId.Mainnet, MAINNET_COL)).toBe(true);
    expect(networkMatchesCollection(RadixNetworkId.Stokenet, MAINNET_COL)).toBe(false);
    expect(networkMatchesAccount(RadixNetworkId.Stokenet, STOKENET_ACC)).toBe(true);
    expect(networkMatchesAccount(RadixNetworkId.Mainnet, STOKENET_ACC)).toBe(false);
  });

  it('splits NFT global ids cleanly', () => {
    expect(splitNftGlobalId(`${STOKENET_COL}:#42#`)).toEqual({
      resource: STOKENET_COL,
      localId: '#42#',
    });
    expect(splitNftGlobalId(`${MAINNET_COL}:{deadbeef}`)).toEqual({
      resource: MAINNET_COL,
      localId: '{deadbeef}',
    });
    expect(splitNftGlobalId(MAINNET_COL)).toEqual({
      resource: MAINNET_COL,
      localId: MAINNET_COL,
    });
  });
});

describe('evaluateIntegritySummary (SSoT)', () => {
  const baseIntegrity: CollectionIntegrity = {
    hasMarker: true,
    officialBrand: true,
    ownerLocked: true,
    burnDenied: true,
    dataImmutable: true,
    issuerVerified: true,
    totalBurned: 0,
    customMetadata: [],
  };

  it('returns allOk when every invariant holds', () => {
    expect(evaluateIntegritySummary(baseIntegrity)).toEqual({
      standardOk: true,
      custodyOk: true,
      immutableOk: true,
      allOk: true,
    });
  });

  it('flags standard, custody, or immutability violations individually', () => {
    expect(
      evaluateIntegritySummary({ ...baseIntegrity, officialBrand: false }),
    ).toEqual({
      standardOk: false,
      custodyOk: true,
      immutableOk: true,
      allOk: false,
    });

    expect(
      evaluateIntegritySummary({ ...baseIntegrity, ownerLocked: false }),
    ).toEqual({
      standardOk: true,
      custodyOk: false,
      immutableOk: true,
      allOk: false,
    });

    expect(
      evaluateIntegritySummary({ ...baseIntegrity, totalBurned: 1 }),
    ).toEqual({
      standardOk: true,
      custodyOk: true,
      immutableOk: false,
      allOk: false,
    });
  });
});

describe('buildAuditUrl (SSoT)', () => {
  it('builds canonical /console/sign-audit URLs with optional date filters', () => {
    expect(
      buildAuditUrl({
        origin: 'https://radix.community',
        locale: 'es',
        collection: STOKENET_COL,
      }),
    ).toBe(
      `https://radix.community/es/console/sign-audit?collection=${encodeURIComponent(STOKENET_COL)}`,
    );

    expect(
      buildAuditUrl({
        origin: 'https://radix.community/',
        locale: 'en',
        collection: MAINNET_COL,
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      }),
    ).toBe(
      `https://radix.community/en/console/sign-audit?collection=${encodeURIComponent(MAINNET_COL)}&from=2026-01-01&to=2026-12-31`,
    );
  });
});

describe('resolveRequestSigners (Web + MCP SSoT)', () => {
  it('includes initiator and deduplicates when alsoSign is true', () => {
    expect(
      resolveRequestSigners(STOKENET_ACC, [' account_tdx_2_1b ', STOKENET_ACC, ''], true),
    ).toEqual([STOKENET_ACC, 'account_tdx_2_1b']);
  });

  it('omits initiator when alsoSign is false', () => {
    expect(
      resolveRequestSigners(STOKENET_ACC, ['account_tdx_2_1b', 'account_tdx_2_1b'], false),
    ).toEqual(['account_tdx_2_1b']);
  });
});

describe('certificate & signed-pdf helpers (SSoT)', () => {
  it('builds canonical AttestationPayload with sorted unique signers', () => {
    const payload = createAttestationPayload({
      docHash: 'a'.repeat(64),
      fileName: 'contract.pdf',
      fileSize: 1234,
      signers: [' account_b ', 'account_a', 'account_b', ''],
      sortSigners: true,
      timestamp: '2026-11-25T10:00:00Z',
      networkId: RadixNetworkId.Stokenet,
      nonce: 'b'.repeat(64),
    });
    expect(payload.v).toBe(1);
    expect(payload.hashAlg).toBe('blake2b-256');
    expect(payload.signers).toEqual(['account_a', 'account_b']);
    expect(looksLikeEnvelope({ payload, signatures: [], onChain: null })).toBe(true);
    expect(looksLikeEnvelope({ payload: { docHash: 123 }, signatures: [] })).toBe(false);
  });

  it('detects PDF files by MIME type or extension', () => {
    expect(isPdfFile({ fileType: 'application/pdf', fileName: 'doc.bin' })).toBe(true);
    expect(isPdfFile({ fileType: '', fileName: 'REPORT.PDF' })).toBe(true);
    expect(isPdfFile({ fileType: 'text/plain', fileName: 'notes.txt' })).toBe(false);
  });
});
