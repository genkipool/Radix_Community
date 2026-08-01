import { describe, it, expect } from 'vitest';
import { clampCardText, headline } from '@/lib/og-text';

describe('headline', () => {
    it('keeps only the part before the search-engine separator', () => {
        expect(headline('Radix Seal | Self-Custody Document Signing, Encryption & Secure Chat'))
            .toBe('Radix Seal');
        expect(headline('Radix Community | Radix DLT & Blockchain Solutions for Banks'))
            .toBe('Radix Community');
    });

    it('leaves a title that has no separator alone', () => {
        expect(headline('Build Manifest')).toBe('Build Manifest');
    });

    it('falls back to the whole title rather than returning nothing', () => {
        expect(headline('| Radix')).toBe('| Radix');
    });
});

describe('clampCardText', () => {
    it('returns short text untouched', () => {
        expect(clampCardText('SRWA', 90)).toBe('SRWA');
    });

    // On-ledger metadata is free-form text from whoever registered the entity.
    it('flattens newlines so text cannot fake extra layout', () => {
        expect(clampCardText('Radix\n\n   Giveaway\tAlert', 90)).toBe('Radix Giveaway Alert');
    });

    it('cuts on a word boundary, not mid-word', () => {
        const source = 'An open self-custody trust standard. No server holds your keys.';
        const out = clampCardText(source, 40);
        const body = out.slice(0, -1);

        expect(out.endsWith('…')).toBe(true);
        // What was kept is a real prefix, and it stops exactly where a space
        // was, so no word is left cut in half.
        expect(source.startsWith(body)).toBe(true);
        expect(source[body.length]).toBe(' ');
        expect(out.length).toBeLessThanOrEqual(41);
    });

    // A single unbroken run has no boundary to cut on; it still must not run
    // past the limit and off the card.
    it('cuts mid-token when there is no word boundary to use', () => {
        const out = clampCardText('x'.repeat(200), 50);
        expect(out).toBe(`${'x'.repeat(50)}…`);
    });

    it('never exceeds the limit it was given', () => {
        for (const max of [24, 40, 90, 170]) {
            expect(clampCardText('palabra '.repeat(80), max).length).toBeLessThanOrEqual(max + 1);
        }
    });
});
