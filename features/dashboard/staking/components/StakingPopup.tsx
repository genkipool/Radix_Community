
import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Validator } from '@/types/radix';
import { StakingPopupContent } from './StakingPopupContent';
import { TranslationsT } from '@/features/dashboard/types';
import { Portal } from '@/components/ui/Portal';

interface StakingPopupProps {
    children: React.ReactNode;
    validator: Validator;
    t?: Partial<TranslationsT>;
}

interface PopupCoords {
    top: number;
    left?: number;
    right?: number;
    transformOrigin: string;
    isUp: boolean;
}

export const StakingPopup = ({ children, validator, t }: StakingPopupProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<PopupCoords>({ top: 0, right: 0, transformOrigin: 'top right', isUp: false });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const calculateCoords = () => {
        if (!triggerRef.current) return;
        
        const rect = triggerRef.current.getBoundingClientRect();
        const popupWidth = 420;
        const estimatedHeight = 350; // Estimate height of the popup
        
        let top = rect.bottom + window.scrollY + 8;
        let left: number | undefined = undefined;
        let right: number | undefined = document.documentElement.clientWidth - rect.right - window.scrollX;
        let transformOrigin = 'top right';
        let isUp = false;

        // Check vertical collision (space below vs above)
        if (rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight) {
            top = rect.top + window.scrollY - 8;
            transformOrigin = transformOrigin.replace('top', 'bottom');
            isUp = true;
        }

        // Check horizontal collision (space left vs right)
        // By default it aligns to the right edge and expands left.
        if (rect.right < popupWidth) {
            // Not enough space to the left, so align to the left edge and expand right
            right = undefined;
            left = rect.left + window.scrollX;
            transformOrigin = transformOrigin.replace('right', 'left');
        }

        setCoords({ top, left, right, transformOrigin, isUp });
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        calculateCoords();
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); // 300ms delay to allow moving mouse into the popup
    };

    useEffect(() => {
        return () => {
            const id = timeoutRef.current;
            if (id) clearTimeout(id);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        window.addEventListener('scroll', calculateCoords, true);
        window.addEventListener('resize', calculateCoords);

        return () => {
            window.removeEventListener('scroll', calculateCoords, true);
            window.removeEventListener('resize', calculateCoords);
        };
    }, [isOpen]);

    return (
        <>
            <div 
                ref={triggerRef}
                className="relative inline-block"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </div>
            
            <Portal>
                <AnimatePresence>
                    {isOpen && (
                        <m.div
                            initial={{ opacity: 0, y: coords.isUp ? "calc(-100% + 10px)" : 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: coords.isUp ? "-100%" : 0, scale: 1 }}
                            exit={{ opacity: 0, y: coords.isUp ? "calc(-100% + 10px)" : 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute z-[9999]"
                            style={{ 
                                top: coords.top, 
                                right: coords.right, 
                                left: coords.left,
                                transformOrigin: coords.transformOrigin 
                            }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            {/* Puente invisible / Invisible bridge to prevent mouseLeave when moving between trigger and popup */}
                            <div 
                                className="absolute left-0 right-0 h-4 bg-transparent" 
                                style={{
                                    bottom: coords.isUp ? '-16px' : 'auto',
                                    top: coords.isUp ? 'auto' : '-16px',
                                }}
                            />
                            <StakingPopupContent validator={validator} t={t} />
                        </m.div>
                    )}
                </AnimatePresence>
            </Portal>
        </>
    );
};
