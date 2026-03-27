'use client';

import { useState } from 'react';

/**
 * features/dashboard/hooks/useCopyToClipboard.ts
 *
 * Reusable hook for copying text to the clipboard with a temporary success state.
 */
export function useCopyToClipboard(timeoutMs = 2000) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), timeoutMs);
    } catch {
        // Silent fallback — clipboard write is non-critical UI feedback
    }
  };

  return { copiedText, copy };
}
