/**
 * The identity buttons of the signing form, as a rule instead of a widget.
 *
 * Three choices are offered — signature only, full name, email — but they are
 * not three independent switches. "Signature only" MEANS that neither of the
 * other two travels with the signature, so it cannot sit selected next to them:
 * a certificate cannot both disclose an email and disclose nothing. The name
 * and the email, on the other hand, are genuinely independent and may be
 * chosen together.
 *
 * Kept out of the component because it is a rule about what a certificate can
 * say, it has to hold identically wherever the options are offered, and it is
 * the kind of thing that quietly regresses the next time a button is added.
 */
import type { DisclosurePolicy } from '../types/sign.types';

/** One identity button. `'none' | 'full_name' | 'surname'` + the email toggle. */
export type IdentityOption = DisclosurePolicy | 'email';

export interface IdentityChoice {
  disclosure: DisclosurePolicy;
  includeEmail: boolean;
}

/**
 * Which buttons show as selected for a choice. "Signature only" appears
 * selected exactly when nothing else is — it is the absence of the others, so
 * it is never lit beside them.
 */
export function identitySelection({
  disclosure,
  includeEmail,
}: IdentityChoice): IdentityOption[] {
  const selected: IdentityOption[] = [
    ...(disclosure !== 'none' ? [disclosure] : []),
    ...(includeEmail ? (['email'] as const) : []),
  ];
  return selected.length > 0 ? selected : ['none'];
}

/**
 * The choice a click produces, given what was selected before and the raw list
 * the buttons hand back.
 *
 * Picking "signature only" clears the rest; picking a name or the email drops
 * "signature only"; unticking the last one lands back on it, so there is always
 * exactly one answer and no way to express a contradiction.
 */
export function nextIdentityChoice(
  current: IdentityChoice,
  next: IdentityOption[],
): IdentityChoice {
  const before = identitySelection(current);
  if (next.includes('none') && !before.includes('none')) {
    return { disclosure: 'none', includeEmail: false };
  }
  const name = next.find(
    (option): option is DisclosurePolicy =>
      option === 'full_name' || option === 'surname',
  );
  return { disclosure: name ?? 'none', includeEmail: next.includes('email') };
}
