import { describe, it, expect } from 'vitest';
import { addressNodeIdHex, decodePricePoint, priceChange, priceRewrites } from '@/features/dashboard/explorador/utils/oraclePrices';

// The well-known XRD address and its node id.
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const XRD_NODE = '5da66318c6318c61f5a61b4c6318c6318cf794aa8d295f14e6318c6318c6';

/** PriceInfo { timestamp: i64, price: Decimal } as SBOR hex. */
const priceInfo = (seconds: number, attos: bigint) => {
    const le = (n: bigint, bytes: number) => Array.from({ length: bytes }, (_, i) => ((n >> BigInt(8 * i)) & 0xffn).toString(16).padStart(2, '0')).join('');
    return `5c210205${le(BigInt(seconds), 8)}a0${le(attos, 24)}`;
};

describe('addressNodeIdHex', () => {
    it('decodes an address to its node id', () => {
        expect(addressNodeIdHex(XRD)).toBe(XRD_NODE);
    });
});

describe('decodePricePoint', () => {
    it('reads the price and the time from a PriceInfo tuple', () => {
        expect(decodePricePoint(priceInfo(1792434900, 16650045204812573892482091n))).toEqual({ price: '16650045.204812573892482091', timestamp: 1792434900 });
    });

    it('reads tiny prices without losing digits', () => {
        expect(decodePricePoint(priceInfo(1792434900, 100000000n))?.price).toBe('0.0000000001');
    });

    it('reads a bare Decimal', () => {
        expect(decodePricePoint(`5ca0${'00'.repeat(0)}000064a7b3b6e00d${'00'.repeat(16)}`)).toEqual({ price: '1', timestamp: null });
    });

    it('gives up on shapes it does not know', () => {
        expect(decodePricePoint('5c0c0568656c6c6f')).toBeNull();
        expect(decodePricePoint(null)).toBeNull();
        expect(decodePricePoint('zz')).toBeNull();
    });
});

describe('priceRewrites', () => {
    it('pairs each rewritten entry with the resource it is keyed by', () => {
        const rewrites = priceRewrites([
            {
                substate_id: { substate_type: 'GenericKeyValueStoreEntry', substate_key: { key_hex: `5c80${XRD_NODE}` } },
                previous_value: { substate_data: { value: { data: { struct_data: { hex: priceInfo(1792434300, 2n * 10n ** 18n) } } } } },
                new_value: { substate_data: { value: { data: { struct_data: { hex: priceInfo(1792434900, 3n * 10n ** 18n) } } } } },
            },
            { substate_id: { substate_type: 'FungibleVaultFieldBalance' } },
        ], [XRD]);
        expect(rewrites).toEqual({
            [XRD]: { before: { price: '2', timestamp: 1792434300 }, after: { price: '3', timestamp: 1792434900 } },
        });
    });

    it('finds nothing for resources the receipt does not rewrite', () => {
        expect(priceRewrites([], [XRD])).toEqual({});
        expect(priceRewrites(undefined, [XRD])).toEqual({});
    });
});

describe('priceChange', () => {
    it('gives the move in percent of the old price', () => {
        expect(priceChange('200', '150')).toBe(-25);
        expect(priceChange('0.0000000001', '0.0000000001')).toBe(0);
    });

    it('has nothing to compare without an old price', () => {
        expect(priceChange(undefined, '5')).toBeNull();
        expect(priceChange('0', '5')).toBeNull();
    });
});
