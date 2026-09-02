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

/** Has this validator already signalled the configured target version? */
export const hasVotedTarget = (vote?: string | null): boolean =>
    PROTOCOL_UPDATE_TARGET_ENABLED && (vote ?? '').trim() === PROTOCOL_UPDATE_SIGNAL;

/**
 * Friendly text for the badge: the human label when the vote matches the
 * configured target, otherwise the raw signalled value ('' when none).
 */
export const protocolVoteDisplayName = (vote?: string | null): string => {
    if (isNoneProtocolVote(vote)) return '';
    const v = (vote as string).trim();
    if (hasVotedTarget(v) && PROTOCOL_UPDATE_NAME) return PROTOCOL_UPDATE_NAME;
    return v;
};
