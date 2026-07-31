import { describe, expect, it } from 'vitest';
import {
  instantOf,
  issuedAtAgrees,
  signedAtAgrees,
} from '@/features/sign/lib/timestamp';

/**
 * The legacy value is not invented: it is what every signature NFT minted
 * before the format was pinned down actually carries on Stokenet, read back
 * from the ledger. Its transaction committed at COMMIT_TIME, nineteen seconds
 * later, so the record is honest — it simply states its date in a form that
 * carries no timezone.
 */
const LEGACY_ISSUED_AT = '07/19/2026 17:17:25';
const COMMIT_TIME = '2026-07-19T17:17:44.359Z';

describe('parsing instants', () => {
  it('accepts ISO-8601 with an explicit offset', () => {
    expect(instantOf('2026-07-19T17:17:44.359Z')).toBe(
      Date.parse('2026-07-19T17:17:44.359Z'),
    );
    expect(instantOf('2026-07-19T19:17:44+02:00')).toBe(
      Date.parse('2026-07-19T17:17:44Z'),
    );
  });

  it('refuses anything whose meaning depends on the reader', () => {
    // Date.parse would happily resolve these against the machine's own
    // timezone, so the same record would pass in UTC and fail elsewhere.
    expect(instantOf(LEGACY_ISSUED_AT)).toBeNull();
    expect(instantOf('2026-07-19T17:17:44')).toBeNull();
    expect(instantOf('2026-07-19')).toBeNull();
    expect(instantOf('whenever')).toBeNull();
    expect(instantOf('')).toBeNull();
  });
});

describe('an NFT date the ledger cannot adjudicate', () => {
  it('reports a legacy issued_at as unknown, not as a contradiction', () => {
    // Flagging these would accuse every collection minted before the format
    // settled — and every NFT minted by hand through the console — of lying.
    expect(issuedAtAgrees(LEGACY_ISSUED_AT, COMMIT_TIME)).toBeNull();
  });

  it('still confirms an issued_at written by the current code', () => {
    expect(issuedAtAgrees('2026-07-19T17:17:25.000Z', COMMIT_TIME)).toBe(true);
  });

  it('contradicts one that disagrees with its own transaction', () => {
    expect(issuedAtAgrees('2020-01-01T00:00:00.000Z', COMMIT_TIME)).toBe(false);
  });

  it('claims nothing when either side is missing', () => {
    expect(issuedAtAgrees('', COMMIT_TIME)).toBeNull();
    expect(issuedAtAgrees('2026-07-19T17:17:25.000Z', null)).toBeNull();
  });
});

describe('a certificate date is ours to define', () => {
  it('treats a timezone-less signedAt as disagreement', () => {
    // Every date this app writes into a certificate is toISOString(); anything
    // else in that slot has been through other hands.
    expect(signedAtAgrees(LEGACY_ISSUED_AT, COMMIT_TIME)).toBe(false);
    expect(signedAtAgrees('2026-07-19T17:17:44', COMMIT_TIME)).toBe(false);
  });

  it('does not depend on the timezone of the machine checking it', () => {
    // Asserted on the property itself rather than by reassigning process.env.TZ:
    // the reassignment does not reliably move Node's clock mid-process, and
    // restoring an originally-unset TZ writes the string "undefined" and skews
    // every test that runs afterwards in the same worker.
    //
    // The same instant written in three timezones must parse to one number, and
    // an offset-less form must parse to none at all. That IS the independence:
    // nothing is left for the reader's own timezone to decide.
    const sameInstant = [
      '2026-07-19T17:17:44.359Z',
      '2026-07-19T19:17:44.359+02:00',
      '2026-07-20T05:17:44.359+12:00',
    ].map(instantOf);
    expect(new Set(sameInstant).size).toBe(1);
    expect(sameInstant[0]).toBe(Date.parse('2026-07-19T17:17:44.359Z'));
    expect(instantOf('2026-07-19T17:17:44.359')).toBeNull();
  });
});
