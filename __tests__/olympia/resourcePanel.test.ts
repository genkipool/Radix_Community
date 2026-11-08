import { describe, expect, it } from 'vitest';
import { olympiaResourceConfig, olympiaResourceMetadata } from '@/features/dashboard/explorador/olympia/OlympiaResourcePanel';
import type { OlympiaResource } from '@/types/olympia';

const token = (r: Partial<OlympiaResource>): OlympiaResource => ({
  rri: 'gum_rr1qtest', babylonAddress: null, symbol: 'GUM', name: 'Gum', description: 'A test token', url: 'https://example.org',
  iconUrl: 'https://example.org/i.png', isMutable: false, granularity: '1', owner: null, createdStateVersion: 10,
  totalSupply: '100', totalMinted: '100', totalBurnt: '0', holders: 3, topHolders: [], ...r,
});
const tt = { role_resolution_owner: 'Owner', role_resolution_allow_all: 'Allow All', role_resolution_deny_all: 'Deny All' };

describe('Olympia token tabs', () => {
  it('turns its fields into locked metadata entries', () => {
    const items = olympiaResourceMetadata(token({}));
    expect(items.map((m) => m.key)).toEqual(['name', 'symbol', 'description', 'icon_url', 'info_url']);
    expect(items.every((m) => m.is_locked)).toBe(true);
    expect(olympiaResourceMetadata(token({ name: null, description: null, url: null, iconUrl: null })).map((m) => m.key)).toEqual(['symbol']);
  });

  it('lets nobody mint or burn a fixed-supply token', () => {
    const roles = olympiaResourceConfig(token({ isMutable: false }), tt);
    expect(roles.find((r) => r.name === 'minter')?.resolution).toBe('Deny All');
    expect(roles.find((r) => r.name === 'minter')?.ruleAddress).toBeNull();
    expect(roles.every((r) => !r.updatable)).toBe(true);
  });

  it('gives minting and burning of a mutable token to its owner', () => {
    const roles = olympiaResourceConfig(token({ isMutable: true, owner: 'rdx1qspowner' }), tt);
    const minter = roles.find((r) => r.name === 'minter');
    expect(minter?.resolution).toBe('Owner');
    expect(minter?.ruleAddress).toBe('rdx1qspowner');
    expect(roles.find((r) => r.name === 'withdrawer')?.resolution).toBe('Allow All');
  });
});
