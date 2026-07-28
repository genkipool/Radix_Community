import { describe, it, expect } from 'vitest';
import { extractDisclosedName } from '@/features/sign/lib/certificate';

/**
 * The name printed on the signature certificate ("Digitally signed by: …")
 * falls back down a chain: full name → the persona's nickname → the persona's
 * label in the wallet → (in the renderer) the account address. Anything the
 * wallet actually knows beats printing a bech32 address at a human.
 */
const fullName = (fields: Record<string, string>) => [
  { entry: 'fullName', fields },
];

describe('extractDisclosedName', () => {
  it('prefers the full name, ordered by variant', () => {
    expect(
      extractDisclosedName(
        fullName({ givenNames: 'Kyusang', familyName: 'Cho', variant: 'western' }),
        'full_name',
      ),
    ).toBe('Kyusang Cho');
    expect(
      extractDisclosedName(
        fullName({ givenNames: 'Kyusang', familyName: 'Cho', variant: 'eastern' }),
        'full_name',
      ),
    ).toBe('Cho Kyusang');
  });

  it('falls back to the nickname when the name fields are empty', () => {
    expect(
      extractDisclosedName(
        fullName({ givenNames: '', familyName: '', nickname: 'Rin' }),
        'full_name',
        'Persona 1',
      ),
    ).toBe('Rin');
  });

  it('falls back to the persona label when there is no name at all', () => {
    expect(extractDisclosedName([], 'full_name', 'Rin')).toBe('Rin');
    expect(
      extractDisclosedName(fullName({ givenNames: '', familyName: '' }), 'full_name', 'Rin'),
    ).toBe('Rin');
  });

  it('returns null when nothing is known, so the renderer shows the address', () => {
    expect(extractDisclosedName([], 'full_name')).toBeNull();
    expect(extractDisclosedName(undefined, 'full_name', '   ')).toBeNull();
  });

  it('under "none" keeps only the persona label, never the persona data', () => {
    // "Signature only": no persona data is requested from the wallet, so even
    // if some arrived it must not reach the certificate. The label comes from
    // the session the signer is already logged in with, so it costs no extra
    // wallet prompt and still names a person instead of an address.
    expect(
      extractDisclosedName(
        fullName({ givenNames: 'Kyusang', familyName: 'Cho' }),
        'none',
        'Rin',
      ),
    ).toBe('Rin');
    // No label either: null, and the renderer prints the account address.
    expect(
      extractDisclosedName(fullName({ givenNames: 'Kyusang', familyName: 'Cho' }), 'none'),
    ).toBeNull();
  });

  it('under the "surname" policy keeps the surname, then falls back', () => {
    expect(
      extractDisclosedName(
        fullName({ givenNames: 'Kyusang', familyName: 'Cho' }),
        'surname',
        'Rin',
      ),
    ).toBe('Cho');
    expect(
      extractDisclosedName(
        fullName({ givenNames: 'Kyusang', familyName: '', nickname: 'Kyu' }),
        'surname',
        'Rin',
      ),
    ).toBe('Kyu');
    // No surname and no nickname: the persona label rather than an address.
    expect(
      extractDisclosedName(fullName({ givenNames: 'Kyusang', familyName: '' }), 'surname', 'Rin'),
    ).toBe('Rin');
  });
});
