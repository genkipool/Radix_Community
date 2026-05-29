'use client';

import React, { useId } from 'react';

interface GoldPlatinumIconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function GoldPlatinumIcon({ className, ...props }: GoldPlatinumIconProps) {
    const idPrefix = useId().replace(/:/g, '');
    const goldGradientId = `goldBar-${idPrefix}`;
    const platGradientId = `platBar-${idPrefix}`;
    const shadowFilterId = `shadow-${idPrefix}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 205 190"
            className={className}
            preserveAspectRatio="xMidYMid meet"
            {...props}
        >
            <defs>
                <linearGradient id={goldGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFEA9F"></stop>
                    <stop offset="50%" stopColor="#D4AF37"></stop>
                    <stop offset="100%" stopColor="#997A00"></stop>
                </linearGradient>
                <linearGradient id={platGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF"></stop>
                    <stop offset="50%" stopColor="#E5E4E2"></stop>
                    <stop offset="100%" stopColor="#8C8C8C"></stop>
                </linearGradient>
                <filter id={shadowFilterId} x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="2" dy="5" stdDeviation="4" floodOpacity="0.1"></feDropShadow>
                </filter>
            </defs>
            <rect x="10" y="10" width="70" height="160" rx="8" fill={`url(#${goldGradientId})`} filter={`url(#${shadowFilterId})`}></rect>
            <rect x="15" y="15" width="60" height="150" rx="5" fill="none" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1.5"></rect>
            <text x="45" y="95" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20" fill="#7A5C00">Au</text>
            <text x="45" y="115" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="20" fill="#7A5C00">79</text>
            <rect x="120" y="10" width="70" height="160" rx="8" fill={`url(#${platGradientId})`} filter={`url(#${shadowFilterId})`}></rect>
            <rect x="125" y="15" width="60" height="150" rx="5" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5"></rect>
            <text x="155" y="95" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20" fill="#555555">Pt</text>
            <text x="155" y="115" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="20" fill="#555555">78</text>
        </svg>
    );
}

GoldPlatinumIcon;
