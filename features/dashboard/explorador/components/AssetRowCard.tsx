'use client';
/**
 * One asset of an account as the account card's Tokens tab draws it: icon,
 * name and symbol, short address with copy, the amount on the right and a
 * chevron; clicked, it opens its panel underneath. Only the look: the caller
 * says what the asset is and what opens (Babylon resources and Olympia tokens
 * share it).
 */
import React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, ChevronDown, Copy, Info } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { truncateAddress } from '@/utils/formatters';

export interface AssetRowCardProps {
    address: string;
    name: string;
    symbol?: string | null;
    iconUrl?: string | null;
    /** The amount, already formatted. */
    amountText: string;
    /** Under the amount (a validator or a claim value). */
    amountExtra?: React.ReactNode;
    expanded: boolean;
    onToggle: () => void;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    /** What opens under the row; rendered only while expanded. */
    children?: React.ReactNode;
}

/** A section of asset rows with its title, as in the Tokens tab. */
export function AssetListSection({ title, burned = false, children }: { title: string; burned?: boolean; children: React.ReactNode }) {
    return (
        <div className="mt-4">
            <h4 className={`text-xs font-black uppercase mb-3 tracking-wider ${burned ? 'text-red-500/80' : 'text-[var(--color-text-muted)]'}`}>
                {title}
            </h4>
            <div className="flex flex-col gap-2">{children}</div>
        </div>
    );
}

export function AssetRowCard({
    address, name, symbol, iconUrl, amountText, amountExtra, expanded, onToggle, onCopy, copiedAddress, burned = false, children,
}: AssetRowCardProps) {
    const handleToggle = (e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        if (window.getSelection()?.toString()) return;
        onToggle();
    };

    return (
        <div className={`flex flex-col bg-[var(--color-surface)] border ${burned ? 'border-red-500/20 opacity-70' : 'border-[var(--color-card-border)]'} rounded-xl transition-all shadow-sm`}>
            {/* Clickable Header */}
            <div
                role="button"
                tabIndex={0}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl w-full text-left"
                onClick={handleToggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(e); } }}
            >
                {/* Left side: Icon + Name + Address */}
                <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                    <div className="size-8 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center border border-[var(--color-card-border)]">
                        {iconUrl ? (
                            <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className={`w-full h-full object-cover ${burned ? 'grayscale' : ''}`} zoomable={true} />
                        ) : (
                            <Info className="size-4 text-[var(--color-text-muted)]" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate min-w-[3ch]" title={name}>{name}</span>
                            {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate min-w-0 max-w-[40%] shrink" title={symbol}>{symbol}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate select-all">{truncateAddress(address, 6, 6)}</span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors shrink-0"
                            >
                                {copiedAddress === address ? <Check className="size-2.5 text-green-500" /> : <Copy className="size-2.5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right side: Amount + Chevron */}
                <div className="flex items-center gap-2 shrink-0 max-w-[50%]">
                    <div className="flex flex-col items-end gap-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0 max-w-full">
                            <span className="text-xs font-mono font-black text-[var(--color-text-main)] tracking-tight whitespace-nowrap">
                                {amountText}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] text-right truncate min-w-0 max-w-[7rem]" title={symbol || name}>
                                {symbol || name}
                            </span>
                        </div>
                        {amountExtra}
                    </div>
                    <ChevronDown className={`size-4 ml-1 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                </div>
            </div>

            {/* Expandable Content Overlay using AnimatePresence */}
            <AnimatePresence>
                {expanded && (
                    <m.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        {children}
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
