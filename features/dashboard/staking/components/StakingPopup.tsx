import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Validator } from '@/types/radix';
import { StakingPopupContent } from './StakingPopupContent';
import { TranslationsT } from '@/features/dashboard/types';
import { Portal } from '@/components/ui/Portal';

interface StakingPopupProps {
    children: React.ReactNode;
    validator: Validator;
    t?: Partial<TranslationsT>;
}

export const StakingPopup = ({ children, validator, t }: StakingPopupProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, right: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                right: document.documentElement.clientWidth - rect.right - window.scrollX
            });
        }
        
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); // 300ms delay to allow moving mouse into the popup
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const updateCoords = () => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 8,
                    right: document.documentElement.clientWidth - rect.right - window.scrollX
                });
            }
        };

        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);

        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
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
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute z-[9999] origin-top-right"
                            style={{ top: coords.top, right: coords.right }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <StakingPopupContent validator={validator} t={t} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </Portal>
        </>
    );
};
