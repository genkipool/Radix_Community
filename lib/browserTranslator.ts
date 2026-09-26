/**
 * On-device translation with the browser's built-in Translator API (Chrome
 * and Edge 138+). Content written in English (governance proposals) is
 * translated by the reader's browser locally: no server, no API bill,
 * nothing stored anywhere but this tab's memory. Browsers without the API
 * keep the original text.
 *
 * The language model may have to be downloaded first, which the browser only
 * allows during a user gesture. The site's language switcher calls
 * `prewarmTranslator` from its click, so choosing a language is what starts
 * it; pages can also start it on the reader's first interaction.
 */

export type TranslatorAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface BrowserTranslator {
    translate(text: string): Promise<string>;
}

interface DownloadMonitor {
    addEventListener(type: 'downloadprogress', listener: (e: { loaded: number }) => void): void;
}

interface TranslatorFactory {
    availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<Exclude<TranslatorAvailability, 'unsupported'>>;
    create(options: { sourceLanguage: string; targetLanguage: string; monitor?: (m: DownloadMonitor) => void }): Promise<BrowserTranslator>;
}

const SOURCE = 'en';

function factory(): TranslatorFactory | null {
    if (typeof self === 'undefined') return null;
    const candidate = (self as unknown as { Translator?: TranslatorFactory }).Translator;
    return candidate && typeof candidate.availability === 'function' ? candidate : null;
}

export async function translatorAvailability(target: string): Promise<TranslatorAvailability> {
    const api = factory();
    if (!api || target === SOURCE) return 'unsupported';
    try {
        return await api.availability({ sourceLanguage: SOURCE, targetLanguage: target });
    } catch {
        return 'unavailable';
    }
}

const translators = new Map<string, Promise<BrowserTranslator>>();

/* ── Download state, shared with React through useSyncExternalStore ── */

export interface TranslatorState {
    phase: 'idle' | 'downloading' | 'ready' | 'failed';
    /** Download progress 0..1 while downloading. */
    progress: number;
}

const IDLE: TranslatorState = { phase: 'idle', progress: 0 };
const states = new Map<string, TranslatorState>();
const listeners = new Set<() => void>();

function setState(target: string, next: TranslatorState) {
    states.set(target, next);
    listeners.forEach(l => l());
}

export function subscribeTranslator(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function translatorState(target: string): TranslatorState {
    return states.get(target) ?? IDLE;
}

/**
 * One translator per target language for the whole tab. Creating it may
 * download the language model, which needs a user gesture when the model is
 * not on the device yet.
 */
export function getTranslator(target: string): Promise<BrowserTranslator> {
    const existing = translators.get(target);
    if (existing) return existing;
    const api = factory();
    if (!api) return Promise.reject(new Error('Translator API not available'));
    setState(target, { phase: 'downloading', progress: 0 });
    const created = api.create({
        sourceLanguage: SOURCE,
        targetLanguage: target,
        monitor: m => m.addEventListener('downloadprogress', e => setState(target, { phase: 'downloading', progress: e.loaded })),
    });
    translators.set(target, created);
    created.then(
        () => setState(target, { phase: 'ready', progress: 1 }),
        () => { translators.delete(target); setState(target, { phase: 'failed', progress: 0 }); },
    );
    return created;
}

/**
 * Starts the translator for a language from a user gesture (a click on the
 * language switcher). Does nothing for English or without the API.
 */
export function prewarmTranslator(target: string): void {
    if (target === SOURCE || !factory()) return;
    getTranslator(target).catch(() => { /* not available for this pair: pages keep the original */ });
}

/** Same text, same language: translated once per tab. */
const cache = new Map<string, Promise<string>>();

/** Text that has nothing to translate: numbers, hashes, addresses, symbols. */
const UNTRANSLATABLE = /^[\s\d\p{P}\p{S}]*$|^[\s]*(?:account|component|resource|package|validator|txid|internal_\w+)_[a-z0-9_]+[\s]*$|^[\s]*[0-9a-fA-F]{16,}[\s]*$/u;

/**
 * Names and acronyms of the source (RadixDAO, XRD, CAIP, GP-PRE-1): words with
 * an inner capital, two or more capitals, or letters mixed with digits. The
 * translator tends to re-case them ("Radixdao"), so they are put back.
 */
const NAME = /\b(?=[A-Za-z0-9-]*[A-Z][A-Za-z0-9-]*[A-Z0-9])[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9]\b/g;
const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function restoreNames(source: string, translated: string): string {
    const names = new Set(source.match(NAME) ?? []);
    let out = translated;
    for (const name of names) {
        out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), name);
    }
    return out;
}

export function translateText(target: string, text: string): Promise<string> {
    if (!text.trim() || UNTRANSLATABLE.test(text)) return Promise.resolve(text);
    const key = `${target}\u0000${text}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = getTranslator(target)
        .then(t => t.translate(text))
        .then(out => restoreNames(text, out))
        .catch(() => { cache.delete(key); return text; });
    cache.set(key, pending);
    return pending;
}

/** Elements whose text must stay as written. */
const KEEP = new Set(['CODE', 'PRE', 'KBD', 'SAMP']);

/**
 * Translates already-sanitised HTML node by node: only text nodes change,
 * so structure, links and code are kept and nothing new is ever parsed as
 * markup. Leading/trailing spaces of each node are preserved.
 */
export async function translateHtml(target: string, html: string): Promise<string> {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            for (let el = node.parentElement; el && el !== doc.body; el = el.parentElement) {
                if (KEEP.has(el.tagName)) return NodeFilter.FILTER_REJECT;
            }
            return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
    });
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

    await Promise.all(nodes.map(async node => {
        const raw = node.nodeValue ?? '';
        const lead = raw.match(/^\s*/)?.[0] ?? '';
        const trail = raw.match(/\s*$/)?.[0] ?? '';
        const translated = await translateText(target, raw.trim());
        node.nodeValue = `${lead}${translated}${trail}`;
    }));
    return doc.body.innerHTML;
}
