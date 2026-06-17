'use client';
import React, { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Portal } from '@/components/ui/Portal';

export interface SidePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Width on desktop. Defaults to sm:w-[420px] and sm:max-w-[420px] */
  widthClass?: string;
  /** Set to true if this modal is being rendered in a standalone window */
  isStandalone?: boolean;
  /** Set to true if the panel is pinned (shrinks body margin) */
  isPinned?: boolean;
  /** Target element for Portal. Useful for external windows. */
  portalTarget?: HTMLElement | null;
}

export function SidePanelModal({
  isOpen,
  onClose,
  children,
  widthClass = 'sm:w-[420px] sm:max-w-[420px]',
  isStandalone = false,
  isPinned = false,
  portalTarget,
}: SidePanelModalProps) {

  // Handle body pinning
  useEffect(() => {
    if (isOpen && isPinned && !isStandalone && window.innerWidth >= 1024) {
      document.body.style.marginRight = '420px';
      document.body.style.transition = 'margin-right 0.3s ease';
      document.documentElement.style.setProperty('--sidebar-width', '420px');
    } else {
      document.body.style.marginRight = '0';
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    }
    return () => {
      document.body.style.marginRight = '0';
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    };
  }, [isOpen, isPinned, isStandalone]);

  return (
    <Portal target={portalTarget || undefined}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            {!isPinned && !isStandalone && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                className="fixed inset-0 z-[9000]"
                onMouseDown={onClose}
              />
            )}
            
            {/* Panel */}
            <m.div
              initial={isStandalone ? undefined : { x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={isStandalone ? undefined : { x: '100%', opacity: 0 }}
              transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
              className={
                isStandalone
                  ? 'w-full h-full flex flex-col text-[var(--color-text-main)] overflow-x-hidden bg-[var(--color-bg)]'
                  : `fixed top-0 right-0 h-full w-full ${widthClass} z-[9001] pointer-events-auto flex flex-col text-[var(--color-text-main)] overflow-x-hidden transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
                      isPinned
                        ? 'bg-[var(--color-bg)] border-l border-[var(--color-card-border)] shadow-none'
                        : 'bg-[var(--color-bg)]/85 backdrop-blur-sm shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]'
                    }`
              }
            >
              {children}
            </m.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
