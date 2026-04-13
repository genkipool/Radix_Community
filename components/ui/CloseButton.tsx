'use client';

import React from 'react';
import { X } from 'lucide-react';

interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose?: () => void;
  title?: string;
  className?: string;
  iconSize?: number;
}

/**
 * CloseButton
 * 
 * A unified, generic close button for modals and overlays.
 * Features a circular design, glassmorphism surface, and red-on-hover effect.
 * Does NOT rotate on hover as per user request.
 */
export function CloseButton({
  onClose,
  onClick,
  title = 'Cerrar',
  className = '',
  iconSize = 20,
  ...props
}: CloseButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onClose) onClose();
    if (onClick) onClick(e);
  };

  return (
    <button
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`
        flex items-center justify-center 
        w-10 h-10 sm:w-[38px] sm:h-[38px] 
        rounded-full transition-all duration-200 
        bg-[var(--color-surface)] border border-[var(--color-card-border)] 
        text-[var(--color-text-muted)] hover:text-[var(--color-close-hover, #ef4444)] 
        hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-close-hover, #ef4444)]/30 
        hover:shadow-md active:scale-95 shrink-0 
        ${className}
      `}
      {...props}
    >
      <X size={iconSize} className="transition-colors" strokeWidth={2.5} />
    </button>
  );
}
