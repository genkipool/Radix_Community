'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/components/ui/Card';
import { ValidatorDetailView } from './ValidatorDetailView';
import { usePrefetchValidatorEntity } from '../hooks/usePrefetchValidator';
import {
    Layout1Col,
    Layout2Col,
    Layout4Col,
    Layout6Col,
} from './ValidatorLayouts';
import type { TranslationsT } from '@/features/dashboard/types';

import { VALIDATOR_MODAL_THRESHOLD } from '@/constants/dashboard';

/* ═════════════════════════════════════════
   Portal Modal — fixed to viewport
═════════════════════════════════════════ */
import { type LocalModalProps, type ValidatorCardProps } from '../types';

const LocalModal = ({
    validator, onClose, onPrev, onNext, t, copiedAddress, onCopy, network = 'mainnet',
}: LocalModalProps) => {
    const dt = t?.dashboard ?? ({} as TranslationsT['dashboard']);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998]"
                style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                onClick={onClose}
            >
                <div className="absolute inset-0 overflow-y-auto flex items-start justify-center p-4 sm:p-6">
                    <motion.div
                        key="modal-content"
                        initial={{ opacity: 0, scale: 0.96, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 24 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        className="relative w-full max-w-[1140px] my-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <ValidatorDetailView
                            validator={validator}
                            onClose={onClose}
                            onPrev={onPrev}
                            onNext={onNext}
                            t={t}
                            dt={dt}
                            copiedAddress={copiedAddress}
                            copyAddress={onCopy}
                            network={network}
                        />
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
};

/* ═════════════════════════════════════════
   Props & equality check
═════════════════════════════════════════ */
// ValidatorCardProps moved to ../types


/* ═════════════════════════════════════════
   Main export
═════════════════════════════════════════ */
export const ValidatorCard: React.FC<ValidatorCardProps> = ({
    validator, index: _index, searchQuery, isExpanded, columns,
    onExpand, onCopy, copiedAddress, t, network = 'mainnet',
    onOpenModalPrev, onOpenModalNext,
}: ValidatorCardProps) => {
    const isModalMode = columns >= VALIDATOR_MODAL_THRESHOLD;
    const [localModalOpen, setLocalModalOpen] = useState(isExpanded && isModalMode);
    const [downTime, setDownTime] = useState(0);

    const { prefetchValidator } = usePrefetchValidatorEntity();

    const handleExpand = () => {
        if (isModalMode) setLocalModalOpen(true);
        else onExpand(validator.id);
    };

    const handleCardClick = () => {
        if (window.getSelection()?.toString().length) return;
        if (Date.now() - downTime > 500) return;
        handleExpand();
    };

    const sharedProps = {
        validator,
        searchQuery,
        isExpanded,
        t,
        onExpand: handleExpand,
        onCopy,
        copiedAddress,
        network,
    };

    return (
        <>
            <Card
                onPointerEnter={() => prefetchValidator(validator.address, network)}
                onPointerDown={() => setDownTime(Date.now())}
                onClick={handleCardClick}
                className={`p-0 overflow-hidden group cursor-pointer transition-[border-color,box-shadow,transform] duration-300 ${isExpanded && !isModalMode ? 'border-[var(--color-primary)]/40 shadow-lg' : ''
                    }`}
            >
                {columns === 1 && <Layout1Col {...sharedProps} columns={columns} />}
                {(columns === 2 || columns === 3) && <Layout2Col {...sharedProps} columns={columns} />}
                {(columns === 4 || columns === 5) && <Layout4Col {...sharedProps} columns={columns} />}
                {columns >= 6 && <Layout6Col {...sharedProps} columns={columns} />}
            </Card>

            {isModalMode && localModalOpen && (
                <LocalModal
                    validator={validator}
                    onClose={() => setLocalModalOpen(false)}
                    onPrev={onOpenModalPrev}
                    onNext={onOpenModalNext}
                    t={t}
                    copiedAddress={copiedAddress}
                    onCopy={onCopy}
                    network={network}
                />
            )}
        </>
    );
};

ValidatorCard.displayName = 'ValidatorCard';