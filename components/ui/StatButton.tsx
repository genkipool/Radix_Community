'use client';
import { cloneElement, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface StatButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    count: number | string;
    isActive?: boolean;
    activeClassName?: string;
    inactiveClassName?: string;
}

export function StatButton({
    icon,
    count,
    isActive = false,
    activeClassName = 'text-red-500 bg-red-500/10',
    inactiveClassName = 'text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/5',
    className = '',
    onClick,
    title,
    ...props
}: StatButtonProps) {
    const renderedIcon =
        isActive && isValidElement(icon)
            ? cloneElement(icon as React.ReactElement<{ className?: string }>, {
                  className: `${(icon as React.ReactElement<{ className?: string }>).props.className ?? ''} fill-current`,
              })
            : icon;

    return (
        <button
            onClick={onClick}
            title={title}
            className={`flex items-center gap-1.5 transition-all duration-200 py-1 px-2 rounded-lg shrink-0 font-bold text-[10px] sm:text-xs ${isActive ? activeClassName : inactiveClassName} ${className}`}
            {...props}
        >
            {renderedIcon}
            <span>{count}</span>
        </button>
    );
}

interface BadgeStatProps {
    icon: ReactNode;
    count: number | string;
    title?: string;
    className?: string;
}

export function BadgeStat({ icon, count, title, className = '' }: BadgeStatProps) {
    return (
        <span className={`flex items-center gap-1.5 shrink-0 text-xs text-[var(--color-text-muted)] ${className}`} title={title}>
            {icon}
            <span>{count}</span>
        </span>
    );
}
