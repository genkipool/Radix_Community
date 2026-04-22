import React from 'react';

export function RadixIcon({ className = "w-4 h-4", strokeColor = "#00C389", animate = true }: { className?: string, strokeColor?: string, animate?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 194.2" fill="none" className={className}>
      {/* Translate protege el grosor del trazo (13.05 es la mitad de 26.1) */}
      <g transform="translate(13.05, 13.05) scale(1)">
        <path 
          d="M0,91.1 L27.35,91.1 L82.85,168.1 L156.45,0 L223.9,0" 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth="26.1" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={animate ? "logo-dash-animate" : ""}
        />
      </g>
    </svg>
  );
}
