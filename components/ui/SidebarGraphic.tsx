'use client';

import { useTheme, Theme } from '@/context/ThemeContext';
import { useEffect, useState, useId } from 'react';

function getHtmlTheme(): Theme {
    if (typeof document === 'undefined') return 'radix-dark';
    const cls = document.documentElement.className;
    const themes: Theme[] = ['radix-dark', 'radix-light', 'oro-dark', 'oro-light', 'radix-original-light', 'radix-original-dark'];
    return themes.find(t => cls.includes(t)) ?? 'radix-dark';
}

interface SidebarGraphicProps {
    appName: string;
    title: string;
    subtitle: string;
    badgeLabel?: string;
    idPrefix?: string;
    variant: 'default' | 'games' | 'community' | 'docs' | 'infrastructure' | 'developers' | 'academy' | 'roadmap';
}

export const SidebarGraphic = ({
    appName,
    title,
    subtitle,
    badgeLabel: _badgeLabel,
    variant,
    idPrefix = 'sidebar',
}: SidebarGraphicProps) => {
    const { theme: ctxTheme } = useTheme();

    const [safeTheme, setSafeTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') return getHtmlTheme();
        return ctxTheme ?? 'radix-oscuro';
    });

    useEffect(() => {
        setSafeTheme(ctxTheme ?? getHtmlTheme());
    }, [ctxTheme]);
    const reactId = useId().replace(/:/g, ''); // SVG IDs shouldn't have colons just in case
    const id = `${idPrefix}-${safeTheme}-${reactId}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 560"
            suppressHydrationWarning
            className="w-full h-auto"
            style={{ display: 'block' }}
            aria-hidden="true"
        >
            <defs>
                {/* Background radial glows */}
                <radialGradient id={`bgA-${id}`} cx="10%" cy="10%" r="70%">
                    <stop offset="0%" stopColor="var(--sidebar-secondary)" stopOpacity="var(--sidebar-glow-op-1)" />
                    <stop offset="60%" stopColor="var(--sidebar-secondary)" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="var(--sidebar-bg)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`bgB-${id}`} cx="90%" cy="90%" r="80%">
                    <stop offset="0%" stopColor="var(--sidebar-primary)" stopOpacity="var(--sidebar-glow-op-2)" />
                    <stop offset="50%" stopColor="var(--sidebar-primary)" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="var(--sidebar-bg)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`bgC-${id}`} cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="var(--sidebar-primary)" stopOpacity="var(--sidebar-glow-op-3)" />
                    <stop offset="100%" stopColor="var(--sidebar-bg)" stopOpacity="0" />
                </radialGradient>

                {/* Card gradients */}
                <linearGradient id={`cardFront-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--sidebar-grad1)" />
                    <stop offset="45%" stopColor="var(--sidebar-grad-mid)" />
                    <stop offset="100%" stopColor="var(--sidebar-grad2)" />
                </linearGradient>
                <linearGradient id={`cardShadow-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--sidebar-shadow)" />
                    <stop offset="100%" stopColor="var(--sidebar-shadow2)" />
                </linearGradient>

                {/* Text gradient for title */}
                <linearGradient id={`textGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--sidebar-primary)" />
                    <stop offset="100%" stopColor="var(--sidebar-secondary)" />
                </linearGradient>

                {/* Filters */}
                <filter id={`glowSoft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id={`blurFar-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" />
                </filter>
                <filter id={`blurExtreme-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="12" />
                </filter>

                {/* Glass sphere gradients */}
                <radialGradient id={`sphereA-${id}`} cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="15%" stopColor="#ffffff" stopOpacity="0.1" />
                    <stop offset="70%" stopColor="var(--sidebar-primary)" stopOpacity="0.1" />
                    <stop offset="95%" stopColor="var(--sidebar-primary)" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="var(--sidebar-primary)" stopOpacity="0.9" />
                </radialGradient>
                <radialGradient id={`sphereB-${id}`} cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="15%" stopColor="#ffffff" stopOpacity="0.1" />
                    <stop offset="70%" stopColor="var(--sidebar-secondary)" stopOpacity="0.1" />
                    <stop offset="95%" stopColor="var(--sidebar-secondary)" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="var(--sidebar-secondary)" stopOpacity="0.9" />
                </radialGradient>
            </defs>

            {/* ── BACKGROUND ── */}
            <rect width="1200" height="560" fill="var(--sidebar-bg)" />
            <rect width="1200" height="560" fill={`url(#bgA-${id})`} />
            <rect width="1200" height="560" fill={`url(#bgB-${id})`} />
            <rect width="1200" height="560" fill={`url(#bgC-${id})`} />

            {/* ── DEEP BACKGROUND LAYER (blurred) ── */}
            <g filter={`url(#blurFar-${id})`} opacity="0.55">
                <path d="M 100,50 L 300,150 L 350,100 M 400,400 L 600,500 L 800,400 M 800,100 L 1000,200 L 1100,150"
                    fill="none" stroke="var(--sidebar-primary)" strokeWidth="2" opacity="0.3" />
                <g transform="translate(200,100) scale(1.2)">
                    <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-primary)" fillOpacity="0.12" stroke="white" strokeWidth="0.8" />
                    <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-primary)" fillOpacity="0.08" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                    <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-primary)" fillOpacity="0.22" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                </g>
                <g transform="translate(900,450) scale(1.5)">
                    <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-secondary)" fillOpacity="0.12" stroke="white" strokeWidth="0.8" />
                    <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-secondary)" fillOpacity="0.08" stroke="var(--sidebar-secondary)" strokeWidth="0.8" />
                    <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-secondary)" fillOpacity="0.22" stroke="var(--sidebar-secondary)" strokeWidth="0.8" />
                </g>
                <g transform="translate(600,50) scale(0.8)">
                    <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-primary)" fillOpacity="0.12" stroke="white" strokeWidth="0.8" />
                    <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-primary)" fillOpacity="0.08" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                    <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-primary)" fillOpacity="0.22" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                </g>
                <g transform="translate(400,80) scale(1.5)">
                    <circle r="15" fill={`url(#sphereB-${id})`} />
                    <circle cx="-5" cy="-5" r="3" fill="#fff" opacity="0.7" filter={`url(#glowSoft-${id})`} />
                </g>
                <g transform="translate(800,500) scale(2)">
                    <circle r="15" fill={`url(#sphereA-${id})`} />
                    <circle cx="-5" cy="-5" r="3" fill="#fff" opacity="0.7" filter={`url(#glowSoft-${id})`} />
                </g>
            </g>

            {/* ── NETWORK LINES ── */}
            <g fill="none" strokeLinejoin="round" opacity="0.8">
                <g stroke="var(--sidebar-primary)" strokeWidth="0.8">
                    <path d="M 0,220 L 120,220 L 180,250 L 280,250 L 320,300 L 400,300 L 440,250 L 520,250" />
                    <path d="M 60,320 L 150,320 L 200,380 L 350,380 L 400,440 L 550,440 L 620,500" />
                    <path d="M 280,250 L 280,180 L 350,140 L 450,140 L 500,180 L 650,180" />
                    <path d="M 400,300 L 400,380" />
                    <path d="M 440,250 L 440,140 L 550,80 L 700,80 L 750,130" />
                    <path d="M 520,250 L 600,250 L 650,300 L 800,300 L 850,250 L 1000,250" />
                    <path d="M 350,380 L 350,480 L 450,540" />
                    <path d="M 650,300 L 650,400 L 750,450 L 900,450 L 980,380 L 1150,380" />
                    <path d="M 800,300 L 800,180 L 900,120 L 1050,120 L 1100,160" />
                </g>
                <g stroke="var(--sidebar-net-secondary)" strokeWidth="0.8" opacity="0.9">
                    <path d="M 100,150 L 200,150 L 250,200 L 380,200 L 420,150 L 500,150" />
                    <path d="M 180,250 L 180,350 L 250,400 L 400,400" />
                    <path d="M 380,200 L 380,300 L 480,350 L 600,350 L 650,400 L 800,400" />
                    <path d="M 600,350 L 600,220 L 700,160 L 850,160 L 900,220 L 1050,220" />
                    <path d="M 850,160 L 850,80 L 950,50 L 1100,50" />
                    <path d="M 750,450 L 750,530" />
                    <path d="M 980,380 L 980,480 L 1100,540" />
                </g>
                <g stroke="var(--sidebar-net-thick)" strokeWidth="2" filter={`url(#glowSoft-${id})`}>
                    <path d="M 120,220 L 180,250" opacity="0.8" />
                    <path d="M 350,140 L 450,140" opacity="0.5" />
                    <path d="M 600,350 L 650,400" opacity="0.7" />
                    <path d="M 850,250 L 1000,250" opacity="0.4" />
                    <path d="M 200,380 L 350,380" opacity="0.6" />
                </g>
            </g>

            {/* ── NETWORK NODES ── */}
            <g>
                {([
                    [120, 220], [280, 250], [280, 180], [350, 140], [450, 140], [320, 300],
                    [400, 300], [440, 250], [550, 80], [700, 80], [520, 250], [650, 300],
                    [800, 300], [850, 250], [1000, 250], [60, 320], [150, 320], [200, 380],
                    [400, 440], [550, 440], [620, 500], [650, 400], [750, 450], [900, 450],
                    [980, 380], [900, 120], [1050, 120],
                ] as number[][]).map(([x, y], i) => (
                    <g key={`pn-${i}`} filter={`url(#glowSoft-${id})`}>
                        <circle cx={x} cy={y} r="2.5" fill="var(--sidebar-primary)" />
                        <circle cx={x} cy={y} r="1" fill="var(--sidebar-node-fill)" />
                    </g>
                ))}
                {([
                    [100, 150], [200, 150], [250, 200], [380, 200], [500, 150], [180, 250],
                    [180, 350], [250, 400], [400, 400], [380, 300], [480, 350], [600, 350],
                    [800, 400], [600, 220], [700, 160], [850, 160], [900, 220], [1050, 220],
                    [850, 80], [950, 50], [980, 480],
                ] as number[][]).map(([x, y], i) => (
                    <g key={`sn-${i}`} filter={`url(#glowSoft-${id})`}>
                        <circle cx={x} cy={y} r="2.5" fill="var(--sidebar-secondary)" />
                        <circle cx={x} cy={y} r="1" fill="var(--sidebar-node-fill)" />
                    </g>
                ))}
            </g>

            {/* ── MIDGROUND CUBES & ORBS ── */}
            <g>
                {([
                    { x: 96, y: 316, s: 1.2 }, { x: 300, y: 280, s: 0.8 },
                    { x: 420, y: 150, s: 1.1 }, { x: 650, y: 400, s: 1.4 },
                    { x: 380, y: 440, s: 1.2 }, { x: 1000, y: 450, s: 1.0 },
                    { x: 1100, y: 160, s: 0.8 },
                ]).map(({ x, y, s }, i) => (
                    <g key={`cc-${i}`} transform={`translate(${x},${y}) scale(${s})`}>
                        <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-primary)" fillOpacity="0.13" stroke="white" strokeWidth="0.8" />
                        <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-primary)" fillOpacity="0.08" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                        <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-primary)" fillOpacity="0.22" stroke="var(--sidebar-primary)" strokeWidth="0.8" />
                        <circle cx="0" cy="4" r="2" fill="white" filter={`url(#glowSoft-${id})`} />
                        <path d="M 0,4 L 0,24" stroke="var(--sidebar-primary)" strokeWidth="1.5" opacity="0.5" />
                    </g>
                ))}
                {([
                    { x: 200, y: 150, s: 1.0 }, { x: 500, y: 350, s: 1.0 },
                    { x: 700, y: 160, s: 0.9 }, { x: 900, y: 220, s: 1.1 },
                ]).map(({ x, y, s }, i) => (
                    <g key={`sc-${i}`} transform={`translate(${x},${y}) scale(${s})`}>
                        <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-secondary)" fillOpacity="0.13" stroke="white" strokeWidth="0.8" />
                        <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-secondary)" fillOpacity="0.08" stroke="var(--sidebar-secondary)" strokeWidth="0.8" />
                        <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-secondary)" fillOpacity="0.22" stroke="var(--sidebar-secondary)" strokeWidth="0.8" />
                        <circle cx="0" cy="4" r="2" fill="white" filter={`url(#glowSoft-${id})`} />
                        <path d="M 0,4 L 0,24" stroke="var(--sidebar-secondary)" strokeWidth="1.5" opacity="0.5" />
                    </g>
                ))}
                <g transform="translate(60,220) scale(0.9)">
                    <circle r="15" fill={`url(#sphereA-${id})`} />
                    <circle cx="-5" cy="-5" r="3" fill="white" opacity="0.8" filter={`url(#glowSoft-${id})`} />
                </g>
                <g transform="translate(550,100) scale(0.8)">
                    <circle r="15" fill={`url(#sphereB-${id})`} />
                    <circle cx="-5" cy="-5" r="3" fill="white" opacity="0.8" filter={`url(#glowSoft-${id})`} />
                </g>
                <g transform="translate(800,400) scale(0.8)">
                    <circle r="15" fill={`url(#sphereA-${id})`} />
                    <circle cx="-5" cy="-5" r="3" fill="white" opacity="0.8" filter={`url(#glowSoft-${id})`} />
                </g>
                {([[395, 130], [475, 325], [680, 145]] as number[][]).map(([x, y], i) => (
                    <g key={`lock-${i}`} transform={`translate(${x},${y})`}>
                        <rect x="-6" y="-2" width="12" height="10" rx="1.5" fill="var(--sidebar-primary)" fillOpacity="0.55" stroke="var(--sidebar-primary)" strokeWidth="1" />
                        <path d="M -3,-2 L -3,-4 A 3 3 0 0 1 3 -4 L 3,-2" fill="none" stroke="var(--sidebar-primary)" strokeWidth="1.5" />
                        <circle cx="0" cy="3" r="1.5" fill="white" />
                        <line x1="0" y1="3" x2="0" y2="6" stroke="white" strokeWidth="1.5" />
                    </g>
                ))}
            </g>

            {/* ── FOREGROUND BLUR DEPTH-OF-FIELD ── */}
            <g filter={`url(#blurExtreme-${id})`} opacity="0.65">
                <g transform="translate(-10,50) scale(2)">
                    <circle r="15" fill={`url(#sphereB-${id})`} />
                </g>
                <g transform="translate(30,520) scale(3)">
                    <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-primary)" fillOpacity="0.3" />
                    <polygon points="-18,-6 0,4 0,24 -18,14" fill="var(--sidebar-primary)" fillOpacity="0.4" />
                </g>
                <g transform="translate(1150,480) scale(2.5)">
                    <polygon points="0,-16 18,-6 0,4 -18,-6" fill="var(--sidebar-secondary)" fillOpacity="0.3" />
                    <polygon points="18,-6 18,14 0,24 0,4" fill="var(--sidebar-secondary)" fillOpacity="0.4" />
                </g>
                <g transform="translate(1200,80) scale(3)">
                    <circle r="15" fill={`url(#sphereA-${id})`} />
                </g>
                <path d="M -50,150 L 300,300" stroke="var(--sidebar-secondary)" strokeWidth="8" opacity="0.25" />
            </g>

            {/* ── TYPOGRAPHY ── */}
            <g transform="translate(80, 145)">
                <text
                    x="0" y="0"
                    fontSize="44" fontWeight="700"
                    fill="var(--sidebar-text-main)"
                    letterSpacing="0.5"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                >
                    {appName}
                </text>
                <text
                    x="0" y="130"
                    fontSize="70" fontWeight="800"
                    fill={`url(#textGrad-${id})`}
                    letterSpacing="1"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                >
                    {title}
                </text>
                <text
                    x="0" y="195"
                    fontSize="40" fontWeight="400"
                    fill="var(--sidebar-text-main)"
                    opacity="0.7"
                    letterSpacing="0.5"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                >
                    {subtitle}
                </text>
            </g>



            {/* ── RIGHT-SIDE GRAPHIC ── */}
            {variant === 'games' && (
                /* Energy Sphere with DNA helices and orbits — from RadixGames.svg */
                <g transform="translate(850, 280) scale(0.42) translate(-600, -400)">
                    {/* Back orbits */}
                    <g transform="rotate(12 600 400)" opacity="0.6">
                        <ellipse cx="600" cy="400" rx="580" ry="260" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="2" filter={`url(#glowSoft-${id})`} />
                        <ellipse cx="600" cy="400" rx="583" ry="263" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="2.5" transform="rotate(1 600 400)" filter={`url(#glowSoft-${id})`} />
                    </g>
                    <g transform="rotate(-8 600 400)" opacity="0.65">
                        <ellipse cx="600" cy="400" rx="500" ry="200" fill="none" stroke="var(--sidebar-primary)" strokeWidth="1.5" filter={`url(#glowSoft-${id})`} />
                        <ellipse cx="600" cy="400" rx="504" ry="204" fill="none" stroke="var(--sidebar-primary)" strokeWidth="2.5" transform="rotate(1.5 600 400)" filter={`url(#glowSoft-${id})`} />
                    </g>

                    {/* Plasma core */}
                    <defs>
                        <radialGradient id={`plasma-${id}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                            <stop offset="20%" stopColor="#e0ffff" stopOpacity="0.95" />
                            <stop offset="45%" stopColor="var(--sidebar-primary)" stopOpacity="0.85" />
                            <stop offset="70%" stopColor="var(--sidebar-secondary)" stopOpacity="0.65" />
                            <stop offset="90%" stopColor="var(--sidebar-bg)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id={`plasmaMask-${id}`} cx="50%" cy="50%" r="50%">
                            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                            <stop offset="98%" stopColor="#ffffff" stopOpacity="0" />
                        </radialGradient>
                        <mask id={`sphereMask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="800">
                            <circle cx="600" cy="400" r="390" fill={`url(#plasmaMask-${id})`} />
                        </mask>
                        <filter id={`intenseGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="24" result="blur1" />
                            <feGaussianBlur stdDeviation="12" result="blur2" />
                            <feMerge><feMergeNode in="blur1" /><feMergeNode in="blur2" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    <circle cx="600" cy="400" r="390" fill={`url(#plasma-${id})`} filter={`url(#intenseGlow-${id})`} />

                    {/* DNA helices inside the sphere */}
                    <g mask={`url(#sphereMask-${id})`} opacity="1">
                        <g transform="translate(600, 400)">
                            {/* Deep layer */}
                            {[20, -40, 110, 75, -130, 15].map((rot, i) => (
                                <g key={`dna-d-${i}`} transform={`rotate(${rot}) scale(${1.1 + i * 0.08})`} opacity={0.4 + i * 0.02}>
                                    <path d="M -600,0 C -525,60 -425,-60 -350,0 C -275,60 -175,-60 -100,0 C -25,60 75,-60 150,0 C 225,60 325,-60 400,0 C 475,60 575,-60 650,0" fill="none" stroke={i % 2 === 0 ? "var(--sidebar-secondary)" : "var(--sidebar-primary)"} strokeWidth="1.8" />
                                    <path d="M -600,0 C -525,-60 -425,60 -350,0 C -275,-60 -175,60 -100,0 C -25,-60 75,60 150,0 C 225,-60 325,60 400,0 C 475,-60 575,60 650,0" fill="none" stroke={i % 2 === 0 ? "var(--sidebar-primary)" : "var(--sidebar-secondary)"} strokeWidth="1.8" />
                                </g>
                            ))}
                            {/* Front layer */}
                            {[-15, 55, -70, 160, -115, -90, 135, 5, -35, 30, -55, 105, -165].map((rot, i) => (
                                <g key={`dna-f-${i}`} transform={`rotate(${rot}) scale(${1.2 + (i % 4) * 0.1})`} opacity={0.75 + (i % 3) * 0.08}>
                                    <path d="M -600,0 C -525,60 -425,-60 -350,0 C -275,60 -175,-60 -100,0 C -25,60 75,-60 150,0 C 225,60 325,-60 400,0 C 475,60 575,-60 650,0" fill="none" stroke={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "var(--sidebar-primary)" : "var(--sidebar-secondary)"} strokeWidth={i < 3 ? '2.2' : '1.8'} filter={`url(#glowSoft-${id})`} />
                                    <path d="M -600,0 C -525,-60 -425,60 -350,0 C -275,-60 -175,60 -100,0 C -25,-60 75,60 150,0 C 225,-60 325,60 400,0 C 475,-60 575,60 650,0" fill="none" stroke={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "var(--sidebar-secondary)" : "var(--sidebar-primary)"} strokeWidth={i < 3 ? '2.2' : '1.8'} filter={`url(#glowSoft-${id})`} />
                                </g>
                            ))}
                        </g>
                    </g>

                    {/* Core white hot spots */}
                    <circle cx="600" cy="400" r="150" fill="#ffffff" opacity="0.25" filter={`url(#intenseGlow-${id})`} />
                    <circle cx="600" cy="400" r="60" fill="#ffffff" opacity="0.4" filter={`url(#glowSoft-${id})`} />

                    {/* Front orbits */}
                    <g transform="rotate(-45 600 400)" opacity="0.95">
                        <ellipse cx="600" cy="400" rx="480" ry="320" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="2" filter={`url(#glowSoft-${id})`} opacity="0.8" />
                        <ellipse cx="600" cy="400" rx="484" ry="324" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="3" transform="rotate(1.5 600 400)" filter={`url(#glowSoft-${id})`} />
                    </g>
                    <g transform="rotate(-140 600 400)" opacity="0.95">
                        <ellipse cx="600" cy="410" rx="580" ry="260" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="2" filter={`url(#glowSoft-${id})`} />
                        <ellipse cx="600" cy="405" rx="585" ry="265" fill="none" stroke="var(--sidebar-primary)" strokeWidth="3.5" transform="rotate(1 600 400)" filter={`url(#glowSoft-${id})`} />
                    </g>
                    <g opacity="1">
                        <ellipse cx="600" cy="400" rx="500" ry="500" fill="none" stroke="var(--sidebar-primary)" strokeWidth="2" filter={`url(#glowSoft-${id})`} opacity="0.9" />
                        <ellipse cx="600" cy="400" rx="506" ry="206" fill="none" stroke="var(--sidebar-primary)" strokeWidth="4" transform="rotate(1.5 600 400)" filter={`url(#glowSoft-${id})`} />
                    </g>


                    {/* Central checkmark symbol */}
                    <g transform="translate(460, 390) scale(1.15)">
                        <polyline points="0,0 50,0 100,100 200,-100 260,-100" fill="none" stroke="var(--sidebar-primary)" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" filter={`url(#intenseGlow-${id})`} opacity="1" />
                        <polyline points="0,0 50,0 100,100 200,-100 260,-100" fill="none" stroke="var(--sidebar-check-glow)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glowSoft-${id})`} />
                        <polyline points="0,0 50,0 100,100 200,-100 260,-100" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </g>
            )}

            {variant === 'community' && (
                /* Full RadixCommunity.svg — connecting lines, small icons, 3D layer stack */
                <g transform="translate(900, 280) scale(0.48) translate(-620, -450)">
                    <defs>
                        {/* Layer gradients */}
                        <linearGradient id={`l1f-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--sidebar-grad1)" />
                            <stop offset="32%" stopColor="var(--sidebar-grad-mid)" />
                            <stop offset="55%" stopColor="var(--sidebar-grad-mid)" />
                            <stop offset="100%" stopColor="var(--sidebar-grad2)" />
                        </linearGradient>
                        <linearGradient id={`l1w-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--sidebar-primary)" stopOpacity="0.8" />
                            <stop offset="50%" stopColor="var(--sidebar-grad-mid)" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="var(--sidebar-grad2)" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id={`l2f-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--sidebar-secondary)" />
                            <stop offset="100%" stopColor="var(--sidebar-grad1)" />
                        </linearGradient>
                        <linearGradient id={`l2w-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--sidebar-bg)" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="var(--sidebar-secondary)" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id={`l3f-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--sidebar-grad2)" />
                            <stop offset="100%" stopColor="var(--sidebar-grad-mid)" />
                        </linearGradient>
                        <linearGradient id={`l3w-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--sidebar-bg)" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="var(--sidebar-grad2)" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id={`l4f-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--sidebar-primary)" />
                            <stop offset="100%" stopColor="var(--sidebar-grad1)" />
                        </linearGradient>
                        <linearGradient id={`l4w-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--sidebar-bg)" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="var(--sidebar-primary)" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id={`iconCircle-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--sidebar-primary)" />
                            <stop offset="40%" stopColor="var(--sidebar-grad-mid)" />
                            <stop offset="100%" stopColor="var(--sidebar-secondary)" />
                        </linearGradient>
                        <radialGradient id={`nebulaAura-${id}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="var(--sidebar-grad2)" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="var(--sidebar-secondary)" stopOpacity="0.08" />
                            <stop offset="100%" stopColor="var(--sidebar-bg)" stopOpacity="0" />
                        </radialGradient>
                        <filter id={`layerShadow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="-5" dy="25" stdDeviation="15" floodColor="var(--sidebar-layer-shadow)" floodOpacity="0.25" />
                        </filter>
                        <filter id={`floatShadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.2" />
                        </filter>
                        <filter id={`glowIntense-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="6" result="b1" />
                            <feGaussianBlur stdDeviation="12" result="b2" />
                            <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    {/* Connecting diagram lines */}
                    <g fill="none" stroke="var(--sidebar-comm-lines)" strokeWidth="1.5">
                        <path d="M 100,240 L 600,240" />
                        <path d="M 100,380 L 600,380" />
                        <path d="M 100,520 L 600,520" />
                        <path d="M 100,660 L 600,660" />
                        <path d="M 100,240 L 100,660" />
                        <path d="M 0,450 L 100,450" />
                    </g>

                    {/* Small icons (left column) */}
                    <g transform="translate(240, 0)">

                        {/* Icon 1: Mini Layer Stack (lifted perspective) */}
                        <g transform="translate(0, 240)">
                            <ellipse cx="0" cy="18" rx="35" ry="14" fill="#000000" opacity="0.12" filter={`url(#glowSoft-${id})`} />
                            <g transform="scale(0.32)">
                                {/* Wall layers - 9 stacked planes */}
                                <g fill={`url(#l1w-${id})`}>
                                    {Array.from({ length: 9 }, (_, i) => (
                                        <g key={`i1w-${i}`} transform={`translate(0, ${(i + 1) * 2})`}>
                                            <rect x="-120" y="-120" width="240" height="240" rx="45"
                                                transform="scale(1, 0.75) rotate(45)" />
                                        </g>
                                    ))}
                                </g>
                                {/* Top face */}
                                <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l1f-${id})`}
                                    transform="scale(1, 0.75) rotate(45)" />
                                {/* Radix logo on top */}
                                <g transform="scale(0.8)">
                                    <g transform="scale(1, 0.75) rotate(45)">
                                        <path d="M -90,2.5 L -50,2.5 L -20,52.5 L 40,-62.5 L 90,-62.5" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                                    </g>
                                </g>
                            </g>
                        </g>

                        {/* Icon 2: Circle Logo */}
                        <g transform="translate(0, 380)">
                            <circle cx="0" cy="12" r="35" fill="#000000" opacity="0.12" filter={`url(#glowSoft-${id})`} />
                            <circle cx="0" cy="0" r="38" fill={`url(#iconCircle-${id})`} />
                            {/* Glass highlight */}
                            <path d="M -34,-12 A 36 36 0 0 1 34,-12 A 36 24 0 0 0 -34,-12" fill="#ffffff" opacity="0.25" />
                            {/* Small Radix check logo */}
                            <g transform="scale(1.2)">
                                <path d="M -20,2.5 L -10,2.5 L -5,15.5 L 10,-10.5 L 20,-10.5" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                        </g>

                        {/* Icon 3: Standing Glass Panels Pierced by Light */}
                        <g transform="translate(0, 520)">
                            {/* Floor shadow */}
                            <ellipse cx="0" cy="30" rx="40" ry="12" fill="#000000" opacity="0.15" filter={`url(#glowSoft-${id})`} />

                            {/* LASER back section (entering the figure) */}
                            <line x1="70" y1="-50" x2="30" y2="-16.5" stroke="var(--sidebar-primary)" strokeWidth="5" filter={`url(#glowSoft-${id})`} opacity="0.8" />
                            <line x1="50" y1="-33" x2="30" y2="-16.5" stroke="#ffffff" strokeWidth="1.5" />

                            {/* BACK PANEL (dark blue, vertical position) */}
                            <g transform="translate(15, -15)">
                                <polygon points="0,-28 30,-15 30,25 0,12" fill="var(--sidebar-bg)" stroke="var(--sidebar-grad1)" strokeWidth="0.5" />
                                <polygon points="0,-28 -5,-25 -5,15 0,12" fill="var(--sidebar-bg)" />
                                <polygon points="0,-28 30,-15 25,-12 -5,-25" fill="var(--sidebar-shadow)" />
                                {/* Back impact glow */}
                                <ellipse cx="15" cy="-1.5" rx="6" ry="10" fill="var(--sidebar-primary)" filter={`url(#glowIntense-${id})`} opacity="0.7" />
                            </g>

                            {/* LASER mid section (between panels) */}
                            <line x1="30" y1="-16.5" x2="0" y2="8.5" stroke="var(--sidebar-primary)" strokeWidth="6" filter={`url(#glowSoft-${id})`} opacity="0.6" />
                            <line x1="30" y1="-16.5" x2="0" y2="8.5" stroke="#ffffff" strokeWidth="2" />

                            {/* FRONT PANEL (translucent cyan crystal) */}
                            <g transform="translate(-15, 10)">
                                <polygon points="0,-28 30,-15 30,25 0,12" fill="var(--sidebar-secondary)" opacity="0.65" stroke="var(--sidebar-secondary)" strokeWidth="1" />
                                <polygon points="0,-28 -5,-25 -5,15 0,12" fill="var(--sidebar-primary)" opacity="0.8" />
                                <polygon points="0,-28 30,-15 25,-12 -5,-25" fill="var(--sidebar-primary)" opacity="0.9" />

                                {/* Piercing impact effect (hole, shockwaves, cracks) */}
                                <g transform="translate(15, -1.5)">
                                    <ellipse cx="0" cy="0" rx="3" ry="5" fill="#ffffff" filter={`url(#glowIntense-${id})`} />
                                    {/* Shockwaves */}
                                    <ellipse cx="0" cy="0" rx="8" ry="14" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
                                    <ellipse cx="0" cy="0" rx="15" ry="25" fill="none" stroke="var(--sidebar-primary)" strokeWidth="1" opacity="0.5" />
                                    {/* Energy cracks */}
                                    <path d="M 0,0 L -8,-10 M 0,0 L 12,15 M 0,0 L 18,-6 M 0,0 L -12,8" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                                </g>
                            </g>

                            {/* LASER front section (exiting with high intensity) */}
                            <line x1="0" y1="8.5" x2="-35" y2="37.6" stroke="var(--sidebar-primary)" strokeWidth="8" filter={`url(#glowSoft-${id})`} opacity="0.9" />
                            <line x1="0" y1="8.5" x2="-35" y2="37.6" stroke="#ffffff" strokeWidth="3" />

                            {/* Star Lens Flare */}
                            <g transform="translate(0, 8.5)">
                                {/* Aura */}
                                <circle cx="0" cy="0" r="16" fill="var(--sidebar-primary)" filter={`url(#glowIntense-${id})`} opacity="0.8" />
                                {/* Diagonal cross rays */}
                                <path d="M -18,-18 L 18,18 M -18,18 L 18,-18" stroke="var(--sidebar-primary)" strokeWidth="3" filter={`url(#glowSoft-${id})`} opacity="0.9" />
                                <path d="M -12,-12 L 12,12 M -12,12 L 12,-12" stroke="#ffffff" strokeWidth="1.5" />
                                {/* Horizontal/vertical extended rays */}
                                <path d="M -30,0 L 30,0 M 0,-30 L 0,30" stroke="var(--sidebar-primary)" strokeWidth="1.5" filter={`url(#glowSoft-${id})`} opacity="0.7" />
                                <path d="M -20,0 L 20,0 M 0,-20 L 0,20" stroke="#ffffff" strokeWidth="1" />
                                {/* Burning core */}
                                <circle cx="0" cy="0" r="4" fill="#ffffff" />
                            </g>
                        </g>

                        {/* Icon 4: Atom Nebula */}
                        <g transform="translate(0, 660)">
                            <circle cx="0" cy="0" r="55" fill={`url(#nebulaAura-${id})`} />
                            <circle cx="0" cy="0" r="20" fill="var(--sidebar-grad2)" filter={`url(#glowIntense-${id})`} opacity="0.5" />

                            {/* Atom Orbital Rings */}
                            <g stroke="var(--sidebar-atom-rings)" strokeWidth="0.8" opacity="0.4" fill="none">
                                <ellipse cx="0" cy="0" rx="42" ry="14" transform="rotate(20)" />
                                <ellipse cx="0" cy="0" rx="42" ry="14" transform="rotate(-40)" />
                                <ellipse cx="0" cy="0" rx="42" ry="14" transform="rotate(80)" />
                            </g>

                            {/* Connecting Constellation Lines */}
                            <path d="M 38,15 L -12,40 L -32,-28 L 22,-38 Z" fill="none" stroke="var(--sidebar-text-main)" strokeWidth="0.6" opacity="0.6" />
                            <path d="M -32,-28 L 0,0 L 22,-38" fill="none" stroke="var(--sidebar-primary)" strokeWidth="0.8" opacity="0.5" />
                            <path d="M 38,15 L 0,0 L -12,40" fill="none" stroke="var(--sidebar-secondary)" strokeWidth="0.8" opacity="0.5" />

                            {/* Electrons / Atomic Nodes */}
                            <circle cx="38" cy="15" r="3.5" fill="var(--sidebar-primary)" filter={`url(#glowSoft-${id})`} />
                            <circle cx="-32" cy="-28" r="4" fill="var(--sidebar-secondary)" filter={`url(#glowSoft-${id})`} />
                            <circle cx="-12" cy="40" r="3" fill="var(--sidebar-grad2)" filter={`url(#glowSoft-${id})`} />
                            <circle cx="22" cy="-38" r="4.5" fill="var(--sidebar-primary)" filter={`url(#glowSoft-${id})`} />

                            <circle cx="18" cy="18" r="1.5" fill="#ffffff" />
                            <circle cx="-25" cy="8" r="2" fill="#ffffff" opacity="0.8" />
                            <circle cx="5" cy="-25" r="1" fill="#ffffff" />

                            {/* Central nucleus */}
                            <circle cx="0" cy="0" r="5" fill="#ffffff" filter={`url(#glowIntense-${id})`} />
                        </g>
                    </g>

                    {/* ========================================= */}
                    {/* MAIN 3D STACK (right side)                 */}
                    {/* ========================================= */}
                    <g transform="translate(620, 0)">

                        {/* Huge soft shadow anchoring the stack to the floor */}
                        <ellipse cx="0" cy="730" rx="180" ry="70" fill="#000000" opacity="0.15" filter={`url(#blurFar-${id})`} />

                        {/* LAYER 4 (BOTTOM) — Royal Blue to Cyan */}
                        <g transform="translate(0, 620)" filter={`url(#layerShadow-${id})`}>
                            {/* 3D wall extrusion: 35 stacked isometric planes */}
                            {Array.from({ length: 35 }, (_, i) => (
                                <g key={`l4w-${i}`} transform={`translate(0, ${i + 1})`}>
                                    <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l4w-${id})`} transform="scale(1, 0.55) rotate(45)" />
                                </g>
                            ))}
                            {/* Top face */}
                            <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l4f-${id})`} transform="scale(1, 0.55) rotate(45)" />
                        </g>

                        {/* LAYER 3 — Magenta to Bright Mint/Cyan */}
                        <g transform="translate(0, 480)" filter={`url(#layerShadow-${id})`}>
                            {Array.from({ length: 35 }, (_, i) => (
                                <g key={`l3w-${i}`} transform={`translate(0, ${i + 1})`}>
                                    <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l3w-${id})`} transform="scale(1, 0.55) rotate(45)" />
                                </g>
                            ))}
                            <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l3f-${id})`} transform="scale(1, 0.55) rotate(45)" />
                        </g>

                        {/* LAYER 2 — Light blue to deep navy */}
                        <g transform="translate(0, 340)" filter={`url(#layerShadow-${id})`}>
                            {Array.from({ length: 35 }, (_, i) => (
                                <g key={`l2w-${i}`} transform={`translate(0, ${i + 1})`}>
                                    <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l2w-${id})`} transform="scale(1, 0.55) rotate(45)" />
                                </g>
                            ))}
                            <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l2f-${id})`} transform="scale(1, 0.55) rotate(45)" />
                        </g>

                        {/* LAYER 1 (TOP) — Green corner → Blue Center → Purple */}
                        <g transform="translate(0, 200)" filter={`url(#layerShadow-${id})`}>
                            {Array.from({ length: 35 }, (_, i) => (
                                <g key={`l1w-${i}`} transform={`translate(0, ${i + 1})`}>
                                    <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l1w-${id})`} transform="scale(1, 0.55) rotate(45)" />
                                </g>
                            ))}
                            {/* Top face */}
                            <rect x="-120" y="-120" width="240" height="240" rx="45" fill={`url(#l1f-${id})`} transform="scale(1, 0.55) rotate(45)" />
                            {/* Radix checkmark logo on top face */}
                            <g filter={`url(#floatShadow-${id})`}>
                                <g transform="scale(1, 0.55) rotate(45)">
                                    <path d="M -90,2.5 L -50,2.5 L -20,52.5 L 40,-62.5 L 90,-62.5" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            )}

            {(variant === 'default' || variant === 'docs' || variant === 'infrastructure' || variant === 'developers' || variant === 'academy' || variant === 'roadmap') && (
                /* Original 3D checkmark card */
                <g transform="translate(890, 270) rotate(14) skewX(-12) scale(0.85, 0.81)">
                    <rect x="-115" y="-120" width="290" height="290" rx="55" fill={`url(#cardShadow-${id})`} />
                    <rect x="-137" y="-132" width="290" height="290" rx="55" fill="var(--sidebar-card-base)" opacity="0.6" />
                    <rect x="-140" y="-145" width="290" height="290" rx="55" fill={`url(#cardFront-${id})`} />
                    <g transform="translate(-35, -15)">
                        <path d="M -70,20 L -30,20 L 10,95 L 90,-65 L 140,-65"
                            fill="none" stroke="var(--sidebar-card-stroke)"
                            strokeWidth="32" strokeLinejoin="round" strokeLinecap="round"
                            filter={`url(#glowSoft-${id})`} opacity="0.85" transform="translate(12, 18)" />
                        {/* Mid-layer shadow — always dark tinted for proper shadow look */}
                        <path d="M -70,20 L -30,20 L 10,95 L 90,-65 L 140,-65"
                            fill="none" stroke="var(--sidebar-card-mid-stroke)"
                            strokeWidth="26" strokeLinejoin="round" strokeLinecap="round"
                            transform="translate(5, 8)" />
                        <path d="M -70,20 L -30,20 L 10,95 L 90,-65 L 140,-65"
                            fill="none" stroke="#ffffff"
                            strokeWidth="24" strokeLinejoin="round" strokeLinecap="round" />
                    </g>
                </g>
            )}
        </svg>
    );
}