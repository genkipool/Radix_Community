/**
 * What the active validator set says about the network as a whole: how many
 * run the latest node software, and how spread out they are across hosting
 * providers and countries.
 *
 * Everything counts ACTIVE validators — the ones that run consensus — and the
 * denominator is always all of them, so a validator whose version or provider is
 * not known counts against the totals rather than disappearing from them. How
 * much is known is reported alongside, and a verdict is only given when enough is.
 */
import type { Validator } from '@/types/radix';
import { sanitizeText } from '@/utils/sanitize';
import { shortVersion, validatorLocation, validatorProvider } from './validatorNode';

/* ─── Versions ──────────────────────────────────────────────────────────── */

const RELEASE = /^v?(\d+(?:\.\d+){1,3})/i;

/** "v1.4.0" → [1, 4, 0, 0]; null for anything that is not a release. */
export function releaseOf(version: string | null): number[] | null {
    const match = version ? RELEASE.exec(version.trim()) : null;
    if (!match) return null;
    const parts = match[1].split('.').map(Number);
    while (parts.length < 4) parts.push(0);
    return parts;
}

const compareRelease = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
};

export interface VersionAdoption {
    /**
     * The latest release, as written ("v1.4.0.0"): the one published on GitHub
     * when known, else the highest any active validator runs; null when neither is known.
     */
    latest: string | null;
    /** Where `latest` comes from. */
    source: 'release' | 'validators' | null;
    /** Active validators running it (or a newer build). */
    updated: number;
    /** Active validators in all. */
    total: number;
    /** Of them, those whose version is not known. */
    unknown: number;
    /** `updated` as a share of `total`, 0–100. */
    percent: number;
    /** XRD delegated to the validators on the latest release. */
    updatedStake: number;
    /** XRD delegated to all active validators. */
    totalStake: number;
    /** `updatedStake` as a share of `totalStake`, 0–100. */
    stakePercent: number;
}

/**
 * How long a version our node saw stays valid for this count: the window the
 * node telemetry uses to call a node online. A version seen longer ago may
 * have changed since (the telemetry keeps the last one for days), and the one
 * a validator publishes in its metadata is whatever it last typed, so neither
 * counts: those validators count as unknown, never as an old answer.
 */
export const VERSION_FRESH_MS = 30 * 60_000;

/** The version our node saw on this validator within `VERSION_FRESH_MS`, or null. */
function freshVersion(validator: Validator, now: number): string | null {
    const node = validator.node;
    if (!node?.version || !node.lastSeen || now - node.lastSeen > VERSION_FRESH_MS) return null;
    return sanitizeText(node.version) || null;
}

/**
 * @param release  The latest published release (from GitHub). Without it,
 *                 the highest release the validators run stands in.
 */
export function versionAdoption(
    validators: Validator[],
    { release = null, now = Date.now() }: { release?: string | null; now?: number } = {},
): VersionAdoption {
    const active = validators.filter(v => v.status === 'active');
    const reported = active.map(v => {
        const version = freshVersion(v, now);
        return { version, release: releaseOf(version), stake: v.delegatedStake };
    });
    const known = reported.filter((r): r is { version: string; release: number[]; stake: number } => r.release !== null);

    const newest = known.reduce<(typeof known)[number] | null>(
        (best, r) => (!best || compareRelease(r.release, best.release) > 0 ? r : best), null);
    const published = releaseOf(release);
    const target = published ?? newest?.release ?? null;
    // A validator on a newer build than the published release (a release candidate) is up to date too.
    const onLatest = target ? known.filter(r => compareRelease(r.release, target) >= 0) : [];
    const updated = onLatest.length;
    const total = active.length;
    const updatedStake = onLatest.reduce((sum, r) => sum + r.stake, 0);
    const totalStake = reported.reduce((sum, r) => sum + r.stake, 0);

    return {
        latest: published ? shortVersion(release!) : newest ? shortVersion(newest.version) : null,
        source: published ? 'release' : newest ? 'validators' : null,
        updated,
        total,
        unknown: total - known.length,
        percent: total > 0 ? (updated / total) * 100 : 0,
        updatedStake,
        totalStake,
        stakePercent: totalStake > 0 ? (updatedStake / totalStake) * 100 : 0,
    };
}

/* ─── Concentration ─────────────────────────────────────────────────────── */

export interface Share {
    name: string;
    /** Active validators in it. */
    count: number;
    /** Share of all active validators, 0–100. */
    percent: number;
    /** Share of the active validators' delegated stake, 0–100. */
    stakePercent: number;
}

export interface Distribution {
    /** Biggest first; validators whose group is unknown are not in the list. */
    shares: Share[];
    /** Active validators in all. */
    total: number;
    /** Of them, those whose group is known. */
    known: number;
}

/** Groups the active validators by `groupOf`, case-insensitively, keeping the first spelling seen. */
function distribute(validators: Validator[], groupOf: (v: Validator) => string | null): Distribution {
    const active = validators.filter(v => v.status === 'active');
    const totalStake = active.reduce((sum, v) => sum + v.delegatedStake, 0);
    const groups = new Map<string, { name: string; count: number; stake: number }>();

    for (const v of active) {
        const name = groupOf(v);
        if (!name) continue;
        const key = name.toLowerCase();
        const group = groups.get(key) ?? { name, count: 0, stake: 0 };
        group.count += 1;
        group.stake += v.delegatedStake;
        groups.set(key, group);
    }

    const shares = [...groups.values()]
        .map(g => ({
            name: g.name,
            count: g.count,
            percent: active.length > 0 ? (g.count / active.length) * 100 : 0,
            stakePercent: totalStake > 0 ? (g.stake / totalStake) * 100 : 0,
        }))
        .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return { shares, total: active.length, known: shares.reduce((sum, s) => sum + s.count, 0) };
}

export const providerDistribution = (validators: Validator[]) => distribute(validators, validatorProvider);
export const countryDistribution = (validators: Validator[]) =>
    distribute(validators, v => validatorLocation(v, 'en')?.name ?? null);

/**
 * The fewest groups that together hold more than a third of what is measured —
 * the share that, going offline or colluding, can stall BFT consensus. Counted
 * over all the active set (unknown included in the denominator), so missing data
 * can only make the figure look better than it is, never worse; the caller says
 * so when much is missing.
 */
export function nakamoto(values: number[], total: number): number | null {
    if (total <= 0) return null;
    const sorted = values.toSorted((a, b) => b - a);
    let held = 0;
    for (const [i, value] of sorted.entries()) {
        held += value;
        if (held > total / 3) return i + 1;
    }
    return null;
}

export type Level = 'strong' | 'moderate' | 'weak' | 'insufficient';

/** Below this share of validators with a known provider no verdict is given. */
export const MIN_COVERAGE = 0.6;

export interface Decentralization {
    level: Level;
    /** Known share of the active set, 0–1. */
    coverage: number;
    top: Share | null;
    /** Groups needed to hold over a third of the validators / of the stake; null if they never do. */
    nakamotoValidators: number | null;
    nakamotoStake: number | null;
}

/**
 * A plain reading of how spread out the set is:
 *  - strong: it takes 4 or more groups to reach a third, and none holds over a quarter;
 *  - weak: one group alone holds a third or more (it could stall the network by itself);
 *  - moderate: anything in between.
 * Not a standard — a stated rule, so the verdict can be checked against the numbers.
 */
export function assessDecentralization(distribution: Distribution): Decentralization {
    const { shares, total, known } = distribution;
    const coverage = total > 0 ? known / total : 0;
    const top = shares[0] ?? null;
    const nakamotoValidators = nakamoto(shares.map(s => s.count), total);
    const totalStakePercent = 100;
    const nakamotoStake = nakamoto(shares.map(s => s.stakePercent), totalStakePercent);

    let level: Level;
    if (coverage < MIN_COVERAGE || !top) level = 'insufficient';
    else if (top.percent >= 100 / 3) level = 'weak';
    else if ((nakamotoValidators ?? Infinity) >= 4 && top.percent <= 25) level = 'strong';
    else level = 'moderate';

    return { level, coverage, top, nakamotoValidators, nakamotoStake };
}

/** Share of the validators whose provider is known that sit on a datacenter / hosting network. */
export function hostingShare(validators: Validator[]): { percent: number; known: number } | null {
    const flagged = validators.filter(v => v.status === 'active' && typeof v.node?.hosting === 'boolean');
    if (flagged.length === 0) return null;
    const hosted = flagged.filter(v => v.node?.hosting === true).length;
    return { percent: (hosted / flagged.length) * 100, known: flagged.length };
}
