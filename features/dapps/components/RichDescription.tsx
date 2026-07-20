/**
 * features/dapps/components/RichDescription.tsx
 */

import React from 'react';
import { ConnectWalletPopover } from '@/features/wallet/components/ConnectWalletPopover';
import { type RichDescriptionProps } from '../types/components.types';

/**
 * Render `text` wrapping each occurrence of `keywords` in a <strong>.
 * Keywords are matched case-insensitively; longer phrases match first.
 */
function HighlightBlock({ text, keywords }: { text: string; keywords: string[] }): React.ReactNode {
  if (!keywords.length) return <>{text}</>;

  const sorted = keywords.toSorted((a, b) => b.length - a.length);
  const escaped = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  const kwSet = new Set(sorted.map(k => k.toLowerCase()));

  return (
    <>
      {parts.map((part, i) => kwSet.has(part.toLowerCase()) ? (
          <strong key={`${i}-${part}`} className="font-bold text-[var(--color-text-main)]">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function RichDescription({ text, keywords, ctaPhrase }: RichDescriptionProps) {
  const idx = ctaPhrase ? text.indexOf(ctaPhrase) : -1;

  if (idx === -1) {
    return <HighlightBlock text={text} keywords={keywords} />;
  }

  const before = text.slice(0, idx);
  const after = text.slice(idx + ctaPhrase.length);

  return (
    <>
      <HighlightBlock text={before} keywords={keywords} />
      <ConnectWalletPopover>
        <span
          role="button"
          tabIndex={0}
          aria-label={ctaPhrase}
          className="
            inline-block px-1
            text-[var(--color-primary)] font-bold
            hover:opacity-80 transition-all duration-200 cursor-pointer select-none
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60
          "
        >
          {ctaPhrase}
        </span>
      </ConnectWalletPopover>
      <HighlightBlock text={after} keywords={keywords} />
    </>
  );
}
