/**
 * Text preparation for social cards.
 *
 * Split out from `og-card.tsx` so it carries no dependency on the image
 * renderer: this is the part with rules worth testing, and a unit test should
 * not have to load satori to check where a string gets cut.
 */

/**
 * Fits text to the card.
 *
 * Entity cards title themselves from on-ledger metadata, which is free-form
 * text written by whoever registered the entity: newlines are flattened so it
 * cannot fake extra layout, and length is capped so it cannot push the rest of
 * the card out of frame.
 *
 * Nothing is marked as cut. An ellipsis on a share card reads as a truncation
 * bug rather than as a promise of more, so the text simply ends, on a word
 * boundary.
 */
export function clampCardText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * Fits a description to the card so that it reads as finished.
 *
 * With no ellipsis to signal the cut, where the text stops is what decides
 * whether it looks deliberate or broken, so this tries three endings in order:
 *
 *   a full stop      best, the thought is complete
 *   a clause break   next best, with the comma dropped so the phrase does not
 *                    dangle on punctuation that promises more
 *   a word boundary  last resort, when the text offers nothing else
 *
 * Each is only accepted if it leaves most of the space used; a sentence ending
 * two words in would say less than the fragment it replaced.
 */
export function trimToSentence(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;

  const window = flat.slice(0, max);
  const floor = max * 0.45;

  const sentence = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (sentence > floor) return window.slice(0, sentence + 1);

  const clause = Math.max(
    window.lastIndexOf(', '),
    window.lastIndexOf('; '),
    window.lastIndexOf(': '),
  );
  if (clause > floor) return window.slice(0, clause);

  return clampCardText(flat, max);
}

/**
 * Turns a page title into a card headline.
 *
 * Page titles are built for search results, where "Radix Seal | Self-Custody
 * Document Signing, Encryption & Secure Chat" packs in the keywords. On a card
 * that reads as a run-on, and the subtitle below already carries the detail, so
 * only the part before the first separator is kept.
 */
export function headline(pageTitle: string): string {
  return pageTitle.split('|')[0].trim() || pageTitle.trim();
}
