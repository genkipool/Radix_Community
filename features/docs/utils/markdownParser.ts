/**
 * features/docs/utils/markdownParser.ts
 *
 * Uses `marked` for Markdown -> HTML and `turndown` for HTML -> Markdown,
 * providing the best standard transformation for user documents.
 * GFM tables are fully supported in both directions.
 */
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Configure marked to break on newlines (like GitHub Flavored Markdown)
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Converts a raw Markdown string into HTML using `marked`.
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '<p><br></p>';
  try {
    return marked.parse(md, { async: false }) as string;
  } catch {
    return '<p>Error parsing content</p>';
  }
}

/**
 * Converts an HTML string containing rich text into standard Markdown.
 * Preserves bold, italic, code blocks, tables, etc.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';
  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    // Enable GFM extensions (tables, strikethrough, task lists)
    turndownService.use(gfm);
    
    // Critical: Disable Turndown's automatic escaping.
    // By default, turndown escapes characters like # or * found in regular HTML text.
    // By disabling it, raw markdown typed in the editor (e.g., "## Title")
    // is preserved and expertly transformed into HTML by marked.
    turndownService.escape = (text) => text;

    return turndownService.turndown(html);
  } catch {
    return html; // fallback
  }
}

/**
 * Super parser: takes an editor's HTML (which may contain raw markdown characters like ##) 
 * and outputs perfectly formatted structure HTML.
 * Process: HTML -> Turndown -> collapseTableRows -> Marked -> Final HTML
 */
export function applyMarkdownToHtml(html: string): string {
  if (!html || !html.trim()) return '<p><br></p>';
  
  // 1. Convert Editor HTML (with embedded markdown) to full Markdown
  const markdown = htmlToMarkdown(html);
  
  // 2. Collapse table rows separated by blank lines
  //    When typed in contentEditable, each pipe row ends up in its own <p>,
  //    causing Turndown to insert blank lines between them. marked requires
  //    table rows to be contiguous, so we collapse blank lines between pipe rows.
  const collapsed = collapseTableRows(markdown);
  
  // 3. Convert that Markdown back to clean, semantic HTML
  return markdownToHtml(collapsed);
}

/**
 * Collapses blank lines between pipe-table rows so marked can parse them.
 * Matches: `| ... |\n\n| ... |` and removes the extra blank line.
 */
function collapseTableRows(md: string): string {
  return md.replace(/(\|[^\n]*\|)\n\n(\|)/g, '$1\n$2');
}

