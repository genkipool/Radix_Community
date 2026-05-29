'use client';

import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Portal } from './Portal';

interface InfoTooltipProps {
  content: string;
  children: ReactNode;
}

export function InfoTooltip({ content, children }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, shiftX: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateAndSetCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = rect.left + rect.width / 2;

      let shiftX = 0;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 16;

      const tooltipWidth = Math.min(320, viewportWidth - margin * 2);
      const halfWidth = tooltipWidth / 2;

      if (left + halfWidth > viewportWidth - margin) {
        shiftX = viewportWidth - margin - (left + halfWidth);
      } else if (left - halfWidth < margin) {
        shiftX = margin - (left - halfWidth);
      }

      // Instead of guessing the tooltip's exact height (which varies wildly on mobile),
      // we mathematically guarantee the safest placement by putting it wherever there is MORE screen space.
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      const currentPlacement = spaceAbove > spaceBelow ? 'top' : 'bottom';

      setPlacement(currentPlacement);
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left,
        shiftX
      });
    }
  };

  const handleOpen = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (!isOpen) {
      calculateAndSetCoords();
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      handleOpen();
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [closeTimeoutRef]);

  useEffect(() => {
    if (isOpen) {
      // While open, keep coordinates updated on scroll/resize but DO NOT change placement
      // to avoid jumping animations during scrolling.
      const updateOnScroll = () => {
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          const left = rect.left + rect.width / 2;

          let shiftX = 0;
          const viewportWidth = window.innerWidth;
          const margin = 16;

          const tooltipWidth = Math.min(320, viewportWidth - margin * 2);
          const halfWidth = tooltipWidth / 2;

          if (left + halfWidth > viewportWidth - margin) {
            shiftX = viewportWidth - margin - (left + halfWidth);
          } else if (left - halfWidth < margin) {
            shiftX = margin - (left - halfWidth);
          }

          setCoords(prev => ({
            ...prev,
            top: rect.top,
            bottom: rect.bottom,
            left,
            shiftX
          }));
        }
      };

      window.addEventListener('resize', updateOnScroll);
      window.addEventListener('scroll', updateOnScroll, true);
      return () => {
        window.removeEventListener('resize', updateOnScroll);
        window.removeEventListener('scroll', updateOnScroll, true);
      };
    }
  }, [isOpen]);

  const isTop = placement === 'top';

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <span
        onClick={handleToggle}
        className="cursor-pointer inline-flex items-center"
      >
        {children}
      </span>

      <AnimatePresence>
        {isOpen && (
          <Portal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: isTop ? '-90%' : '10%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: isTop ? '-100%' : '0%' }}
              exit={{ opacity: 0, scale: 1, x: '-50%', y: isTop ? '-100%' : '0%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: isTop ? `${coords.top - 12}px` : `${coords.bottom + 12}px`,
                left: `${coords.left}px`,
                width: 'max-content',
              }}
            >
              <div
                className="relative pointer-events-auto"
                onMouseEnter={handleOpen}
                onMouseLeave={handleClose}
                // Stop basic event bubbling within the tooltip itself
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `translateX(${coords.shiftX}px)` }}
              >
                {/* Invisible bridge to maintain hover while cursor moves through empty space */}
                <div
                  className={`absolute left-0 right-0 h-8 pointer-events-auto ${isTop ? '-bottom-8' : '-top-8'}`}
                />
                <div
                  className="bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl rounded-xl p-4 w-[min(320px,calc(100vw-32px))] relative pointer-events-auto"
                >
                  <div
                    className="text-[11px] leading-relaxed text-[var(--color-text-main)] font-medium space-y-2 [&>strong]:text-[var(--color-text-strong,var(--color-text-main))] max-h-[60vh] overflow-y-auto overscroll-contain pr-1 custom-scrollbar select-text"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                  {/* Arrow */}
                  <div
                    className={`absolute size-4 bg-[var(--color-surface)] border-[var(--color-card-border)] ${isTop
                      ? '-bottom-[9px] border-r border-b'
                      : '-top-[9px] border-l border-t'
                      }`}
                    style={{
                      left: `calc(50% - ${coords.shiftX}px)`,
                      transform: 'translateX(-50%) rotate(45deg)'
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </span>
  );
}
// Sync verified: dom 19 abr 2026 02:30:04 CEST
