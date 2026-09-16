/**
 * Protocol-update signalling target, per network.
 *
 * Mainnet and Stokenet run their own protocol updates, and the 32-character
 * version name is NOT the same on both: Cuttlefish is
 * `96e00440adafe5e2000000cuttlefish` on mainnet and
 * `034d3327f58995c6000000cuttlefish` on Stokenet. A single shared value was
 * therefore always wrong on one of the two ledgers: the badge never matched
 * the vote it had just read, so the button kept offering to vote again.
 *
 * Configured via environment variables so it can be updated from Vercel, change
 * the value and press "Redeploy", no code change needed, every time a network
 * announces a new protocol update:
 *
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL_MAINNET
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL_STOKENET
 *     The EXACT 32-character protocol version name validators must signal
 *     on-ledger (the string passed to `signal_protocol_update_readiness`). The
 *     engine rejects anything whose length is not exactly 32
 *     (ValidatorError::InvalidProtocolVersionNameLength), so voting is only
 *     offered when this is present and 32 chars long.
 *
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_NAME_MAINNET
 *   NEXT_PUBLIC_PROTOCOL_UPDATE_NAME_STOKENET
 *     A human-friendly label shown on the badge once a validator has signalled
 *     this version (e.g. "Cuttlefish"). Falls back to the raw signal when unset.
 *
 * The older single-network variables (without the `_MAINNET` / `_STOKENET`
 * suffix) are still read as a fallback so existing deployments keep working,
 * and the values verified on-ledger today are the last resort, so a deployment
 * that configures nothing still reads and offers the current update correctly
 * on both networks.
 *
 * NOTE: NEXT_PUBLIC_* values are inlined at build time, which is why each one
 * is written out in full below rather than looked up through a computed key.
 * Changing them in Vercel takes effect after a redeploy.
 */

export type VoteNetwork = 'mainnet' | 'stokenet';

/** Exact length the ledger requires for a protocol version name. */
export const PROTOCOL_VERSION_NAME_LEN = 32;

/**
 * The update currently live on each ledger, read back from the Gateway.
 * Only used when nothing is configured; the env vars always win.
 */
const FALLBACK_SIGNAL: Record<VoteNetwork, string> = {
    mainnet: '96e00440adafe5e2000000cuttlefish',
    stokenet: '034d3327f58995c6000000cuttlefish',
};
const FALLBACK_NAME = 'Cuttlefish';

const SIGNAL_MAINNET = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL_MAINNET ?? '').trim();
const SIGNAL_STOKENET = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL_STOKENET ?? '').trim();
const NAME_MAINNET = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_NAME_MAINNET ?? '').trim();
const NAME_STOKENET = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_NAME_STOKENET ?? '').trim();

/** Pre-per-network variables, kept so existing deployments keep working. */
const SIGNAL_LEGACY = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_SIGNAL ?? '').trim();
const NAME_LEGACY = (process.env.NEXT_PUBLIC_PROTOCOL_UPDATE_NAME ?? '').trim();

/**
 * The version name this network signals. A legacy value is only honoured when
 * it is the right length for this ledger, so a Stokenet signal left in the old
 * shared variable cannot leak onto mainnet and be offered there as the target.
 */
export const protocolSignal = (network: VoteNetwork = 'mainnet'): string => {
    const perNetwork = network === 'stokenet' ? SIGNAL_STOKENET : SIGNAL_MAINNET;
    if (perNetwork) return perNetwork;
    if (SIGNAL_LEGACY === FALLBACK_SIGNAL[network]) return SIGNAL_LEGACY;
    return FALLBACK_SIGNAL[network];
};

/** The label shown once this network's target has been signalled. */
export const protocolName = (network: VoteNetwork = 'mainnet'): string => {
    const perNetwork = network === 'stokenet' ? NAME_STOKENET : NAME_MAINNET;
    return perNetwork || NAME_LEGACY || FALLBACK_NAME;
};

/**
 * Whether a valid target is configured for this network. Voting is only
 * offered when the signal is exactly 32 characters, otherwise the on-ledger
 * call would fail.
 */
export const protocolTargetEnabled = (network: VoteNetwork = 'mainnet'): boolean =>
    protocolSignal(network).length === PROTOCOL_VERSION_NAME_LEN;

/** True when a validator has not signalled any protocol version. */
export const isNoneProtocolVote = (vote?: string | null): boolean => {
    const v = (vote ?? '').trim();
    return v === '' || v.toLowerCase() === 'none';
};

/**
 * Has this validator signalled the configured target? A vote matches when it
 * equals the raw signal (the Gateway returned it unmapped) OR the friendly
 * name (the Gateway's own lookup already mapped it to the same label).
 */
export const hasVotedTarget = (vote?: string | null, network: VoteNetwork = 'mainnet'): boolean => {
    if (!protocolTargetEnabled(network)) return false;
    const v = (vote ?? '').trim();
    const name = protocolName(network);
    return v === protocolSignal(network) || (!!name && v === name);
};

/**
 * Text for the badge. When the vote is the configured target it renders the
 * friendly name (falling back to the signal when no name is set), regardless
 * of what the Gateway returned. A non-target vote shows its raw value.
 */
export const protocolVoteDisplayName = (
    vote?: string | null,
    network: VoteNetwork = 'mainnet',
): string => {
    if (isNoneProtocolVote(vote)) return '';
    const v = (vote as string).trim();
    if (hasVotedTarget(v, network)) return protocolName(network) || protocolSignal(network);
    return v;
};

/* ── Mainnet-shaped aliases ──
   The console's validator form is a single mainnet-oriented tool that prefills
   the signal field; it reads these rather than threading a network through. */
export const PROTOCOL_UPDATE_SIGNAL = protocolSignal('mainnet');
export const PROTOCOL_UPDATE_NAME = protocolName('mainnet');
export const PROTOCOL_UPDATE_TARGET_ENABLED = protocolTargetEnabled('mainnet');
