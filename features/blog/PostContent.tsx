/**
 * PostContent — RSC
 *
 * Extracted from BlogClient.tsx. Renders blog post body with:
 *  - Bullet list detection (lines starting with "•")
 *  - Bold text rendering (**text**)
 *  - Search query highlighting
 *
 * Pure presentational: no hooks, no state, safe to render on the server.
 * BlogClient passes it as JSX from within its own render, so the RSC
 * distinction mainly helps during Static Site Generation and reduces
 * the amount of JSX that must be serialized for hydration.
 */
import { HighlightText } from '@/components/ui/HighlightText';
import React from 'react';
import type { PostContentProps } from './types';
import { sanitizeUserHtml } from '@/utils/sanitize';
import DOMPurify from 'isomorphic-dompurify';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';

export function PostContent({ content, query, isSummary = false }: PostContentProps) {
  if (isSummary) return <HighlightText text={content} query={query} />;

  // 1. Convert mixed HTML/Markdown to clean semantic HTML
  const rawHtml = applyMarkdownToHtml(content);

  // 2. Sanitize HTML
  let finalHtml = DOMPurify.sanitize(sanitizeUserHtml(rawHtml));

  // 3. Highlight search query if present
  if (query && query.trim()) {
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace the query only outside of HTML tags
    const regex = new RegExp(`(?![^<]*>)(${q})`, 'gi');
    finalHtml = finalHtml.replace(regex, '<mark class="bg-[var(--color-primary)]/30 text-[var(--color-text-main)] rounded px-0.5">$1</mark>');
  }

  return (
    <CodeHighlighter
      className="rich-text-content space-y-3 leading-relaxed"
      html={finalHtml}
    />
  );
}
