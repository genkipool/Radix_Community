import { describe, expect, it } from 'vitest';
import { signedAtAgrees } from '@/features/sign/lib/timestamp';

/**
 * The rule the verify route applies when an account holds several signature
 * mints for one document, reproduced here so the decision itself is pinned
 * down: the mint that AGREES with what the certificate declares is the evidence
 * for it, and only when none agrees is the claim uncorroborated.
 *
 * Signing the same file twice is ordinary. Dating a certificate from an
 * arbitrary one of those mints is how a signature made minutes ago gets
 * reported against a mint from a fortnight back — and the certificate then
 * called a liar for saying otherwise, which is what happened on Stokenet.
 */
function pickMatching(
  commits: string[],
  declaredAt: string,
): { committedAt: string; matched: boolean } {
  for (const committedAt of commits) {
    if (signedAtAgrees(declaredAt, committedAt)) return { committedAt, matched: true };
  }
  return { committedAt: commits[0], matched: false };
}

// Earliest first, as the lookup returns them.
const COMMITS = [
  '2026-07-19T03:46:07.651Z',
  '2026-07-19T17:17:44.359Z',
  '2026-08-01T01:15:02.000Z',
];

describe('choosing which mint a certificate refers to', () => {
  it('picks the signature just made, not the oldest one on record', () => {
    const justSigned = '2026-08-01T01:15:00.000Z';
    const result = pickMatching(COMMITS, justSigned);
    expect(result.matched).toBe(true);
    expect(result.committedAt).toBe('2026-08-01T01:15:02.000Z');
  });

  it('picks an older one when that is what the certificate declares', () => {
    const result = pickMatching(COMMITS, '2026-07-19T17:17:40.000Z');
    expect(result.matched).toBe(true);
    expect(result.committedAt).toBe('2026-07-19T17:17:44.359Z');
  });

  it('still catches a backdated claim no mint supports', () => {
    // The anti-backdating property has to survive the leniency above.
    const result = pickMatching(COMMITS, '2020-01-01T00:00:00.000Z');
    expect(result.matched).toBe(false);
    expect(signedAtAgrees('2020-01-01T00:00:00.000Z', result.committedAt)).toBe(false);
  });

  it('falls back to the earliest, so an uncorroborated claim still shows a date', () => {
    const result = pickMatching(COMMITS, '2020-01-01T00:00:00.000Z');
    expect(result.committedAt).toBe(COMMITS[0]);
  });

  it('is unambiguous with a single mint, the ordinary case', () => {
    const single = ['2026-08-01T01:15:02.000Z'];
    expect(pickMatching(single, '2026-08-01T01:15:00.000Z').matched).toBe(true);
    expect(pickMatching(single, '2020-01-01T00:00:00.000Z').matched).toBe(false);
  });
});
