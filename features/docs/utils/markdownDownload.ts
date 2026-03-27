'use client';
import { TocEntry } from '../types/data.types';

/**
 * Utility to download curated or user documents as Markdown.
 */
export function downloadAsMarkdown(title: string, content: string | { toc: TocEntry[], dictContent: Record<string, string> }) {
  let md = `# ${title}\n\n`;

  if (typeof content === 'string') {
    // Basic HTML to MD conversion (very simplified for UserDocs)
    md += content
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''); // strip remaining tags
  } else {
    // Curated docs structure
    const { toc, dictContent } = content;
    toc.forEach(entry => {
      const prefix = '#'.repeat(entry.level);
      const sectionTitle = dictContent[entry.titleKey] || entry.titleKey;
      const sectionBody = dictContent[entry.bodyKey] || '';
      md += `${prefix} ${sectionTitle}\n\n${sectionBody}\n\n`;
    });
  }

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
