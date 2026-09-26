'use client';

import React, { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { WalletAccount } from '@/features/wallet/types/wallet';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';

/** One gradient per wallet appearance id, so an account keeps its colour. */
const APPEARANCES = [
    'from-sky-500 to-indigo-600', 'from-emerald-400 to-teal-600', 'from-fuchsia-500 to-purple-600',
    'from-amber-400 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-400 to-blue-600',
    'from-lime-400 to-green-600', 'from-violet-500 to-indigo-700', 'from-orange-400 to-red-600',
    'from-teal-400 to-cyan-700', 'from-pink-400 to-fuchsia-600', 'from-blue-500 to-slate-700',
];

function Avatar({ account, size = 'size-9' }: { account: WalletAccount; size?: string }) {
    const gradient = APPEARANCES[Math.abs(account.appearanceId ?? 0) % APPEARANCES.length];
    const initial = (account.label?.trim()[0] ?? '#').toUpperCase();
    return (
        <span className={`grid place-items-center ${size} rounded-xl bg-gradient-to-br ${gradient} text-white text-sm font-black shadow-sm shrink-0`}>
            {initial}
        </span>
    );
}

function AccountLine({ account }: { account: WalletAccount }) {
    return (
        <span className="min-w-0 flex flex-col text-left">
            <span className="truncate text-sm font-bold text-[var(--color-text-main)]">{account.label || shortenAddress(account.address)}</span>
            <span className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">{shortenAddress(account.address)}</span>
        </span>
    );
}

/** Same look as the destination address list of the wallet transfer popup. */
function rowClass(selected: boolean, active: boolean): string {
    const state = selected
        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold'
        : active ? 'bg-[var(--color-bg)] text-[var(--color-text-main)]' : 'text-[var(--color-text-main)]';
    return `group w-full flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${state}`;
}

/**
 * Accounts to vote with: one or several (all of them cast the same vote in a
 * single transaction). A keyboard-accessible multi-select listbox showing each
 * account's colour, name and address.
 */
export function AccountPicker({ accounts, selected, onToggle, onSetAll, label, labels }: {
    accounts: WalletAccount[];
    selected: string[];
    onToggle: (address: string) => void;
    onSetAll: (addresses: string[]) => void;
    label: string;
    labels: { all: string; count: string; none: string };
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const chosen = accounts.filter(a => selected.includes(a.address));
    const allSelected = chosen.length === accounts.length;
    const single = accounts.length <= 1;
    // Row 0 is "all accounts" when there is more than one.
    const rows = single ? accounts.length : accounts.length + 1;

    const activate = (i: number) => {
        if (!single && i === 0) onSetAll(allSelected ? accounts.slice(0, 1).map(a => a.address) : accounts.map(a => a.address));
        else onToggle(accounts[single ? i : i - 1].address);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (single) return;
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActive(0); setOpen(true); return; }
        if (!open) return;
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % rows); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + rows) % rows); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(active); }
    };

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={e => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
        >
            <span className="block mb-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{label}</span>
            <button
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-haspopup="listbox"
                aria-label={label}
                disabled={single}
                onClick={() => setOpen(o => !o)}
                onKeyDown={onKeyDown}
                className={`w-full h-14 flex items-center gap-3 rounded-xl border px-3 text-left transition-colors ${open
                    ? 'border-[var(--color-primary)] bg-[var(--color-card-bg)]'
                    : 'border-[var(--color-card-border)] bg-[var(--color-surface)] enabled:hover:border-[var(--color-primary)]/50'}`}
            >
                {chosen.length === 1 ? (
                    <>
                        <Avatar account={chosen[0]} />
                        <AccountLine account={chosen[0]} />
                    </>
                ) : chosen.length > 1 ? (
                    <>
                        <span className="flex -space-x-2 shrink-0">
                            {chosen.slice(0, 4).map(a => <span key={a.address} className="ring-2 ring-[var(--color-card-bg)] rounded-xl"><Avatar account={a} size="size-9" /></span>)}
                            {chosen.length > 4 && (
                                <span className="grid place-items-center size-9 rounded-xl ring-2 ring-[var(--color-card-bg)] bg-[var(--color-surface-hover)] text-[11px] font-bold text-[var(--color-text-secondary)] tabular-nums">
                                    +{chosen.length - 4}
                                </span>
                            )}
                        </span>
                        <span className="min-w-0 text-sm font-bold text-[var(--color-text-main)] truncate">
                            {allSelected ? labels.all : labels.count.replace('{n}', String(chosen.length))}
                        </span>
                    </>
                ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">{labels.none}</span>
                )}
                {!single && <ChevronDown className={`ml-auto size-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={label}
                    className="absolute z-30 mt-2 w-full max-h-80 overflow-auto no-scrollbar rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl p-1.5 shadow-2xl"
                >
                    {!single && (
                        <li
                            role="option"
                            aria-selected={allSelected}
                            tabIndex={-1}
                            onMouseEnter={() => setActive(0)}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => activate(0)}
                            className={`${rowClass(allSelected, active === 0)} mb-1`}
                        >
                            <span className={`text-xs ${allSelected ? '' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{labels.all}</span>
                            {allSelected && <Check className="size-4 shrink-0 ml-2" strokeWidth={2} />}
                        </li>
                    )}
                    {accounts.map((a, i) => {
                        const row = single ? i : i + 1;
                        const isSelected = selected.includes(a.address);
                        return (
                            <li
                                key={a.address}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={-1}
                                onMouseEnter={() => setActive(row)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => activate(row)}
                                className={rowClass(isSelected, active === row)}
                            >
                                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <Avatar account={a} size="size-7" />
                                    <span className="flex flex-col min-w-0">
                                        <span className={`text-xs truncate ${isSelected ? '' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{a.label || shortenAddress(a.address)}</span>
                                        <span className={`text-[10px] truncate ${isSelected ? 'text-[var(--color-primary)]/80 font-normal' : 'text-[var(--color-text-muted)]'}`}>{shortenAddress(a.address)}</span>
                                    </span>
                                </span>
                                {isSelected && <Check className="size-4 shrink-0 ml-2" strokeWidth={2} />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
