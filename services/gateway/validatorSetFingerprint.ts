/**
 * services/gateway/validatorSetFingerprint.ts
 *
 * A short digest of what makes one validator list different from another to
 * a delegator: which validators exist and how each one presents itself.
 *
 * The full list is expensive to build, so it is cached: in Redis, in the Next
 * data cache, at the CDN and in the browser. Each layer is right to serve an
 * old copy for a few minutes, as long as nothing a reader would notice has
 * changed. The digest is one light walk of the Gateway list, cheap enough to
 * check often, and it is what tells those layers apart from the ledger: when
 * it moves, the cached list is rebuilt at once instead of being served for
 * another round of minutes.
 *
 * Stake, uptime and APY are left out on purpose. They move every epoch, and
 * being a few minutes behind on them is exactly what the caches are for.
 */

import { createHash } from 'node:crypto';
import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import type { Network } from './client';
import { fetchValidatorListRest } from './validatorList';

/** How long one live fingerprint is trusted before the Gateway is asked again. */
export const FINGERPRINT_TTL_S = 30;

const fingerprintKey = (network: Network) => `validators_fingerprint_${network}`;

/*
 * The fingerprint is stored with the moment it expires (`<fingerprint>@<ms>`),
 * so each instance keeps it in memory for exactly as long as Redis keeps it.
 * Asking Redis on every read of the validator list cost a billed command per
 * page view; this way it is one per instance every TTL, and never staler.
 */
const held = new Map<Network, { fingerprint: string; expiresAt: number }>();

function parseStored(stored: string): { fingerprint: string; expiresAt: number | null } {
    const at = stored.lastIndexOf('@');
    if (at < 0) return { fingerprint: stored, expiresAt: null };
    const expiresAt = Number(stored.slice(at + 1));
    return { fingerprint: stored.slice(0, at), expiresAt: Number.isFinite(expiresAt) ? expiresAt : null };
}

/** Forgets what this instance holds; for tests. */
export function forgetHeldFingerprints() {
    held.clear();
}

/** Metadata that changes how a validator shows up in the list. */
const IDENTITY_METADATA = ['name', 'icon_url', 'info_url', 'description'] as const;

export interface FingerprintSource {
    address: string;
    state?: {
        is_registered?: boolean;
        accepts_delegated_stake?: boolean;
        public_key?: { key_hex?: string };
    };
    effective_fee_factor?: {
        current?: { fee_factor?: number | string };
        pending?: { fee_factor?: number | string };
    };
    metadata?: {
        items?: Array<{ key: string; value?: { typed?: { value?: unknown } } }>;
    };
}

const metadataValue = (validator: FingerprintSource, key: string) =>
    validator.metadata?.items?.find((item) => item.key === key)?.value?.typed?.value ?? null;

/** Order-independent digest of the validator set as a delegator sees it. */
export function validatorSetFingerprint(validators: FingerprintSource[]): string {
    const rows = validators
        .map((validator) => [
            validator.address,
            validator.state?.is_registered ?? null,
            validator.state?.accepts_delegated_stake ?? null,
            validator.state?.public_key?.key_hex ?? null,
            String(validator.effective_fee_factor?.current?.fee_factor ?? ''),
            String(validator.effective_fee_factor?.pending?.fee_factor ?? ''),
            ...IDENTITY_METADATA.map((key) => metadataValue(validator, key)),
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
}

/**
 * The fingerprint of the ledger right now, shared for `FINGERPRINT_TTL_S`
 * across every request and instance. Null when it cannot be read: callers
 * then keep what they have rather than guess that it changed.
 */
export async function fetchLiveValidatorSetFingerprint(network: Network): Promise<string | null> {
    const redis = getRedis();
    const key = fingerprintKey(network);

    const mine = held.get(network);
    if (mine && Date.now() < mine.expiresAt) return mine.fingerprint;

    if (redis) {
        try {
            const cached = await redis.get<string>(key);
            if (cached) {
                const { fingerprint, expiresAt } = parseStored(String(cached));
                if (expiresAt) held.set(network, { fingerprint, expiresAt });
                return fingerprint;
            }
        } catch (err) {
            logger.warn({ err, network }, '[ValidatorFingerprint] Redis read failed');
        }
    }

    try {
        const validators = await fetchValidatorListRest<FingerprintSource>(network);
        if (validators.length === 0) return null;
        const fingerprint = validatorSetFingerprint(validators);
        const expiresAt = Date.now() + FINGERPRINT_TTL_S * 1000;
        held.set(network, { fingerprint, expiresAt });
        redis?.set(key, `${fingerprint}@${expiresAt}`, { ex: FINGERPRINT_TTL_S }).catch((err) =>
            logger.warn({ err, network }, '[ValidatorFingerprint] Redis write failed'),
        );
        return fingerprint;
    } catch (err) {
        logger.warn({ err, network }, '[ValidatorFingerprint] Gateway read failed');
        return null;
    }
}
