'use client';

import { useState } from 'react';

/** Copies text to the clipboard and remembers the last copied value for a moment. */
export function useCopy(resetMs = 1500) {
    const [copied, setCopied] = useState<string | null>(null);
    const copy = (value: string) => {
        navigator.clipboard?.writeText(value).then(() => {
            setCopied(value);
            setTimeout(() => setCopied(c => (c === value ? null : c)), resetMs);
        }).catch(() => { /* clipboard unavailable: nothing to show */ });
    };
    return { copied, copy };
}
