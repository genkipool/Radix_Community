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
});
