'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Portal } from '@/components/ui/Portal';
import { SelectPopup, SelectPopupRow } from '@/components/ui/SelectPopup';
import { usePickerPopup } from '@/hooks/usePickerPopup';

export interface MultiFilterOption {
    key: string;
    label: string;
    count: number;
    dotClass?: string;
}

/**
 * Multi-select tab-bar dropdown used by VotersTable for both the grade/vote
 * filter and the election candidate filter.
 */
export function MultiFilterDropdown({
    title,
    label,
    tooltip,
    closeLabel,
    options,
    activeKeys,
    onToggle,
    language,
    onBeforeOpen,
}: {
    title: string;
    label: string;
    tooltip?: string;
    closeLabel: string;
    options: MultiFilterOption[];
    activeKeys: ReadonlySet<string>;
    onToggle: (key: string) => void;
    language: string;
    onBeforeOpen?: () => void;
}) {
    const { open, show, close, buttonRef, popupRef, layoutFor } = usePickerPopup();
    const layout = layoutFor(300, 'left');
    const hasActive = activeKeys.size > 0;

    return (
        <div className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                aria-expanded={open}
                title={tooltip}
                onClick={() => {
                    onBeforeOpen?.();
                    if (open) close();
                    else show();
                }}
                className={`relative inline-flex items-center justify-center gap-1.5 w-36 sm:w-44 pb-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    hasActive ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
            >
                <span className="truncate">{label}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                {hasActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
            </button>
            <Portal>
                <AnimatePresence>
                    {open && (
                        <SelectPopup
                            ref={popupRef}
                            title={title}
                            closeLabel={closeLabel}
                            onClose={close}
                            direction={layout.direction}
                            style={{
                                ...layout.style,
                                height: 'auto',
                                maxHeight: layout.style.height,
                            }}
                        >
                            {options.map(opt => (
                                <SelectPopupRow
                                    key={opt.key}
                                    selected={activeKeys.has(opt.key)}
                                    label={opt.label}
                                    icon={opt.dotClass ? (
                                        <span className={`size-2 rounded-full shrink-0 ${opt.dotClass}`} aria-hidden="true" />
                                    ) : undefined}
                                    trailing={
                                        <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
                                            ({opt.count.toLocaleString(language)})
                                        </span>
                                    }
                                    onClick={() => onToggle(opt.key)}
                                />
                            ))}
                        </SelectPopup>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}
