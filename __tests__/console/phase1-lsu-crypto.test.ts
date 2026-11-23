import { describe, expect, it, vi } from 'vitest';
import {
  compareCryptoMarketCap,
  FALLBACK_CRYPTO_COINS,
  findCoin,
} from '@/features/console/lib/crypto-compare';
import { fetchLsuInfo } from '@/features/console/lib/lsu-lookup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';

describe('crypto-compare pure math', () => {
  const xrd = FALLBACK_CRYPTO_COINS.find((c) => c.id === 'radix')!;
  const btc = FALLBACK_CRYPTO_COINS.find((c) => c.id === 'bitcoin')!;

  it('projects Radix unit price at Bitcoin market cap accurately', () => {
    const res = compareCryptoMarketCap(xrd, btc, 'mcap', 0.9, 10000);
    expect(res).not.toBeNull();
    const expectedMult = btc.marketCapUsd / xrd.marketCapUsd;
    expect(res!.multiplier).toBeCloseTo(expectedMult, 6);
    expect(res!.projectedPriceUsd).toBeCloseTo(xrd.priceUsd * expectedMult, 6);
    expect(res!.projectedPriceEur).toBeCloseTo(res!.projectedPriceUsd * 0.9, 6);
    expect(res!.holding?.currentUsd).toBeCloseTo(10000 * xrd.priceUsd, 6);
    expect(res!.holding?.projectedUsd).toBeCloseTo(10000 * res!.projectedPriceUsd, 6);
  });

  it('supports FDV mode and coin lookup by symbol, id, or name', () => {
    const res = compareCryptoMarketCap(xrd, btc, 'fdv', 0.92);
    expect(res).not.toBeNull();
    expect(res!.baseCapUsd).toBe(xrd.fdvUsd);
    expect(res!.targetCapUsd).toBe(btc.fdvUsd);
    expect(findCoin(FALLBACK_CRYPTO_COINS, 'xrd')?.id).toBe('radix');
    expect(findCoin(FALLBACK_CRYPTO_COINS, 'Bitcoin')?.id).toBe('bitcoin');
  });

  it('returns null on invalid zero-cap or zero-price inputs', () => {
    expect(compareCryptoMarketCap({ ...xrd, priceUsd: 0 }, btc, 'mcap')).toBeNull();
    expect(compareCryptoMarketCap(xrd, { ...btc, marketCapUsd: 0 }, 'mcap')).toBeNull();
  });
});

describe('lsu-lookup pure parser', () => {
  it('resolves validator, vaults, exchange rate, and owner locked XRD', async () => {
    const post = vi.fn(async (_ep: string, body: Record<string, unknown>) => {
      const addrs = body.addresses as string[];
      if (addrs[0] === 'resource_rdx1lsu') {
        return {
          items: [{
            address: 'resource_rdx1lsu',
            details: { total_supply: '1000000' },
            metadata: {
              items: [
                { key: 'name', value: { typed: { type: 'String', value: 'Genki LSU' } } },
                { key: 'symbol', value: { typed: { type: 'String', value: 'LSU' } } },
                { key: 'validator', value: { typed: { type: 'GlobalAddress', value: 'validator_rdx1val' } } },
              ],
            },
          }],
        };
      }
      if (addrs[0] === 'validator_rdx1val') {
        return {
          items: [{
            address: 'validator_rdx1val',
            metadata: {
              items: [{ key: 'name', value: { typed: { type: 'String', value: 'GENKIPOOL' } } }],
            },
            details: {
              state: {
                is_registered: true,
                accepts_delegated_stake: true,
                validator_fee_factor: '0.02',
                stake_unit_resource_address: 'resource_rdx1lsu',
                claim_token_resource_address: 'resource_rdx1claim',
                public_key: { key_hex: '02abcd' },
                stake_xrd_vault: { entity_address: 'internal_vault_stake' },
                pending_xrd_withdraw_vault: { entity_address: 'internal_vault_pending' },
                locked_owner_stake_unit_vault: { entity_address: 'internal_vault_owner' },
              },
            },
          }],
        };
      }
      return {
        items: [
          { address: 'internal_vault_stake', details: { balance: { amount: '1250000' } } },
          { address: 'internal_vault_pending', details: { balance: { amount: '50000' } } },
          { address: 'internal_vault_owner', details: { balance: { amount: '10000' } } },
        ],
      };
    });

    const info = await fetchLsuInfo(post as unknown as GatewayPost, 'resource_rdx1lsu');
    expect(info).not.toBeNull();
    expect(info!.validatorName).toBe('GENKIPOOL');
    expect(info!.feePercent).toBeCloseTo(2, 6);
    expect(info!.xrdPerLsu).toBeCloseTo(1.25, 6);
    expect(info!.lsuPerXrd).toBeCloseTo(0.8, 6);
    expect(info!.lockedOwnerXrd).toBeCloseTo(12500, 6);
    expect(info!.pendingWithdrawXrd).toBe(50000);
  });

  it('rejects non-LSU resources (missing validator metadata or mismatched two-way link)', async () => {
    const post = vi.fn(async () => ({ items: [{ address: 'resource_rdx1plain', metadata: { items: [] }, details: {} }] }));
    expect(await fetchLsuInfo(post as unknown as GatewayPost, 'resource_rdx1plain')).toBeNull();
    expect(await fetchLsuInfo(post as unknown as GatewayPost, 'account_rdx1notaresource')).toBeNull();
  });
});
