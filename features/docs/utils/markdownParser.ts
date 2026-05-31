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

const safeRenderer = new marked.Renderer();
safeRenderer.html = (token: { text: string; block?: boolean }) => {
  const escaped = token.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return token.block ? `<p>${escaped}</p>\n` : escaped;
};

/**
 * Converts a raw Markdown string into HTML using `marked`.
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '<p><br></p>';
  try {
    return marked.parse(md, { renderer: safeRenderer, async: false }) as string;
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
    
    // Critical: Custom escape rule to preserve raw markdown but prevent HTML block consumption
    // We only escape < and > so that tags like <script> aren't treated as HTML blocks by Marked
    turndownService.escape = function (string) {
      return string.replace(/</g, '\\<');
    };

    // Custom rule: if a code block already contains markdown backticks, strip them
    turndownService.addRule('stripInnerBackticks', {
      filter: ['pre'],
      replacement: function (content, node) {
        let code = node.textContent || '';
        code = code.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        return '\n\n```\n' + code + '\n```\n\n';
      }
    });

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

  // Check if it is raw markdown (lacks block-level HTML tags from the editor)
  const isEditorHtml = /<[a-z][\s\S]*>/i.test(html);
  
  if (!isEditorHtml) {
    // It's raw markdown (e.g. from docs/dictionaries). Don't use Turndown.
    return markdownToHtml(html);
  }

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

