/**
 * How a validator's logo address is carried to our own image route.
 *
 * The address goes in the path rather than a query string, so the browser
 * caches it as its own resource and Next accepts it as a local source. Every
 * one of these logos is a URL an operator wrote on-ledger, so what goes in is
 * arbitrary and what comes back out has to be exactly what went in — the route
 * only fetches an address it can match against the published set.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeIconToken,
  validatorIconSrc,
} from '@/features/dashboard/staking/lib/validatorIcon';

/** What the route does with what {@link validatorIconSrc} builds. */
function roundTrip(url: string): string | null {
  const src = validatorIconSrc(url, 'mainnet');
  const token = src?.split('/').pop() ?? '';
  return decodeIconToken(token);
}

describe('a validator logo address', () => {
  it('travels in the path, not a query string', () => {
    const src = validatorIconSrc('https://example.com/logo.png?v=2', 'mainnet');
    expect(src).toMatch(/^\/api\/validator-icon\/mainnet\/[\w-]+$/);
    expect(src).not.toContain('?');
  });

  it('survives the round trip, query string and all', () => {
    const url = 'https://example.com/logo.png?v=2&size=large';
    expect(roundTrip(url)).toBe(url);
  });

  it('survives accents and other non-ASCII characters', () => {
    const url = 'https://validador.example/logotipo-año.png';
    expect(roundTrip(url)).toBe(url);
  });

  it('keeps the networks apart', () => {
    expect(validatorIconSrc('https://example.com/a.png', 'stokenet')).toContain(
      '/stokenet/',
    );
  });

  it('leaves anything that is not an https address alone', () => {
    expect(validatorIconSrc('data:image/svg+xml;base64,AAA')).toBe(
      'data:image/svg+xml;base64,AAA',
    );
    expect(validatorIconSrc('http://example.com/logo.png')).toBe(
      'http://example.com/logo.png',
    );
    expect(validatorIconSrc(undefined)).toBeUndefined();
    expect(validatorIconSrc('   ')).toBeUndefined();
  });
});

describe('reading a token the route was handed', () => {
  it('refuses one that is not an https address', () => {
    const token = Buffer.from('file:///etc/passwd').toString('base64url');
    expect(decodeIconToken(token)).toBeNull();
  });

  it('refuses one that is not base64 at all', () => {
    expect(decodeIconToken('../../../etc/passwd')).toBeNull();
    expect(decodeIconToken('')).toBeNull();
  });
});
