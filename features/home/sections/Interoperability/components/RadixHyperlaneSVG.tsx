
/**
 * Radix Hyperlane SVG component with theme-aware colors.
 * Renders an atomic orbital animation representing the Hyperlane interoperability layer.
 * All colors use CSS variables so they adapt to light/dark/custom themes.
 */
export default function RadixHyperlaneSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={`w-full h-full max-w-[600px] max-h-[600px] drop-shadow-[0_0_30px_rgba(0,180,255,0.1)] ${className}`}
    >
      <defs>
        <radialGradient id="hl-core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <filter id="hl-glow-atom">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Glow for text to improve legibility on both themes without dark smudging */}
        <filter id="hl-text-halo">
          <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="dilated" />
          <feGaussianBlur stdDeviation="2" in="dilated" result="blurred" />
          <feFlood floodColor="var(--color-bg)" result="bgColor" />
          <feComposite in="bgColor" in2="blurred" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Central Core with checkmark */}
      <g transform="translate(200, 200)">
        <circle cx="0" cy="0" r="70" fill="url(#hl-core-grad)" filter="url(#hl-glow-atom)" className="animate-pulse" />
        <path
          d="M -37,4 L -26,4 L -9,29 L 15,-29 L 37,-29"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.5"
          style={{ filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.2))' }}
        />
      </g>

      {/* Orbit 1: xBTC (cyan) */}
      <g transform="translate(200, 200) rotate(0)">
        <ellipse cx="0" cy="0" rx="170" ry="50" stroke="var(--color-secondary)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="8s" repeatCount="indefinite" path="M -170,0 A 170,50 0 1,0 170,0 A 170,50 0 1,0 -170,0" />
          <g transform="rotate(0)" filter="url(#hl-glow-atom)">
            <rect x="-24" y="-22" width="48" height="14" rx="7" fill="var(--color-secondary)" fillOpacity="0.2" stroke="var(--color-secondary)" strokeWidth="1" />
            <text x="0" y="-12" fontSize="9" textAnchor="middle" fill="var(--color-secondary)" fontWeight="bold" filter="url(#hl-text-halo)">xBTC</text>
            <circle r="10" fill="transparent" stroke="var(--color-secondary)" strokeWidth="2" />
            <text x="0" y="4" fontSize="13" textAnchor="middle" fill="var(--color-secondary)" fontWeight="bold">₿</text>
          </g>
        </g>
      </g>

      {/* Orbit 2: NFT (magenta/accent) */}
      <g transform="translate(200, 200) rotate(60)">
        <ellipse cx="0" cy="0" rx="150" ry="35" stroke="var(--color-accent, #da48ef)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="10s" repeatCount="indefinite" path="M -150,0 A 150,35 0 1,0 150,0 A 150,35 0 1,0 -150,0" />
          <g transform="rotate(-60)" filter="url(#hl-glow-atom)">
            <rect x="-20" y="-24" width="40" height="14" rx="7" fill="var(--color-accent, #da48ef)" fillOpacity="0.2" stroke="var(--color-accent, #da48ef)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-accent, #da48ef)" fontWeight="bold" filter="url(#hl-text-halo)">NFT</text>
            <rect x="-9" y="-9" width="18" height="18" rx="4" fill="transparent" stroke="var(--color-accent, #da48ef)" strokeWidth="2" />
            <path d="M -5,5 L 0,0 L 5,5" stroke="var(--color-accent, #da48ef)" strokeWidth="1.5" fill="none" />
            <circle cx="3" cy="-3" r="1.5" fill="var(--color-accent, #da48ef)" />
          </g>
        </g>
      </g>

      {/* Orbit 3: LOGIC (green/primary) */}
      <g transform="translate(200, 200) rotate(120)">
        <ellipse cx="0" cy="0" rx="180" ry="60" stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="9s" repeatCount="indefinite" path="M -180,0 A 180,60 0 1,0 180,0 A 180,60 0 1,0 -180,0" />
          <g transform="rotate(-120)" filter="url(#hl-glow-atom)">
            <rect x="-24" y="-24" width="48" height="14" rx="7" fill="var(--color-primary)" fillOpacity="0.2" stroke="var(--color-primary)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-primary)" fontWeight="bold" filter="url(#hl-text-halo)">LOGIC</text>
            <path d="M 0,-10 L 9,-5 L 9,5 L 0,10 L -9,5 L -9,-5 Z" fill="transparent" stroke="var(--color-primary)" strokeWidth="2" />
            <path d="M 0,-10 L 0,0 M 0,0 L 9,5 M 0,0 L -9,5" stroke="var(--color-primary)" strokeWidth="1" />
          </g>
        </g>
      </g>

      {/* Orbit 4: ID (blue/primary) */}
      <g transform="translate(200, 200) rotate(-60)">
        <ellipse cx="0" cy="0" rx="160" ry="40" stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="11s" repeatCount="indefinite" path="M -160,0 A 160,40 0 1,0 160,0 A 160,40 0 1,0 -160,0" />
          <g transform="rotate(60)" filter="url(#hl-glow-atom)">
            <rect x="-18" y="-24" width="36" height="14" rx="7" fill="var(--color-primary)" fillOpacity="0.2" stroke="var(--color-primary)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-primary)" fontWeight="bold" filter="url(#hl-text-halo)">ID</text>
            <path d="M -8,-9 L 8,-9 L 8,0 C 8,6 4,10 0,11 C -4,10 -8,6 -8,0 Z" fill="transparent" stroke="var(--color-primary)" strokeWidth="2" />
            <path d="M 0,-4 L 0,4 M -3,0 L 3,0" stroke="var(--color-primary)" strokeWidth="1.5" />
          </g>
        </g>
      </g>

      {/* Orbit 5: DEFI (yellow/secondary) */}
      <g transform="translate(200, 200) rotate(180)">
        <ellipse cx="0" cy="0" rx="190" ry="55" stroke="var(--color-secondary)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="12s" repeatCount="indefinite" path="M -190,0 A 190,55 0 1,0 190,0 A 190,55 0 1,0 -190,0" />
          <g transform="rotate(-180)" filter="url(#hl-glow-atom)">
            <rect x="-22" y="-24" width="44" height="14" rx="7" fill="var(--color-secondary)" fillOpacity="0.2" stroke="var(--color-secondary)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-secondary)" fontWeight="bold" stroke="var(--color-bg)" strokeWidth="3" style={{ paintOrder: 'stroke' }}>DEFI</text>
            <circle r="11" fill="transparent" stroke="var(--color-secondary)" strokeWidth="2" />
            <path d="M -6,4 L -2,0 L 2,4 L 6,-4" stroke="var(--color-secondary)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>

      {/* Orbit 6: DATA (accent/purple) */}
      <g transform="translate(200, 200) rotate(240)">
        <ellipse cx="0" cy="0" rx="140" ry="30" stroke="var(--color-accent, #a855f7)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="13s" repeatCount="indefinite" path="M -140,0 A 140,30 0 1,0 140,0 A 140,30 0 1,0 -140,0" />
          <g transform="rotate(-240)" filter="url(#hl-glow-atom)">
            <rect x="-22" y="-24" width="44" height="14" rx="7" fill="var(--color-accent, #a855f7)" fillOpacity="0.2" stroke="var(--color-accent, #a855f7)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-accent, #a855f7)" fontWeight="bold" filter="url(#hl-text-halo)">DATA</text>
            <path d="M -8,-6 C -8,-8 8,-8 8,-6 L 8,6 C 8,8 -8,8 -8,6 Z" fill="transparent" stroke="var(--color-accent, #a855f7)" strokeWidth="2" />
            <ellipse cx="0" cy="-6" rx="8" ry="2" fill="none" stroke="var(--color-accent, #a855f7)" strokeWidth="1" />
            <path d="M -8,0 C -8,2 8,2 8,0" fill="none" stroke="var(--color-accent, #a855f7)" strokeWidth="1" />
          </g>
        </g>
      </g>

      {/* Orbit 7: GAME (orange/secondary) */}
      <g transform="translate(200, 200) rotate(90)">
        <ellipse cx="0" cy="0" rx="130" ry="25" stroke="var(--color-secondary)" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        <g>
          <animateMotion dur="14s" repeatCount="indefinite" path="M -130,0 A 130,25 0 1,0 130,0 A 130,25 0 1,0 -130,0" />
          <g transform="rotate(-90)" filter="url(#hl-glow-atom)">
            <rect x="-22" y="-24" width="44" height="14" rx="7" fill="var(--color-secondary)" fillOpacity="0.2" stroke="var(--color-secondary)" strokeWidth="1" />
            <text x="0" y="-14" fontSize="9" textAnchor="middle" fill="var(--color-secondary)" fontWeight="bold" filter="url(#hl-text-halo)">GAME</text>
            <path d="M -10,-6 L 10,-6 C 12,-6 12,-4 12,0 C 12,4 8,6 6,6 L -6,6 C -8,6 -12,4 -12,0 C -12,-4 -12,-6 -10,-6 Z" fill="transparent" stroke="var(--color-secondary)" strokeWidth="2" />
            <path d="M -7,0 L -3,0 M -5,-2 L -5,2" stroke="var(--color-secondary)" strokeWidth="1.5" fill="none" />
            <circle cx="4" cy="-2" r="1" fill="var(--color-secondary)" />
            <circle cx="7" cy="1" r="1" fill="var(--color-secondary)" />
          </g>
        </g>
      </g>
    </svg>
  );
}