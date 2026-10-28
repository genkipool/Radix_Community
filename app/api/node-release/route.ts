import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { fetchLatestNodeRelease } from '@/services/nodeRelease';

/** The latest stable release of the Radix node software, from GitHub (see services/nodeRelease). */
export async function GET() {
    try {
        const release = await fetchLatestNodeRelease();
        return NextResponse.json(release, {
            headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=900' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ err: error }, '[NodeReleaseAPI] %s', message);
        return NextResponse.json({ error: 'release_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
