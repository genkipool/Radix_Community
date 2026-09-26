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

    // Same shape as the other pills of the vote header.
    const shell = 'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]';

    if (status === 'downloading') {
        return (
            <div className={shell} role="status">
                <Loader2 className="size-3 animate-spin text-[var(--color-primary)]" />
                {fill(g.translate_downloading || 'Preparing your browser translator… {pct}', { pct: progress > 0 ? `${Math.round(progress * 100)} %` : '' })}
            </div>
        );
    }
    return (
        <div className={shell} role="status">
            {translating && !showOriginal
                ? <Loader2 className="size-3 animate-spin text-[var(--color-primary)]" />
                : <Languages className="size-3 text-[var(--color-primary)]" />}
            {showOriginal
                ? (g.showing_original || 'You are viewing the original English text')
                : translating ? (g.translating || 'Translating…') : (g.translated_by_browser || 'Translated by your browser, on your device')}
            <span aria-hidden>·</span>
            <button type="button" onClick={() => setShowOriginal(!showOriginal)} className="font-bold text-[var(--color-primary)] hover:underline">
                {showOriginal ? (g.show_translation || 'View translation') : (g.show_original || 'View original')}
            </button>
        </div>
    );
}
