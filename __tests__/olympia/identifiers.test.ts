import { describe, expect, it } from 'vitest';
import { decodeOlympiaMessage, olympiaKindOf, symbolOfRri } from '@/features/dashboard/lib/olympia';
import { dashboardRoutes, networkOfAddress, parseDashboardQuery, resolveEntityKind } from '@/features/dashboard/lib/routes';
import { isRadixAddress } from '@/features/dashboard/utils/radixAddress';

const ACCOUNT = 'rdx1qspxhhwwhfqpzprvkfgz6ytkdxvqcy6e65nmdv0cdvs8dar2szenq3gruxhkv';
const VALIDATOR = 'rv1q0rd59efueuu80mg8jedescygakhee8jvc8fcz92k4gjyrhxf9dmxqsjrxm';
const XRD = 'xrd_rr1qy5wfsfh';
const TOKEN = 'oci_rr1qws04shqrz3cdjljdp5kezgv7ddsq5l0hqqaxlzgfquqdysrnp';
const TX = 'a6bb9fce9e9b90f5cd5fb286df0ce530eb95d9ff5ea0501bf33c057b54c295ca';
const BABYLON = 'account_rdx168u7hevd7s30a3hj8cu6qvp4ffehm5f3xvzet3gspdsdc2cq7y6tjq';

describe('olympiaKindOf', () => {
  it('recognises every Olympia identifier', () => {
    expect(olympiaKindOf(ACCOUNT)).toBe('account');
    expect(olympiaKindOf(VALIDATOR)).toBe('validator');
    expect(olympiaKindOf(XRD)).toBe('resource');
    expect(olympiaKindOf(TOKEN)).toBe('resource');
    expect(olympiaKindOf(TX)).toBe('tx');
    expect(olympiaKindOf(TX.toUpperCase())).toBe('tx');
  });

  it('never claims a Babylon address or a fragment', () => {
    expect(olympiaKindOf(BABYLON)).toBeNull();
    expect(olympiaKindOf('resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd')).toBeNull();
    expect(olympiaKindOf('txid_rdx1abc')).toBeNull();
    expect(olympiaKindOf('rdx1qsp')).toBeNull();
    expect(olympiaKindOf(TX.slice(1))).toBeNull();
    expect(olympiaKindOf('')).toBeNull();
    expect(olympiaKindOf(null)).toBeNull();
  });

  it('reads the symbol of an RRI', () => {
    expect(symbolOfRri(XRD)).toBe('XRD');
    expect(symbolOfRri(TOKEN)).toBe('OCI');
  });
});

describe('routing of Olympia identifiers', () => {
  it('resolves to the olympia route, on mainnet', () => {
    for (const v of [ACCOUNT, VALIDATOR, XRD, TX]) {
      expect(resolveEntityKind(v)).toBe('olympia');
      expect(networkOfAddress(v)).toBe('mainnet');
      expect(dashboardRoutes.entity('es', v)).toBe(`/es/dashboard/olympia/${v}`);
    }
  });

  it('keeps Babylon routing unchanged', () => {
    expect(resolveEntityKind(BABYLON)).toBe('account');
    expect(dashboardRoutes.entity('en', BABYLON)).toBe(`/en/dashboard/account/${BABYLON}`);
  });

  it('accepts Olympia values as a focused entity and as a search destination', () => {
    expect(parseDashboardQuery({ entity: ACCOUNT }).entity).toBe(ACCOUNT);
    expect(isRadixAddress(ACCOUNT)).toBe(true);
    expect(isRadixAddress(TX)).toBe(true);
    expect(isRadixAddress('hello')).toBe(false);
  });
});

const hex = (s: string) => Buffer.from(s, 'utf8').toString('hex');

describe('decodeOlympiaMessage', () => {
  it('reads plaintext written as hex text with the 00 00 header', () => {
    const stored = hex(`0000${Buffer.from('Some tokens for you!').toString('hex')}`);
    expect(decodeOlympiaMessage(stored)).toEqual({ kind: 'text', text: 'Some tokens for you!' });
  });

  it('flags encrypted messages', () => {
    expect(decodeOlympiaMessage(hex('01ff02c1cbe65eaf7b72'))?.kind).toBe('encrypted');
  });

  it('reads plain text sent as is', () => {
    const quote = 'The only way of discovering the limits of the possible';
    expect(decodeOlympiaMessage(hex(quote))).toEqual({ kind: 'text', text: quote });
  });

  it('rejects malformed input', () => {
    expect(decodeOlympiaMessage('zz')).toBeNull();
    expect(decodeOlympiaMessage('abc')).toBeNull();
    expect(decodeOlympiaMessage(null)).toBeNull();
  });
});
