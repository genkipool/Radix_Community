'use client';
import React from 'react';
import { m, AnimatePresence } from "motion/react";
import { X, Construction, HardHat } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';
import type { Dictionary } from '@/types/i18n';

interface UnderConstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Dictionary;
  overlayClassName?: string;
  contentClassName?: string;
}

export function UnderConstructionModal({
  isOpen,
  onClose,
  t,
  overlayClassName,
  contentClassName,
}: UnderConstructionModalProps) {
  const c = t.under_construction;

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <>
            <ModalOverlay onClose={onClose} blur="sm" className={overlayClassName} />
            <m.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none ${contentClassName || ''}`}
            >
              <div
                className="w-full max-w-md bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden pointer-events-auto relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Decorative background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 via-transparent to-[var(--color-accent)]/5 pointer-events-none" />

                <div className="p-8 flex flex-col items-center text-center relative z-10">
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 size-8 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors border border-transparent hover:border-[var(--color-card-border)]"
                  >
                    <X className="size-4" />
                  </button>

                  {/* Construction Icon */}
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center text-white shadow-xl mb-6 relative group">
                    <Construction className="size-8 rotate-[-10deg] group-hover:rotate-0 transition-transform duration-500" />
                    <div className="absolute -top-2 -right-2 size-8 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-primary)] shadow-sm">
                      <HardHat className="size-4" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-[var(--color-text-main)] mb-3 tracking-tight">
                    {c.title}
                  </h3>

                  <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-8 max-w-[280px]">
                    {c.body}
                  </p>

                  <Button
                    variant="primary"
                    onClick={onClose}
                    className="w-full !rounded-xl py-6 font-black uppercase tracking-widest text-xs"
                  >
                    {c.close}
                  </Button>
                </div>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
