import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fresh module per test: the translator and its cache live at module level.
async function load() {
    vi.resetModules();
    return import('@/lib/browserTranslator');
}

const fakeTranslate = vi.fn(async (text: string) => `[es] ${text}`);
function installTranslator(availability = 'available') {
    const create = vi.fn(async (opts: { monitor?: (m: { addEventListener: (t: string, l: (e: { loaded: number }) => void) => void }) => void }) => {
        opts.monitor?.({ addEventListener: (_t, l) => { l({ loaded: 0.5 }); l({ loaded: 1 }); } });
        return { translate: fakeTranslate };
    });
    (globalThis as unknown as { Translator: unknown }).Translator = { availability: vi.fn(async () => availability), create };
    return create;
}

beforeEach(() => fakeTranslate.mockClear());
afterEach(() => { delete (globalThis as unknown as { Translator?: unknown }).Translator; });

describe('browserTranslator', () => {
    it('keeps the original when the browser has no Translator API', async () => {
        const t = await load();
        expect(await t.translatorAvailability('es')).toBe('unsupported');
        expect(await t.translateText('es', 'Hello')).toBe('Hello');
        expect(() => t.prewarmTranslator('es')).not.toThrow();
    });

    it('translates text once per tab and leaves addresses, hashes and figures alone', async () => {
        installTranslator();
        const t = await load();
        expect(await t.translatorAvailability('es')).toBe('available');
        expect(await t.translateText('es', 'Hello')).toBe('[es] Hello');
        expect(await t.translateText('es', 'Hello')).toBe('[es] Hello');
        expect(fakeTranslate).toHaveBeenCalledTimes(1);
        expect(await t.translateText('es', 'account_rdx1_test_voter')).toBe('account_rdx1_test_voter');
        expect(await t.translateText('es', '33a668f69af6b57d34cdd02a')).toBe('33a668f69af6b57d34cdd02a');
        expect(await t.translateText('es', '1,350.8 %')).toBe('1,350.8 %');
        expect(fakeTranslate).toHaveBeenCalledTimes(1);
    });

    it('translates HTML text only, keeping structure, links and code', async () => {
        installTranslator();
        const t = await load();
        const html = '<h2>Voting options</h2><p>Read <a href="https://example.org" target="_blank">the draft</a> and run <code>sha256sum file</code>.</p>';
        expect(await t.translateHtml('es', html)).toBe(
            '<h2>[es] Voting options</h2><p>[es] Read <a href="https://example.org" target="_blank">[es] the draft</a> [es] and run <code>sha256sum file</code>.</p>',
        );
    });

    it('reports the model download started from a gesture', async () => {
        const create = installTranslator('downloadable');
        const t = await load();
        const seen: string[] = [];
        t.subscribeTranslator(() => seen.push(`${t.translatorState('es').phase}:${t.translatorState('es').progress}`));
        t.prewarmTranslator('es');
        t.prewarmTranslator('es');
        await t.getTranslator('es');
        expect(create).toHaveBeenCalledTimes(1);
        expect(seen).toEqual(['downloading:0', 'downloading:0.5', 'downloading:1', 'ready:1']);
        t.prewarmTranslator('en');
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('puts back names and acronyms the translator re-cases', async () => {
        const t = await load();
        expect(t.restoreNames('RadixDAO: ratify GP-PRE-1 with XRD', 'Radixdao: ratificar Gp-pre-1 con xrd')).toBe('RadixDAO: ratificar GP-PRE-1 con XRD');
        expect(t.restoreNames('The community votes', 'La comunidad vota')).toBe('La comunidad vota');
    });
});
