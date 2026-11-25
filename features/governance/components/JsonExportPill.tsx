'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { G } from './GovernanceBadges';

export type TabExportGetter = () => unknown;
export type RegisterTabExport = (getter: TabExportGetter | null) => void;

/**
 * Registers a lazy JSON getter for the currently mounted governance tab.
 * Reading at click time avoids extra re-renders while async tallies/ages load.
 */
export function useRegisterTabExport(onRegisterExport: RegisterTabExport | undefined, getter: TabExportGetter) {
    useEffect(() => {
        if (!onRegisterExport) return;
        onRegisterExport(getter);
        return () => onRegisterExport(null);
    });
}

function downloadJson(filename: string, json: string) {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Compact header pill with "JSON" label and Copy / Download icon buttons,
 * matching the pill row in GovernanceDetail.
 */
export function JsonExportPill({ getData, filename, g }: {
    getData: () => unknown;
    filename: string;
    g: G;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            const json = JSON.stringify(getData(), null, 2);
            if (!navigator.clipboard?.writeText) return;
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable */
        }
    };

    const handleDownload = () => {
        const json = JSON.stringify(getData(), null, 2);
        downloadJson(filename, json);
    };

    const copyLabel = copied ? (g.json_copied || 'JSON copied') : (g.copy_json || 'Copy JSON');
    const downloadLabel = g.download_json || 'Download JSON';

    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
            <span>JSON</span>
            <button
                type="button"
                onClick={handleCopy}
                title={copyLabel}
                aria-label={copyLabel}
                className="inline-flex items-center justify-center rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
                {copied ? <Check className="size-3 text-[var(--color-accent)]" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
            </button>
            <button
                type="button"
                onClick={handleDownload}
                title={downloadLabel}
                aria-label={downloadLabel}
                className="inline-flex items-center justify-center rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
                <Download className="size-3" aria-hidden="true" />
            </button>
        </span>
    );
}
