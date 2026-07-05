'use client';

import React, { useState, useEffect } from 'react';

export function HeroIllustration() {
  const [activeShards, setActiveShards] = useState(2);
  const [displayTps, setDisplayTps] = useState(250);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveShards((prev) => {
        if (prev === 2) return 3;
        if (prev === 3) return 4;
        return 2;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const targetTps = activeShards === 2 ? 250 : activeShards === 3 ? 375 : 500;
    
    const countInterval = setInterval(() => {
      setDisplayTps((prev) => {
        if (prev === targetTps) {
          clearInterval(countInterval);
          return prev;
        }
        const diff = targetTps - prev;
        // Ease-out effect
        const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) / 10));
        return prev + step;
      });
    }, 30);

    return () => clearInterval(countInterval);
  }, [activeShards]);

  return (
    <div className="relative w-full h-auto aspect-[9/8] flex items-center justify-center">
      {/* Background glow behind the SVG */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/20 via-[var(--color-accent)]/10 to-[var(--color-secondary)]/20 rounded-2xl blur-3xl opacity-50" />
      
      <svg
        viewBox="0 0 900 800"
        className="relative z-10 w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="streamGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.05" />
            <stop offset="60%" stopColor="var(--color-primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="streamGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.05" />
            <stop offset="60%" stopColor="var(--color-secondary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.1" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="glow-intense" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="25" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Hexagonal grid pattern for background texture */}
          <pattern id="hex-grid" width="60" height="103.923" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
            <path d="M30 0L60 17.32L60 51.96L30 69.28L0 51.96L0 17.32Z" fill="none" stroke="var(--color-text-main)" strokeOpacity="0.04" strokeWidth="1"/>
            <path d="M30 103.92L60 86.6L60 51.96L30 34.64L0 51.96L0 86.6Z" fill="none" stroke="var(--color-text-main)" strokeOpacity="0.04" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Ambient Grid */}
        <rect width="100%" height="100%" fill="url(#hex-grid)" />

        {/* --- High Speed Data Streams (Paths) --- */}
        <g filter="url(#glow)">
          {/* Shard 1 to Hub (Always ON) */}
          <g>
            <path d="M 120 150 C 350 150, 350 400, 450 400" stroke="url(#streamGrad1)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 120 150 C 350 150, 350 400, 450 400" stroke="var(--color-primary)" strokeWidth="6" fill="none" strokeDasharray="15 45" opacity="0.9">
              <animate attributeName="stroke-dashoffset" values="60;0" dur="1s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Shard 2 to Hub (Always ON) */}
          <g>
            <path d="M 100 320 C 300 320, 350 400, 450 400" stroke="url(#streamGrad2)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 100 320 C 300 320, 350 400, 450 400" stroke="var(--color-secondary)" strokeWidth="8" fill="none" strokeDasharray="30 70" opacity="0.8">
              <animate attributeName="stroke-dashoffset" values="100;0" dur="0.8s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Shard 3 to Hub (Fades IN) */}
          <g style={{ opacity: activeShards >= 3 ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }}>
            <path d="M 100 480 C 300 480, 350 400, 450 400" stroke="url(#streamGrad1)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 100 480 C 300 480, 350 400, 450 400" stroke="var(--color-primary)" strokeWidth="6" fill="none" strokeDasharray="20 60" opacity="0.8">
              <animate attributeName="stroke-dashoffset" values="80;0" dur="1.2s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Shard 4 to Hub (Fades IN) */}
          <g style={{ opacity: activeShards >= 4 ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }}>
            <path d="M 120 650 C 350 650, 350 400, 450 400" stroke="url(#streamGrad2)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 120 650 C 350 650, 350 400, 450 400" stroke="var(--color-secondary)" strokeWidth="6" fill="none" strokeDasharray="10 50" opacity="0.9">
              <animate attributeName="stroke-dashoffset" values="60;0" dur="0.9s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Hub to Output */}
          <path d="M 450 400 L 780 400" stroke="var(--color-accent)" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.3" />
          <path d="M 450 400 L 780 400" stroke="var(--color-accent)" strokeWidth="4" fill="none" strokeDasharray="40 120">
            <animate attributeName="stroke-dashoffset" values="160;0" dur="0.5s" repeatCount="indefinite" />
          </path>
        </g>

        {/* --- 4 Input Shards --- */}
        <g className="animate-[pulse_3s_ease-in-out_indefinite]" style={{ transformOrigin: '120px 150px' }}>
          <circle cx="120" cy="150" r="45" fill="var(--code-bg)" stroke="var(--color-primary)" strokeWidth="2" filter="url(#glow)" />
          <circle cx="120" cy="150" r="15" fill="var(--color-primary)" opacity="0.8" />
          <circle cx="120" cy="150" r="28" fill="none" stroke="var(--color-text-main)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="0 120 150" to="360 120 150" dur="8s" repeatCount="indefinite" />
          </circle>
          <text x="120" y="215" fill="var(--color-text-muted)" fontSize="16" textAnchor="middle" fontFamily="monospace" fontWeight="bold">SHARD 0x1A</text>
        </g>

        <g className="animate-[pulse_4s_ease-in-out_indefinite]" style={{ transformOrigin: '100px 320px', animationDelay: '0.5s' }}>
          <circle cx="100" cy="320" r="55" fill="var(--code-bg)" stroke="var(--color-secondary)" strokeWidth="2" filter="url(#glow)" />
          <circle cx="100" cy="320" r="20" fill="var(--color-secondary)" opacity="0.8" />
          <circle cx="100" cy="320" r="35" fill="none" stroke="var(--color-text-main)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="360 100 320" to="0 100 320" dur="12s" repeatCount="indefinite" />
          </circle>
          <text x="100" y="395" fill="var(--color-text-muted)" fontSize="16" textAnchor="middle" fontFamily="monospace" fontWeight="bold">SHARD 0x2E</text>
        </g>

        <g className="animate-[pulse_3.5s_ease-in-out_indefinite]" style={{ transformOrigin: '100px 480px', animationDelay: '1.2s', opacity: activeShards >= 3 ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }}>
          <circle cx="100" cy="480" r="50" fill="var(--code-bg)" stroke="var(--color-primary)" strokeWidth="2" filter="url(#glow)" />
          <circle cx="100" cy="480" r="18" fill="var(--color-primary)" opacity="0.8" />
          <circle cx="100" cy="480" r="32" fill="none" stroke="var(--color-text-main)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="0 100 480" to="360 100 480" dur="10s" repeatCount="indefinite" />
          </circle>
          <text x="100" y="550" fill="var(--color-text-muted)" fontSize="16" textAnchor="middle" fontFamily="monospace" fontWeight="bold">SHARD 0x71</text>
        </g>

        <g className="animate-[pulse_4.5s_ease-in-out_indefinite]" style={{ transformOrigin: '120px 650px', animationDelay: '0.2s', opacity: activeShards >= 4 ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }}>
          <circle cx="120" cy="650" r="40" fill="var(--code-bg)" stroke="var(--color-secondary)" strokeWidth="2" filter="url(#glow)" />
          <circle cx="120" cy="650" r="12" fill="var(--color-secondary)" opacity="0.8" />
          <circle cx="120" cy="650" r="25" fill="none" stroke="var(--color-text-main)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="360 120 650" to="0 120 650" dur="7s" repeatCount="indefinite" />
          </circle>
          <text x="120" y="710" fill="var(--color-text-muted)" fontSize="16" textAnchor="middle" fontFamily="monospace" fontWeight="bold">SHARD 0x9B</text>
        </g>

        {/* --- Massive Central Consensus Hub --- */}
        <g style={{ transformOrigin: '450px 400px' }}>
          {/* Outer rotating rings */}
          <circle cx="450" cy="400" r="150" fill="none" stroke="var(--color-text-main)" strokeWidth="1" strokeDasharray="5 15" opacity="0.2">
            <animateTransform attributeName="transform" type="rotate" from="0 450 400" to="360 450 400" dur="40s" repeatCount="indefinite" />
          </circle>
          <circle cx="450" cy="400" r="130" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeDasharray="20 40" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="360 450 400" to="0 450 400" dur="25s" repeatCount="indefinite" />
          </circle>
          <circle cx="450" cy="400" r="110" fill="none" stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="4 8" opacity="0.5">
            <animateTransform attributeName="transform" type="rotate" from="0 450 400" to="360 450 400" dur="15s" repeatCount="indefinite" />
          </circle>
          
          {/* Central core */}
          <g filter="url(#glow-intense)">
            <circle cx="450" cy="400" r="80" fill="var(--code-bg)" stroke="var(--color-accent)" strokeWidth="4" opacity="0.9" />
            <circle cx="450" cy="400" r="40" fill="var(--color-accent)" opacity="0.9">
               <animate attributeName="r" values="35;45;35" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
          <text x="450" y="510" fill="var(--color-accent)" fontSize="18" textAnchor="middle" fontFamily="sans-serif" fontWeight="900" letterSpacing="3">ATOMIC COMMIT</text>
        </g>

        {/* --- Massive Output Node (Right) --- */}
        <g style={{ transformOrigin: '780px 400px' }}>
          <circle cx="780" cy="400" r="90" fill="var(--code-bg)" stroke="var(--color-primary)" strokeWidth="3" filter="url(#glow)" />
          
          <g filter="url(#glow-intense)">
             <circle cx="780" cy="400" r="35" fill="var(--color-primary)" />
          </g>
          
          <circle cx="780" cy="400" r="65" fill="none" stroke="var(--color-secondary)" strokeWidth="6" strokeDasharray="15 25">
            <animateTransform attributeName="transform" type="rotate" from="0 780 400" to="360 780 400" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="780" cy="400" r="80" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="5 15">
            <animateTransform attributeName="transform" type="rotate" from="360 780 400" to="0 780 400" dur="12s" repeatCount="indefinite" />
          </circle>
          <text x="780" y="520" fill="var(--color-primary)" fontSize="22" textAnchor="middle" fontFamily="sans-serif" fontWeight="900" letterSpacing="2">{displayTps}K+ TPS</text>
        </g>

        {/* High speed ambient particles floating around */}
        <g fill="var(--color-text-main)" opacity="0.8">
          <circle cx="350" cy="200" r="3"><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" /></circle>
          <circle cx="600" cy="250" r="4"><animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.5s" /></circle>
          <circle cx="250" cy="600" r="3"><animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" begin="1s" /></circle>
          <circle cx="550" cy="550" r="5"><animate attributeName="opacity" values="0;1;0" dur="2.5s" repeatCount="indefinite" begin="1.5s" /></circle>
          <circle cx="700" cy="300" r="2"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" begin="0.8s" /></circle>
        </g>
      </svg>
    </div>
  );
}
