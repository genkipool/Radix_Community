import React from "react";
import "../styles/PhaseGraphics.css";

import type { GraphicProps } from '../../../types';

export const Graphic1 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowRed1"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g opacity="0.9">
      <path d="M 10 70 L 90 70 M 25 70 L 25 40 M 50 70 L 50 40 M 75 70 L 75 40 M 10 40 L 90 40 L 50 15 Z" fill="transparent" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" />
      <text x="50" y="95" className="code font-bold" fill="#FCA5A5" textAnchor="middle" style={{ fontSize: "14px" }}>
        {_t?.ecosistema?.graphics?.g20_bankA || "Bank A"}
      </text>
    </g>
    <g opacity="0.9">
      <path d="M 210 70 L 290 70 M 225 70 L 225 40 M 250 70 L 250 40 M 275 70 L 275 40 M 210 40 L 290 40 L 250 15 Z" fill="transparent" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" />
      <text x="250" y="95" className="code font-bold" fill="#FCA5A5" textAnchor="middle" style={{ fontSize: "14px" }}>
        {_t?.ecosistema?.graphics?.g20_bankB || "Bank B"}
      </text>
    </g>
    <g>
      <path d="M 100 55 L 140 55" fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <path d="M 160 55 L 200 55" fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <path d="M 140 45 L 160 65 M 160 45 L 140 65" fill="none" stroke="#EF4444" strokeWidth="3" filter="url(#glowRed1)" />
    </g>
    <text x="150" y="125" className="code font-bold tracking-widest" fill="#EF4444" textAnchor="middle" filter="url(#glowRed1)" style={{ fontSize: "12px" }}>
      {_t?.ecosistema?.graphics?.g1_counterparty_risk || "COUNTERPARTY RISK"}
    </text>
  </svg>
);
export const Graphic2 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowRed2"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="scale(1.3) translate(-25, -30)">
      <rect x="20" y="20" width="180" height="80" rx="4" fill="transparent" stroke="#EF4444" strokeWidth="1" />
      <text x="30" y="45" className="code">
        <tspan style={{ fill: "var(--code-keyword)" }}>mapping</tspan>(
        <tspan style={{ fill: "var(--code-type)" }}>address</tspan> {"=>"} <tspan style={{ fill: "var(--code-type)" }}>uint</tspan>)
      </text>
      <text x="30" y="65" className="code">
        {" "}
        <tspan style={{ fill: "var(--code-keyword)" }}>public</tspan> balances;
      </text>
      <path d="M 230 80 C 230 40, 270 40, 270 80 Z" fill="transparent" stroke="#EF4444" strokeWidth="2" />
      <circle cx="240" cy="65" r="3" fill="#EF4444" />
      <circle cx="260" cy="65" r="3" fill="#EF4444" />
      {/* Hacker Eye Laser Beams */}
      <g fill="#EF4444" opacity="0.3" filter="url(#glowRed2)">
        <polygon points="240,65 20,40 200,40">
          <animate attributeName="points" values="240,65 20,20 200,20; 240,65 20,100 200,100; 240,65 20,20 200,20" dur="2.5s" repeatCount="indefinite" />
        </polygon>
        <polygon points="260,65 20,40 200,40">
          <animate attributeName="points" values="260,65 20,20 200,20; 260,65 20,100 200,100; 260,65 20,20 200,20" dur="2.5s" repeatCount="indefinite" />
        </polygon>
      </g>
      <text x="250" y="105" className="code" fill="#EF4444" textAnchor="middle" fontWeight="bold">
        Hack!
      </text>
    </g>
  </svg>
);

export const Graphic3 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-10 -10 260 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan3"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate(225, 10)">
      <g className="draw-pulse">
        <path d="M 0 -25 L 20 -10 L 20 15 L 0 30 L -20 15 L -20 -10 Z" fill="transparent" stroke="#38BDF8" strokeWidth="3" filter="url(#glowCyan3)" />
        <path d="M 0 -25 L 0 0 L 20 15 M 0 0 L -20 15" fill="none" stroke="#38BDF8" strokeWidth="2" />
        <circle cx="0" cy="0" r="5" fill="#38BDF8" />
      </g>
    </g>
    <text x="0" y="30" className="code" style={{ fontSize: "14px" }}>
      <tspan fill="#38BDF8">let</tspan> asset ={" "}
      <tspan fill="#0a0a0aff"></tspan>ResourceBuilder
    </text>
    <text x="15" y="50" className="code" style={{ fontSize: "14px" }}>
      ::new_fungible()
    </text>
    <text x="15" y="70" className="code" style={{ fontSize: "14px" }}>
      .<tspan fill="#38BDF8">mint_initial_supply</tspan>(
      <tspan fill="#10B981">100</tspan>);
    </text>
    <path d="M 160 45 L 225 45" stroke="#38BDF8" strokeWidth="3" strokeDasharray="4" strokeDashoffset="0" className="draw-swift" />

  </svg>
);

export const Graphic4 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink4">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed4"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan4"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold4"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple4"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald4"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine4" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <rect
      x="30"
      y="30"
      width="60"
      height="60"
      rx="4"
      fill="transparent"
      stroke="#FBBF24"
      strokeWidth="2"
    />
    <path d="M 30 70 L 90 70" stroke="#FBBF24" strokeDasharray="3" />
    <text x="60" y="110" className="code" textAnchor="middle" fill="#FDE047">
      Vault A
    </text>

    <g transform="translate(150, 45)">
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-90,-20; -90,10; 0,-20; 90,10; 90,-20; -90,-20"
          dur="4s"
          repeatCount="indefinite"
        />
        <path
          d="M -15 -15 L 15 -15 L 10 15 L -10 15 Z"
          fill="transparent"
          stroke="#FBBF24"
          strokeWidth="2"
          strokeDasharray="2"
        />
        <circle cx="0" cy="0" r="6" fill="#FBBF24" filter="url(#glowGold4)" />
      </g>
    </g>

    <rect
      x="210"
      y="30"
      width="60"
      height="60"
      rx="4"
      fill="transparent"
      stroke="#FBBF24"
      strokeWidth="2"
    />
    <path d="M 210 70 L 270 70" stroke="#FBBF24" strokeDasharray="3" />
    <text x="240" y="110" className="code" textAnchor="middle" fill="#FDE047">
      Vault B
    </text>
  </svg>
);

export const Graphic5 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowGold5"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowCyan5"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <g transform="translate(150, 55) scale(1.6)">
      {/* Target Device / App Login gate */}
      <g transform="translate(45, 0)">
        <rect x="-25" y="-35" width="50" height="70" rx="6" fill="transparent" stroke="#00F0FF" strokeWidth="2" filter="url(#glowCyan5)" />
        <line x1="-15" y1="-20" x2="15" y2="-20" stroke="#00F0FF" strokeWidth="2" strokeDasharray="4" />
        <circle cx="0" cy="0" r="10" fill="transparent" stroke="#00F0FF" strokeWidth="2" strokeDasharray="2 4" className="draw-spin" />
        <text x="0" y="25" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "9px" }}>LOGIN</text>
      </g>

      {/* Posición MÁS A LA IZQUIERDA (-65). El grupo wrapper preserva el Translate contra el CSS Overload */}
      <g transform="translate(-65, 0)">
        <g className="draw-float">
          {/* Shield outline */}
          <path d="M 0 -22 L 15 -15 L 15 5 C 15 18, 0 30, 0 30 C 0 30, -15 18, -15 5 L -15 -15 Z" fill="transparent" stroke="#EAB308" strokeWidth="2" filter="url(#glowGold5)" />
          {/* Inner User Symbol */}
          <g filter="url(#glowGold5)">
            <circle cx="0" cy="-2" r="4" fill="transparent" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M -8 10 C -8 3, 8 3, 8 10" fill="transparent" stroke="#EAB308" strokeWidth="1.5" />
          </g>
          <text x="0" y="42" className="code font-bold" fill="#EAB308" textAnchor="middle" style={{ fontSize: "9px" }}>BADGE</text>
        </g>
      </g>

      {/* Authentication Beam connecting them */}
      <path d="M -50 0 L 20 0" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" className="draw-swift" />
    </g>
  </svg>
);

export const Graphic6 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan6"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate(-15, -10) scale(1.2)">
      <g opacity="0.8">
        <path d="M 10 70 L 60 70 M 20 70 L 20 50 M 35 70 L 35 50 M 50 70 L 50 50 M 10 50 L 60 50 L 35 30 Z" fill="transparent" stroke="#38BDF8" strokeWidth="2" strokeLinejoin="round" />
        <text x="35" y="90" className="code" fill="#38BDF8" textAnchor="middle" style={{ fontSize: "12px" }}>Bank</text>
      </g>
      <g opacity="0.8">
        <circle cx="250" cy="45" r="10" fill="transparent" stroke="#38BDF8" strokeWidth="2" />
        <path d="M 230 70 C 230 55, 270 55, 270 70" fill="transparent" stroke="#38BDF8" strokeWidth="2" />
        <text x="250" y="90" className="code" fill="#38BDF8" textAnchor="middle" style={{ fontSize: "12px" }}>User</text>
      </g>
      {/* ID Card glowing */}
      <g transform="translate(140, 50)" filter="url(#glowCyan6)">
        <rect x="-20" y="-15" width="40" height="30" rx="4" fill="transparent" stroke="#38BDF8" strokeWidth="2" />
        <circle cx="-5" cy="-2" r="4" fill="#38BDF8" />
        <line x1="-5" y1="5" x2="-5" y2="8" stroke="#38BDF8" strokeWidth="2" />
        <line x1="5" y1="-5" x2="15" y2="-5" stroke="#38BDF8" strokeWidth="1" />
        <line x1="5" y1="0" x2="15" y2="0" stroke="#38BDF8" strokeWidth="1" />
        <line x1="5" y1="5" x2="10" y2="5" stroke="#38BDF8" strokeWidth="1" />
      </g>
      <text x="140" y="85" className="code font-bold" fill="#38BDF8" textAnchor="middle" style={{ fontSize: "12px" }}>
        {_t?.ecosistema?.graphics?.g6_idosCheck || "idOS"}
      </text>
      <path d="M 70 50 L 110 50" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <path d="M 170 50 L 210 50" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <polygon points="210,50 205,47 205,53" fill="#38BDF8" />
    </g>
  </svg>
);

export const Graphic7 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan7"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowFuchsia7"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowGold7"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <g transform="translate(5, 5) scale(1.15)">
      {/* DeFi Protocol Core */}
      <g transform="translate(130, 45)" scale="1.4">
        <polygon points="0,-25 22,-12 22,12 0,25 -22,12 -22,-12" fill="none" stroke="#00F0FF" strokeWidth="2" filter="url(#glowCyan7)" className="draw-pulse" />
        <circle cx="0" cy="0" r="12" fill="none" stroke="#00F0FF" strokeWidth="2" strokeDasharray="3" />
        <text x="0" y="4" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "9px" }}>DeFi LP</text>
      </g>

      {/* Role 1: Minter */}
      <g transform="translate(10, 15)">
        <rect x="-25" y="-12" width="60" height="24" rx="4" fill="none" stroke="#10B981" strokeWidth="2" />
        <circle cx="-25" cy="0" r="6" fill="#10B981" />
        <text x="5" y="4" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>Minter</text>
      </g>
      <path d="M 40 15 L 90 30" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="3" className="draw-swift" />

      {/* Role 2: Burner */}
      <g transform="translate(10, 75)">
        <rect x="-25" y="-12" width="60" height="24" rx="4" fill="none" stroke="#F43F5E" strokeWidth="2" />
        <circle cx="-25" cy="0" r="6" fill="#F43F5E" />
        <text x="5" y="4" className="code font-bold" fill="#F43F5E" textAnchor="middle" style={{ fontSize: "12px" }}>Burner</text>
      </g>
      <path d="M 40 75 L 90 60" fill="none" stroke="#F43F5E" strokeWidth="2" strokeDasharray="3" className="draw-swift" />

      {/* Admin Badge Unlocking Roles - MÁS A LA DERECHA (275). El wrapper rescata el Translate */}
      <g transform="translate(280, 45)">
        <g className="draw-float">
          {/* Police Shield */}
          <path d="M 0 -22 L 15 -15 L 15 5 C 15 18, 0 30, 0 30 C 0 30, -15 18, -15 5 L -15 -15 Z" fill="transparent" stroke="#EAB308" strokeWidth="2" filter="url(#glowGold7)" />
          {/* Inner User Symbol */}
          <g filter="url(#glowGold7)">
            <circle cx="0" cy="-2" r="4" fill="transparent" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M -8 10 C -8 3, 8 3, 8 10" fill="transparent" stroke="#EAB308" strokeWidth="1.5" />
          </g>
          <text x="0" y="45" className="code font-bold" fill="#EAB308" textAnchor="middle" style={{ fontSize: "12px" }}>
            <tspan x="0" dy="0">Admin</tspan>
            <tspan x="0" dy="1.2em">Badge</tspan>
          </text>        </g>
      </g>

      {/* Authentication Beams */}
      <path d="M 265 40 C 200 -10, 100 -20, 60 15 L 40 15" fill="none" stroke="#EAB308" strokeWidth="2" strokeDasharray="5" opacity="0.8" className="draw-swift" />
      <path d="M 265 50 C 200 100, 100 110, 60 75 L 40 75" fill="none" stroke="#EAB308" strokeWidth="2" strokeDasharray="5" opacity="0.8" className="draw-swift" />
    </g>
  </svg>
);

export const Graphic8 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowFuchsia8"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate(0, -35)">
      {/* Central Identity component */}
      <g transform="translate(150, 40) scale(1.4)">
        <g className="draw-pulse">
          <path d="M 0 -25 L 20 -10 L 20 15 L 0 30 L -20 15 L -20 -10 Z" fill="transparent" stroke="#5446efff" strokeWidth="2" filter="url(#glowFuchsia8)" />
          <circle cx="-10" cy="-5" r="3" fill="#5446efff" />
          <circle cx="10" cy="-5" r="3" fill="#5446efff" />
          <circle cx="0" cy="10" r="3" fill="#5446efff" />
        </g>
      </g>

      {/* Biometrics */}
      <g transform="translate(45, 90)">
        <g transform="scale(1.6)">
          <path d="M -6 5 C -12 -5, 12 -5, 6 5 M -10 8 C -18 -10, 18 -10, 10 8 M -2 2 C -5 -2, 5 -2, 2 2" fill="none" stroke="#5446efff" strokeWidth="1.5" className="draw-swift" />
        </g>
        <text x="0" y="32" className="code font-bold" fill="#5446efff" textAnchor="middle" style={{ fontSize: "14px" }}>{t?.ecosistema?.graphics?.g8_biometrics || "Biometría"}</text>
      </g>

      {/* Ledger */}
      <g transform="translate(255, 90)">
        <g transform="scale(1.6)">
          <rect x="-8" y="-12" width="16" height="24" rx="2" fill="none" stroke="#5446efff" strokeWidth="1.5" className="draw-pulse" />
          <rect x="-4" y="-8" width="8" height="6" fill="#5446efff" />
          <circle cx="0" cy="4" r="2" fill="#5446efff" />
        </g>
        <text x="0" y="32" className="code font-bold" fill="#5446efff" textAnchor="middle" style={{ fontSize: "14px" }}>{t?.ecosistema?.graphics?.g8_ledger || "Ledger"}</text>
      </g>

      {/* Social Recovery */}
      <g transform="translate(150, 135)">
        <g stroke="#5446efff" strokeWidth="1.5" fill="none" className="draw-float" transform="scale(2.6)">
          <circle cx="0" cy="-5" r="3" /> <path d="M -6 5 C -6 -1, 6 -1, 6 5" />
          <circle cx="-12" cy="0" r="2.5" /> <path d="M -17 8 C -17 3, -7 3, -7 8" />
          <circle cx="12" cy="0" r="2.5" /> <path d="M 7 8 C 7 3, 17 3, 17 8" />
        </g>
        <text x="0" y="32" className="code font-bold" fill="#5446efff" textAnchor="middle" style={{ fontSize: "14px" }}>{t?.ecosistema?.graphics?.g8_social_recovery || "Recuperación Social"}</text>
      </g>

      {/* Lines connecting them */}
      <path d="M 125 50 L 55 75 M 175 50 L 245 75 M 150 75 L 150 110" fill="none" stroke="#5446efff" strokeWidth="1" strokeDasharray="3" opacity="0.6" />
    </g>
  </svg>
);

export const Graphic9 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowEmerald9"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {/* Ajustado verticalmente */}
    <g transform="translate(-10, 5) scale(1.1)">
      <rect x="0" y="10" width="280" height="100" rx="6" fill="transparent" stroke="#334155" strokeWidth="1" opacity="0.9" />
      <text x="15" y="35" className="code font-bold" style={{ fontSize: "14px" }}>
        <tspan style={{ fill: "var(--code-keyword)" }}>CALL_METHOD</tspan>
      </text>
      <text x="15" y="55" className="code" style={{ fontSize: "14px" }}>
        {" "}
        <tspan style={{ fill: "var(--code-type)" }}>Address(</tspan>
        <tspan style={{ fill: "var(--code-string)" }}>&quot;account_rdx…&quot;</tspan>
        <tspan style={{ fill: "var(--code-type)" }}>)</tspan>
      </text>
      <text x="15" y="75" className="code" style={{ fontSize: "14px" }}>
        {" "}
        <tspan style={{ fill: "var(--code-string)" }}>&quot;withdraw&quot;</tspan>
      </text>
      <text x="15" y="95" className="code" style={{ fontSize: "14px" }}>
        {" "}
        <tspan style={{ fill: "var(--code-type)" }}>Address(</tspan>
        <tspan style={{ fill: "var(--code-string)" }}>&quot;resource_rdx…&quot;</tspan>
        <tspan style={{ fill: "var(--code-type)" }}>)</tspan><tspan style={{ fill: "var(--code-punct)" }}>;</tspan>
      </text>
      <g transform="translate(255, 35)">
        <circle cx="0" cy="0" r="12" fill="#10B981" filter="url(#glowEmerald9)" className="draw-pulse" />
        <path
          d="M -5.2,0.6 L -3.6,0.6 L -1.3,4.1 L 2.1,-4.1 L 5.2,-4.1"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  </svg>
);

export const Graphic10 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan10"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {/* Ajustado verticalmente empujando hacia arriba */}
    <g transform="translate(0, -10) scale(1.2)">
      <g transform="translate(40, 60)">
        <rect x="-25" y="-25" width="50" height="50" rx="8" fill="none" stroke="#38BDF8" strokeWidth="2" />
        <text x="0" y="4" className="code font-bold" fill="#F8FAFC" textAnchor="middle">DApp</text>
      </g>
      <path d="M 75 40 L 195 40" stroke="#00F0FF" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <circle cx="135" cy="40" r="14" fill="transparent" stroke="#00F0FF" strokeWidth="2" />
      <path d="M 135 32 V 40 H 141" fill="none" stroke="#000000ff" strokeWidth="2" />
      <text x="135" y="15" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "12px" }}>Time Limit</text>

      <path d="M 75 80 L 195 80" stroke="#00F0FF" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <circle cx="135" cy="80" r="14" fill="transparent" stroke="#00F0FF" strokeWidth="2" />
      <text x="135" y="84" className="code" fill="#00F0FF" textAnchor="middle" fontWeight="bold">$</text>
      <text x="135" y="110" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "12px" }}>Max $10/tx</text>

      <g transform="translate(230, 60)">
        <g className="draw-pulse">
          <path d="M 0 -25 L 20 -10 L 20 15 L 0 30 L -20 15 L -20 -10 Z" fill="transparent" stroke="#38BDF8" strokeWidth="3" filter="url(#glowCyan10)" />
          <path
            d="M -11.1,6.2 L -7.8,6.2 L -2.7,13.7 L 4.5,-3.7 L 11.1,-3.7"
            fill="none"
            stroke="#10B981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  </svg>
);

export const Graphic11 = ({ t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan11"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {/* Ajustado verticalmente empujando hacia arriba */}
    <g transform="translate(-15, -15) scale(1.1)">
      {/* Central Vault */}
      <g transform="translate(150, 60)">
        <g className="draw-pulse">
          <rect x="-30" y="-30" width="60" height="60" rx="6" fill="transparent" stroke="#10B981" strokeWidth="2" filter="url(#glowCyan11)" />
          <circle cx="0" cy="-10" r="15" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="2 4" />
          <path
            d="M -5.2,-9.4 L -3.6,-9.4 L -1.3,-5.9 L 2.1,-14.1 L 5.2,-14.1"
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="0" y="20" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "14px" }}>Vault</text>
        </g>
      </g>

      {/* Signer 1 (Signed) */}
      <g transform="translate(50, 25)" stroke="#10B981" strokeWidth="2" fill="none">
        <circle cx="0" cy="-6" r="6" /> <path d="M -12 12 C -12 0, 12 0, 12 12" />
        <text x="0" y="25" className="code font-bold" fill="#10B981" textAnchor="middle" stroke="none" style={{ fontSize: "12px" }}>Signer 1</text>
      </g>
      <path d="M 65 35 L 120 50" stroke="#10B981" strokeWidth="2" className="draw-swift" />

      {/* Signer 2 (Signed) */}
      <g transform="translate(50, 95)" stroke="#10B981" strokeWidth="2" fill="none">
        <circle cx="0" cy="-6" r="6" /> <path d="M -12 12 C -12 0, 12 0, 12 12" />
        <text x="0" y="25" className="code font-bold" fill="#10B981" textAnchor="middle" stroke="none" style={{ fontSize: "12px" }}>Signer 2</text>
      </g>
      <path d="M 65 85 L 120 70" stroke="#10B981" strokeWidth="2" className="draw-swift" />

      {/* Signer 3 (Pending) */}
      <g transform="translate(250, 60)" stroke="#64748B" strokeWidth="2" fill="none" strokeDasharray="3">
        <circle cx="0" cy="-6" r="6" /> <path d="M -12 12 C -12 0, 12 0, 12 12" />
        <text x="0" y="25" className="code font-bold" fill="#64748B" textAnchor="middle" stroke="none" style={{ fontSize: "12px" }}>Signer 3</text>
      </g>
      <path d="M 235 60 L 180 60" stroke="#64748B" strokeWidth="2" strokeDasharray="4" />

      {/* Movido un pelin mas arriba para que respire */}
      <text x="150" y="145" className="code font-bold" fill="#D1FAE5" textAnchor="middle" style={{ fontSize: "14px" }}>
        {t?.ecosistema?.graphics?.g11_policy || "2 / 3 Multisig"}
      </text>
    </g>
  </svg>
);

export const Graphic12 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink12">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed12"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan12"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold12"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple12"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald12"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine12" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink12" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient12" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <path
      d="M 30 60 L 270 60"
      stroke="#64748B"
      strokeWidth="2"
      strokeDasharray="5"
    />
    <circle cx="80" cy="60" r="6" fill="#EC4899" />
    <circle cx="150" cy="60" r="6" fill="#EC4899" />
    <circle cx="220" cy="60" r="6" fill="#EC4899" />

    <g transform="translate(80, 60)">
      <g className="draw-magnify">
        <circle
          cx="0"
          cy="0"
          r="15"
          fill="none"
          stroke="#2736b6ff"
          strokeWidth="2"
          filter="url(#glowPink30)"
        />
        <path d="M 10 10 L 20 20" stroke="#2736b6ff" strokeWidth="3" />
        <text x="0" y="-20" className="code" fill="#FCE7F3" textAnchor="middle" style={{ fontSize: "14px" }}>
          Audit Tx
        </text>
      </g>
    </g>
  </svg>
);

export const Graphic13 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink13">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed13"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan13"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold13"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple13"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald13"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine13" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink13" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient13" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <g transform="translate(50, 50) scale(2.0)">
      <path
        d="M -25 20 L -25 -5 L 0 -25 L 25 -5 L 25 20 Z"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="3"
      />
      <rect
        x="-10"
        y="5"
        width="20"
        height="15"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2"
      />
      <rect x="-15" y="-10" width="8" height="8" fill="none" stroke="#38BDF8" />
      <rect x="7" y="-10" width="8" height="8" fill="none" stroke="#38BDF8" />
      <text x="0" y="40" className="code" fill="#38BDF8" textAnchor="middle">
        Real World
      </text>
    </g>

    <path
      d="M 90 60 L 210 60"
      fill="none"
      stroke="#38BDF8"
      strokeWidth="2"
      strokeDasharray="4"
      className="draw-swift"
    />
    <g transform="translate(150, 60)">
      <circle cx="0" cy="0" r="10" fill="#38BDF8" filter="url(#glowCyan13)" />
      <path
        d="M -5.2,0.6 L -3.6,0.6 L -1.3,4.1 L 2.1,-4.1 L 5.2,-4.1"
        fill="none"
        stroke="#252a0fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>

    <g transform="translate(250, 60)">
      <g className="draw-spin" style={{ animationDuration: "0.8s" }}>
        <circle
          cx="0"
          cy="0"
          r="30"
          fill="transparent"
          stroke="#38BDF8"
          strokeWidth="3"
          strokeDasharray="10 5"
          filter="url(#glowCyan13)"
        />
      </g>
      <text
        x="0"
        y="5"
        className="code font-bold"
        fill="#F8FAFC"
        textAnchor="middle"
        style={{ fontSize: "14px" }}
      >
        Token
      </text>
    </g>
  </svg>
);

export const Graphic14 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowFuchsia14"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowGold14"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowEmerald14"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>

      <linearGradient id="goldGrad14" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>

      <linearGradient id="emeraldGrad14" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>

    <g transform="translate(150, 60) scale(2.5)">
      {/* State 1: Original Bond */}
      <g transform="translate(-45, -5)">
        {/* Certificate Outer Border */}
        <rect x="-24" y="-28" width="48" height="56" rx="4" fill="transparent" stroke="url(#goldGrad14)" strokeWidth="1.2" filter="url(#glowGold14)" />
        {/* Certificate Inner Line */}
        <rect x="-21" y="-25" width="42" height="50" rx="2" fill="transparent" stroke="url(#goldGrad14)" strokeWidth="0.5" opacity="0.6" strokeDasharray="1 1" />

        {/* Header Ribbon Context */}
        <path d="M -24 -16 L 24 -16" stroke="url(#goldGrad14)" strokeWidth="0.5" opacity="0.6" />

        {/* Title Text */}
        <text x="0" y="-19.5" className="code" fill="#FDE047" textAnchor="middle" style={{ fontSize: "5px", letterSpacing: "0.5px", opacity: 0.9 }}>
          {t?.ecosistema?.graphics?.g14_bond || "10Y YIELD BOND"}
        </text>

        {/* Realistic Technical Text Lines */}
        <text x="-18" y="-10" className="code" fill="#F8FAFC" style={{ fontSize: "2.8px", opacity: 0.8 }}>ISSUER: RADIX NETWORK</text>
        <text x="-18" y="-6" className="code" fill="#F8FAFC" style={{ fontSize: "2.8px", opacity: 0.8 }}>MATURITY: 2036-12-31</text>
        <text x="-18" y="-2" className="code" fill="#FDE047" style={{ fontSize: "2.8px", opacity: 0.9, fontWeight: "bold" }}>COUPON: 5.00% FIXED</text>
        <text x="-18" y="2" className="code" fill="#F8FAFC" style={{ fontSize: "2.8px", opacity: 0.8 }}>ISIN: RDX00098765432</text>
        <text x="-18" y="6" className="code" fill="#F8FAFC" style={{ fontSize: "2.8px", opacity: 0.6 }}>CLASS: AAA RATED</text>

        {/* Medal Decoration (Seal) */}
        <g transform="translate(10, 16)">
          <path d="M -2 4 L -3 10 L 0 8 L 3 10 L 2 4" fill="transparent" stroke="url(#goldGrad14)" strokeWidth="0.75" opacity="0.8" />
          {/* Star Polygon */}
          <polygon points="0,-5 1.5,-1.5 5,-1.5 2.5,1 3.5,5 0,3 -3.5,5 -2.5,1 -5,-1.5 -1.5,-1.5" fill="transparent" stroke="url(#goldGrad14)" strokeWidth="1" filter="url(#glowGold14)" />
          {/* Inner Circle */}
          <circle cx="0" cy="0" r="2.5" fill="transparent" stroke="url(#goldGrad14)" strokeWidth="0.5" />
        </g>

        {/* State Label */}
        <text x="-10" y="18" className="code font-bold uppercase" fill="#FDE047" textAnchor="middle" style={{ fontSize: "5px", letterSpacing: "0.5px" }}>
          {t?.ecosistema?.graphics?.g14_active || "ACTIVE"}
        </text>
      </g>

      {/* Transformation Arrow */}
      <g transform="translate(0, -5)">
        <g filter="url(#glowFuchsia14)">
          <path d="M -7 0 L 7 0" fill="none" stroke="#D946EF" strokeWidth="2" className="draw-swift" />
          <polygon points="22,0 19,-2 19,2" fill="#D946EF" />
        </g>
        <text x="2" y="-4" className="code font-bold" fill="#D946EF" textAnchor="middle" style={{ fontSize: "8px" }}>
          {t?.ecosistema?.graphics?.g14_mutate || "Mutate"}
        </text>
      </g>

      {/* State 2: Modified Bond */}
      <g transform="translate(50, -5)">
        {/* Certificate Outer Border */}
        <rect x="-24" y="-28" width="48" height="56" rx="4" fill="transparent" stroke="url(#emeraldGrad14)" strokeWidth="1.2" filter="url(#glowEmerald14)" />
        {/* Certificate Inner Line */}
        <rect x="-21" y="-25" width="42" height="50" rx="2" fill="transparent" stroke="url(#emeraldGrad14)" strokeWidth="0.5" opacity="0.6" strokeDasharray="1 1" />

        {/* Header Ribbon Context */}
        <path d="M -24 -16 L 24 -16" stroke="url(#emeraldGrad14)" strokeWidth="0.5" opacity="0.6" />

        {/* Title Text */}
        <text x="0" y="-19.5" className="code" fill="#6EE7B7" textAnchor="middle" style={{ fontSize: "5px", letterSpacing: "0.5px", opacity: 0.9 }}>
          {t?.ecosistema?.graphics?.g14_bond || "10Y YIELD BOND"}
        </text>

        {/* Realistic Technical Text Lines */}
        <text x="-18" y="-10" className="code" fill="#F8FAFC" style={{ fontSize: "2.4px", opacity: 0.8 }}>ISSUER: RADIX NETWORK</text>
        <text x="-18" y="-6" className="code" fill="#F8FAFC" style={{ fontSize: "2.4px", opacity: 0.8 }}>MATURITY: 2036-12-31</text>
        {/* Updated values in Green */}
        <text x="-18" y="-2" className="code" fill="#10B981" style={{ fontSize: "2.4px", opacity: 1, fontWeight: "bold" }}>COUPON: 7.00% FIXED</text>
        <text x="-18" y="2" className="code" fill="#10B981" style={{ fontSize: "2.4px", opacity: 1, fontWeight: "bold" }}>STATUS: UPGRADED</text>
        <text x="-18" y="6" className="code" fill="#F8FAFC" style={{ fontSize: "2.4px", opacity: 0.6 }}>CLASS: AAA RATED</text>

        {/* Medal Decoration (Seal) - Updated Green */}
        <g transform="translate(10, 16)">
          <path d="M -2 4 L -3 10 L 0 8 L 3 10 L 2 4" fill="transparent" stroke="url(#emeraldGrad14)" strokeWidth="0.75" opacity="0.8" />
          <polygon points="0,-5 1.5,-1.5 5,-1.5 2.5,1 3.5,5 0,3 -3.5,5 -2.5,1 -5,-1.5 -1.5,-1.5" fill="transparent" stroke="url(#emeraldGrad14)" strokeWidth="1" filter="url(#glowEmerald14)" />
          {/* Checkmark inside medal */}
          <path d="M -1 0.5 L 0 1.5 L 2 -1" fill="none" stroke="url(#emeraldGrad14)" strokeWidth="0.5" />
        </g>

        {/* State Label */}
        <text x="-8" y="18" className="code font-bold uppercase" fill="#10B981" textAnchor="middle" style={{ fontSize: "5px", letterSpacing: "0.5px" }}>
          {t?.ecosistema?.graphics?.g14_expired || "EXPIRED"}
        </text>
      </g>
    </g>
  </svg>
);

export const Graphic15 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink15">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed15"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan15"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold15"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple15"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald15"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine15" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink15" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient15" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>
    <circle
      cx="50"
      cy="30"
      r="22"
      fill="transparent"
      stroke="#38BDF8"
      strokeWidth="2"
    />{" "}
    <text
      x="50"
      y="36"
      className="code font-bold"
      fill="#38BDF8"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      USDC
    </text>
    <circle
      cx="50"
      cy="90"
      r="22"
      fill="transparent"
      stroke="#FBBF24"
      strokeWidth="2"
    />{" "}
    <text
      x="50"
      y="96"
      className="code font-bold"
      fill="#FBBF24"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      XRD
    </text>
    <path
      d="M 75 30 L 140 60 M 75 90 L 140 60"
      stroke="#64748B"
      strokeWidth="3"
    />
    <rect
      x="150"
      y="20"
      width="90"
      height="80"
      rx="10"
      fill="transparent"
      stroke="#A855F7"
      strokeWidth="3"
    />
    <text
      x="195"
      y="66"
      className="code font-bold"
      fill="#A855F7"
      textAnchor="middle"
      style={{ fontSize: "18px" }}
    >
      AMM
    </text>
    <path
      d="M 245 60 L 270 60"
      stroke="#A855F7"
      strokeWidth="3"
      markerEnd="url(#arrowPurple15)"
    />
    <circle
      cx="295"
      cy="60"
      r="18"
      fill="transparent"
      stroke="#A855F7"
      strokeWidth="2"
      strokeDasharray="4"
    />{" "}
    <text
      x="295"
      y="66"
      className="code font-bold"
      fill="#A855F7"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      LP
    </text>
  </svg>
);

export const Graphic16 = ({ t: t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink16">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed16"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan16"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold16"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple16"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald16"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine16" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink16" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient16" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <g transform="translate(150, 60)">
      <g className="draw-spin">
        <path
          d="M 0 -45 A 45 45 0 0 1 45 0 M 45 0 A 45 45 0 0 1 0 45 M 0 45 A 45 45 0 0 1 -45 0 M -45 0 A 45 45 0 0 1 0 -45"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="4"
        />
        <path d="M 45 -8 L 45 8 L 30 0 Z" fill="#38BDF8" />
        <path d="M -45 8 L -45 -8 L -30 0 Z" fill="#38BDF8" />
      </g>
    </g>
    <text
      x="150"
      y="66"
      className="code"
      fill="#E2E8F0"
      textAnchor="middle"
      fontWeight="bold"
      style={{ fontSize: "20px" }}
    >
      {t?.ecosistema?.graphics?.g16_1tx || "1 TX"}
    </text>
    <text
      x="150"
      y="0"
      className="code font-bold"
      fill="#F8FAFC"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      {t?.ecosistema?.graphics?.g16_borrow || "Borrow 10M"}
    </text>
    <text
      x="235"
      y="66"
      className="code font-bold"
      fill="#F8FAFC"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      Arb
    </text>
    <text
      x="150"
      y="125"
      className="code font-bold"
      fill="#F8FAFC"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      {t?.ecosistema?.graphics?.g16_repay || "Repay + Fee"}
    </text>
  </svg>
);

export const Graphic17 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowEmer17"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate(150, 50) scale(1.3)">
      {/* Connection Links */}
      <path d="M -70 -50 L 0 0 M 70 -50 L 0 0 M -70 50 L 0 0 M 70 50 L 0 0" fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3" opacity="0.6" className="draw-pulse" />
      <path d="M -70 -50 L 0 -60 L 70 -50 L 90 0 L 70 50 L 0 60 L -70 50 L -90 0 Z" fill="none" stroke="#10B981" strokeWidth="0.5" opacity="0.3" />

      {/* Outer Validator Nodes text scaled */}
      <circle cx="-70" cy="-50" r="10" fill="transparent" stroke="#10B981" strokeWidth="2" />
      <text x="-70" y="-65" className="code" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>Val 1</text>

      <circle cx="70" cy="-50" r="10" fill="transparent" stroke="#10B981" strokeWidth="2" />
      <text x="70" y="-65" className="code" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>Val 2</text>

      <circle cx="-70" cy="50" r="10" fill="transparent" stroke="#10B981" strokeWidth="2" />
      <text x="-70" y="70" className="code" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>Val 3</text>

      <circle cx="70" cy="50" r="10" fill="transparent" stroke="#10B981" strokeWidth="2" />
      <text x="70" y="70" className="code" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>Val 4</text>

      {/* Central PROPOSAL Document - No Fill */}
      <rect x="-30" y="-35" width="60" height="70" rx="3" fill="transparent" stroke="#10B981" strokeWidth="2" filter="url(#glowEmer17)" className="draw-float" />
      <line x1="-15" y1="-15" x2="15" y2="-15" stroke="#10B981" strokeWidth="2" />
      <line x1="-15" y1="0" x2="15" y2="0" stroke="#10B981" strokeWidth="1" />
      <line x1="-15" y1="15" x2="5" y2="15" stroke="#10B981" strokeWidth="1" />
      <text x="0" y="-22" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>PROPOSAL</text>

      {/* Signatures/Checks flowing - Moved after Proposal to be on top */}
      <g stroke="#10B981" strokeWidth="2" fill="none">
        <path d="M -7.4,0.8 L -5.2,0.8 L -1.8,5.8 L 3.0,-5.8 L 7.4,-5.8">
          <animateTransform attributeName="transform" type="translate" values="-70,-50; 0,0" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="4s" repeatCount="indefinite" />
        </path>
        <path d="M -7.4,0.8 L -5.2,0.8 L -1.8,5.8 L 3.0,-5.8 L 7.4,-5.8">
          <animateTransform attributeName="transform" type="translate" values="70,-50; 0,0" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="4s" repeatCount="indefinite" />
        </path>
      </g>
    </g>
  </svg>
);

export const Graphic18 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <marker id="arrowGold18" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
    </defs>
    <circle cx="20" cy="60" r="24" fill="transparent" stroke="#FBBF24" strokeWidth="2" />
    <text x="20" y="66" className="code font-bold" fill="#FBBF24" textAnchor="middle" style={{ fontSize: "16px" }}>
      User
    </text>
    <path d="M 50 60 L 150 60" stroke="#FBBF24" strokeWidth="3" markerEnd="url(#arrowGold18)" />
    <text x="100" y="45" className="code font-bold" fill="#FDE047" textAnchor="middle" style={{ fontSize: "14px" }}>
      {t?.ecosistema?.graphics?.g19_stake || "Stake 1000 XRD"}
    </text>
    <rect x="165" y="20" width="70" height="80" rx="6" fill="transparent" stroke="#64748B" strokeWidth="3" />
    <text x="200" y="66" className="code font-bold" textAnchor="middle" style={{ fontSize: "16px" }}>
      Node
    </text>
    <path d="M 235 60 L 280 60" stroke="#10B981" strokeWidth="3" strokeDasharray="6" />
    <text x="260" y="45" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "14px" }}>
      Yield
    </text>
  </svg>
);

export const Graphic19 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink19">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed19"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan19"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold19"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple19"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald19"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine19" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink19" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient19" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <g transform="translate(50, 60)">
      <rect
        x="-30"
        y="-20"
        width="60"
        height="40"
        rx="6"
        fill="transparent"
        stroke="#A855F7"
        strokeWidth="3"
      />
      <text
        x="0"
        y="6"
        className="code font-bold"
        fill="#A855F7"
        textAnchor="middle"
        style={{ fontSize: "18px" }}
      >
        XRD
      </text>
    </g>
    <path
      d="M 85 60 L 135 60"
      stroke="#A855F7"
      strokeWidth="3"
      markerEnd="url(#arrowPurple19)"
      className="draw-swift"
    />
    <g transform="translate(160, 60)">
      <g className="draw-pulse">
        <polygon
          points="0,-25 20,0 0,25 -20,0"
          fill="transparent"
          stroke="#38BDF8"
          strokeWidth="4"
        />
      </g>
    </g>
    <path
      d="M 185 60 L 235 60"
      stroke="#38BDF8"
      strokeWidth="3"
      markerEnd="url(#arrowCyan19)"
      className="draw-swift"
    />
    <g transform="translate(265, 60)">
      <circle
        cx="0"
        cy="0"
        r="25"
        fill="transparent"
        stroke="#38BDF8"
        strokeWidth="3"
        strokeDasharray="4"
      />
      <text
        x="0"
        y="6"
        className="code font-bold"
        fill="#38BDF8"
        textAnchor="middle"
        style={{ fontSize: "18px" }}
      >
        LSU
      </text>
    </g>
  </svg>
);

export const Graphic20 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowGold20"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <rect x="60" y="-10" width="180" height="60" rx="8" fill="transparent" stroke="#10B981" strokeWidth="2" />
    <text x="150" y="25" className="code font-bold" textAnchor="middle" fill="#10B981" style={{ fontSize: "18px" }}>
      Blueprints
    </text>

    {/* Falling coins */}
    <g filter="url(#glowGold20)">
      <circle cx="130" cy="40" r="8" fill="#FBBF24">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,60" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="150" cy="40" r="8" fill="#FBBF24">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,60" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="170" cy="40" r="8" fill="#FBBF24">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,60" dur="1.5s" begin="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" begin="1s" repeatCount="indefinite" />
      </circle>
    </g>

    <path d="M 150 90 L 150 110" stroke="#FBBF24" strokeWidth="3" strokeDasharray="4" className="draw-swift" />
    <rect x="90" y="110" width="120" height="40" fill="transparent" stroke="#94A3B8" strokeWidth="2" rx="4" />
    <text x="150" y="135" className="code font-bold" fill="#F8FAFC" textAnchor="middle" style={{ fontSize: "16px" }}>
      Dev Wallet
    </text>
  </svg>
);

export const Graphic21 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink21">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed21"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan21"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold21"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple21"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald21"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine21" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink21" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient21" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>
    <rect
      x="25"
      y="30"
      width="70"
      height="60"
      rx="6"
      fill="transparent"
      stroke="#64748B"
      strokeWidth="3"
    />{" "}
    <text
      x="60"
      y="66"
      className="code font-bold"
      textAnchor="middle"
      style={{ fontSize: "20px" }}
    >
      BTC
    </text>
    <path
      d="M 100 60 L 130 60"
      stroke="#64748B"
      strokeWidth="3"
      strokeDasharray="6"
    />
    <g transform="translate(150, 60)">
      <g className="draw-spin" style={{ animationDuration: "0.8s" }}>
        <path
          d="M 0 -25 L 20 -15 L 20 15 L 0 25 L -20 15 L -20 -15 Z"
          fill="transparent"
          stroke="#FBBF24"
          strokeWidth="3"
        />
      </g>
    </g>
    <path
      d="M 170 60 L 200 60"
      stroke="#FBBF24"
      strokeWidth="4"
      markerEnd="url(#arrowGold21)"
    />
    <rect
      x="215"
      y="20"
      width="80"
      height="80"
      rx="12"
      fill="transparent"
      stroke="#FBBF24"
      strokeWidth="3"
    />{" "}
    <text
      x="255"
      y="66"
      className="code font-bold"
      fill="#FBBF24"
      textAnchor="middle"
      style={{ fontSize: "22px" }}
    >
      xBTC
    </text>
  </svg>
);

export const Graphic22 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan22"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowPurple22"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowEmerald22"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="scale(1.2) translate(-25, 0)">
      <circle cx="50" cy="50" r="22" fill="transparent" stroke="#A855F7" strokeWidth="2" filter="url(#glowPurple22)" />
      <text x="50" y="55" className="code font-bold" fill="#A855F7" textAnchor="middle" style={{ fontSize: "12px" }}>ETH</text>

      <circle cx="250" cy="50" r="22" fill="transparent" stroke="#10B981" strokeWidth="2" filter="url(#glowEmerald22)" />
      <text x="250" y="55" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }}>XRD</text>

      <text x="150" y="10" className="code font-bold" fill="#F8FAFC" textAnchor="middle" style={{ fontSize: "14px" }}>
        {t?.ecosistema?.graphics?.g22_hyperlane || "Hyperlane"}
      </text>

      {/* Bridge Structure */}
      <g opacity="0.6">
        {/* Arch */}
        <path d="M 70 50 Q 150 -10 230 50" fill="none" stroke="#64748B" strokeWidth="2" />
        {/* Cable lines */}
        <line x1="110" y1="20" x2="110" y2="50" stroke="#64748B" strokeWidth="1" />
        <line x1="130" y1="12" x2="130" y2="50" stroke="#64748B" strokeWidth="1" />
        <line x1="150" y1="9" x2="150" y2="50" stroke="#64748B" strokeWidth="1" />
        <line x1="170" y1="12" x2="170" y2="50" stroke="#64748B" strokeWidth="1" />
        <line x1="190" y1="20" x2="190" y2="50" stroke="#64748B" strokeWidth="1" />
      </g>

      <path d="M 80 50 L 220 50" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4" className="draw-swift" />
      <polyline points="215 45 220 50 215 55" fill="none" stroke="#38BDF8" strokeWidth="2" />
    </g>
  </svg>
);

export const Graphic23 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink23">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed23"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan23"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold23"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple23"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald23"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine23" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink23" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient23" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <circle
      cx="30"
      cy="20"
      r="14"
      fill="transparent"
      stroke="#00FFA3"
      strokeWidth="2"
    />
    <circle
      cx="30"
      cy="100"
      r="14"
      fill="transparent"
      stroke="#00FFA3"
      strokeWidth="2"
    />
    <path
      d="M 90 20 L 150 45 L 150 75 L 90 100 Z"
      fill="transparent"
      stroke="#00FFA3"
      strokeWidth="3"
    />
    <text
      x="115"
      y="66"
      className="code font-bold"
      fill="#00FFA3"
      textAnchor="middle"
      style={{ fontSize: "20px" }}
    >
      API
    </text>
    <rect
      x="210"
      y="20"
      width="80"
      height="80"
      rx="8"
      fill="transparent"
      stroke="#64748B"
      strokeWidth="3"
    />
    <line x1="225" y1="45" x2="275" y2="45" stroke="#64748B" strokeWidth="3" />
    <line x1="225" y1="65" x2="255" y2="65" stroke="#64748B" strokeWidth="3" />
    <path
      d="M 50 20 L 85 20"
      fill="none"
      stroke="#00FFA3"
      className="draw-stream"
      strokeWidth="3"
    />
    <path
      d="M 50 100 L 85 100"
      fill="none"
      stroke="#00FFA3"
      className="draw-stream"
      strokeWidth="3"
    />
    <path
      d="M 155 60 L 205 60"
      fill="none"
      stroke="#00FFA3"
      className="draw-stream"
      strokeWidth="5"
      filter="url(#glowEmerald23)"
    />
  </svg>
);

export const Graphic24 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowAzure24"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {/* Elevado el eje Y de 60 a 45 para centrar en el ViewBox */}
    <g transform="translate(150, 15) scale(1.5)">
      <polygon points="0,-35 45,-20 45,30 0,65 -45,30 -45,-20" fill="transparent" stroke="#38BDF8" strokeWidth="3" filter="url(#glowAzure24)" className="draw-pulse" />
      <polygon points="0,-25 35,-12 35,22 0,55 -35,22 -35,-12" fill="transparent" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />
      {/* Explanatory Texts Scaled Up */}
      <text x="0" y="-5" className="code font-bold" fill="#FFFFFF" textAnchor="middle" style={{ fontSize: "12px" }}>Mathematical</text>
      <text x="0" y="10" className="code font-bold" fill="#FFFFFF" textAnchor="middle" style={{ fontSize: "12px" }}>Proofs</text>
      <text x="0" y="27" className="code font-bold" fill="#38BDF8" textAnchor="middle" style={{ fontSize: "12px" }}>Bug-Free DeFi</text>
    </g>
    {/* Texto de pie */}
    <text x="150" y="140" className="code font-bold tracking-widest" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "14px" }} filter="url(#glowAzure24)">
      {t?.ecosistema?.graphics?.g24_secure || "MILITARY GRADE SECURITY"}
    </text>
  </svg>
);

export const Graphic25 = ({ t: _t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink25">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed25"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan25"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold25"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple25"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald25"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine25" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink25" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient25" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <g transform="translate(150, 60)">
      <g className="draw-spin">
        <circle
          cx="0"
          cy="0"
          r="55"
          fill="transparent"
          stroke="#64748B"
          strokeWidth="3"
          strokeDasharray="4 8"
        />
        <circle
          cx="-39"
          cy="-39"
          r="6"
          fill="#FBBF24"
          filter="url(#glowGold25)"
        />
        <circle
          cx="39"
          cy="39"
          r="6"
          fill="#FBBF24"
          filter="url(#glowGold25)"
        />
        <circle cx="-55" cy="0" r="6" fill="#FBBF24" />
        <circle cx="55" cy="0" r="6" fill="#FBBF24" filter="url(#glowGold25)" />
      </g>
    </g>
    <text
      x="150"
      y="70"
      className="card-title font-bold tracking-widest"
      fill="#FBBF24"
      textAnchor="middle"
      style={{ fontSize: "28px" }}
    >
      2^256
    </text>
  </svg>
);

export const Graphic26 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowPurple26"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowEmerald26"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowPink26"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowCyan26"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    {/* Vanishing Horizon Perspective */}
    <g transform="translate(150, 80)">
      {/* Horizon origin point WITHOUT black background */}
      <circle cx="0" cy="-60" r="10" fill="transparent" stroke="#00F0FF" strokeWidth="2" filter="url(#glowCyan26)" />
      <line x1="-150" y1="-60" x2="150" y2="-60" stroke="#00F0FF" strokeWidth="1" strokeDasharray="4" />
      <text x="0" y="-75" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "16px" }}>HORIZON SCALING</text>

      {/* Lane 1 - Static path */}
      <path d="M 0 -60 L -120 100 M 0 -60 L -60 100" fill="none" stroke="#A855F7" strokeWidth="2" opacity="0.6" />
      <path d="M 0 -60 L -90 100" fill="none" stroke="#A855F7" strokeWidth="3" opacity="0.4" />

      {/* Circle traveling Lane 1 */}
      <circle cx="0" cy="0" r="6" fill="#A855F7" filter="url(#glowPurple26)">
        <animateTransform attributeName="transform" type="translate" values="0,-60; -90,100" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; 0.1; 0.9; 1" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Lane 2 - Static path */}
      <path d="M 0 -60 L -25 100 M 0 -60 L 25 100" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.6" />
      <path d="M 0 -60 L 0 100" fill="none" stroke="#10B981" strokeWidth="3" opacity="0.4" />

      {/* Circle traveling Lane 2 */}
      <circle cx="0" cy="0" r="7" fill="#10B981" filter="url(#glowEmerald26)">
        <animateTransform attributeName="transform" type="translate" values="0,-60; 0,100" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; 0.1; 0.9; 1" dur="1.5s" repeatCount="indefinite" />
      </circle>

      {/* Lane 3 - Static path */}
      <path d="M 0 -60 L 60 100 M 0 -60 L 120 100" fill="none" stroke="#F472B6" strokeWidth="2" opacity="0.6" />
      <path d="M 0 -60 L 90 100" fill="none" stroke="#F472B6" strokeWidth="3" opacity="0.4" />

      {/* Circle traveling Lane 3 */}
      <circle cx="0" cy="0" r="6" fill="#F472B6" filter="url(#glowPink26)">
        <animateTransform attributeName="transform" type="translate" values="0,-60; 90,100" dur="2.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; 0.1; 0.9; 1" dur="2.3s" repeatCount="indefinite" />
      </circle>

      {/* Horizontal grids for perspective */}
      <path d="M -20 -30 L 20 -30 M -50 0 L 50 0 M -80 30 L 80 30" fill="none" stroke="#334155" strokeWidth="1" opacity="0.4" />
    </g>
  </svg>
);

export const Graphic27 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan27"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowEmerald27"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowPink27"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate(10, 40)" scale="1.15">
      {/* DNA Triple Helix — filter= moved to inner <g> wrappers so the
          draw-swift <g> itself has no filter and can be GPU-composited */}
      <g>
        <g filter="url(#glowCyan27)"><path d="M 0 0 Q 30 -80, 60 0 T 120 0 T 180 0 T 240 0 T 300 0" fill="none" stroke="#00F0FF" strokeWidth="4" opacity="0.8" className="draw-swift" /></g>
        <g filter="url(#glowEmerald27)"><path d="M 0 40 Q 30 -40, 60 40 T 120 40 T 180 40 T 240 40 T 300 40" fill="none" stroke="#10B981" strokeWidth="4" opacity="0.8" className="draw-swift" /></g>
        <g filter="url(#glowPink27)"><path d="M 0 -40 Q 30 40, 60 -40 T 120 -40 T 180 -40 T 240 -40 T 300 -40" fill="none" stroke="#F472B6" strokeWidth="4" opacity="0.8" className="draw-swift" /></g>
      </g>

      {/* Decorative joining bridges (hydrogen bonds) */}
      <g stroke="#334155" strokeWidth="2" opacity="0.7">
        <line x1="30" y1="-40" x2="30" y2="40" />
        <line x1="90" y1="-40" x2="90" y2="40" />
        <line x1="150" y1="-40" x2="150" y2="40" />
        <line x1="210" y1="-40" x2="210" y2="40" />
        <line x1="270" y1="-40" x2="270" y2="40" />
      </g>

      {/* Legend Scaled Up - Rendered AFTER Helix so it sits ON TOP */}
      <g transform="translate(-10, 75)">
        <circle cx="15" cy="20" r="6" fill="#00F0FF" filter="url(#glowCyan27)" />
        <text x="30" y="25" className="code font-bold" fill="#00F0FF" style={{ fontSize: "12px" }}>PROPOSE</text>

        <circle cx="145" cy="20" r="6" fill="#10B981" filter="url(#glowEmerald27)" />
        <text x="160" y="25" className="code font-bold" fill="#10B981" style={{ fontSize: "12px" }}>PREPARE</text>

        <circle cx="265" cy="20" r="6" fill="#F472B6" filter="url(#glowPink27)" />
        <text x="280" y="25" className="code font-bold" fill="#F472B6" style={{ fontSize: "12px" }}>COMMIT</text>
      </g>
    </g>
  </svg>
);

export const Graphic28 = ({ t: t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowPink28"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowCyan28"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowGreen28"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    {/* Scaled up Academic / Microscope design */}
    <g transform="translate(150, 40) scale(1.3)">
      {/* Background Peer Review Network (Researchers Nodes) */}
      <g opacity="0.4" stroke="#00F0FF" strokeWidth="1.5">
        <path d="M -80 -40 L -50 0 L -80 40 M 80 -40 L 50 0 L 80 40 M -50 0 L 50 0 M -30 -60 L 0 0 L 30 -60 M -30 60 L 0 0 L 30 60" fill="none" strokeDasharray="3" className="draw-pulse" />
        <circle cx="-80" cy="-40" r="6" fill="#00F0FF" />
        <circle cx="80" cy="-40" r="6" fill="#00F0FF" />
        <circle cx="-80" cy="40" r="6" fill="#00F0FF" />
        <circle cx="80" cy="40" r="6" fill="#00F0FF" />
        <circle cx="-30" cy="-60" r="6" fill="#00F0FF" />
        <circle cx="30" cy="-60" r="6" fill="#00F0FF" />
        <circle cx="-30" cy="60" r="6" fill="#00F0FF" />
        <circle cx="30" cy="60" r="6" fill="#00F0FF" />
      </g>

      <circle cx="0" cy="0" r="30" fill="transparent" stroke="#1E293B" strokeWidth="2" strokeDasharray="2 6" className="draw-spin" />

      {/* Magnifying Glass overlay without dark background inner */}
      <g className="draw-float">
        <circle cx="0" cy="0" r="28" fill="transparent" stroke="#00F0FF" strokeWidth="4" filter="url(#glowCyan28)" />
        {/* Removed the weird X/handle to avoid confusion */}

        {/* "Approved" Stamp / Check inside */}
        <path
          d="M -11.1,1.2 L -7.8,1.2 L -2.7,8.7 L 4.5,-8.7 L 11.1,-8.7"
          fill="transparent"
          stroke="#10B981"
          strokeWidth="4"
          filter="url(#glowGreen28)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="0" y="25" className="code font-bold" fill="#10B981" textAnchor="middle" style={{ fontSize: "12px" }} filter="url(#glowGreen28)">PEER REVIEWED</text>
      </g>
    </g>
    <text x="150" y="160" className="code font-bold tracking-widest" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "15px" }} filter="url(#glowCyan28)">
      {t?.ecosistema?.graphics?.g28_peer || "CASSANDRA RESEARCH LABS"}
    </text>
  </svg>
);

export const Graphic29 = ({ t: t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink29">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed29"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan29"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold29"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple29"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald29"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine29" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink29" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient29" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <g transform="translate(90, 60)">
      <g className="draw-swap1">
        <rect
          x="-40"
          y="-25"
          width="80"
          height="50"
          rx="8"
          fill="transparent"
          stroke="#FBBF24"
          strokeWidth="3"
        />
        <text
          x="0"
          y="6"
          className="code font-bold"
          fill="#FBBF24"
          textAnchor="middle"
          style={{ fontSize: "18px" }}
        >
          {t?.ecosistema?.graphics?.g29_bond || "BONO"}
        </text>
      </g>
    </g>
    <g transform="translate(210, 60)">
      <g className="draw-swap2">
        <rect
          x="-40"
          y="-25"
          width="80"
          height="50"
          rx="8"
          fill="transparent"
          stroke="#00F0FF"
          strokeWidth="3"
        />
        <text
          x="0"
          y="6"
          className="code font-bold"
          fill="#00F0FF"
          textAnchor="middle"
          style={{ fontSize: "18px" }}
        >
          {t?.ecosistema?.graphics?.g29_cbdc || "CBDC"}
        </text>
      </g>
    </g>
    <path
      d="M 130 50 L 170 50 M 130 70 L 170 70"
      stroke="#64748B"
      strokeWidth="4"
    />
  </svg>
);

export const Graphic30 = ({ t }: GraphicProps) => (
  <svg
    viewBox="-30 -30 360 180"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="radix-svg-graphic overflow-visible"
  >
    <defs>
      <filter id="glowRed30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowCyan30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGold30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPurple30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowEmerald30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowPink30">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker
        id="arrowRed30"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#EF4444" />
      </marker>
      <marker
        id="arrowCyan30"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00F0FF" />
      </marker>
      <marker
        id="arrowGold30"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#FBBF24" />
      </marker>
      <marker
        id="arrowPurple30"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#B026FF" />
      </marker>
      <marker
        id="arrowEmerald30"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 8 4, 0 8" fill="#00FFA3" />
      </marker>
      <linearGradient id="chartLine30" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BE185D" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id="neonPink30" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE185D" />
      </linearGradient>
      <linearGradient id="redGradient30" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
    </defs>

    <text
      x="150"
      y="-15"
      className="code font-bold tracking-widest"
      fill="#EC4899"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
      filter="url(#glowPink30)"
    >
      {t?.ecosistema?.graphics?.g30_infinite || "LINEAL SCALABILITY"}
    </text>
    <line
      x1="45"
      y1="110"
      x2="280"
      y2="110"
      stroke="var(--color-border)"
      strokeWidth="2"
      opacity="0.5"
    />
    <line
      x1="45"
      y1="110"
      x2="45"
      y2="20"
      stroke="var(--color-border)"
      strokeWidth="2"
      opacity="0.5"
    />
    <text
      x="160"
      y="145"
      className="code opacity-70"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      {t?.ecosistema?.graphics?.g30_nodes || "Active Shard Groups / Nodes"}
    </text>
    <text
      x="20"
      y="70"
      className="code opacity-70"
      textAnchor="middle"
      transform="rotate(-90 20,70)"
      style={{ fontSize: "21px" }}
    >
      {t?.ecosistema?.graphics?.g30_tps || "TPS"}
    </text>
    <g filter="url(#glowPink30)">
    <path
      d="M 45 110 L 120 85 L 195 60 L 270 35"
      fill="none"
      stroke="url(#chartLine30)"
      strokeWidth="5"
      className="draw-wave2"
    />
    </g>
    <circle
      cx="120"
      cy="85"
      r="5"
      fill="transparent"
      stroke="#EC4899"
      strokeWidth="3"
      className="draw-pulse"
    />
    <text
      x="100"
      y="70"
      className="code font-bold"
      fill="#F8FAFC"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      {t?.ecosistema?.graphics?.g30_10k || "10k"}
    </text>
    <circle
      cx="195"
      cy="60"
      r="5"
      fill="transparent"
      stroke="#EC4899"
      strokeWidth="3"
      className="draw-pulse"
      style={{ animationDelay: "0.2s" }}
    />
    <text
      x="175"
      y="45"
      className="code font-bold"
      fill="#F8FAFC"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
    >
      {t?.ecosistema?.graphics?.g30_100k || "100k"}
    </text>
    <circle
      cx="270"
      cy="35"
      r="6"
      fill="transparent"
      stroke="#EC4899"
      strokeWidth="4"
      className="draw-pulse"
      style={{ animationDelay: "0.4s" }}
    />
    <text
      x="250"
      y="20"
      className="code font-bold"
      fill="#EC4899"
      textAnchor="middle"
      style={{ fontSize: "14px" }}
      filter="url(#glowPink30)"
    >
      {t?.ecosistema?.graphics?.g30_limit || "UNLIMITED"}
    </text>
  </svg>
);

export const Graphic31 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowCyan31"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <g transform="translate(150, 30)" scale="1.4">
      {/* Refined, structured interconnected mesh */}
      <g opacity="0.9">
        {/* Core Connections */}
        <path d="M 0 0 L -60 -40 M 0 0 L 60 -40 M 0 0 L -60 40 M 0 0 L 60 40 M 0 0 L 0 -60 M 0 0 L 0 60 L 0 0 L 80 0 L 0 0 L -80 0" fill="none" stroke="#00F0FF" strokeWidth="2" filter="url(#glowCyan31)" opacity="0.8" />

        {/* Outer Ring / Polygon */}
        <polygon points="0,-60 60,-40 80,0 60,40 0,60 -60,40 -80,0 -60,-40" fill="transparent" stroke="#00F0FF" strokeWidth="1" strokeDasharray="3" className="draw-spin" opacity="0.6" />
        <polygon points="0,-30 30,-20 40,0 30,20 0,30 -30,20 -40,0 -30,-20" fill="transparent" stroke="#00F0FF" strokeWidth="1.5" className="draw-pulse" opacity="0.7" />

        {/* Outer Nodes */}
        {[-60, 0, 60].map(x => [-40, 40].map(y => (x !== 0) && <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#00F0FF" filter="url(#glowCyan31)" />))}
        <circle cx="0" cy="-60" r="5" fill="#00F0FF" filter="url(#glowCyan31)" />
        <circle cx="0" cy="60" r="5" fill="#00F0FF" filter="url(#glowCyan31)" />
        <circle cx="80" cy="0" r="5" fill="#00F0FF" filter="url(#glowCyan31)" />
        <circle cx="-80" cy="0" r="5" fill="#00F0FF" filter="url(#glowCyan31)" />

        {/* Medium Nodes */}
        {[-30, 0, 30].map(x => [-20, 20].map(y => (x !== 0) && <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill="#FFFFFF" />))}
        <circle cx="0" cy="-30" r="3" fill="#FFFFFF" />
        <circle cx="0" cy="30" r="3" fill="#FFFFFF" />
        <circle cx="40" cy="0" r="3" fill="#FFFFFF" />
        <circle cx="-40" cy="0" r="3" fill="#FFFFFF" />

        {/* Core Node */}
        <circle cx="0" cy="0" r="14" fill="transparent" stroke="#00F0FF" strokeWidth="3" filter="url(#glowCyan31)" className="draw-pulse" />
        <circle cx="0" cy="0" r="4" fill="#FFFFFF" />
      </g>
    </g>
    <text x="150" y="130" className="code font-bold tracking-widest" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "16px" }} filter="url(#glowCyan31)">
      NETWORK XI&apos;AN
    </text>
  </svg>
);

export const Graphic32 = ({ t: _t }: GraphicProps) => (
  <svg viewBox="-30 -30 360 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="radix-svg-graphic overflow-visible">
    <defs>
      <filter id="glowGold32"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowCyan32"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <g transform="translate(150, 70)" scale="1.4">
      {/* Triangle reverted to Green #10B981 */}
      <polygon points="0,-60 65,40 -65,40" fill="transparent" stroke="#10B981" strokeWidth="3" filter="url(#glowGold32)" className="draw-pulse" />

      {/* Vertices text SCALED UP Even More */}
      <text x="0" y="-75" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "13px" }}>Decentralization</text>
      <text x="90" y="60" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "13px" }}>Security</text>
      <text x="-90" y="60" className="code font-bold" fill="#00F0FF" textAnchor="middle" style={{ fontSize: "13px" }}>Scalability</text>

      {/* Nodes on vertices */}
      <circle cx="0" cy="-60" r="6" fill="#00F0FF" filter="url(#glowCyan32)" />
      <circle cx="65" cy="40" r="6" fill="#00F0FF" filter="url(#glowCyan32)" />
      <circle cx="-65" cy="40" r="6" fill="#00F0FF" filter="url(#glowCyan32)" />

      {/* Internal lines meeting at the solution (Radix Xi'an context) */}
      <g>
        <line x1="0" y1="-60" x2="0" y2="5" stroke="#EAB308" strokeWidth="2" strokeDasharray="4" opacity="0.8" className="draw-swift" />
        <line x1="65" y1="40" x2="0" y2="5" stroke="#EAB308" strokeWidth="2" strokeDasharray="4" opacity="0.8" className="draw-swift" />
        <line x1="-65" y1="40" x2="0" y2="5" stroke="#EAB308" strokeWidth="2" strokeDasharray="4" opacity="0.8" className="draw-swift" />
      </g>

      <circle cx="0" cy="5" r="10" fill="#EAB308" filter="url(#glowGold32)" />
      <text x="0" y="30" className="code font-bold" fill="#EAB308" textAnchor="middle" style={{ fontSize: "15px" }} filter="url(#glowGold32)">RADIX XI&apos;AN</text>
    </g>
  </svg>
);
