import { describe, expect, it } from 'vitest';
import { formatShare, formatXrd } from '@/features/governance/lib/format';

describe('formatXrd', () => {
    it('keeps tiny amounts visible instead of rounding them to 0', () => {
        expect(formatXrd(0.389384348491111112, 'en')).toBe('0.39');
        expect(formatXrd(0.00012, 'en')).toBe('0.00012');
    });

    it('shows zero as zero and large amounts compact', () => {
        expect(formatXrd(0, 'en')).toBe('0');
        expect(formatXrd(8.12769566728, 'en')).toBe('8.1');
        expect(formatXrd(942_912_802, 'en')).toBe('942.9M');
    });
});

describe('formatShare', () => {
    it('never shows a real but tiny share as 0 %', () => {
        expect(formatShare(0.000001, 'en')).toBe('< 0.1%');
        expect(formatShare(0, 'en')).toBe('0%');
    });
});
