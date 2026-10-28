/**
 * services/nodeRelease.ts
 *
 * The latest published release of the Radix node software (Babylon node),
 * read from its GitHub releases so "on the latest version" follows each new
 * release without touching the code. Only a stable release counts: drafts,
 * pre-releases and test or release-candidate tags ("v1.4.0.0-RC1",
 * "v1.3.0.5-test.1") are skipped.
 *
 * GitHub allows 60 unauthenticated requests an hour per IP, so the answer is
 * cached on the server for a quarter of an hour: one request per instance and
 * period, whatever the traffic.
 */

import { cacheLife, cacheTag } from 'next/cache';

export const NODE_RELEASES_API = 'https://api.github.com/repos/radixdlt/babylon-node/releases';

/** A plain release tag: "v1.4.0.0", nothing after it. */
const STABLE_TAG = /^v?\d+(\.\d+){1,3}$/;

export interface NodeRelease {
    /** As tagged, e.g. "v1.4.0.0". */
    version: string;
    /** The release title, e.g. "Eagle Ray v1.4.0.0". */
    name: string;
    publishedAt: string;
    url: string;
}

interface GithubRelease {
    tag_name?: string;
    name?: string | null;
    draft?: boolean;
    prerelease?: boolean;
    published_at?: string | null;
    html_url?: string;
}

const isStable = (r: GithubRelease) => !r.draft && !r.prerelease && STABLE_TAG.test(r.tag_name?.trim() ?? '');

const toRelease = (r: GithubRelease): NodeRelease => ({
    version: r.tag_name!.trim(),
    name: r.name?.trim() || r.tag_name!.trim(),
    publishedAt: r.published_at ?? '',
    url: r.html_url ?? '',
});

async function github<T>(path: string): Promise<T> {
    const res = await fetch(`${NODE_RELEASES_API}${path}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'radix-community' },
    });
    if (!res.ok) throw new Error(`GitHub releases: ${res.status}`);
    return res.json() as Promise<T>;
}

/**
 * The newest stable release. GitHub's "latest" is tried first; when it is not
 * a plain release tag, the most recent stable one from the list is taken.
 * Throws when GitHub cannot be read, so a failure is never cached as an answer.
 */
export async function fetchLatestNodeRelease(): Promise<NodeRelease> {
    'use cache';
    cacheLife({ stale: 900, revalidate: 900, expire: 86_400 });
    cacheTag('node-release');

    const latest = await github<GithubRelease>('/latest');
    if (isStable(latest)) return toRelease(latest);

    const recent = await github<GithubRelease[]>('?per_page=20');
    const stable = recent.find(isStable);
    if (!stable) throw new Error('GitHub releases: no stable release found');
    return toRelease(stable);
}
