'use client';

import React from 'react';

interface RadixLogoProps {
  className?: string;
  showBeta?: boolean;
  label?: string;
  betaLabel?: string;
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  fontSize?: number;
  textX?: number;
  strokeColor?: string;
  textColor?: string;
  logoScale?: number;
  logoTranslateY?: number;
}

/**
 * RadixLogo – Global reusable logo component for Navbar and Footer.
 * Ensures consistent branding, font (Inter), and "BETA" label sizing.
 */
export function RadixLogo({ 
  className, 
  showBeta = true,
  label = 'RADIX',
  betaLabel = 'BETA',
  width = "150",
  height = "40",
  viewBox = "0 0 150 40",
  fontSize = 22,
  textX = 40,
  strokeColor = "var(--color-accent)",
  textColor = "var(--color-text-main)",
  logoScale = 0.5,
  logoTranslateY = -6,
}: RadixLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ─── Radix Mark (Zigzag) ─── */}
      <g transform={`translate(0, ${logoTranslateY}) scale(${logoScale})`}>
        <path
          d="M14,53 L25,53 L42,78 L66,20 L88,20"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          // CSS animation defined in global CSS or locally if needed
          className="logo-dash-animate"
        />
      </g>

      {/* ─── RADIX Wordmark ─── */}
      <text
        x={textX}
        y="28"
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        fontSize={fontSize}
        fill={textColor}
        letterSpacing="0.05em"
      >
        {label}
      </text>

      {/* ─── BETA Label ─── */}
      {showBeta && (
        <text
          x="118"
          y="16"
          fontFamily="Inter, sans-serif"
          fontWeight="bold"
          fontSize="10"
          fill="#6366f1"
          letterSpacing="0.5"
        >
          {betaLabel}
        </text>
      )}
    </svg>
  );
}
