/**
 * Protocol-update signalling target.
 *
 * Configured via environment variables so it can be updated from Vercel — change
 * the value and press "Redeploy", no code change needed — every time the network
 * announces a new protocol update.
 *
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL
 *     The EXACT 32-character protocol version name validators must signal
 *     on-ledger (the string passed to `signal_protocol_update_readiness`). The
 *     engine rejects anything whose length is not exactly 32
 *     (ValidatorError::InvalidProtocolVersionNameLength), so voting is only
 *     offered when this is present and 32 chars long.
 *
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_NAME
 *     A human-friendly label shown on the badge once a validator has signalled
 *     this version (e.g. "Cuttlefish"). Falls back to the raw signal when unset.
 *
 * NOTE: NEXT_PUBLIC_* values are inlined at build time. Changing them in Vercel
 * takes effect after a redeploy (which needs no code change).
 */

/** Exact length the ledger requires for a protocol version name. */
export const PROTOCOL_VERSION_NAME_LEN = 32;

export const PROTOCOL_UPDATE_SIGNAL = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL ?? '').trim();
export const PROTOCOL_UPDATE_NAME = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_NAME ?? '').trim();

/**
 * Whether a valid target is configured. Voting is only offered when the signal
 * is exactly 32 characters, otherwise the on-ledger call would fail.
 */
export const PROTOCOL_UPDATE_TARGET_ENABLED =
    PROTOCOL_UPDATE_SIGNAL.length === PROTOCOL_VERSION_NAME_LEN;

/** True when a validator has not signalled any protocol version. */
export const isNoneProtocolVote = (vote?: string | null): boolean => {
    const v = (vote ?? '').trim();
    return v === '' || v.toLowerCase() === 'none';
};

/**
 * Has this validator signalled the configured target? The env vars are the
 * source of truth: a vote matches the target when it equals the raw signal
 * (Gateway returned it unmapped) OR the friendly name (Gateway's own lookup
 * already mapped it to the same label the env declares).
 */
export const hasVotedTarget = (vote?: string | null): boolean => {
    if (!PROTOCOL_UPDATE_TARGET_ENABLED) return false;
    const v = (vote ?? '').trim();
    return v === PROTOCOL_UPDATE_SIGNAL || (!!PROTOCOL_UPDATE_NAME && v === PROTOCOL_UPDATE_NAME);
};

/**
 * Text for the badge. The env vars are the source of truth: when the vote is
 * the configured target it always renders the env name (falling back to the
 * signal only if no name is set), regardless of what the Gateway returned.
 * A non-target vote shows its raw value.
 */
export const protocolVoteDisplayName = (vote?: string | null): string => {
    if (isNoneProtocolVote(vote)) return '';
    const v = (vote as string).trim();
    if (hasVotedTarget(v)) return PROTOCOL_UPDATE_NAME || PROTOCOL_UPDATE_SIGNAL;
    return v;
};
