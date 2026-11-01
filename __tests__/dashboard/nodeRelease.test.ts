// @vitest-environment node
/**
 * The latest node release comes from GitHub, and only a stable one counts:
 * no draft, pre-release, release candidate or test tag.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { fetchLatestNodeRelease, NODE_RELEASES_API } from '@/services/nodeRelease';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
    tag_name: tag, name: `Name ${tag}`, draft: false, prerelease: false, published_at: '2026-09-10T03:59:09Z', html_url: `https://github.com/x/${tag}`, ...extra,
});

const serve = (routes: Record<string, unknown>) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const path = url.slice(NODE_RELEASES_API.length);
        return path in routes
            ? { ok: true, status: 200, json: async () => routes[path] }
            : { ok: false, status: 404, json: async () => ({}) };
    }));

afterEach(() => vi.unstubAllGlobals());

describe('fetchLatestNodeRelease', () => {
    it('takes GitHub\'s latest release when it is a plain release tag', async () => {
        serve({ '/latest': release('v1.4.0.0') });
        expect(await fetchLatestNodeRelease()).toEqual({
            version: 'v1.4.0.0', name: 'Name v1.4.0.0', publishedAt: '2026-09-10T03:59:09Z', url: 'https://github.com/x/v1.4.0.0',
        });
    });

    it('skips test, candidate and pre-release tags for the newest stable one', async () => {
        serve({
            '/latest': release('v1.3.0.5-test.1'),
            '?per_page=20': [release('v1.5.0.0', { prerelease: true }), release('v1.4.0.0-RC1'), release('v1.4.0.0', { draft: true }), release('v1.3.0.5')],
        });
        expect((await fetchLatestNodeRelease()).version).toBe('v1.3.0.5');
    });

    it('throws when GitHub cannot be read, so no failure is cached as an answer', async () => {
        serve({});
        await expect(fetchLatestNodeRelease()).rejects.toThrow(/GitHub releases: 404/);
    });
});
