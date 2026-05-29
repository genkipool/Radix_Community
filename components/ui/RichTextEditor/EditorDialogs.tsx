'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Link2 } from 'lucide-react';
import {
    LinkDialogProps,
    DiscardDialogProps,
    ModalShellProps,
    BtnProps,
    FieldInputProps
} from './types';

/* ─── Shared modal shell ─── */
function ModalShell({ children, onBackdropClick }: ModalShellProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onBackdropClick}
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="relative z-10 rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
                style={{
                    background: 'var(--color-card-bg)',
                    border: '1px solid var(--color-card-border)',
                }}
            >
                {children}
            </motion.div>
        </div>
    );
}

/* ─── Label ─── */
function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            {children}
        </label>
    );
}

/* ─── Input ─── */
function FieldInput(props: FieldInputProps) {
    return (
        <input
            {...props}
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
            style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-text-main)',
                caretColor: 'var(--color-primary)',
            }}
            onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-primary)'; }}
            onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-card-border)'; }}
        />
    );
}

/* ─── Btn primary / secondary ─── */
function Btn({ variant = 'primary', children, ...rest }: BtnProps) {
    const styles: Record<string, React.CSSProperties> = {
        primary: { background: 'var(--color-primary)', color: 'var(--color-bg)' },
        secondary: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-muted)',
        },
        danger: { background: '#ef4444', color: '#fff' },
    };
    return (
        <button
            type="button"
            {...rest}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
            style={styles[variant]}
        >
            {children}
        </button>
    );
}

/* =============================================═════════ */
/*  LinkDialog                                            */
/* =============================================═════════ */
export function LinkDialog({ onInsert, onClose, t }: LinkDialogProps) {
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');

    const commit = () => { if (url.trim()) onInsert(url.trim(), label.trim()); };

    return (
        <ModalShell onBackdropClick={onClose}>
            <div className="flex items-center gap-3 mb-5">
                <div
                    className="size-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
                >
                    <Link2 className="size-4" />
                </div>
                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-main)' }}>
                    {t?.insert_link ?? 'Insert link'}
                </h3>
            </div>

            <div className="space-y-4">
                <div>
                    <FieldLabel>URL</FieldLabel>
                    <FieldInput
                        type="url"
                        placeholder="https://..."
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
                    />
                </div>
                <div>
                    <FieldLabel>{t?.link_label_placeholder ?? 'Label (optional)'}</FieldLabel>
                    <FieldInput
                        type="text"
                        placeholder={t?.link_label_placeholder ?? 'Link text…'}
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
                    />
                </div>
            </div>

            <div className="flex gap-3 mt-5">
                <Btn variant="primary" onClick={commit}>{t?.insert ?? 'Insert'}</Btn>
                <Btn variant="secondary" onClick={onClose}>{t?.cancel ?? 'Cancel'}</Btn>
            </div>
        </ModalShell>
    );
}

/* =============================================═════════ */
/*  DiscardDialog                                         */
/* =============================================═════════ */

function _DiscardDialog({ onConfirm, onClose, t }: DiscardDialogProps) {
    return (
        <ModalShell onBackdropClick={onClose}>
            <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="size-5 text-amber-400 shrink-0" />
                <h3 className="font-bold text-base" style={{ color: 'var(--color-text-main)' }}>
                    {t?.confirm_discard ?? 'Discard changes?'}
                </h3>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
                {t?.confirm_discard_desc ?? 'All unsaved changes will be permanently lost.'}
            </p>
            <div className="flex gap-3">
                <Btn variant="danger" onClick={onConfirm}>{t?.discard ?? 'Discard'}</Btn>
                <Btn variant="secondary" onClick={onClose}>{t?.cancel ?? 'Cancel'}</Btn>
            </div>
        </ModalShell>
    );
}
