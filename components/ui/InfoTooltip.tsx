'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Portal } from './Portal';

interface InfoTooltipProps {
  content: string;
  children: ReactNode;
}

export function InfoTooltip({ content, children }: InfoTooltipProps) {
  const [state, setState] = useState<'closed' | 'measuring' | 'open'>('closed');
  const triggerRef = useRef<HTMLDivElement>(null);
  const measuringRef = useRef<HTMLDivElement>(null);
  
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, shiftX: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  // Step 1: Measure height precisely before triggering Framer Motion
  useLayoutEffect(() => {
    if (state === 'measuring') {
      if (triggerRef.current && measuringRef.current) {
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

        const tooltipHeight = measuringRef.current.offsetHeight;
        const spaceAbove = rect.top;
        // 30px extra margin ensures we don't collide with fixed headers
        const spaceNeeded = tooltipHeight + 30; 
        
        const currentPlacement = spaceAbove < spaceNeeded ? 'bottom' : 'top';
        
        setPlacement(currentPlacement);
        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left,
          shiftX
        });
        
        // Open with exact coordinates
        setState('open');
      }
    }
  }, [state]);

  // Step 2: Keep coordinates updated on scroll/resize while open
  useEffect(() => {
    if (state === 'open') {
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

          // Update position tracking, but DO NOT flip top/bottom placement during scroll 
          // to prevent abrupt mid-animation jumping
          setCoords(prev => ({
            ...prev,
            top: rect.top,
            bottom: rect.bottom,
            left,
            shiftX
          }));
        }
      };

      const handle = requestAnimationFrame(updateCoords);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        cancelAnimationFrame(handle);
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [state]);

  const isTop = placement === 'top';

  const handleOpen = () => {
    if (state === 'closed') setState('measuring');
  };

  const handleClose = () => {
    setState('closed');
  };

  const handleToggle = () => {
    if (state === 'closed') setState('measuring');
    else setState('closed');
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onClick={handleToggle}
    >
      {children}

      {/* Invisible Measuring Phase: Guaranteed to wrap identically to the real element */}
      {state === 'measuring' && (
        <Portal>
          <div
            className="fixed z-[9999] opacity-0 pointer-events-none"
            style={{ top: -9999, left: 0, width: 'max-content' }}
          >
             <div 
               ref={measuringRef} 
               className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-4 w-[min(320px,calc(100vw-32px))]"
              >
                <div
                  className="text-[11px] leading-relaxed font-medium space-y-2 [&>strong]:text-[var(--color-text-strong)]"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
             </div>
          </div>
        </Portal>
      )}

      {/* Visible Animate Phase */}
      <AnimatePresence>
        {state === 'open' && (
          <Portal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: isTop ? '-90%' : '10%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: isTop ? '-100%' : '0%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: isTop ? '-90%' : '10%' }}
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: isTop ? `${coords.top - 12}px` : `${coords.bottom + 12}px`,
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
                    className={`absolute w-4 h-4 bg-[var(--color-surface)] border-[var(--color-card-border)] ${
                      isTop
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
    </div>
  );
}
