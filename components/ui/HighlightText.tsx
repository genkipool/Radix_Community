import React from 'react';

interface HighlightTextProps {
    text: string;
    query: string;
}

export function HighlightText({ text, query }: HighlightTextProps) {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={`hl-${i}`} className="bg-[var(--color-primary)]/30 text-[var(--color-text-main)] rounded px-0.5">{part}</mark>
                    : part
            )}
        </>
    );
}
