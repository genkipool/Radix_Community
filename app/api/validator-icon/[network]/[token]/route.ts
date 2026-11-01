import { NextResponse } from 'next/server';
import { getValidatorsCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';
import { decodeIconToken } from '@/features/dashboard/staking/lib/validatorIcon';
import { isPublicHost } from '@/lib/publicAddress';

/**
 * GET /api/validator-icon/<network>/<token>
 *
 * Serves a validator's logo from this origin: shrunk to the size a card
 * actually shows, and with a cache header that means the browser never asks
 * for it a second time.
 *
 * The logos live wherever each operator put them. They are full-size images —
 * one of them is 1.7 MB — served with whatever caching their host felt like,
 * mostly "revalidate". On a reload that was a round trip per card before
 * anything could be painted, and the grid filled in one logo at a time over
 * about a second and a half. Coming from here they are a few kilobytes and
 * immutable, so a reload paints them with the first frame.
 *
 * The address travels in the PATH rather than a query string because that is
 * the form a browser will cache under, and the one Next accepts as a local
 * image source.
 *
 * It is NOT an open proxy. The only URLs it will fetch are the ones the
 * validators themselves published on-ledger, read from the same cached set the
 * dashboard renders, over https, on a public host — checked again at every
 * redirect, on the addresses the name resolves to. Anything else is a 404 and
 * the card falls back to its initials, exactly as it does for a broken logo.
 *
 * Whoever runs a validator chooses that file, so it is untrusted: what goes
 * out is always re-encoded here as WebP, from the raster and vector formats a
 * logo comes in, and never the bytes as they came. An SVG served from this
 * origin as it was published would run its scripts here.
 */

/** Enough for any avatar; something larger than this is not a logo. */
const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
/** sharp refuses anything that would decode to more pixels than a logo ever has. */
const MAX_INPUT_PIXELS = 24_000_000;
/** Covers the largest card at twice the pixel density; the zoom uses the original. */
const MAX_DIMENSION = 384;
/** Encoded logos held between requests, so a cold browser cache is not a cold fetch. */
const MEMORY_LIMIT = 200;
/** Redirects followed to reach a logo; each hop is checked like the first. */
const MAX_REDIRECTS = 3;
/** What sharp is asked to read. HEIF/AVIF are left out: their decoder has had the most holes. */
const READABLE_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif', 'svg']);

interface CachedIcon {
    body: Buffer;
    type: string;
}

const memory = new Map<string, CachedIcon>();

type Shrinker = (typeof import('sharp'))['default'];
/** `undefined` while untried, `null` once this host is known not to have it. */
let shrinker: Shrinker | null | undefined;

/**
 * sharp, if this host can run it.
 *
 * It is a native module, and whether its binary survives into a deployment is
 * the host's business, not ours. Imported at the top of the file a host without
 * it takes the whole route down and every card loses its logo to a 500; loaded
 * here, a host without it answers 404 and the cards show their initials.
 */
async function loadShrinker(): Promise<Shrinker | null> {
    if (shrinker !== undefined) return shrinker;
    try {
        shrinker = (await import('sharp')).default;
    } catch (error) {
        logger.warn({ err: error }, '[ValidatorIcon] No sharp here; serving logos at full size');
        shrinker = null;
    }
    return shrinker;
}

function remember(key: string, icon: CachedIcon) {
    memory.delete(key);
    memory.set(key, icon);
    if (memory.size > MEMORY_LIMIT) {
        const oldest = memory.keys().next().value;
        if (oldest !== undefined) memory.delete(oldest);
    }
}

const notFound = () =>
    new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

function respond({ body, type }: CachedIcon) {
    return new NextResponse(new Uint8Array(body), {
        headers: {
            'Content-Type': type,
            // A validator changing its logo changes the URL it publishes, and
            // with it this path, so this answer never becomes the wrong one.
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            // Opened on its own, it is an inert image whatever it contains.
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'Content-Disposition': 'inline',
        },
    });
}

/**
 * Downloads a logo, never trusting the host that serves it.
 *
 * - The response must arrive uncompressed. Asking for `identity` and refusing a
 *   `Content-Encoding` anyway keeps a hostile host from steering the body
 *   through the runtime's decompressors (Brotli among them).
 * - Redirects are followed by hand, a few at most, and every hop has to be https
 *   on a public host like the first URL did.
 * - The body is read as a stream and dropped at the size cap, instead of being
 *   buffered whole before anyone looks at its length.
 */
async function downloadLogo(first: URL): Promise<{ bytes: Buffer; type: string } | null> {
    let url = first;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (url.protocol !== 'https:' || !(await isPublicHost(url.hostname))) return null;
        const upstream = await fetch(url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { Accept: 'image/*', 'Accept-Encoding': 'identity' },
            redirect: 'manual',
        });

        if (upstream.status >= 300 && upstream.status < 400) {
            const location = upstream.headers.get('location');
            await upstream.body?.cancel();
            if (!location) return null;
            let next: URL;
            try {
                next = new URL(location, url);
            } catch {
                return null;
            }
            url = next;
            continue;
        }

        const type = upstream.headers.get('content-type') ?? '';
        const encoding = upstream.headers.get('content-encoding')?.trim().toLowerCase();
        const declared = Number(upstream.headers.get('content-length'));
        if (!upstream.ok || !type.startsWith('image/') || (encoding && encoding !== 'identity') || declared > MAX_BYTES) {
            await upstream.body?.cancel();
            return null;
        }

        const reader = upstream.body?.getReader();
        if (!reader) return null;
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BYTES) {
                await reader.cancel();
                return null;
            }
            chunks.push(value);
        }
        return { bytes: Buffer.concat(chunks), type };
    }
    return null;
}

/**
 * Nothing here is allowed to answer with a 500.
 *
 * A logo is decoration: a card without one falls back to its initials and the
 * page is whole. An unhandled throw instead paints a broken image into every
 * card and fills the reader's console with errors, which is how a missing
 * native module on one host turned into a grid with no logos at all.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ network: string; token: string }> },
) {
    try {
        return await serveIcon(context);
    } catch (error) {
        logger.error({ err: error, url: request.url }, '[ValidatorIcon] Unhandled failure');
        return notFound();
    }
}

async function serveIcon(
    { params }: { params: Promise<{ network: string; token: string }> },
) {
    const { network: rawNetwork, token } = await params;
    const network = validateNetwork(rawNetwork);
    const src = decodeIconToken(token);
    if (!src) return notFound();

    const cached = memory.get(token);
    if (cached) return respond(cached);

    let target: URL;
    try {
        target = new URL(src);
    } catch {
        return notFound();
    }
    if (target.protocol !== 'https:') return notFound();

    // The allowlist: what the validators actually published.
    try {
        const { validators } = await getValidatorsCached(network);
        if (!validators.some((v) => v.iconUrl?.trim() === src)) return notFound();
    } catch (error) {
        // That list is what authorises the fetch, so without it nothing is served.
        logger.error({ err: error, network }, '[ValidatorIcon] Could not read the validator set');
        return notFound();
    }

    let original: Buffer;
    try {
        const downloaded = await downloadLogo(target);
        if (!downloaded) return notFound();
        original = downloaded.bytes;
    } catch (error) {
        logger.error({ err: error, host: target.hostname }, '[ValidatorIcon] Upstream fetch failed');
        return notFound();
    }

    const sharp = await loadShrinker();
    if (!sharp) return notFound();
    let icon: CachedIcon;
    try {
        // The format is read from the bytes, not from what the host claimed.
        const { format } = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
        if (!format || !READABLE_FORMATS.has(format)) return notFound();
        const body = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate() // honour the EXIF orientation before it is stripped
            .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        icon = { body, type: 'image/webp' };
    } catch (error) {
        // Something sharp will not read: the card shows its initials instead.
        logger.warn({ err: error, host: target.hostname }, '[ValidatorIcon] Unreadable logo');
        return notFound();
    }

    remember(token, icon);
    return respond(icon);
}
