'use client';
import React from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { LabelProps, DRProps, ARProps } from '../types/components.types';

/* ─────────────────────────────────────────
   Label — section heading
───────────────────────────────────────── */
export const Label = ({ children }: LabelProps) => (
    <p className="veb-label">{children}</p>
);

/* ─────────────────────────────────────────
   DR — data row (label / value)
───────────────────────────────────────── */
export const DR = ({
    label, value, sub, hi, vertical,
}: DRProps) => (
    <div className={`veb-dr ${vertical ? 'veb-dr-v' : ''}`}>
        <span className="veb-dr-label">{label}</span>
        <div className="veb-dr-right">
            <span className="veb-dr-val" style={hi ? { color: hi } : undefined}>{value}</span>
            {sub && <span className="veb-dr-sub">{sub}</span>}
        </div>
    </div>
);

/* ─────────────────────────────────────────
   AR — address row with copy
───────────────────────────────────────── */
export const AR = ({
    label, addr, onCopy, copied, brackets,
}: ARProps) => (
    <div className="veb-ar">
        <span className="veb-ar-label">{label}</span>
        <div
            className="veb-ar-content group/ar"
            onClick={e => { e.stopPropagation(); onCopy(brackets ? `[${addr}]` : addr); }}
        >
            <code className={`veb-ar-code transition-colors duration-300 ${copied ? 'text-green-700 dark:text-green-400' : ''}`}>
                {brackets ? `[${addr}]` : addr}
            </code>
            <CopyButton
                value={brackets ? `[${addr}]` : addr}
                variant="minimal"
                size="xs"
                className="pointer-events-none"
                forceCopied={copied}
            />
        </div>
    </div>
);

/* ─────────────────────────────────────────
   Shared CSS — injected once by ValidatorExpandedBody
───────────────────────────────────────── */
export const VEB_STYLES = `
    /* LAYOUT */
    .veb { background: var(--color-bg); border-top: 1px solid var(--color-card-border); }
    .veb-main-grid { display: grid; grid-template-columns: 1fr; }
    .veb-block { border-bottom: 1px solid var(--color-card-border); }

    /* GRID 1: Classic 3-column */
    .veb-classic-grid .veb-top {
        display: grid;
        grid-template-columns: 1fr;
        border-bottom: 1px solid var(--color-card-border);
    }
    .veb-classic-grid .veb-history-grid {
        display: grid;
        grid-template-columns: 1fr;
    }
    @media (min-width: 900px) {
        .veb-classic-grid .veb-top { grid-template-columns: 1fr 340px; }
        .veb-classic-grid .veb-history-grid { grid-template-columns: 1fr 1fr; }
        .veb-classic-grid .veb-profile { border-right: 1px solid var(--color-card-border); border-bottom: none; }
        .veb-classic-grid .veb-delegation { border-bottom: none; }
        .veb-classic-grid .veb-uptimes { grid-column: span 2; border-top: 1px solid var(--color-card-border); }
        .veb-classic-grid .veb-evolution { border-right: 1px solid var(--color-card-border); border-bottom: none; }
        .veb-classic-grid .veb-activity { border-bottom: none; }
        .veb-classic-grid .veb-history { grid-column: span 2; border-top: 1px solid var(--color-card-border); }
    }
    @media (min-width: 1300px) {
        .veb-classic-grid .veb-top { grid-template-columns: 1fr 340px 340px; }
        .veb-classic-grid .veb-history-grid { grid-template-columns: 1fr 1fr 380px; }
        .veb-classic-grid .veb-uptimes { grid-column: auto; border-top: none; border-left: 1px solid var(--color-card-border); }
        .veb-classic-grid .veb-delegation { border-right: 1px solid var(--color-card-border); }
        .veb-classic-grid .veb-history { grid-column: auto; border-top: none; border-left: 1px solid var(--color-card-border); }
        .veb-classic-grid .veb-activity { border-right: none; }
    }
    .veb-classic-grid .veb-block { border-bottom: 1px solid var(--color-card-border); }
    .veb-classic-grid .veb-profile { padding: 20px 24px; gap: 14px; }
    .veb-classic-grid .veb-delegation { padding: 24px; }
    .veb-classic-grid .veb-chart-panel { padding: 18px 24px; }
    .veb-classic-grid .veb-epochs { padding: 12px 16px; }
    .veb-classic-grid .veb-history-grid .veb-block:last-child { border-bottom: none; }

    /* GRID 2 */
    .veb-grid-2 { grid-template-columns: 1fr 1fr; }
    .veb-grid-2 .veb-block { border-bottom: 1px solid var(--color-card-border); border-right: 1px solid var(--color-card-border); }
    .veb-grid-2 .col-span-2 { grid-column: span 2; border-right: none; }
    .veb-grid-2 .veb-block:nth-child(2), .veb-grid-2 .veb-block:nth-child(5) { border-right: none; }
    .veb-grid-2 .veb-block:nth-child(n+5) { border-bottom: none; }

    /* GRID 3+ */
    .veb-grid-3, .veb-grid-4, .veb-grid-5, .veb-grid-6, .veb-grid-7, .veb-grid-8 { grid-template-columns: 1fr; }
    .veb-grid-3 .veb-block, .veb-grid-4 .veb-block { border-bottom: 1px solid var(--color-card-border); border-right: none; }
    .veb-grid-3 .veb-block:last-child { border-bottom: none; }

    /* Mobile */
    @media (max-width: 900px) {
        .veb-main-grid { grid-template-columns: 1fr !important; }
        .veb-block { border-right: none !important; border-bottom: 1px solid var(--color-card-border) !important; }
        .veb-block:last-child { border-bottom: none !important; }
        .col-span-2 { grid-column: auto !important; }
    }

    /* BLOCK BASE */
    .veb-block { padding: 24px; display: flex; flex-direction: column; min-width: 0; }
    .veb-chart-panel { min-height: 320px; }

    /* CHARTS */
    .veb-chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .veb-chart-legend { display: flex; gap: 12px; align-items: center; }
    .veb-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--color-text-muted); }
    .veb-legend-dot { width: 8px; height: 8px; border-radius: 2px; }
    .veb-bg-stake   { background: #22c55e; box-shadow: 0 0 6px #22c55e60; }
    .veb-bg-unstake { background: #f59e0b; box-shadow: 0 0 6px #f59e0b60; }
    .veb-bg-claim   { background: #3b82f6; box-shadow: 0 0 6px #3b82f660; }
    .veb-chart-content { flex: 1; display: flex; flex-direction: column; position: relative; min-height: 220px; }
    .veb-chart-loading { display: flex; align-items: center; justify-content: center; height: 220px; }
    .veb-chart-empty { display: flex; align-items: center; justify-content: center; height: 220px; font-size: 12px; color: var(--color-text-muted); opacity: 0.5; font-style: italic; }
    .veb-chart-recharts { width: 100%; position: relative; }
    .veb-spinner { width: 24px; height: 24px; border: 2.5px solid color-mix(in srgb, var(--color-primary) 10%, transparent); border-top-color: var(--color-primary); border-radius: 50%; animation: veb-spin 0.8s linear infinite; }
    @keyframes veb-spin { to { transform: rotate(360deg); } }

    /* RECHARTS TOOLTIP */
    .veb-shc-tooltip { background: var(--color-surface); border: 1px solid var(--color-card-border); padding: 10px 14px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px color-mix(in srgb, var(--color-primary) 12%, transparent); pointer-events: none; display: flex; flex-direction: column; gap: 5px; min-width: 160px; backdrop-filter: blur(12px); }
    .veb-shc-tt-date { font-size: 10.5px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 4px; border-bottom: 1px solid var(--color-card-border); margin-bottom: 2px; }
    .veb-shc-tt-row { display: flex; align-items: center; gap: 7px; }
    .veb-shc-tt-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
    .veb-shc-tt-k { font-size: 11.5px; font-weight: 500; color: var(--color-text-muted); flex: 1; }
    .veb-shc-tt-v { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }

    /* PROFILE */
    .veb-profile { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid var(--color-card-border); }
    @media (min-width: 900px) { .veb-profile { border-bottom: none; border-right: 1px solid var(--color-card-border); } }
    .veb-desc-text { margin-top: 6px; font-size: 13px; line-height: 1.65; }
    .veb-desc-has { font-style: italic; color: var(--color-text-main); opacity: 0.72; }
    .veb-desc-empty { color: var(--color-text-muted); }
    .veb-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; font-size: 12.5px; font-weight: 500; color: var(--color-primary); text-decoration: none; max-width: 320px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .veb-link:hover { text-decoration: underline; }
    .veb-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 2px; }
    .veb-meta-sep { width: 1px; height: 16px; background: var(--color-card-border); flex-shrink: 0; margin: 0 2px; }
    .veb-techpill { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; }
    .veb-techpill-icon { color: var(--color-text-muted); opacity: 0.45; display: flex; }
    .veb-techpill-k { color: var(--color-text-muted); }
    .veb-techpill-v { font-weight: 600; color: var(--color-text-main); }
    .veb-profile-addrs { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }

    /* DELEGATION */
    .veb-delegation { padding: 20px 24px; display: flex; flex-direction: column; border-bottom: 1px solid var(--color-card-border); }
    .veb-delegation > .veb-drows { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    @media (min-width: 900px) { .veb-delegation { border-bottom: none; } }
    @media (min-width: 1200px) { .veb-delegation { border-right: 1px solid var(--color-card-border); } }
    .veb-drows { margin-top: 10px; }
    .veb-dr { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 7px 0; border-bottom: 1px solid var(--color-card-border); transition: background 0.1s; }
    .veb-dr:last-child { border-bottom: none; }
    .veb-dr-label { font-size: 12.5px; color: var(--color-text-muted); font-weight: 500; flex: 1; min-width: 0; line-height: 1.4; }
    .veb-dr-right { display: flex; flex-direction: column; align-items: flex-end; min-width: fit-content; flex-shrink: 0; text-align: right; }
    .veb-dr-val { font-size: 13.5px; font-weight: 500; color: var(--color-text-main); white-space: nowrap; line-height: 1.2; }
    .veb-dr-sub { font-size: 10.5px; color: var(--color-text-muted); font-weight: 500; margin-top: 1px; }

    /* PERFORMANCE */
    .veb-uptimes { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .veb-perf-section { flex: 1; display: flex; flex-direction: column; }
    .veb-perf-section > .veb-drows { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .veb-u-pct { font-size: 14px; font-weight: 500; line-height: 1.2; display: flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; }
    .veb-made   { color: #16a34a; font-weight: 500; font-variant-numeric: tabular-nums; }
    .veb-missed { color: #dc2626; font-weight: 500; font-variant-numeric: tabular-nums; }

    /* EPOCHS TABLE */
    .veb-epochs-panel { background: var(--color-surface); }
    .veb-epochs { padding: 12px 16px; overflow-x: auto; }
    .veb-epochs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .veb-live-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: var(--color-text-muted); }
    .veb-table { width: 100%; border-collapse: collapse; }
    .veb-th { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted); padding-bottom: 8px; border-bottom: 1px solid var(--color-card-border); }
    .veb-tr      { border-bottom: 1px solid var(--color-card-border); }
    .veb-tr-live { border-bottom: 1px solid var(--color-card-border); background: color-mix(in srgb, var(--color-accent) 4%, transparent); }
    .veb-tr:last-child { border-bottom: none; }
    .veb-td { padding: 7px 0; vertical-align: middle; }
    .veb-epoch-live-cell { display: inline-flex; align-items: center; gap: 5px; }
    .veb-epoch-num { font-size: 12.5px; font-weight: 700; color: var(--color-text-main); font-variant-numeric: tabular-nums; }
    .veb-live-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-accent); }
    .veb-num-made   { font-size: 13px; font-weight: 500; color: #16a34a; font-variant-numeric: tabular-nums; }
    .veb-num-missed { font-size: 13px; font-weight: 500; color: #dc2626; font-variant-numeric: tabular-nums; }
    .veb-num-zero   { font-size: 13px; font-weight: 500; color: var(--color-text-muted); opacity: 0.3; font-variant-numeric: tabular-nums; }

    /* ADDRESSES */
    .veb-ar { display: flex; flex-direction: column; gap: 4px; }
    .veb-ar-label { font-size: 12.5px; font-weight: 500; color: var(--color-text-muted); line-height: 1.2; }
    .veb-ar-content { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
    .veb-ar-code { flex: 1; min-width: 0; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: var(--color-text-muted); opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .veb-ar-content:hover .veb-ar-code { color: var(--color-primary); opacity: 1; }

    /* CTA */
    .veb-cta { display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center !important; justify-content: space-between !important; gap: 24px; padding: 16px 32px !important; width: 100%; box-sizing: border-box; }
    .veb-cta-hint { font-size: 14px; color: var(--color-text-muted); font-weight: 500; line-height: 1.4; margin: 0 !important; flex: 1; }
    .veb-cta-btn { height: 40px !important; padding: 0 40px !important; border-radius: 12px !important; font-size: 13px !important; font-weight: 700 !important; white-space: nowrap; background: var(--color-primary) !important; color: white !important; box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 20%, transparent) !important; transition: all 0.2s ease !important; flex-shrink: 0; }
    .veb-cta-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 30%, transparent) !important; }
    .veb-cta-btn:active { transform: scale(0.96) !important; }

    /* LABEL */
    .veb-label { font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; color: var(--color-text-muted); }

    /* RECHARTS */
    .recharts-wrapper *:focus { outline: none !important; }
    .recharts-rectangle, .recharts-bar-rectangle { outline: none !important; }
`;
