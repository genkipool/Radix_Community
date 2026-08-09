import { NextResponse } from 'next/server';
import { getValidatorsCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';
import { decodeIconToken } from '@/features/dashboard/staking/lib/validatorIcon';

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
 * dashboard renders, over https, on a public host. Anything else is a 404 and
 * the card falls back to its initials, exactly as it does for a broken logo.
 */

/** Enough for any avatar; something larger than this is not a logo. */
const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
/** Covers the largest card at twice the pixel density; the zoom uses the original. */
const MAX_DIMENSION = 384;
/** Encoded logos held between requests, so a cold browser cache is not a cold fetch. */
const MEMORY_LIMIT = 200;

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
 * here, the worst case is the branch this route already had for an image sharp
 * cannot read — the original bytes, served from our origin with the same
 * immutable cache header. Bigger, but on screen.
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
        },
    });
}

/** Rejects loopback, link-local and private literals: this fetch runs on our network. */
function isPublicHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
    if (/^\[?::1\]?$/.test(host)) return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^169\.254\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
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
    if (target.protocol !== 'https:' || !isPublicHost(target.hostname)) return notFound();

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
    let originalType: string;
    try {
        const upstream = await fetch(target, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { Accept: 'image/*' },
        });
        originalType = upstream.headers.get('content-type') ?? '';
        if (!upstream.ok || !originalType.startsWith('image/')) return notFound();

        const bytes = await upstream.arrayBuffer();
        if (bytes.byteLength > MAX_BYTES) return notFound();
        original = Buffer.from(bytes);
    } catch (error) {
        logger.error({ err: error, host: target.hostname }, '[ValidatorIcon] Upstream fetch failed');
        return notFound();
    }

    let icon: CachedIcon = { body: original, type: originalType };
    const sharp = await loadShrinker();
    if (sharp) {
        try {
            const body = await sharp(original)
                .rotate() // honour the EXIF orientation before it is stripped
                .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();
            icon = { body, type: 'image/webp' };
        } catch (error) {
            // Something sharp will not read — an animated format, an odd SVG. The
            // original still works, and is still worth serving with a cache header.
            logger.warn({ err: error, host: target.hostname }, '[ValidatorIcon] Serving the original');
        }
    }

    remember(token, icon);
    return respond(icon);
}
