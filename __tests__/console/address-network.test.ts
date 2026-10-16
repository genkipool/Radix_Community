import { describe, expect, it } from 'vitest';

import { networkOfAddress, otherNetworkOf } from '@/features/console/lib/address-network';

describe('address network', () => {
  it('reads the network from the bech32 prefix', () => {
    expect(networkOfAddress('locker_rdx1cz9xexample')).toBe('mainnet');
    expect(networkOfAddress('locker_tdx_2_1cz9xexample')).toBe('stokenet');
    expect(networkOfAddress('not an address')).toBeNull();
  });

  it('flags only an address of the other network', () => {
    expect(otherNetworkOf('pool_tdx_2_1abc', 'mainnet')).toBe('stokenet');
    expect(otherNetworkOf('pool_rdx1abc', 'stokenet')).toBe('mainnet');
    expect(otherNetworkOf('pool_rdx1abc', 'mainnet')).toBeNull();
    expect(otherNetworkOf('pool_', 'mainnet')).toBeNull();
  });
});
