'use client';

import React from 'react';
import { Plus, Reply } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ForumActionButtonProps {
    /** The text to display on the button. */
    label: string;
    /** The click handler. */
    onClick: (e: React.MouseEvent) => void;
    /** Optional tooltip title. */
    title?: string;
    /** Optional icon to lead the text. Defaults to Plus if not specified. */
    icon?: 'plus' | 'reply' | React.ReactNode;
    /** Extra classes to apply. */
    className?: string;
    /** Whether the button is in a loading state. */
    loading?: boolean;
    /** Whether the button is disabled. */
    disabled?: boolean;
    /** Optional custom variant (defaults to primary for unified look). */
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
}

/**
 * ForumActionButton
 * 
 * A standardized action button for the forum (Publish, Reply, etc.)
 * that ensures a consistent premium look with specific rounding and tracking.
 */
export function ForumActionButton({
    label,
    onClick,
    title,
    icon,
    className = '',
    loading = false,
    disabled = false,
    variant = 'primary'
}: ForumActionButtonProps) {
    let finalIcon = icon;
    
    if (icon === 'plus') {
        finalIcon = <Plus className="w-4 h-4" />;
    } else if (icon === 'reply') {
        finalIcon = <Reply className="w-3.5 h-3.5" />;
    }

    return (
        <Button
            onClick={onClick}
            title={title}
            variant={variant}
            size="sm"
            isLoading={loading}
            disabled={disabled}
            className={`!rounded-xl px-4 font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 ${variant === 'primary' ? 'shadow-[var(--color-primary)]/10' : ''} ${className}`}
            leftIcon={finalIcon as React.ReactNode}
        >
            {label}
        </Button>
    );
}
