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

function renderFormattedLine(text: string, query: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-[var(--color-text-main)]">
              <HighlightText text={part.slice(2, -2)} query={query} />
            </strong>
          );
        }
        return <React.Fragment key={i}><HighlightText text={part} query={query} /></React.Fragment>;
      })}
    </>
  );
}

export function PostContent({ content, query, isSummary = false }: PostContentProps) {
  if (isSummary) return <HighlightText text={content} query={query} />;

  // Detect HTML content (from RichTextEditor) — render it natively
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  if (isHtml) {
    return (
      <div
        className="rich-text-content space-y-3 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Plain text fallback — existing bullet / bold rendering
  const lines = content.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed && i < lines.length - 1) return <div key={i} className="h-2" />;
        if (!trimmed) return null;

        const isBullet = trimmed.startsWith('•');
        const cleanLine = isBullet ? trimmed.substring(1).trim() : line;

        return (
          <div key={i} className={`flex gap-2 ${isBullet ? 'pl-4' : ''}`}>
            {isBullet && (
              <span className="text-[var(--color-primary)] font-bold shrink-0 mt-0.5">•</span>
            )}
            <div className="flex-1">{renderFormattedLine(cleanLine, query)}</div>
          </div>
        );
      })}
    </div>
  );
}
