/**
 * Escaping for values interpolated into manifest string literals.
 *
 * Manifest strings are double-quoted, so a backslash or a quote coming from
 * user input would otherwise terminate the literal and change the meaning of
 * the transaction. Backslashes go first: escaping quotes first would double
 * the backslashes this function itself introduces.
 */
export const escapeManifestString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
