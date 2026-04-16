/**
 * liveDataStore.ts
 *
 * Real-time proposal tracking via the Radix Gateway stream.
 * Reads the ConsensusManagerFieldCurrentProposalStatistic substate
 * updated EVERY ROUND (not just at epoch end).
 *
 * Improvements over v1:
 *  - Exponential backoff on poll errors (avoids hammering a degraded API)
 *  - Retry loop for initialization failures
 *  - Back-off resets on successful polls
 *  - useSyncExternalStore-compatible pub/sub (unchanged)
 */

/**
 * liveDataStore runs in both server and client (browser polling loop).
 * Pino is a Node.js-only module, so we use a lightweight console wrapper
 * here instead of importing from lib/logger (which is server-only).
 */
const logger = {
   
  error: (obj: unknown, msg: string, ...args: unknown[]) =>
    console.error('[LiveStore]', msg, ...args, obj),
};

let currentGateway = 'https://mainnet.radixdlt.com';

export function setLiveNetwork(network: 'mainnet' | 'stokenet' = 'mainnet') {
    const nextGateway = network === 'stokenet'
        ? 'https://stokenet.radixdlt.com'
        : 'https://mainnet.radixdlt.com';

    if (nextGateway === currentGateway) return;

    // 1. Update Target
    currentGateway = nextGateway;

    // 2. Clear Existing Interval
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    // 3. Reset State & Flags
    initialized = false;
    initializing = false;
    state = {
        epochProposals: new Map(),
        finalizedEpochs: [],
        currentEpoch: null,
    };
    epochValidatorSet = [];
    lastStateVersion = 0;

    // 4. Notify subscribers of the "clean slate"
    subscribers.forEach(s => s());
    epochSubscribers.forEach(s => s());

    // 5. If we have addresses being watched, re-initiate
    // Note: in this app, init() will be triggered again by 
    // registerAddressForPolling in ValidatorDetailComponents / LiveProposals.
}

async function gPost(path: string, body: object): Promise<unknown> {
    const r = await fetch(currentGateway + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (r.status === 400) {
        const errText = await r.text();
        if (errText.includes('State version is beyond the end')) {
            return { items: [] };
        }
        throw new Error(`Gateway ${path} → 400: ${errText}`);
    }

    if (!r.ok) throw new Error(`Gateway ${path} → ${r.status}`);
    return r.json();
}

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
export type EpochProposals = { made: number; missed: number };

export type LiveStoreSnapshot = {
    epochProposals: Map<string, EpochProposals>;
    finalizedEpochs: Array<{ epoch: number; data: Map<string, EpochProposals> }>;
    currentEpoch: number | null;
};

/* ──────────────────────────────────────────
   PERSISTENCE
 ────────────────────────────────────────── */
const STORAGE_PREFIX = 'radix_live_v2_';

function getStorageKey() {
    return STORAGE_PREFIX + (currentGateway.includes('stokenet') ? 'stokenet' : 'mainnet');
}

function saveState() {
    if (typeof window === 'undefined') return;
    try {
        const serialized = {
            currentEpoch: state.currentEpoch,
            finalizedEpochs: state.finalizedEpochs.map(fe => ({
                epoch: fe.epoch,
                data: Object.fromEntries(fe.data)
            }))
        };
        localStorage.setItem(getStorageKey(), JSON.stringify(serialized));
    } catch (e) {
        console.warn('[LiveStore] Failed to save state', e);
    }
}

function loadState() {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem(getStorageKey());
        if (!stored) return;
        const parsed = JSON.parse(stored) as { 
            currentEpoch: number | null; 
            finalizedEpochs: Array<{ epoch: number; data: Record<string, EpochProposals> }> 
        };
        
        state = {
            epochProposals: new Map(), // Always start fresh for live
            currentEpoch: parsed.currentEpoch,
            finalizedEpochs: parsed.finalizedEpochs.map(fe => ({
                epoch: fe.epoch,
                data: new Map(Object.entries(fe.data))
            }))
        };
    } catch (e) {
        console.warn('[LiveStore] Failed to load state', e);
    }
}

/* ──────────────────────────────────────────
   STATE
────────────────────────────────────────── */
let state: LiveStoreSnapshot = {
    epochProposals: new Map(),
    finalizedEpochs: [],
    currentEpoch: null,
};

let epochValidatorSet: string[] = [];
let lastStateVersion = 0;

const subscribers = new Set<() => void>();
const epochSubscribers = new Set<() => void>();
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let initializing = false;

/* ── Backoff state ─────────────────────── */
const BASE_POLL_INTERVAL_MS = 2_000;
const MAX_POLL_INTERVAL_MS = 60_000;
let currentPollIntervalMs = BASE_POLL_INTERVAL_MS;
let consecutiveErrors = 0;

function onPollSuccess() {
    if (consecutiveErrors > 0) {
        consecutiveErrors = 0;
        currentPollIntervalMs = BASE_POLL_INTERVAL_MS;
        restartPollingWithCurrentInterval();
    }
}

function onPollError() {
    consecutiveErrors++;
    // Exponential backoff: 2s → 4s → 8s → 16s → 32s → 60s (cap)
    currentPollIntervalMs = Math.min(
        BASE_POLL_INTERVAL_MS * 2 ** consecutiveErrors,
        MAX_POLL_INTERVAL_MS,
    );
    restartPollingWithCurrentInterval();
}

function restartPollingWithCurrentInterval() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = setInterval(poll, currentPollIntervalMs);
    }
}

/* ──────────────────────────────────────────
   EPOCH VALIDATOR SET
────────────────────────────────────────── */
async function fetchEpochValidatorSet(epoch: number): Promise<string[]> {
    let attempt = 0;
    const maxRetries = 5;

    while (attempt < maxRetries) {
        try {
            const data = await gPost('/stream/transactions', {
                limit_per_page: 1,
                kind_filter: 'EpochChange',
                at_ledger_state: { epoch },
                order: 'Desc',
            });
            const tx = (data as { items?: Array<{ fee_paid: string; receipt?: { next_epoch?: { validators: Array<{ address: string }> } } }> })?.items?.[0];
            if (!tx || tx.fee_paid !== '0') return [];
            const validators = tx.receipt?.next_epoch?.validators ?? [];
            return validators.map(v => v.address);
        } catch (error) {
            attempt++;
            const message = error instanceof Error ? error.message : String(error);

            // If it's a 400 error about "beyond the end of known ledger", it's a transient sync issue.
            // We retry until the Gateway catches up.
            const isTransient = message.includes('beyond the end of the known ledger') || message.includes('400');

            if (isTransient && attempt < maxRetries) {
                console.warn(`[LiveStore] fetchEpochValidatorSet lag detected for epoch ${epoch} (attempt ${attempt}/${maxRetries}). Retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            logger.error({ err: error, attempt }, '[LiveStore] fetchEpochValidatorSet error: %s', message);
            return [];
        }
    }
    return [];
}

/* ──────────────────────────────────────────
   APPLY SUBSTATE VALUE → MAP
────────────────────────────────────────── */
function applyProposalStats(value: { completed?: number[]; made?: number[]; missed?: number[] } | null | undefined): void {
    if (!value) return;

    const madeArr: number[] = Array.isArray(value.completed) ? value.completed
        : Array.isArray(value.made) ? value.made
            : [];
    const missedArr: number[] = Array.isArray(value.missed) ? value.missed : [];

    if (madeArr.length === 0 && missedArr.length === 0) return;

    const newMap = new Map<string, EpochProposals>();
    const len = Math.max(madeArr.length, missedArr.length, epochValidatorSet.length);

    for (let i = 0; i < len; i++) {
        const addr = epochValidatorSet[i];
        if (!addr) continue;
        newMap.set(addr, { made: madeArr[i] ?? 0, missed: missedArr[i] ?? 0 });
    }

    state = { ...state, epochProposals: newMap };
}

/* ──────────────────────────────────────────
   INIT — with retry loop
────────────────────────────────────────── */
async function init(): Promise<void> {
    if (initializing || initialized) return;
    initializing = true;

    loadState(); // Try to restore from localStorage first

    let attempt = 0;
    while (!initialized) {
        try {
            const status = await gPost('/status/gateway-status', {}) as { ledger_state: { epoch: number; state_version: number } };
            const currentEpoch: number = status.ledger_state.epoch;
            const currentStateVersion: number = status.ledger_state.state_version;

            epochValidatorSet = await fetchEpochValidatorSet(currentEpoch);

            const initTxns = await gPost('/stream/transactions', {
                limit_per_page: 100,
                kind_filter: 'All',
                opt_ins: { receipt_state_changes: true },
                at_ledger_state: { state_version: currentStateVersion },
                order: 'Desc',
            }) as { items?: Array<{
                fee_paid: string;
                receipt?: {
                    next_epoch?: unknown;
                    state_updates?: {
                        updated_substates?: Array<{
                            substate_id?: { entity_type: string; substate_type: string };
                            new_value?: { substate_data?: { value: { completed?: number[]; made?: number[]; missed?: number[] } } };
                        }>;
                    };
                };
            }> };

            outer: for (const tx of (initTxns?.items ?? [])) {
                if (tx.fee_paid !== '0') continue;
                if (tx.receipt?.next_epoch) continue;

                const substates = tx?.receipt?.state_updates?.updated_substates ?? [];
                for (const sub of substates) {
                    if (
                        sub?.substate_id?.entity_type === 'GlobalConsensusManager' &&
                        sub?.substate_id?.substate_type === 'ConsensusManagerFieldCurrentProposalStatistic'
                    ) {
                        applyProposalStats(sub.new_value?.substate_data?.value);
                        break outer;
                    }
                }
            }

            state = { ...state, currentEpoch };
            lastStateVersion = currentStateVersion;
            initialized = true;
            subscribers.forEach(s => s());
            break; // success — exit loop

        } catch (error) {
            attempt++;
            const message = error instanceof Error ? error.message : String(error);
            
            // Log as error for the first 5, then as warning to reduce noise but stay active
            if (attempt <= 5) {
                logger.error({ err: error, attempt }, '[LiveStore] init error (attempt %d/5): %s', attempt, message);
            } else {
                console.warn(`[LiveStore] Persistent init failure (attempt ${attempt}). Retrying in 60s...`, message);
            }

            // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 60s... (capped at 60s)
            const delay = attempt <= 5 
                ? Math.min(2_000 * 2 ** (attempt - 1), 60_000)
                : 60_000;
            
            await new Promise(r => setTimeout(r, delay));
        }
    }

    initializing = false;
}

/* ──────────────────────────────────────────
   POLL — stream new round transactions
────────────────────────────────────────── */
async function poll(): Promise<void> {
    if (!initialized) return;

    try {
        const data = await gPost('/stream/transactions', {
            limit_per_page: 100,
            kind_filter: 'All',
            opt_ins: { receipt_state_changes: true },
            from_ledger_state: { state_version: lastStateVersion + 1 },
            order: 'Asc',
        }) as { items?: Array<{
            state_version: number;
            fee_paid: string;
            receipt?: {
                next_epoch?: { epoch: number; validators: Array<{ address: string }> };
                state_updates?: {
                    updated_substates?: Array<{
                        substate_id?: { entity_type: string; substate_type: string };
                        new_value?: { substate_data?: { value: { completed?: number[]; made?: number[]; missed?: number[] } } };
                    }>;
                };
            };
        }> };

        const items = data?.items ?? [];
        if (items.length === 0) {
            onPollSuccess();
            return;
        }

        let hasProposalUpdate = false;
        let hasEpochChange = false;

        for (const tx of items) {
            if (tx.state_version > lastStateVersion) {
                lastStateVersion = tx.state_version;
            }

            if (tx.fee_paid !== '0') continue;

            if (tx.receipt?.next_epoch) {
                const newEpoch: number = tx.receipt.next_epoch.epoch;
                if (newEpoch !== state.currentEpoch) {
                    const final = new Map(state.epochProposals);
                    const nextValidators: Array<{ address: string }> = tx.receipt.next_epoch.validators ?? [];
                    epochValidatorSet = nextValidators.map(v => v.address);
                    
                    const newFinalized = [
                        { epoch: state.currentEpoch as number, data: final },
                        ...state.finalizedEpochs
                    ].slice(0, 10); // Keep last 10

                    state = {
                        epochProposals: new Map(),
                        finalizedEpochs: newFinalized,
                        currentEpoch: newEpoch,
                    };
                    saveState();
                    hasEpochChange = true;
                }
            }

            const substates = (tx?.receipt?.state_updates?.updated_substates ?? []) as Array<{ 
                substate_id?: { entity_type?: string; substate_type?: string }; 
                new_value?: { substate_data?: { value?: unknown } } 
            }>;
            for (const sub of substates) {
                if (
                    sub?.substate_id?.entity_type === 'GlobalConsensusManager' &&
                    sub?.substate_id?.substate_type === 'ConsensusManagerFieldCurrentProposalStatistic'
                ) {
                    applyProposalStats(sub.new_value?.substate_data?.value as Parameters<typeof applyProposalStats>[0]);
                    hasProposalUpdate = true;
                    break;
                }
            }
        }

        if (hasEpochChange) epochSubscribers.forEach(s => s());
        if (hasProposalUpdate || hasEpochChange) subscribers.forEach(s => s());

        onPollSuccess();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, '[LiveStore] poll error: %s', message);
        onPollError();
    }
}

/* ──────────────────────────────────────────
   PUBLIC API
────────────────────────────────────────── */
export function subscribeToLiveData(callback: () => void): () => void {
    subscribers.add(callback);
    return () => { subscribers.delete(callback); };
}

export function subscribeToEpochChange(callback: () => void): () => void {
    epochSubscribers.add(callback);
    return () => { epochSubscribers.delete(callback); };
}

export function getLiveSnapshot(): LiveStoreSnapshot { return state; }
export function getLastKnownEpoch(): number | null { return state.currentEpoch; }

export function registerAddressForPolling(__address: string): void {
    if (!pollingInterval) {
        init().then(() => {
            if (!pollingInterval) {
                pollingInterval = setInterval(poll, currentPollIntervalMs);
            }
        });
    }
}

export function unregisterAddressForPolling(__address: string): void {
    // Polling is global — no per-address teardown needed
}

// Legacy compat
export function getLiveDataSnapshot() { return state.epochProposals; }

// ── HMR cleanup (dev only) ───────────────────────────────────────────────────
// Without this, Vite/Turbopack HMR re-evaluates this module and starts a new
// polling interval while the previous one keeps running — doubling poll rate
// each hot reload.
if (typeof module !== 'undefined' && (module as unknown as { hot?: { dispose: (fn: () => void) => void } }).hot) {
    (module as unknown as { hot: { dispose: (fn: () => void) => void } }).hot
        .dispose(() => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        });
}

