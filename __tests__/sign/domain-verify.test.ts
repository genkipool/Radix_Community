import { describe, expect, it } from 'vitest';
import {
  buildDnsTxtRecord,
  buildWellKnownSnippet,
  buildWellKnownUrl,
  extractPublicDomain,
  matchesDnsTxtRecords,
  matchesWellKnownDocument,
} from '@/features/sign/lib/domain-verify';
import {
  domainVerifyInputSchema,
  isPrivateOrReservedIp,
} from '@/features/sign/lib/domain-verify.server';

const COL_MAINNET =
  'resource_rdx1n2ekdd2m0jsxjt9wasmu3p49twy2yfalpaa6wf08md46sk8dfmldnd';
const ACC_MAINNET =
  'account_rdx128y6j78mt0aqv6372evz28hrxp8mn06ccddkr7xppc88hyvynvjdwr';
const COL_STOKENET =
  'resource_tdx_2_1ntfwt60ucvctmw9ls8r9ec7fgu6aujmf7v0wpya8xkw3eg6nhs7y7x';
const ACC_STOKENET =
  'account_tdx_2_128y6j78mt0aqv6372evz28hrxp8mn06ccddkr7xppc88hyvynvjdwr';

describe('domain-verify (custody-free .well-known & DNS TXT SSoT)', () => {
  it('extracts valid public HTTPS domains and rejects unsafe or local URLs', () => {
    expect(extractPublicDomain('https://Economia.Gob.ES/firma')).toBe('economia.gob.es');
    expect(extractPublicDomain('radix.community')).toBe('radix.community');
    expect(extractPublicDomain('http://economia.gob.es')).toBeNull();
    expect(extractPublicDomain('https://localhost/foo')).toBeNull();
    expect(extractPublicDomain('https://127.0.0.1/.well-known')).toBeNull();
    expect(extractPublicDomain('https://169.254.169.254/latest')).toBeNull();
    expect(extractPublicDomain('https://internal.local')).toBeNull();
    expect(extractPublicDomain('https://user:pass@economia.gob.es')).toBeNull();
    expect(extractPublicDomain('https://economia.gob.es:8443')).toBeNull();
    expect(extractPublicDomain('')).toBeNull();
  });

  it('blocks private, loopback, link-local, CGNAT and ULA IPs (SSRF guard)', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);

    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    expect(isPrivateOrReservedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('builds and matches canonical .well-known JSON declarations on Mainnet and Stokenet', () => {
    expect(buildWellKnownUrl('economia.gob.es')).toBe(
      'https://economia.gob.es/.well-known/radix-seal.json',
    );
    for (const [col, acc] of [
      [COL_MAINNET, ACC_MAINNET],
      [COL_STOKENET, ACC_STOKENET],
    ] as const) {
      const colOnly = JSON.parse(buildWellKnownSnippet(col));
      expect(colOnly).toEqual({ v: 1, collections: [col] });
      expect(matchesWellKnownDocument(colOnly, { collection: col })).toBe(true);
      expect(matchesWellKnownDocument(colOnly, { account: acc })).toBe(false);

      const withAccount = JSON.parse(buildWellKnownSnippet(col, acc));
      expect(matchesWellKnownDocument(withAccount, { collection: col })).toBe(true);
      expect(matchesWellKnownDocument(withAccount, { account: acc })).toBe(true);
      expect(
        matchesWellKnownDocument(withAccount, { collection: 'resource_rdx1other' }),
      ).toBe(false);
    }
    expect(
      matchesWellKnownDocument(
        { v: 2, collections: [COL_MAINNET] },
        { collection: COL_MAINNET },
      ),
    ).toBe(false);
  });

  it('builds and matches canonical DNS TXT _radix-seal records on Mainnet and Stokenet', () => {
    for (const [col, acc] of [
      [COL_MAINNET, ACC_MAINNET],
      [COL_STOKENET, ACC_STOKENET],
    ] as const) {
      const rec = buildDnsTxtRecord('economia.gob.es', col);
      expect(rec.host).toBe('_radix-seal.economia.gob.es');
      expect(rec.value).toBe(`v=radix-seal1 collection=${col}`);
      expect(matchesDnsTxtRecords([rec.value], { collection: col })).toBe(true);
      expect(
        matchesDnsTxtRecords([`v=radix-seal1; account=${acc}`], { account: acc }),
      ).toBe(true);
      expect(matchesDnsTxtRecords([`collection=${col}`], { collection: col })).toBe(
        false,
      );
      expect(
        matchesDnsTxtRecords([rec.value], { collection: 'resource_rdx1other' }),
      ).toBe(false);
    }
  });

  it('validates domainVerifyInputSchema for both Mainnet and Stokenet addresses', () => {
    expect(
      domainVerifyInputSchema.safeParse({
        orgUrl: 'https://economia.gob.es',
        collection: COL_MAINNET,
        account: ACC_MAINNET,
      }).success,
    ).toBe(true);
    expect(
      domainVerifyInputSchema.safeParse({
        orgUrl: 'https://economia.gob.es',
        collection: COL_STOKENET,
        account: ACC_STOKENET,
      }).success,
    ).toBe(true);
    expect(
      domainVerifyInputSchema.safeParse({
        orgUrl: 'https://economia.gob.es',
      }).success,
    ).toBe(false);
  });
});
