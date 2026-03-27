import { describe, it, expect } from 'vitest';
import { formatNumber, formatXRD } from '@/utils/formatters';

describe('formatNumber', () => {
    it('formats integers correctly', () => {
        expect(formatNumber(1000)).toContain('1');
    });

    it('limits decimal places', () => {
        const result = formatNumber(1.123456789, 4);
        // Should have at most 4 decimal digits
        const parts = result.replace(/,/g, '').split('.');
        if (parts[1]) {
            expect(parts[1].length).toBeLessThanOrEqual(4);
        }
    });

    it('handles zero', () => {
        expect(formatNumber(0)).toBe('0');
    });

    it('handles negative numbers', () => {
        const result = formatNumber(-1234.5, 2);
        expect(result).toContain('1');
        expect(result).toContain('-');
    });

    it('respects custom decimal count', () => {
        const result = formatNumber(3.14159, 2);
        // Locale-agnostic: decimal could be . or ,
        expect(result.replace(',', '.')).toContain('3.14');
    });
});

describe('formatXRD', () => {
    it('returns billions suffix for values >= 1B', () => {
        expect(formatXRD(1_500_000_000)).toBe('1.50B');
    });

    it('returns millions suffix for values >= 1M', () => {
        expect(formatXRD(2_500_000)).toBe('2.5M');
    });

    it('returns thousands suffix for values >= 1K', () => {
        expect(formatXRD(45_600)).toBe('45.6K');
    });

    it('returns full number for values < 1K', () => {
        const result = formatXRD(999);
        expect(result).toContain('999');
    });

    // Edge cases — boundary values
    it('handles exactly 1000 as K', () => {
        expect(formatXRD(1000)).toBe('1.0K');
    });

    it('handles exactly 1_000_000 as M', () => {
        expect(formatXRD(1_000_000)).toBe('1.0M');
    });

    it('handles exactly 1_000_000_000 as B', () => {
        expect(formatXRD(1_000_000_000)).toBe('1.00B');
    });

    it('handles 999.9 without suffix', () => {
        const result = formatXRD(999.9);
        expect(result).not.toContain('K');
        expect(result).not.toContain('M');
    });

    it('handles zero', () => {
        expect(formatXRD(0)).toBe('0');
    });

    it('handles very small decimals', () => {
        const result = formatXRD(0.00000001);
        expect(result).toContain('0');
    });
});
