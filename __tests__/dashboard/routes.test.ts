import { describe, it, expect } from 'vitest';
import {
  dashboardRoutes,
  legacyDashboardRedirect,
  networkOfAddress,
  parseDashboardQuery,
  resolveEntityKind,
  segmentToView,
  serializeDashboardQuery,
  viewToSegment,
} from '@/features/dashboard/lib/routes';

describe('view ↔ segment', () => {
  it('maps both ways and rejects unknown segments', () => {
    expect(viewToSegment('staking')).toBe('staking');
    expect(viewToSegment('transactions')).toBe('explorer');
    expect(segmentToView('staking')).toBe('staking');
    expect(segmentToView('explorer')).toBe('transactions');
    expect(segmentToView('transactions')).toBeNull();
    expect(segmentToView('nope')).toBeNull();
  });
});

describe('resolveEntityKind', () => {
  it('reads the kind off the address prefix', () => {
    expect(resolveEntityKind('txid_rdx1abc')).toBe('tx');
    expect(resolveEntityKind('transactionintent_rdx1abc')).toBe('tx');
    expect(resolveEntityKind('resource_rdx1abc')).toBe('resource');
    expect(resolveEntityKind('account_tdx_2_1abc')).toBe('account');
    expect(resolveEntityKind('validator_rdx1abc')).toBe('validator');
    expect(resolveEntityKind('component_rdx1abc')).toBe('component');
    expect(resolveEntityKind('pool_rdx1abc')).toBe('component');
  });

  it('returns null for anything that is not an entity', () => {
    expect(resolveEntityKind('hello')).toBeNull();
    expect(resolveEntityKind('')).toBeNull();
    expect(resolveEntityKind(null)).toBeNull();
    expect(resolveEntityKind(undefined)).toBeNull();
  });
});

describe('networkOfAddress', () => {
  it('reads the ledger out of the address itself', () => {
    // Which is what lets a bare link — no `?network=` — still open on the right
    // ledger, in the PDF certificate above all.
    expect(networkOfAddress('txid_rdx1abc')).toBe('mainnet');
    expect(networkOfAddress('txid_tdx_2_1abc')).toBe('stokenet');
    expect(networkOfAddress('resource_tdx_2_1n20d5q2y9p46zrjaw')).toBe('stokenet');
    expect(networkOfAddress('validator_tdx_2_1s0wluv529800cm8un')).toBe('stokenet');
    expect(
      networkOfAddress('account_rdx12yy8p2v6z9k3xqe4m7c5n8w0r1t2u3i4o5p6a7s8d9f0'),
    ).toBe('mainnet');
  });

  it('is not fooled by the data part, which cannot hold an underscore', () => {
    // Only the human-readable prefix has underscores; `tdx` inside the body is
    // just bech32 data.
    expect(networkOfAddress('txid_rdx1tdx2qqq')).toBe('mainnet');
  });

  it('returns null when nothing says', () => {
    expect(networkOfAddress('hello')).toBeNull();
    expect(networkOfAddress('')).toBeNull();
    expect(networkOfAddress(null)).toBeNull();
    expect(networkOfAddress(undefined)).toBeNull();
  });
});

describe('parseDashboardQuery', () => {
  it('keeps valid view state', () => {
    expect(
      parseDashboardQuery({
        network: 'stokenet',
        start: '2026-01-01',
        end: '2026-02-01',
        tag: 'Success',
        entity: 'resource_rdx1abc',
      }),
    ).toEqual({
      network: 'stokenet',
      start: '2026-01-01',
      end: '2026-02-01',
      tag: 'Success',
      entity: 'resource_rdx1abc',
    });
  });

  it('drops anything malformed instead of trusting it', () => {
    expect(
      parseDashboardQuery({
        network: 'bitcoin',
        start: 'yesterday',
        end: '01/02/2026',
        tag: 'DROP TABLE',
        entity: 'not-an-address',
      }),
    ).toEqual({
      network: undefined,
      start: undefined,
      end: undefined,
      tag: undefined,
      entity: undefined,
    });
  });

  it('accepts the legacy `tx` name and url-encoded tags', () => {
    const q = parseDashboardQuery({ tx: 'txid_rdx1abc', tag: 'With%20NFTs' });
    expect(q.entity).toBe('txid_rdx1abc');
    expect(q.tag).toBe('With NFTs');
  });

  it('takes the first value when a param repeats', () => {
    expect(parseDashboardQuery({ network: ['stokenet', 'mainnet'] }).network).toBe(
      'stokenet',
    );
  });
});

describe('serializeDashboardQuery', () => {
  it('round-trips through parse', () => {
    const query = {
      network: 'mainnet' as const,
      start: '2026-01-01',
      end: '2026-02-01',
      tag: 'Failed' as const,
      entity: 'account_rdx1abc',
    };
    const parsed = parseDashboardQuery(
      Object.fromEntries(new URLSearchParams(serializeDashboardQuery(query))),
    );
    expect(parsed).toEqual(query);
  });

  it('omits defaults and empty state so URLs stay short', () => {
    expect(serializeDashboardQuery({})).toBe('');
    expect(serializeDashboardQuery({ tag: 'All' })).toBe('');
    expect(serializeDashboardQuery({ network: 'mainnet' })).toBe('?network=mainnet');
  });
});

describe('dashboardRoutes', () => {
  it('builds canonical paths', () => {
    expect(dashboardRoutes.staking('es')).toBe('/es/dashboard/staking');
    expect(dashboardRoutes.explorer('en')).toBe('/en/dashboard/explorer');
    expect(dashboardRoutes.view('es', 'transactions')).toBe('/es/dashboard/explorer');
    expect(dashboardRoutes.view('es', 'staking', { network: 'stokenet' })).toBe(
      '/es/dashboard/staking?network=stokenet',
    );
  });

  it('gives every known entity kind its own path', () => {
    expect(dashboardRoutes.entity('es', 'resource_rdx1abc', { network: 'mainnet' })).toBe(
      '/es/dashboard/resource/resource_rdx1abc?network=mainnet',
    );
    expect(dashboardRoutes.entity('es', 'txid_rdx1abc')).toBe(
      '/es/dashboard/tx/txid_rdx1abc',
    );
    expect(dashboardRoutes.entity('en', 'account_rdx1abc')).toBe(
      '/en/dashboard/account/account_rdx1abc',
    );
    expect(dashboardRoutes.entity('es', 'validator_rdx1abc')).toBe(
      '/es/dashboard/validator/validator_rdx1abc',
    );
  });

  it('falls back to the explorer for kinds without a route yet', () => {
    expect(dashboardRoutes.entity('es', 'component_rdx1abc')).toBe(
      '/es/dashboard/explorer?entity=component_rdx1abc',
    );
  });
});

describe('legacyDashboardRedirect', () => {
  it('sends a focused old URL straight to the entity page', () => {
    expect(
      legacyDashboardRedirect('es', {
        view: 'transactions',
        network: 'mainnet',
        tx: 'resource_rdx1abc',
      }),
    ).toBe('/es/dashboard/resource/resource_rdx1abc?network=mainnet');
  });

  it('does the same when the entity is the only hint, as the old page did', () => {
    expect(legacyDashboardRedirect('es', { tx: 'txid_rdx1abc' })).toBe(
      '/es/dashboard/tx/txid_rdx1abc',
    );
  });

  it('infers the explorer from a date range', () => {
    expect(legacyDashboardRedirect('en', { start: '2026-01-01' })).toBe(
      '/en/dashboard/explorer?start=2026-01-01',
    );
  });

  it('defaults to staking, which is what a bare /dashboard showed', () => {
    expect(legacyDashboardRedirect('es', {})).toBe('/es/dashboard/staking');
    expect(legacyDashboardRedirect('es', { network: 'stokenet' })).toBe(
      '/es/dashboard/staking?network=stokenet',
    );
  });

  it('does not carry junk through the redirect', () => {
    expect(legacyDashboardRedirect('es', { tx: 'javascript:alert(1)' })).toBe(
      '/es/dashboard/staking',
    );
  });
});
