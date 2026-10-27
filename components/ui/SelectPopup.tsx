'use client';

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Check, Search, X } from 'lucide-react';
import { m } from 'motion/react';

/*
 * The selection popup used across the site (the wallet profile's address and
 * validator filters, the send-transaction picker, the console's "+" pickers):
 * a title bar with a close button, a search box, the rows and, when several
 * can be picked, one button that applies the choice.
 *
 * Several at once works on a draft: ticking rows changes nothing outside the
 * popup until the footer button applies it, closing without it discards it,
 * and rows picked when it opened are listed first and stay put while toggling.
 */

/** Container look; position it with `className` / `style`. */
const PANEL_CLASS =
  'flex flex-col rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl overflow-hidden';
const BAR_CLASS = 'shrink-0 p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50';

export function SelectPopupClose({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-colors shrink-0 ml-2"
    >
      <X className="size-4" />
    </button>
  );
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
/**
 * Width a popup needs for `SelectPopupTabs` with these labels (each with its
 * count, as shown), so it can size itself to fit them on one line: 10 px
 * bold uppercase text with 0.05em tracking, 4 px padding a side, 12 px gaps,
 * 12 px bar padding a side and the 32 px close button, plus 8 px so subpixel
 * rounding never pushes the last tab onto another line. 0 when it cannot
 * measure (no DOM), so callers fall back to their own width.
 */
export function selectPopupTabsWidth(labels: string[]): number {
  if (typeof document === 'undefined') return 0;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = `700 10px ${getComputedStyle(document.body).fontFamily}`;
  const text = labels.reduce((sum, l) => sum + measureCtx!.measureText(l.toUpperCase()).width + l.length * 0.5 + 8, 0);
  return Math.ceil(text + 12 * (labels.length - 1) + 24 + 32 + 8);
}

interface SelectPopupTabsProps<T extends string> {
  tabs: Array<{ value: T; label: ReactNode; count?: number }>;
  active: T;
  onChange: (value: T) => void;
  onClose: () => void;
  closeLabel: string;
}

/** A title bar made of tabs (underlined when active) and the close button; pass it as `header`. */
export function SelectPopupTabs<T extends string>({ tabs, active, onChange, onClose, closeLabel }: SelectPopupTabsProps<T>) {
  return (
    // The top padding belongs to the tabs (their underline sits on the border),
    // so the close button centres on the whole bar.
    <div className="shrink-0 px-3 flex items-center justify-between border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
      {/* Each tab grows from its own width, so they fill the bar with even gaps;
          tabs that do not fit wrap onto another line instead of hiding behind a scroll. */}
      <div role="tablist" className="flex flex-wrap gap-x-3 pt-3 flex-1 min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active === tab.value}
            onClick={() => onChange(tab.value)}
            className="relative flex-auto py-2 px-1 outline-none flex items-center justify-center group"
          >
            <span
              className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap transition-opacity duration-200 ${
                active === tab.value
                  ? 'text-[var(--color-primary)] opacity-100'
                  : 'text-[var(--color-text-muted)] opacity-80 group-hover:opacity-100'
              }`}
            >
              {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
            </span>
            {active === tab.value && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-primary)] rounded-t-full" />}
          </button>
        ))}
      </div>
      <SelectPopupClose onClick={onClose} label={closeLabel} />
    </div>
  );
}

interface SelectPopupProps {
  /** Title bar text; ignored when `header` is given. */
  title?: ReactNode;
  /** Replaces the title bar, e.g. with tabs. Include a `SelectPopupClose`. */
  header?: ReactNode;
  onClose: () => void;
  closeLabel: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    autoFocus?: boolean;
    onEnter?: () => void;
    /** Label of the clear (×) button; the button shows only when there is text and this is given. */
    clearLabel?: string;
  };
  /** Rendered between the search box and the rows (tabs, options). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** The apply button; only for popups that pick several. */
  footer?: { label: ReactNode; onClick: () => void; disabled?: boolean };
  /** Limits the rows' height when the container itself is not limited. */
  listClassName?: string;
  className?: string;
  style?: CSSProperties;
  /** Which way it grows from its trigger, for the entry animation. */
  direction?: 'up' | 'down';
  ref?: Ref<HTMLDivElement>;
}

/** The popup body. Wrap it in `AnimatePresence` for the exit animation. */
export function SelectPopup({
  title,
  header,
  onClose,
  closeLabel,
  search,
  toolbar,
  children,
  footer,
  listClassName = '',
  className = '',
  style,
  direction = 'down',
  ref,
}: SelectPopupProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search?.onEnter) {
      e.preventDefault();
      search.onEnter();
    }
  };
  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: direction === 'up' ? -8 : 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: direction === 'up' ? -8 : 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={`${PANEL_CLASS} ${className}`}
      style={style}
    >
      {header ?? (
        <div className={`${BAR_CLASS} flex items-center justify-between`}>
          <span className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider truncate">{title}</span>
          <SelectPopupClose onClick={onClose} label={closeLabel} />
        </div>
      )}
      {search && (
        <div className={BAR_CLASS}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              autoFocus={search.autoFocus}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-8 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
            />
            {search.clearLabel && search.value && (
              <button
                type="button"
                onClick={() => search.onChange('')}
                aria-label={search.clearLabel}
                title={search.clearLabel}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {toolbar}
      <div className={`min-h-0 flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar ${listClassName}`}>{children}</div>
      {footer && (
        <div className="shrink-0 p-3 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
          <button
            type="button"
            onClick={footer.onClick}
            disabled={footer.disabled}
            className="w-full flex items-center justify-center py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {footer.label}
          </button>
        </div>
      )}
    </m.div>
  );
}

interface SelectPopupRowProps {
  selected: boolean;
  onClick: () => void;
  label: ReactNode;
  /** Second line: an address, a name. */
  sublabel?: ReactNode;
  /** Before the text: an icon or thumbnail. */
  icon?: ReactNode;
  /** After the text, before the check: a balance, an amount. */
  trailing?: ReactNode;
  disabled?: boolean;
  title?: string;
  /** False for rows that pick one and close: they need no check. */
  showCheck?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

/** One row: tinted and checked when selected. */
export function SelectPopupRow({ selected, onClick, label, sublabel, icon, trailing, disabled, title, showCheck = true, onKeyDown }: SelectPopupRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      title={title}
      aria-pressed={selected}
      className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg transition-colors group ${
        selected
          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold'
          : 'hover:bg-[var(--color-bg)] text-[var(--color-text-main)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon && <span className="flex shrink-0 items-center justify-center">{icon}</span>}
        <span className="flex min-w-0 flex-col">
          <span className={`truncate ${selected ? '' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{label}</span>
          {sublabel && (
            <span className={`truncate text-[10px] font-normal ${selected ? 'text-[var(--color-primary)]/80' : 'text-[var(--color-text-muted)]'}`}>
              {sublabel}
            </span>
          )}
        </span>
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
      {showCheck && selected && <Check className="size-4 shrink-0" strokeWidth={2} />}
    </button>
  );
}

export function SelectPopupEmpty({ children }: { children: ReactNode }) {
  return <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">{children}</div>;
}

/**
 * The draft behind a several-at-once popup. `open(current)` starts it from
 * what is applied now; `toggle` edits it; `pinned` is what was picked when it
 * opened, which `selectedFirst` lists on top. `repin()` makes the current
 * picks the pinned ones, for when the list starts over (the search cleared):
 * rows never jump while toggling, only when the list is rebuilt anyway.
 */
export function useSelectionDraft<T extends string>() {
  const [draft, setDraft] = useState<T[]>([]);
  const [pinned, setPinned] = useState<T[]>([]);
  return {
    draft,
    pinned,
    open: (current: T[]) => {
      setDraft(current);
      setPinned(current);
    },
    toggle: (value: T) => setDraft((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value])),
    repin: () => setPinned(draft),
    set: setDraft,
  };
}

/** Items picked when the popup opened first, in their original order otherwise. */
export function selectedFirst<I>(items: I[], pinned: string[], keyOf: (item: I) => string | null): I[] {
  const isPinned = (item: I) => {
    const key = keyOf(item);
    return key !== null && pinned.includes(key);
  };
  return [...items.filter(isPinned), ...items.filter((item) => !isPinned(item))];
}
