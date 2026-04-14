'use client';

import React from 'react';
import { motion, PanInfo } from 'motion/react';

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
 * A generic component that wraps content to allow swipe gestures
 * and directional entrance/exit animations.
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
    threshold = 60,
    disabled = false,
    onClick,
    style,
}) => {
    // Variantes para animaciones de deslizamiento conscientes de la dirección
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

    return (
        <motion.div
            key={itemKey}
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 450, damping: 40 }}
            drag={disabled ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_e, info: PanInfo) => {
                if (disabled) return;
                
                if (info.offset.x > threshold && onPrev) {
                    setDirection(-1);
                    onPrev();
                } else if (info.offset.x < -threshold && onNext) {
                    setDirection(1);
                    onNext();
                }
            }}
            className={`flex-1 flex flex-col min-h-0 relative touch-pan-y ${className}`}
            onClick={onClick || (e => e.stopPropagation())}
            style={{ ...style, touchAction: 'pan-y' }}
        >
            {children}
        </motion.div>
    );
};

SwipeableContainer.displayName = 'SwipeableContainer';
