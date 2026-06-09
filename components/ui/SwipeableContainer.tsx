'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from "motion/react";

interface SwipeableContainerProps {
    children: React.ReactNode;
    onNext?: () => void;
    onPrev?: () => void;
    direction: number;
    setDirection: (d: number) => void;
    itemKey: string | number;
    className?: string;
    threshold?: number;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
}

/**
 * SwipeableContainer
 *
 * Wraps content to allow horizontal swipe navigation between items
 * while preserving native text selection.
 *
 * Uses manual pointer tracking instead of Framer Motion's drag="x"
 * so that the browser's text selection mechanism is never blocked.
 *
 * Must be used inside an AnimatePresence component with mode="popLayout".
 */
export const SwipeableContainer: React.FC<SwipeableContainerProps> = ({
    children,
    onNext,
    onPrev,
    direction,
    setDirection,
    itemKey,
    className = '',
    threshold = 80,
    disabled = false,
    onClick,
    style,
}) => {
    const startPos = useRef<{ x: number; y: number } | null>(null);
    const didSwipe = useRef(false);

    // Direction-aware slide animation variants
    const variants = {
        initial: (d: number) => ({
            x: d > 0 ? 300 : d < 0 ? -300 : 0,
            opacity: 0,
        }),
        animate: {
            x: 0,
            opacity: 1,
            zIndex: 1,
        },
        exit: (d: number) => ({
            x: d > 0 ? -300 : d < 0 ? 300 : 0,
            opacity: 0,
            zIndex: 0,
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
        }),
    };

    // Keyboard navigation: ArrowLeft / ArrowRight
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && onPrev) {
                e.preventDefault();
                setDirection(-1);
                onPrev();
            } else if (e.key === 'ArrowRight' && onNext) {
                e.preventDefault();
                setDirection(1);
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onPrev, onNext, setDirection]);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only track touch gestures — mouse users navigate via buttons/keyboard
        if (disabled || e.pointerType === 'mouse') return;
        startPos.current = { x: e.clientX, y: e.clientY };
        didSwipe.current = false;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (disabled || e.pointerType === 'mouse' || !startPos.current) return;

        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Only trigger swipe if horizontal movement is dominant and exceeds threshold
        if (absDx > threshold && absDx > absDy * 1.5) {
            if (dx > 0 && onPrev) {
                didSwipe.current = true;
                setDirection(-1);
                onPrev();
            } else if (dx < 0 && onNext) {
                didSwipe.current = true;
                setDirection(1);
                onNext();
            }
        }

        startPos.current = null;
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        // If a swipe just happened, suppress the click
        if (didSwipe.current) {
            didSwipe.current = false;
            e.stopPropagation();
            return;
        }
        if (onClick) {
            onClick(e);
        } else {
            e.stopPropagation();
        }
    };

    return (
        <motion.div
            key={itemKey}
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 450, damping: 40 }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className={`flex-1 flex flex-col min-h-0 relative select-text ${className}`}
            onClick={handleContainerClick}
            style={{ ...style, touchAction: 'pan-y' }}
        >
            {children}
        </motion.div>
    );
};

SwipeableContainer.displayName = 'SwipeableContainer';
