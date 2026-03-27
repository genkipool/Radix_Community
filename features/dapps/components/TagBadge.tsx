/**
 * features/dapps/components/TagBadge.tsx
 */

import React from 'react';
import { dappTagColor } from '@/constants/tagColors';

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${
        dappTagColor[tag] ??
        'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'
      }`}
    >
      {tag}
    </span>
  );
}
