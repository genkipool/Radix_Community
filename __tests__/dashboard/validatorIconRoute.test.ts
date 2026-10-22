/**
 * What the logo route answers when the host it runs on is not the one it was
 * written on.
 *
 * sharp is a native module and whether its binary survives into a deployment is
 * the host's business. Imported at the top of the route it took the whole
 * module down where it was missing, and every card in staking answered 500 and
 * showed a broken image. A logo is decoration: the route has to degrade to the
 * original bytes, and never to a 500.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const ICON_URL = 'https://logos.example/validator.png';

const getValidatorsCached = vi.fn();

vi.mock('@/services/radixApi', () => ({
    getValidatorsCached: (...args: unknown[]) => getValidatorsCached(...args),
}));
vi.mock('@/lib/logger', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/** The route reads the module fresh, so each test gets its own sharp verdict. */
async function loadRoute() {
    vi.resetModules();
    return import('@/app/api/validator-icon/[network]/[token]/route');
}

function request(url: string) {
    const token = Buffer.from(url).toString('base64url');
    return {
        req: new Request(`https://radix.example/api/validator-icon/mainnet/${token}`),
        context: { params: Promise.resolve({ network: 'mainnet', token }) },
    };
}

describe('the validator logo route', () => {
    beforeEach(() => {
        getValidatorsCached.mockResolvedValue({ validators: [{ iconUrl: ICON_URL }] });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG, {
            status: 200,
            headers: { 'content-type': 'image/png' },
        })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.doUnmock('sharp');
        vi.clearAllMocks();
    });

    it('serves the original logo when sharp is not available on this host', async () => {
        vi.doMock('sharp', () => { throw new Error('Could not load the sharp module'); });

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(res.headers.get('cache-control')).toContain('immutable');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    });

    it('shrinks the logo when sharp is available', async () => {
        const webp = new Uint8Array([1, 2, 3]);
        vi.doMock('sharp', () => ({
            default: () => ({
                rotate: () => ({
                    resize: () => ({
                        webp: () => ({ toBuffer: async () => Buffer.from(webp) }),
                    }),
                }),
            }),
        }));

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/webp');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(webp);
    });

    it('answers 404, never 500, when something unforeseen throws', async () => {
        vi.doMock('sharp', () => ({ default: () => { throw new Error('boom'); } }));
        getValidatorsCached.mockImplementation(() => { throw new Error('gateway is down'); });

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
    });

    it('still refuses a logo no validator published', async () => {
        vi.doMock('sharp', () => { throw new Error('no sharp'); });

        const { GET } = await loadRoute();
        const { req, context } = request('https://somewhere.else/not-a-logo.png');
        const res = await GET(req, context);

        expect(res.status).toBe(404);
        expect(fetch).not.toHaveBeenCalled();
    });

    describe('does not trust the host serving the logo', () => {
        const noSharp = () => vi.doMock('sharp', () => { throw new Error('no sharp'); });
        const get = async () => {
            const { GET } = await loadRoute();
            const { req, context } = request(ICON_URL);
            return GET(req, context);
        };

        it('asks for the logo uncompressed and does not follow redirects on its own', async () => {
            noSharp();
            await get();
            const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
            expect(init.redirect).toBe('manual');
            expect(init.headers).toMatchObject({ 'Accept-Encoding': 'identity' });
        });

        it('refuses a body that arrives compressed, Brotli included', async () => {
            noSharp();
            vi.mocked(fetch).mockResolvedValue(new Response(PNG, { headers: { 'content-type': 'image/png', 'content-encoding': 'br' } }));
            expect((await get()).status).toBe(404);
        });

        it('follows a redirect to another public https host', async () => {
            noSharp();
            vi.mocked(fetch)
                .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://cdn.example/logo.png' } }))
                .mockResolvedValueOnce(new Response(PNG, { headers: { 'content-type': 'image/png' } }));
            const res = await get();
            expect(res.status).toBe(200);
            expect(vi.mocked(fetch).mock.calls[1][0].toString()).toBe('https://cdn.example/logo.png');
        });

        it.each([
            'http://cdn.example/logo.png',
            'https://127.0.0.1/logo.png',
            'https://169.254.169.254/latest/meta-data',
            'https://[::1]/logo.png',
            'https://[fd00::1]/logo.png',
            'https://[::ffff:10.0.0.5]/logo.png',
            'https://100.64.0.1/logo.png',
            'https://0.0.0.0/logo.png',
        ])('refuses a redirect to %s', async (location) => {
            noSharp();
            vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
            expect((await get()).status).toBe(404);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('gives up on a redirect loop', async () => {
            noSharp();
            vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 302, headers: { location: 'https://cdn.example/again' } }));
            expect((await get()).status).toBe(404);
            expect(fetch).toHaveBeenCalledTimes(4);
        });

        it('stops reading a body that grows past the cap, even without a Content-Length', async () => {
            noSharp();
            const chunk = new Uint8Array(1024 * 1024);
            let sent = 0;
            const body = new ReadableStream<Uint8Array>({
                pull(controller) { sent += 1; controller.enqueue(chunk); },
            });
            vi.mocked(fetch).mockResolvedValue(new Response(body, { headers: { 'content-type': 'image/png' } }));
            expect((await get()).status).toBe(404);
            expect(sent).toBeLessThan(10); // 3 MB cap: it was not read to the end
        });

        it('shows an SVG logo sharp cannot read, but as a download when opened on its own', async () => {
            noSharp();
            vi.mocked(fetch).mockResolvedValue(new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>', { headers: { 'content-type': 'image/svg+xml' } }));
            const res = await get();
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('image/svg+xml');
            expect(res.headers.get('content-disposition')).toMatch(/^attachment/);
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });

        it('still refuses what is not a picture, whatever it calls itself', async () => {
            noSharp();
            vi.mocked(fetch).mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
            expect((await get()).status).toBe(404);
        });

        it('still serves a raster original untouched, with nosniff', async () => {
            noSharp();
            const res = await get();
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('image/png');
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });
});
