/**
 * services/nodeTelemetry.ts
 *
 * Whether each validator's node is up and reachable, where it runs and what it
 * runs, decided from the strongest evidence available:
 *
 *   1. Consensus. An active validator is asked to propose blocks every epoch
 *      and the Gateway reports how many it made and missed. One that made none
 *      and missed them all is not validating, whatever else looks fine.
 *   2. Our full node. A script on it (scripts/node-telemetry) reads the peers
 *      it is connected to and its address book every five minutes, probes the
 *      gossip port of every validator node it has an address for, locates the
 *      IPs and writes the result to Redis keyed by node public key. No IP ever
 *      leaves the node: only the country.
 *
 * With nothing to go on the answer is "unknown" (null), never a guess.
 *
 * A new observed field needs three touches: the script, the
 * `ValidatorNodeTelemetry` type and `parseNodeTelemetry` below.
 */

import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { sanitizeText } from '@/utils/sanitize';
import { countryName, normalizeCountryCode } from '@/utils/country';
import type { OnlineReason, Validator, ValidatorNodeTelemetry } from '@/types/radix';
import type { Network } from '@/services/gateway/client';

/** Redis keys the script writes. Keep in sync with scripts/node-telemetry. */
export const nodeTelemetryKeys = (network: Network) => ({
    /** Hash: node public key (hex) → JSON ValidatorNodeTelemetry. */
    nodes: `validator_nodes_${network}`,
    /** String: JSON { updatedAt } of the latest successful run. */
    meta: `validator_nodes_${network}_meta`,
});

/**
 * Past this age the script is presumed down. Its last view would keep showing
 * nodes online that may have gone, so it is ignored. Four missed runs.
 */
export const TELEMETRY_MAX_AGE_MS = 20 * 60_000;

/**
 * Finished epochs weighed, besides the live one, to tell whether an active
 * validator is producing. Two epochs are ten minutes: long enough not to judge
 * on one unlucky round, short enough to notice a node that went down.
 */
export const CONSENSUS_EPOCHS = 2;

/**
 * A single missed proposal is too little to call a validator down: one with a
 * sound record may just have been unlucky. It takes this many misses, or a
 * 14-day uptime below `LOW_UPTIME_PERCENT` that says the misses are a pattern.
 */
export const MIN_MISSED_PROPOSALS = 2;
export const LOW_UPTIME_PERCENT = 50;

const MAX_TEXT_LENGTH = 64;

export type NodeTelemetryMap = Map<string, ValidatorNodeTelemetry>;

const normalizeKey = (publicKey: string) => publicKey.trim().toLowerCase();

/* ─── Reading the script's view ─────────────────────────────────────────── */

/** Validates one Redis entry. Anything malformed is dropped, not guessed. */
export function parseNodeTelemetry(raw: unknown): ValidatorNodeTelemetry | null {
    let value = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return null; }
    }
    if (!value || typeof value !== 'object') return null;

    const entry = value as Record<string, unknown>;
    const lastSeen = Number(entry.lastSeen ?? 0);
    if (!Number.isFinite(lastSeen) || lastSeen < 0) return null;

    const text = (field: unknown) => typeof field === 'string'
        ? sanitizeText(field).slice(0, MAX_TEXT_LENGTH) || null
        : null;

    return {
        countryCode: normalizeCountryCode(typeof entry.countryCode === 'string' ? entry.countryCode : null),
        online: entry.online === true,
        acceptsConnections: typeof entry.acceptsConnections === 'boolean' ? entry.acceptsConnections : null,
        version: text(entry.version),
        commit: text(entry.commit),
        lastSeen,
    };
}

/** Builds the lookup map from the raw hash, if the run behind it is fresh. */
export function buildNodeTelemetryMap(
    hash: Record<string, unknown> | null | undefined,
    updatedAt: number | null | undefined,
    now = Date.now(),
): NodeTelemetryMap {
    const map: NodeTelemetryMap = new Map();
    if (!hash || !updatedAt || now - updatedAt > TELEMETRY_MAX_AGE_MS) return map;

    for (const [publicKey, raw] of Object.entries(hash)) {
        const entry = parseNodeTelemetry(raw);
        if (entry) map.set(normalizeKey(publicKey), entry);
    }
    return map;
}

/** Reads the latest view from Redis. Never throws: no view is a valid answer. */
export async function readNodeTelemetry(network: Network): Promise<NodeTelemetryMap> {
    const redis = getRedis();
    if (!redis) return new Map();

    const keys = nodeTelemetryKeys(network);
    try {
        const [meta, hash] = await Promise.all([
            redis.get<{ updatedAt?: number }>(keys.meta),
            redis.hgetall<Record<string, unknown>>(keys.nodes),
        ]);
        const map = buildNodeTelemetryMap(hash, meta?.updatedAt);
        if (hash && map.size === 0) {
            logger.warn({ network, updatedAt: meta?.updatedAt }, '[NodeTelemetry] View is stale or empty, ignoring it');
        }
        return map;
    } catch (err) {
        logger.error({ err, network }, '[NodeTelemetry] Redis read failed');
        return new Map();
    }
}

/* ─── Deciding health ───────────────────────────────────────────────────── */

type ConsensusInput = Pick<Validator, 'status' | 'epochPerformance' | 'recentUptime'>;

/**
 * What consensus says of a validator: producing (true), missing every
 * proposal it was given (false), or nothing (null) when it is not in the
 * active set, had no proposals to make or too few to judge by.
 */
export function consensusSignal({ status, epochPerformance, recentUptime }: ConsensusInput): boolean | null {
    if (status !== 'active' || !epochPerformance?.length) return null;

    // Back in the live epoch: it has recovered, whatever it missed before.
    const live = epochPerformance.find((e) => e.isLive);
    if (live && live.completedProposals > 0) return true;

    const finished = epochPerformance
        .filter((e) => !e.isLive)
        .sort((a, b) => b.epoch - a.epoch)
        .slice(0, CONSENSUS_EPOCHS);
    const made = finished.reduce((sum, e) => sum + e.completedProposals, 0);
    const missed = finished.reduce((sum, e) => sum + e.missedProposals, 0);

    if (made > 0) return true;
    if (missed >= MIN_MISSED_PROPOSALS) return false;
    return missed > 0 && recentUptime < LOW_UPTIME_PERCENT ? false : null;
}

export interface OnlineResolution {
    online: boolean | null;
    reason: OnlineReason;
}

/** Strongest evidence first: consensus, a live connection, then a port probe. */
export function resolveOnline(
    validator: ConsensusInput,
    node: ValidatorNodeTelemetry | undefined,
): OnlineResolution {
    const consensus = consensusSignal(validator);
    if (consensus !== null) return { online: consensus, reason: consensus ? 'producing' : 'missing_proposals' };
    if (node?.online) return { online: true, reason: 'connected' };
    if (node?.acceptsConnections === true) return { online: true, reason: 'reachable' };
    if (node?.acceptsConnections === false) return { online: false, reason: 'unreachable' };
    return { online: null, reason: 'no_data' };
}

/**
 * The validator with its health decided and what our node observed laid over
 * the Gateway data. Fields our node could not observe keep the Gateway's.
 */
export function withNodeHealth(validator: Validator, telemetry: NodeTelemetryMap): Validator {
    const node = validator.publicKey ? telemetry.get(normalizeKey(validator.publicKey)) : undefined;
    const { online, reason } = resolveOnline(validator, node);

    const withHealth: Validator = {
        ...validator,
        node: node ?? null,
        onlineStatus: online,
        onlineReason: reason,
        acceptsConnect: node?.acceptsConnections ?? null,
    };
    if (!node) return withHealth;

    return {
        ...withHealth,
        // English on the server: it is the grouping key for the country share
        // and what search matches. The client localises from the code.
        country: node.countryCode ? countryName(node.countryCode, 'en') : validator.country,
        countryCode: node.countryCode ?? validator.countryCode,
        // Version and commit travel together: never a new version with an old commit.
        ...(node.version ? { version: node.version, commit: node.commit ?? '' } : {}),
    };
}
