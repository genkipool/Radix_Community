import { describe, it, expect } from 'vitest';
import { clampCardText, headline, trimToSentence } from '@/lib/og-text';

describe('headline', () => {
    it('keeps only the part before the search-engine separator', () => {
        expect(headline('Radix Seal | Self-Custody Document Signing, Encryption & Secure Chat'))
            .toBe('Radix Seal');
        expect(headline('Radix Community | Radix DLT & Blockchain Solutions for Banks'))
            .toBe('Radix Community');
    });

    it('handles the em dash the dictionaries also use as a separator', () => {
        expect(headline('Consola Radix — Herramientas para desarrolladores'))
            .toBe('Consola Radix');
        expect(headline('Radix Console — Developer tools')).toBe('Radix Console');
    });

    it('leaves a title that has no separator alone', () => {
        expect(headline('Build Manifest')).toBe('Build Manifest');
    });

    // A dash inside a word is not a separator.
    it('ignores a hyphen that is part of a name', () => {
        expect(headline('Self-Custody Signing')).toBe('Self-Custody Signing');
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

        // What was kept is a real prefix, and it stops exactly where a space
        // was, so no word is left cut in half.
        expect(source.startsWith(out)).toBe(true);
        expect(source[out.length]).toBe(' ');
        expect(out.length).toBeLessThanOrEqual(40);
    });

    // An ellipsis on a share card reads as a truncation bug, not as a promise
    // of more text.
    it('never marks the text as cut', () => {
        expect(clampCardText('palabra '.repeat(60), 50)).not.toContain('…');
        expect(clampCardText('x'.repeat(200), 50)).not.toContain('…');
    });

    // A single unbroken run has no boundary to cut on; it still must not run
    // past the limit and off the card.
    it('cuts mid-token when there is no word boundary to use', () => {
        expect(clampCardText('x'.repeat(200), 50)).toBe('x'.repeat(50));
    });

    it('never exceeds the limit it was given', () => {
        for (const max of [24, 40, 90, 170]) {
            expect(clampCardText('palabra '.repeat(80), max).length).toBeLessThanOrEqual(max);
        }
    });
});

describe('trimToSentence', () => {
    const source =
        'Estándar abierto de confianza en autocustodia sobre Radix: firma documentos. ' +
        'Sin servidores que guarden tus claves.';

    it('leaves a description that already fits', () => {
        expect(trimToSentence('Corta y entera.', 105)).toBe('Corta y entera.');
    });

    it('ends on a full stop rather than mid-clause', () => {
        const out = trimToSentence(source, 105);
        expect(out.endsWith('.')).toBe(true);
        expect(source.startsWith(out)).toBe(true);
    });

    it('never marks the text as cut', () => {
        expect(trimToSentence(source, 105)).not.toContain('…');
        expect(trimToSentence('sin puntuacion '.repeat(20), 60)).not.toContain('…');
    });

    // A sentence that leaves the card nearly empty is worse than a longer
    // fragment ending on a word.
    it('falls back past a sentence end that is too early', () => {
        const out = trimToSentence('Hola. ' + 'palabra '.repeat(40), 100);
        expect(out.startsWith('Hola. palabra')).toBe(true);
        expect(out.length).toBeGreaterThan(50);
    });

    // Real case: one long sentence with no full stop in range. Ending on the
    // clause reads as finished; ending mid-clause reads as broken.
    it('ends on a clause and drops the comma when no sentence fits', () => {
        const out = trimToSentence(
            'Convierte una dirección Olympia en su equivalente Babylon (y viceversa), y genera el QR para importar la cuenta.',
            105,
        );
        expect(out).toBe('Convierte una dirección Olympia en su equivalente Babylon (y viceversa)');
        expect(out.endsWith(',')).toBe(false);
    });
});
