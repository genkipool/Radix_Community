/**
 * Sanitisers for text that reaches a PDF.
 *
 * Everything a signature certificate prints about a person is SELF-DECLARED and
 * arrives from outside: a persona name typed into someone's wallet, an issuer's
 * `org_name` read off the ledger, a `.radixsig.json` a stranger emailed you. It
 * is data, never markup and never PDF syntax, and three things go wrong if it is
 * passed through untouched:
 *
 *  1. Line breaks forge fields. The certificate page is the human-readable
 *     trust surface, drawn as plain lines of text with no structure a reader can
 *     check. A name of "Ada Lovelace\nSIGNING ACCOUNT: account_rdx1…" renders as
 *     a second, invented field that looks exactly like a real one. This is the
 *     one that matters: it is a spoofing vector, not a cosmetic bug.
 *  2. Unencodable characters throw. pdf-lib's standard fonts are WinAnsi only,
 *     and `drawText`/`widthOfTextAtSize` raise on anything outside it — an emoji
 *     or a CJK name would take down the whole page. The callers treat the page
 *     as best-effort and swallow the error, so it would vanish silently.
 *  3. Unbalanced parens corrupt dictionaries. pdf-lib writes literal strings
 *     between `(` and `)` and deliberately does not escape their contents, so a
 *     stray `)` ends the string early and mangles the PDF.
 *
 * HTML tags like `<script>` are inert here — nothing in this path renders markup,
 * and the verifier's React UI escapes text — but they travel through the same
 * door as the payloads above, and the whitelist below lets them through as the
 * literal characters they are.
 */

/**
 * Characters pdf-lib's standard fonts can encode: printable ASCII, the Latin-1
 * supplement (so accented names survive intact), and the handful of typographic
 * characters WinAnsi maps into 0x80–0x9F. Everything else, including every
 * control character, is absent by construction.
 */
const WIN_ANSI =
  /[ -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;

/**
 * Text safe to DRAW on a page: one line, encodable, bounded. Characters the
 * font cannot represent are dropped rather than replaced, so a name written in
 * a script WinAnsi has no room for comes back empty and the caller falls back
 * to the account address, which is honest — better than a row of `?`.
 */
export function pdfSafeText(value: string, maxLength = 200): string {
  let out = '';
  for (const ch of value.normalize('NFC').replace(/\s+/g, ' ')) {
    if (WIN_ANSI.test(ch)) out += ch;
    if (out.length >= maxLength) break;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Text safe to store in a PDF dictionary string (the PAdES signature's Name,
 * Reason and Location). Same rules, minus the three characters that are PDF
 * string syntax and that pdf-lib does not escape for us.
 */
export function pdfSafeDictString(value: string, maxLength = 200): string {
  return pdfSafeText(value, maxLength)
    .replace(/[()\\]/g, '')
    .trim();
}
