import React from 'react';

/**
 * LabelBadge
 *
 * A premium, unified badge component with optional label and high-contrast value.
 * Derived from the Dashboard's transaction source badges.
 */
interface LabelBadgeProps {
  /** Optional prefix label (e.g., "Recibido vía:", "Tema:"). Shown in muted style. */
  label?: string;
  /** The main content of the badge. Shown in high-contrast bold style. */
  value: string;
  /** Tailwind classes for text color (e.g., "text-emerald-700 dark:text-emerald-400"). */
  colorClass?: string;
  /** Tailwind classes for background and border (e.g., "bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"). */
  bgClass?: string;
  /** Optional tooltip title. */
  title?: string;
  /** Optional click handler. */
  onClick?: (e: React.MouseEvent) => void;
  /** Extra container classes. */
  className?: string;
}

export function LabelBadge({
  label,
  value,
  colorClass,
  bgClass,
  title,
  onClick,
  className = '',
}: LabelBadgeProps) {
  const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] uppercase font-medium leading-none shrink-0 shadow-sm align-middle box-border transition-all duration-200";
  const bgClasses = bgClass ?? "bg-[var(--color-bg-alt)] border-[var(--color-border)]";

  return (
    <button
      onClick={onClick}
      title={title}
      className={`${baseClasses} ${bgClasses} ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'} ${className}`}
    >
      {label && (
        <span className="text-[var(--color-text-muted)] border-r border-[var(--color-border)] pr-1.5 flex items-center h-full">
          {label}
        </span>
      )}
      <span className={`font-bold tracking-wider mt-[0.5px] ${colorClass ?? "text-[var(--color-text-main)]"}`}>
        {value}
      </span>
    </button>
  );
}
