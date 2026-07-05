/**
 * Pure Markdown rendering for docs content. Shared by the client download
 * utility (markdownDownload.ts) and the MCP docs tools (server).
 */
import type { TocEntry } from '../types/data.types';

/** Renders a curated doc (TOC + dictionary content) as a Markdown document. */
export function curatedDocToMarkdown(
  title: string,
  toc: TocEntry[],
  dictContent: Record<string, string>,
): string {
  let md = `# ${title}\n\n`;
  toc.forEach((entry) => {
    const prefix = '#'.repeat(entry.level);
    const sectionTitle = dictContent[entry.titleKey] || entry.titleKey;
    const sectionBody = dictContent[entry.bodyKey] || '';
    md += `${prefix} ${sectionTitle}\n\n${sectionBody}\n\n`;
  });
  return md;
}

/** Very simplified HTML → Markdown conversion (user-authored docs). */
export function htmlDocToMarkdown(title: string, html: string): string {
  const body = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''); // strip remaining tags
  return `# ${title}\n\n${body}`;
}
