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
 * the card out of frame. The cut lands on a word boundary, because "No server
 * h…" reads like a rendering bug where "No server…" reads like an abbreviation.
 */
export function clampCardText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
