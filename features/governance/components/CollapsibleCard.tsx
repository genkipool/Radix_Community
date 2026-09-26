'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

/**
 * A side-panel card whose header folds and unfolds its body. The body slides
 * open; once it has, overflow is released so popups inside it (the account
 * picker) are not clipped by the card.
 */
export function CollapsibleCard({ id, icon: Icon, title, headerClassName = '', children }: {
    id: string;
    icon: LucideIcon;
    title: string;
    /** Extra classes for the header (e.g. a tinted background). */
    headerClassName?: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);
    const [settled, setSettled] = useState(true);
    const bodyId = useId();

    const toggle = () => {
        setOpen(o => !o);
        setSettled(false);
        // Not on transitionend: it never fires with reduced motion or in a background tab.
        window.setTimeout(() => setSettled(true), 250);
    };

    return (
        <section aria-labelledby={id} className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
            <h2 id={id}>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={toggle}
                    className={`group w-full px-5 py-4 flex items-center gap-2 text-left text-sm font-bold text-[var(--color-text-main)] transition-colors ${open ? 'rounded-t-2xl' : 'rounded-2xl'} ${headerClassName}`}
                >
                    <Icon className="size-4 shrink-0 text-[var(--color-primary)]" />
                    <span className="min-w-0 flex-1">{title}</span>
                    <ChevronDown className={`size-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:text-[var(--color-primary)] ${open ? 'rotate-180' : ''}`} />
                </button>
            </h2>
            <div
                id={bodyId}
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
                <div inert={!open} className={`min-h-0 ${open && settled ? 'overflow-visible' : 'overflow-hidden'}`}>
                    <div className="border-t border-[var(--color-card-border)] p-5">{children}</div>
                </div>
            </div>
        </section>
    );
}
