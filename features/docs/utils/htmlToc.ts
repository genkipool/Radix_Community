/**
 * htmlToc.ts
 * Parses an HTML string (from the editor) to:
 *  1. Extract a table of contents from h1–h4 headings
 *  2. Inject stable `id` attributes into those headings
 */

import type { UserTocEntry } from '../types/data.types';

/**
 * Extracts h2/h3/h4 from HTML string and returns a structured TOC.
 * Injects IDs into the original HTML if they are missing.
 */
function slugify(text: string, counter: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return base ? `${base}-${counter}` : `section-${counter}`;
}

/**
 * Processes an HTML string: injects unique IDs into h2-h4 headings
 * and returns the mutated HTML together with the TOC entries.
 */
export function injectHeadingIds(html: string): { html: string; toc: UserTocEntry[] } {
  const toc: UserTocEntry[] = [];
  let counter = 0;

  const processed = html.replace(
    /<(h([1-4]))([^>]*)>([\s\S]*?)<\/h\2>/gi,
    (_, fullTag: string, lvlStr: string, attrs: string, inner: string) => {
      const level = parseInt(lvlStr, 10);
      if (level < 2 || level > 4) return _; // leave h1 (title) untouched

      const text = inner.replace(/<[^>]*>/g, '').trim();
      const id   = slugify(text, ++counter);
      toc.push({ id, text, level: level as 2 | 3 | 4 });

      // Remove any existing id attribute then inject the new one
      const cleanAttrs = attrs.replace(/\s+id="[^"]*"/gi, '');
      return `<${fullTag} id="${id}"${cleanAttrs}>${inner}</${fullTag}>`;
    },
  );

  return { html: processed, toc };
}
