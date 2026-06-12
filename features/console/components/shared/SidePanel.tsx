'use client';

import { ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface PanelToggleButtonProps {
  open: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}

/** Text button that toggles a tool's right-hand side panel. */
export function PanelToggleButton({ open, onToggle, showLabel, hideLabel }: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer shrink-0"
      style={{ color: 'var(--color-primary)' }}
    >
      {open ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
      {open ? hideLabel : showLabel}
    </button>
  );
}

interface SidePanelProps {
  title: string;
  /** Optional control rendered at the right of the title (e.g. copy button) */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Right-hand area shown next to a tool (manifest viewer, flow diagram).
 * Intentionally unboxed so its content gets the full available space.
 */
export function SidePanel({ title, action, children }: SidePanelProps) {
  return (
    <aside className="space-y-4 self-start lg:sticky lg:top-24 min-w-0">
      <div
        className="flex items-center justify-between gap-3 pb-2 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </aside>
  );
}
