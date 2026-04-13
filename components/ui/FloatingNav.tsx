'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FloatingNavProps {
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
  showLabels?: boolean;
  zIndex?: number;
}

/**
 * FloatingNav
 * 
 * A generic navigation component that renders premium floating arrows 
 * at the sides of the screen. Intended for use within full-screen 
 * modals or overlays.
 */
export function FloatingNav({
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  prevLabel = 'Anterior',
  nextLabel = 'Siguiente',
  className,
  zIndex = 60,
}: FloatingNavProps) {
  return (
    <div 
      className={`fixed inset-0 pointer-events-none flex items-center justify-between px-4 sm:px-10 ${className || ''}`}
      style={{ zIndex }}
    >
      <AnimatePresence>
        {hasPrev && onPrev && (
          <motion.button
            key="prev-btn"
            initial={{ opacity: 0, x: -20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)]/80 backdrop-blur-md text-[var(--color-text-main)] shadow-2xl transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] group"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            title={prevLabel}
            aria-label={prevLabel}
          >
            <ChevronLeft className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex-1" />

      <AnimatePresence>
        {hasNext && onNext && (
          <motion.button
            key="next-btn"
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)]/80 backdrop-blur-md text-[var(--color-text-main)] shadow-2xl transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] group"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            title={nextLabel}
            aria-label={nextLabel}
          >
            <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
