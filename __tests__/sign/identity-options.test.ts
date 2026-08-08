import { describe, expect, it } from 'vitest';
import {
  identitySelection,
  nextIdentityChoice,
  type IdentityChoice,
} from '@/features/sign/lib/identity-options';

/**
 * "Signature only" says nothing about the signer travels with the signature, so
 * it is a state, not a switch: it cannot be lit next to "Full name" or "Email",
 * which is exactly what the form used to allow. Those two, by contrast, are
 * independent and belong together whenever the signer wants both.
 */
const only = (disclosure: IdentityChoice['disclosure']): IdentityChoice => ({
  disclosure,
  includeEmail: false,
});

describe('identity option selection', () => {
  it('lights "signature only" exactly when nothing else is disclosed', () => {
    expect(identitySelection(only('none'))).toEqual(['none']);
    expect(identitySelection(only('full_name'))).toEqual(['full_name']);
    expect(identitySelection({ disclosure: 'none', includeEmail: true })).toEqual([
      'email',
    ]);
    expect(
      identitySelection({ disclosure: 'full_name', includeEmail: true }),
    ).toEqual(['full_name', 'email']);
  });
});

describe('picking identity options', () => {
  it('drops "signature only" the moment something is disclosed', () => {
    // The buttons hand back the previous selection plus the tapped option.
    expect(nextIdentityChoice(only('none'), ['none', 'full_name'])).toEqual({
      disclosure: 'full_name',
      includeEmail: false,
    });
    expect(nextIdentityChoice(only('none'), ['none', 'email'])).toEqual({
      disclosure: 'none',
      includeEmail: true,
    });
    // …and the result never shows both at once.
    expect(
      identitySelection(nextIdentityChoice(only('none'), ['none', 'email'])),
    ).toEqual(['email']);
  });

  it('clears everything when "signature only" is picked', () => {
    const current: IdentityChoice = { disclosure: 'full_name', includeEmail: true };
    expect(
      nextIdentityChoice(current, ['full_name', 'email', 'none']),
    ).toEqual({ disclosure: 'none', includeEmail: false });
  });

  it('keeps the name and the email together — they are not exclusive', () => {
    expect(
      nextIdentityChoice(only('full_name'), ['full_name', 'email']),
    ).toEqual({ disclosure: 'full_name', includeEmail: true });
  });

  it('falls back to "signature only" when the last option is unticked', () => {
    // Unticking used to be ignored outright: once a name was picked there was
    // no way back to disclosing nothing.
    expect(nextIdentityChoice(only('full_name'), [])).toEqual({
      disclosure: 'none',
      includeEmail: false,
    });
    expect(
      nextIdentityChoice({ disclosure: 'full_name', includeEmail: true }, ['email']),
    ).toEqual({ disclosure: 'none', includeEmail: true });
  });
});
