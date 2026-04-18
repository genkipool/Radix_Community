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
  const [coords, setCoords] = useState({ top: 0, left: 0, shiftX: 0 });

  const updateCoords = () => {
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

      setCoords({
        top: rect.top,
        left,
        shiftX
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Use requestAnimationFrame for smoother initial positioning
      const handle = requestAnimationFrame(updateCoords);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        cancelAnimationFrame(handle);
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <Portal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-90%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-100%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-90%' }}
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: `${coords.top - 12}px`,
                left: `${coords.left}px`,
                width: 'max-content',
              }}
            >
              <div 
                className="relative"
                style={{ transform: `translateX(${coords.shiftX}px)` }}
              >
                <div 
                  className="bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl rounded-xl p-4 w-[min(320px,calc(100vw-32px))] relative pointer-events-auto"
                >
                  <div 
                    className="text-[11px] leading-relaxed text-[var(--color-text-main)] font-medium space-y-2 [&>strong]:text-[var(--color-text-strong,var(--color-text-main))]"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                  {/* Arrow */}
                  <div 
                    className="absolute -bottom-[9px] w-4 h-4 bg-[var(--color-surface)] border-r border-b border-[var(--color-card-border)]"
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
    </div>
  );
}
