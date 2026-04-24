'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';

export function DeleteDocModal() {
    const { deleteDocModal, closeDeleteDocModal } = useLayout();
    const { isOpen, docTitle, onConfirm } = deleteDocModal;
    const { t: fullDict } = useLanguage();
    
    // Maintain dictionary safety
    const docsT = (fullDict as unknown as { docs?: Record<string, Record<string, string>> }).docs || {};
    const modalT = docsT.delete_modal || {};
    
    const [inputValue, setInputValue] = useState('');

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Reset input when modal opens/closes
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (!isOpen) {
            setInputValue('');
        }
    }

    const keyword = modalT.keyword || 'DELETE';
    const isConfirmed = inputValue.trim().toUpperCase() === keyword.toUpperCase();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isConfirmed) {
            onConfirm();
            closeDeleteDocModal();
        }
    };

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-6">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeDeleteDocModal}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal with original design */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 sm:p-8">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-xl font-bold sm:text-2xl" style={{ color: 'var(--color-text-main)' }}>
                                            {modalT.title || 'Delete Document'}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={closeDeleteDocModal}
                                        className="rounded-lg p-2 transition-colors hover:bg-white/10"
                                        style={{ color: 'var(--color-text-dim)' }}
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                                    {(modalT.description || 'Are you sure you want to delete {docTitle}? Please type {keyword} to confirm.')
                                        .replace('{docTitle}', docTitle)
                                        .replace('{keyword}', keyword)}
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={(modalT.input_placeholder || 'Type {keyword}...').replace('{keyword}', keyword)}
                                        className="w-full rounded-xl border p-4 outline-none ring-red-500/50 transition-all focus:ring-2"
                                        style={{ 
                                            background: 'var(--color-bg-alt)', 
                                            borderColor: 'var(--color-card-border)',
                                            color: 'var(--color-text-main)'
                                        }}
                                        autoFocus
                                    />

                                    <div className="flex gap-3">
                                        <Button
                                            type="submit"
                                            variant="danger"
                                            disabled={!isConfirmed}
                                            className="w-full h-12 bg-gradient-to-r from-[#dc2626] to-[#ea580c] font-bold text-white hover:brightness-110 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-red-500/20"
                                            style={{ borderRadius: '12px' }}
                                        >
                                            {modalT.confirm || 'Delete'}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
