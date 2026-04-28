'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface CopyButtonProps {
    value: string;
    label?: string;
    variant?: 'ghost' | 'solid' | 'minimal' | 'card-inline';
    size?: 'xs' | 'sm' | 'md';
    className?: string;
    forceCopied?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

export function CopyButton({
    value,
    label,
    variant = 'solid',
    size = 'sm',
    className = '',
    forceCopied,
    onClick
}: CopyButtonProps) {
    const [internalCopied, setInternalCopied] = useState(false);
    const { t } = useLanguage();
    const copiedText = t?.community_transparency?.copied ?? '¡Copiado!';

    const isCopied = forceCopied ?? internalCopied;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(e);
            return;
        }
        if (isCopied) return;
        try {
            await navigator.clipboard.writeText(value);
            setInternalCopied(true);
            setTimeout(() => setInternalCopied(false), 2000);
        } catch { /* noop */ }
    };

    const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 16;

    const variants = {
        solid: {
            base: 'bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-main)]',
            active: 'bg-green-500/10 border-green-500/30 text-green-500 shadow-[0_0_12px_rgba(34,197,94,0.1)]'
        },
        ghost: {
            base: 'bg-transparent border-transparent text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-main)]',
            active: 'bg-green-500/10 border-transparent text-green-500'
        },
        minimal: {
            base: 'bg-transparent border-transparent text-[var(--color-text-muted)] opacity-60 hover:opacity-100',
            active: 'bg-transparent border-transparent text-green-500 opacity-100'
        },
        'card-inline': {
            base: 'bg-transparent border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors',
            active: 'bg-transparent border-transparent text-green-500 transition-colors'
        }
    };

    const currentStyle = isCopied ? variants[variant].active : variants[variant].base;

    const padding = {
        xs: label ? 'px-2 py-0.5' : 'p-1',
        sm: label ? 'px-2.5 py-1' : 'p-1.5',
        md: label ? 'px-4 py-2' : 'p-2.5',
    }[size];

    const fontSize = {
        xs: 'text-[10px]',
        sm: 'text-xs',
        md: 'text-sm',
    }[size];

    return (
        <button
            onClick={handleCopy}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition-all duration-300 isolate ${padding} ${fontSize} ${currentStyle} ${className}`}
            aria-label={label ?? 'Copy'}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isCopied ? (
                    <motion.div
                        key="check"
                        initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.2, ease: "backOut" }}
                        className="flex items-center gap-1.5"
                    >
                        <Check size={iconSize} />
                        {label && <span>{copiedText}</span>}
                    </motion.div>
                ) : (
                    <motion.div
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1.5"
                    >
                        <Copy size={iconSize} />
                        {label && <span>{label}</span>}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Subtle glow effect on copy */}
            {isCopied && (
                <motion.div
                    layoutId="copy-glow"
                    className="absolute inset-0 z-[-1] rounded-lg bg-green-500/10 blur-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                />
            )}
        </button>
    );
}

/** Professional address row with integrated copy feedback */
export function AddressRow({
    address,
    label,
    className = '',
}: {
    address: string;
    label?: string;
    className?: string;
}) {
    const short = address.length > 28
        ? `${address.slice(0, 16)}...${address.slice(-8)}`
        : address;

    return (
        <div className={`group flex items-center gap-2 p-1 pl-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] transition-all hover:border-[var(--color-primary)]/20 ${className}`}>
            {label && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    {label}
                </span>
            )}
            <code className="flex-1 min-w-0 truncate text-xs font-mono text-[var(--color-text-main)] opacity-80 group-hover:opacity-100 transition-opacity">
                {short}
            </code>
            <CopyButton value={address} variant="minimal" size="sm" />
        </div>
    );
}

