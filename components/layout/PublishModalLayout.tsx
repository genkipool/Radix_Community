'use client';

import React from 'react';
import { motion } from 'motion/react';
import { X, MessageSquarePlus } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Button } from '@/components/ui/Button';

interface PublishModalLayoutProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    title: string;
    subtitle: string;
    icon?: React.ReactNode;
    isPublishing: boolean;
    canPublish: boolean;
    publishLabel: string;
    cancelLabel?: string;
    children: React.ReactNode;
    footerExtra?: React.ReactNode;
    disclaimer?: string;
    maxWidth?: string;
}

/**
 * PublishModalLayout
 * 
 * A shared layout for publishing/composer modals (Forum, Blog, etc.)
 * that ensures consistent premium design, transitions, and interactions.
 * 
 * Standardized to match the high-premium look of the original Forum modal:
 * - Large header with gradient icon
 * - Generous padding (p-8)
 * - Proportional typography
 */
export function PublishModalLayout({
    isOpen,
    onClose,
    onSubmit,
    title,
    subtitle,
    icon = <MessageSquarePlus className="w-6 h-6" />,
    isPublishing,
    canPublish,
    publishLabel,
    cancelLabel,
    children,
    footerExtra,
    disclaimer,
    maxWidth = 'max-w-5xl'
}: PublishModalLayoutProps) {
    if (!isOpen) return null;

    return (
        <>
            <ModalOverlay onClose={onClose} blur="md" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className={`w-full ${maxWidth} max-h-[92vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl rounded-3xl overflow-hidden pointer-events-auto`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 flex flex-col gap-1 relative overflow-hidden border-b border-[var(--color-card-border)] shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-accent)]/5 pointer-events-none" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white shadow-xl shrink-0">
                                    {icon}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
                                        {title}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] opacity-80">
                                        {subtitle}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all border border-transparent hover:border-[var(--color-card-border)]"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 select-text">
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="p-8 flex flex-col gap-6 shrink-0 border-t border-[var(--color-card-border)] bg-[var(--color-surface)]/50">
                        {footerExtra && (
                            <div className="w-full">
                                {footerExtra}
                            </div>
                        )}
                        
                        <div className="flex items-center gap-6 w-full justify-between">
                            <div className="flex-1 min-w-0">
                                {disclaimer && (
                                    <p className="text-xs font-bold text-red-500 select-text leading-tight">
                                        {disclaimer}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                            {cancelLabel && (
                                <Button 
                                    variant="ghost" 
                                    onClick={onClose} 
                                    disabled={isPublishing}
                                    className="px-8 py-3 rounded-2xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                >
                                    {cancelLabel}
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                onClick={onSubmit}
                                isLoading={isPublishing}
                                disabled={!canPublish || isPublishing}
                                className="px-10 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] min-w-[160px]"
                            >
                                {isPublishing ? '...' : publishLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
        </>
    );
}
