import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { WalletAccount } from '@/features/wallet/types/wallet';

interface AccountSelectorProps {
    accounts: WalletAccount[];
    selectedAccount: WalletAccount | null;
    onSelect: (account: WalletAccount) => void;
}

export const AccountSelector = ({ accounts, selectedAccount, onSelect }: AccountSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const truncateAddress = (addr: string) => `${addr.slice(0, 12)}...${addr.slice(-6)}`;

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm hover:border-[var(--color-primary)] transition-colors"
            >
                {selectedAccount ? (
                    <div className="flex flex-col items-start">
                        <span className="font-medium text-[var(--color-text)]">{selectedAccount.label}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{truncateAddress(selectedAccount.address)}</span>
                    </div>
                ) : (
                    <span className="text-[var(--color-text-muted)]">Select an account</span>
                )}
                <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                    {accounts.map(acc => (
                        <button
                            type="button"
                            key={acc.address}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(acc);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--color-background)] transition-colors border-b border-[var(--color-border)] last:border-0 group"
                        >
                            <div className="flex flex-col items-start text-left">
                                <span className="font-medium text-[var(--color-text)] text-sm transition-colors group-hover:text-[var(--color-accent)]">{acc.label}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{truncateAddress(acc.address)}</span>
                            </div>
                            {selectedAccount?.address === acc.address && <Check className="size-4 text-[var(--color-primary)]" />}
                        </button>
                    ))}
                    {accounts.length === 0 && (
                        <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                            No accounts connected
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
