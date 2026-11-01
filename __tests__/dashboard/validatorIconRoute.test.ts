/**
 * What the logo route answers when the host it runs on is not the one it was
 * written on.
 *
 * sharp is a native module and whether its binary survives into a deployment is
 * the host's business. Imported at the top of the route it took the whole
 * module down where it was missing, and every card in staking answered 500 and
 * showed a broken image. A logo is decoration: the route has to degrade to a
 * 404 (the card shows its initials), and never to a 500.
 *
 * The logo is chosen by whoever runs the validator, so it is untrusted: only a
 * re-encoded image ever goes out, never the bytes as they came, and the fetch
 * never reaches a private address, not even through a redirect.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const ICON_URL = 'https://logos.example/validator.png';

const getValidatorsCached = vi.fn();
const isPublicHost = vi.fn();

vi.mock('@/services/radixApi', () => ({
    getValidatorsCached: (...args: unknown[]) => getValidatorsCached(...args),
}));
vi.mock('@/lib/publicAddress', () => ({
    isPublicHost: (host: string) => isPublicHost(host),
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

/** sharp reading `format` from the bytes and encoding them to `webp`. */
function mockSharp(format: string, webp: Uint8Array) {
    vi.doMock('sharp', () => ({
        default: () => ({
            metadata: async () => ({ format }),
            rotate: () => ({
                resize: () => ({
                    webp: () => ({ toBuffer: async () => Buffer.from(webp) }),
                }),
            }),
        }),
    }));
}

describe('the validator logo route', () => {
    beforeEach(() => {
        getValidatorsCached.mockResolvedValue({ validators: [{ iconUrl: ICON_URL }] });
        isPublicHost.mockResolvedValue(true);
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

    it('answers 404, not the original bytes, when sharp is not available on this host', async () => {
        vi.doMock('sharp', () => { throw new Error('Could not load the sharp module'); });

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
    });

    it('shrinks the logo when sharp is available, as an inert image', async () => {
        const webp = new Uint8Array([1, 2, 3]);
        mockSharp('png', webp);

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/webp');
        expect(res.headers.get('cache-control')).toContain('immutable');
        expect(res.headers.get('content-security-policy')).toContain('sandbox');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(webp);
    });

    it('never serves a logo sharp cannot read, an SVG with a script say, as it came', async () => {
        vi.doMock('sharp', () => ({
            default: () => ({ metadata: async () => { throw new Error('unreadable'); } }),
        }));
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg onload="alert(1)"/>', {
            status: 200,
            headers: { 'content-type': 'image/svg+xml' },
        })));

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
    });

    it('does not decode formats outside the allowed ones', async () => {
        mockSharp('heif', new Uint8Array([1]));

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
    });

    it('refuses a logo on a host that resolves to a private address', async () => {
        mockSharp('png', new Uint8Array([1]));
        isPublicHost.mockResolvedValue(false);

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('checks every redirect, and stops at one to a private host', async () => {
        mockSharp('png', new Uint8Array([1]));
        isPublicHost.mockImplementation(async (host: string) => host !== '169.254.169.254');
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
            status: 302,
            headers: { location: 'https://169.254.169.254/latest/meta-data/' },
        })));

        const { GET } = await loadRoute();
        const { req, context } = request(ICON_URL);
        const res = await GET(req, context);

        expect(res.status).toBe(404);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(isPublicHost).toHaveBeenLastCalledWith('169.254.169.254');
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
