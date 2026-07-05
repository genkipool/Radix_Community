'use client';
import { TocEntry } from '../types/data.types';
import { curatedDocToMarkdown, htmlDocToMarkdown } from './markdownRender';

/**
 * Utility to download curated or user documents as Markdown.
 */
export function downloadAsMarkdown(title: string, content: string | { toc: TocEntry[], dictContent: Record<string, string> }) {
  const md = typeof content === 'string'
    ? htmlDocToMarkdown(title, content)
    : curatedDocToMarkdown(title, content.toc, content.dictContent);

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
