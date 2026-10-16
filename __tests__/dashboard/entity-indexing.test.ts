// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// The module reads the ledger through cached server functions; the rule under test is pure.
vi.mock('@/services/gateway/entities', () => ({ fetchEntityDetailsForCard: vi.fn() }));
vi.mock('@/lib/seo', () => ({ buildMetadata: vi.fn() }));

import { isEntityIndexable } from '@/features/dashboard/server/entityMetadata';

const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';

const named = (name: string, linked = true) => ({
  metadata: { items: [{ key: 'name', value: { typed: { value: name } } }] },
  details: linked ? { two_way_linked_dapps: { items: [{ dapp_address: 'account_rdx1…' }] } } : {},
});

describe('which entity pages a search engine may index', () => {
  it('never indexes accounts, transactions or anything on Stokenet', () => {
    expect(isEntityIndexable('account', 'mainnet', 'account_rdx1…', null)).toBe(false);
    expect(isEntityIndexable('tx', 'mainnet', 'txid_rdx1…', null)).toBe(false);
    expect(isEntityIndexable('validator', 'stokenet', 'validator_tdx_2_1…', null)).toBe(false);
    expect(isEntityIndexable('resource', 'stokenet', TOKEN, named('Token'))).toBe(false);
  });

  it('indexes XRD and resources a dApp verifiably claims', () => {
    expect(isEntityIndexable('resource', 'mainnet', XRD, null)).toBe(true);
    expect(isEntityIndexable('resource', 'mainnet', TOKEN, named('Ocean Token'))).toBe(true);
    expect(isEntityIndexable('resource', 'mainnet', TOKEN, named('Some Token', false))).toBe(false);
  });

  it('keeps bait names out even when linked', () => {
    expect(isEntityIndexable('resource', 'mainnet', TOKEN, named('Free XRD airdrop'))).toBe(false);
  });

  it('indexes components only with a verified dApp, and validators as before', () => {
    expect(isEntityIndexable('component', 'mainnet', 'component_rdx1…', { details: { two_way_linked_dapp_address: 'account_rdx1…' } })).toBe(true);
    expect(isEntityIndexable('component', 'mainnet', 'component_rdx1…', {})).toBe(false);
    expect(isEntityIndexable('validator', 'mainnet', 'validator_rdx1…', null)).toBe(true);
  });
});
