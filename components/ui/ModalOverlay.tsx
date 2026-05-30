'use client';
import { m, HTMLMotionProps } from "motion/react";

interface ModalOverlayProps extends HTMLMotionProps<'div'> {
    onClose: () => void;
    blur?: 'sm' | 'md' | 'lg' | 'none';
}

/**
 * Animated modal overlay backdrop. Used by Blog reading-mode and Forum modals.
 */
export function ModalOverlay({ onClose, blur = 'sm', className = '', ...props }: ModalOverlayProps) {
    const blurMap = {
        none: 'none',
        sm: 'blur(4px)',
        md: 'blur(8px)',
        lg: 'blur(16px)'
    };

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 bg-black/70 z-50 ${className}`}
            style={{ backdropFilter: blurMap[blur] }}
            {...props}
        />
    );
}
