'use client';

import React, { createContext, use, useEffect, useState, useSyncExternalStore } from 'react';
import { useIsFetching, useQuery } from '@tanstack/react-query';
import { Languages, Loader2 } from 'lucide-react';
import { prewarmTranslator, subscribeTranslator, translateHtml, translateText, translatorAvailability, translatorState, type TranslatorAvailability } from '@/lib/browserTranslator';
import { fill } from '../lib/format';
import type { G } from './GovernanceBadges';

type Status = TranslatorAvailability | 'ready';

interface TranslationContext {
    language: string;
    status: Status;
    /** Model download progress 0..1 while the browser fetches it. */
    progress: number;
    /** Texts are being shown translated. */
    active: boolean;
    showOriginal: boolean;
    setShowOriginal: (v: boolean) => void;
}

const Ctx = createContext<TranslationContext | null>(null);
const QUERY_KEY = 'governance-browser-translation';

/**
 * Translation state for the whole governance section. The page follows the
 * site's language: the browser translates on the device, with no button of
 * its own. When the language model is not on the device yet it is fetched
 * from a user gesture: the click on the site's language switcher, or else the
 * reader's first interaction with the page.
 */
export function BrowserTranslationProvider({ language, children }: { language: string; children: React.ReactNode }) {
    const availability = useQuery({
        queryKey: ['translator-availability', language],
        queryFn: () => translatorAvailability(language),
        enabled: language !== 'en',
        staleTime: Infinity,
    });
    const download = useSyncExternalStore(subscribeTranslator, () => translatorState(language), () => translatorState(language));
    const [showOriginal, setShowOriginal] = useState(false);

    const base: TranslatorAvailability = language === 'en' ? 'unsupported' : availability.data ?? 'unsupported';
    const status: Status = base === 'available' || download.phase === 'ready' ? 'ready'
        : download.phase === 'downloading' ? 'downloading'
            : download.phase === 'failed' ? 'unavailable'
                : base;

    // Model not on the device and no language click to start it: the first
    // pointer or key interaction anywhere on the page does.
    const needsGesture = status === 'downloadable' || (status === 'downloading' && download.phase === 'idle');
    useEffect(() => {
        if (!needsGesture) return;
        const start = () => prewarmTranslator(language);
        const opts = { once: true, capture: true } as const;
        document.addEventListener('pointerdown', start, opts);
        document.addEventListener('keydown', start, opts);
        return () => {
            document.removeEventListener('pointerdown', start, opts);
            document.removeEventListener('keydown', start, opts);
        };
    }, [needsGesture, language]);

    return (
        <Ctx value={{ language, status, progress: download.progress, active: status === 'ready' && !showOriginal, showOriginal, setShowOriginal }}>
            {children}
        </Ctx>
    );
}

function useTranslationContext(): TranslationContext {
    const ctx = use(Ctx);
    if (!ctx) throw new Error('BrowserTranslationProvider is missing');
    return ctx;
}

/** A text in the reader's language when the browser can translate it, else as written. */
export function useTranslatedText(text: string | null): string | null {
    const { language, active } = useTranslationContext();
    const { data } = useQuery({
        queryKey: [QUERY_KEY, 'text', language, text],
        queryFn: () => translateText(language, text as string),
        enabled: active && !!text,
        staleTime: Infinity,
    });
    return active && data ? data : text;
}

/** Several texts at once (sidebar titles, ballot options). */
export function useTranslatedList(texts: string[]): string[] {
    const { language, active } = useTranslationContext();
    const { data } = useQuery({
        queryKey: [QUERY_KEY, 'list', language, texts],
        queryFn: () => Promise.all(texts.map(t => translateText(language, t))),
        enabled: active && texts.length > 0,
        staleTime: Infinity,
    });
    return active && data?.length === texts.length ? data : texts;
}

/** Sanitised HTML with only its text translated. */
export function useTranslatedHtml(html: string): string {
    const { language, active } = useTranslationContext();
    const { data } = useQuery({
        queryKey: [QUERY_KEY, 'html', language, html],
        queryFn: () => translateHtml(language, html),
        enabled: active && !!html,
        staleTime: Infinity,
    });
    return active && data ? data : html;
}

/**
 * The line under a vote's title, Reddit-style: offers the translation,
 * shows its progress, or says the page was translated with a way back to the
 * original. Hidden in English and in browsers without a translator.
 */
export function TranslationBar({ g }: { g: G }) {
    const { status, progress, showOriginal, setShowOriginal } = useTranslationContext();
    const translating = useIsFetching({ queryKey: [QUERY_KEY] }) > 0;
    // Nothing to offer: English, no translator in this browser, or waiting for
    // the first interaction to fetch the model.
    if (status !== 'ready' && status !== 'downloading') return null;

    // Same shape as the other pills of the vote header. Every message is laid
    // out in the same grid cell and only the current one is visible, so the
    // pill keeps the width of the longest one and never changes size.
    const shell = 'inline-grid rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]';
    const spinner = <Loader2 className="size-3 shrink-0 animate-spin text-[var(--color-primary)]" />;
    const icon = <Languages className="size-3 shrink-0 text-[var(--color-primary)]" />;
    const action = (label: string, current: boolean) => current
        ? <button type="button" onClick={() => setShowOriginal(!showOriginal)} className="font-bold text-[var(--color-primary)] hover:underline">{label}</button>
        : <span className="font-bold">{label}</span>;

    const current = status === 'downloading' ? 'downloading' : showOriginal ? 'original' : translating ? 'translating' : 'translated';
    const variants: Array<{ key: typeof current; lead: React.ReactNode; text: string; action?: string }> = [
        { key: 'downloading', lead: spinner, text: fill(g.translate_downloading || 'Preparing your browser translator… {pct}', { pct: `${Math.round((current === 'downloading' ? progress : 1) * 100)} %` }) },
        { key: 'translating', lead: spinner, text: g.translating || 'Translating…', action: g.show_original || 'View original' },
        { key: 'translated', lead: icon, text: g.translated_by_browser || 'Translated by your browser, on your device', action: g.show_original || 'View original' },
        { key: 'original', lead: icon, text: g.showing_original || 'You are viewing the original English text', action: g.show_translation || 'View translation' },
    ];

    return (
        <div className={shell} role="status">
            {variants.map(v => {
                const on = v.key === current;
                return (
                    <span key={v.key} aria-hidden={!on} className={`col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap ${on ? '' : 'invisible'}`}>
                        {v.lead}{v.text}
                        {/* Always at the far right of the pill, whatever the message. */}
                        {v.action && <span className="ml-auto flex items-center gap-1.5"><span aria-hidden>·</span>{action(v.action, on)}</span>}
                    </span>
                );
            })}
        </div>
    );
}
