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

/**
 * Account selector for voting: the wallet's accounts with their colour, name
 * and address, as a keyboard-accessible listbox.
 */
export function AccountPicker({ accounts, value, onChange, label }: {
    accounts: WalletAccount[];
    value: string;
    onChange: (address: string) => void;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = accounts.find(a => a.address === value) ?? accounts[0];
    const single = accounts.length <= 1;

    const choose = (address: string) => { onChange(address); setOpen(false); };
    const openList = () => { setActive(Math.max(0, accounts.findIndex(a => a.address === value))); setOpen(true); };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (single) return;
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openList(); return; }
        if (!open) return;
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % accounts.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + accounts.length) % accounts.length); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(accounts[active].address); }
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
                onClick={() => (open ? setOpen(false) : openList())}
                onKeyDown={onKeyDown}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${open
                    ? 'border-[var(--color-primary)] bg-[var(--color-card-bg)] shadow-[0_0_0_3px_var(--color-primary)]/10'
                    : 'border-[var(--color-card-border)] bg-[var(--color-surface)] enabled:hover:border-[var(--color-primary)]/50'}`}
            >
                {selected && <Avatar account={selected} />}
                {selected && <AccountLine account={selected} />}
                {!single && <ChevronDown className={`ml-auto size-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={label}
                    className="absolute z-30 mt-2 w-full max-h-72 overflow-auto no-scrollbar rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-1.5 shadow-xl"
                >
                    {accounts.map((a, i) => {
                        const isSelected = a.address === value;
                        return (
                            <li
                                key={a.address}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={-1}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => choose(a.address)}
                                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${i === active ? 'bg-[var(--color-surface)]' : ''}`}
                            >
                                <Avatar account={a} size="size-8" />
                                <AccountLine account={a} />
                                {isSelected && <Check className="ml-auto size-4 shrink-0 text-[var(--color-primary)]" />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
