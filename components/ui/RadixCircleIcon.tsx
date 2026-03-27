'use client';

import React from 'react';

interface RadixCircleIconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
    fillColor?: string;
    strokeColor?: string;
}

/**
 * RadixCircleIcon – Circular Radix branding icon.
 * Used specifically for the Radix Original themes.
 */
export function RadixCircleIcon({
    className,
    fillColor = "var(--color-primary)",
    strokeColor = "white",
    ...props
}: RadixCircleIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            className={className}
            fill="none"
            {...props}
        >
            {/* Circular background */}
            <circle cx="50" cy="50" r="48" fill={fillColor} />

            {/* Zigzag mark (centered) */}
            <path
                d="M25,55 L35,55 L48,72 L65,30 L75,30"
                stroke={strokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default RadixCircleIcon;
