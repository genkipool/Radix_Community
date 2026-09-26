import { describe, expect, it } from 'vitest';
import { formatShare, formatXrd } from '@/features/governance/lib/format';

describe('formatXrd', () => {
    it('always shows two decimals', () => {
        expect(formatXrd(0, 'en')).toBe('0.00');
        expect(formatXrd(0.5, 'en')).toBe('0.50');
        expect(formatXrd(8.12769566728, 'en')).toBe('8.13');
        expect(formatXrd(942_912_802, 'en')).toBe('942.91M');
    });

    it('keeps tiny amounts visible instead of rounding them to 0', () => {
        expect(formatXrd(0.389384348491111112, 'en')).toBe('0.39');
        expect(formatXrd(0.00012, 'en')).toBe('0.00012');
    });

    it('follows the reader\'s locale', () => {
        expect(formatXrd(8.12769566728, 'es')).toBe('8,13');
        expect(formatXrd(39_100, 'es')).toBe('39,10\u00a0mil');
        expect(formatXrd(39_100, 'en')).toBe('39.10K');
        expect(formatXrd(942_912_802, 'es')).toBe('942,91\u00a0M');
    });
});

describe('formatShare', () => {
    it('never shows a real but tiny share as 0 %', () => {
        expect(formatShare(0.000001, 'en')).toBe('< 0.1%');
        expect(formatShare(0, 'en')).toBe('0%');
    });
});
