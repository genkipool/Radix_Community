'use client';

/**
 * SourceBadge
 *
 * Universal "Received/Sent via: METHOD" badge used across all asset transfer
 * rows. Single source of truth for style — change here, updates everywhere.
 *
 * Vertical alignment: py-1 + mt-[1px] on text spans keeps the label perfectly
 * centred regardless of font metrics or browser rendering quirks.
 */
export function SourceBadge({
    method,
    color,
    bg,
    title,
    label,
}: {
    method: string;
    color?: string;
    bg?: string;
    title?: string;
    label?: string;
}) {
    if (!method) return null;
    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] uppercase font-medium leading-none cursor-help shrink-0 shadow-sm align-middle box-border ${bg ?? 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30'}`}
            title={title ?? method}
        >
            <span className="text-slate-500 dark:text-slate-400 font-bold tracking-wider opacity-80 mt-[1px]">
                {label ?? 'via:'}
            </span>
            <span className={`font-black tracking-tight mt-[1px] ${color ?? 'text-amber-700 dark:text-amber-400'}`}>
                {method}
            </span>
        </div>
    );
}
