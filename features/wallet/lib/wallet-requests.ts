/**
 * Every request this site makes to the Radix Wallet goes through
 * `sendToWallet`, so all of them can be seen while they wait and cancelled
 * the same way, whichever feature sent them.
 *
 * Cancelling stops the wait here at once and tells the wallet, through the
 * Radix Connector extension: with `walletApi.cancelPendingRequests` where the
 * toolkit has it (radixdlt/radix-dapp-toolkit#327), and through the toolkit's
 * connect button in 2.3.0, which has nothing else (see `connect-button.ts`).
 *
 * A transaction the wallet has already received cannot be taken back by
 * anyone but the person, in the wallet.
 */
import {
  CANCELLED_CODE,
  TIMEOUT_CODE,
  classifyWalletError,
  walletFailure,
  type WalletFailure,
} from './wallet-errors';
import { cancelThroughConnectButton } from './connect-button';

export type WalletRequestKind = 'connect' | 'transaction' | 'preAuthorization' | 'data' | 'proof';

/** What the toolkit's requests resolve to: a neverthrow `Result`, read structurally. */
export interface ToolkitResult<T> {
  isErr(): boolean;
  value?: T;
  error?: unknown;
}

/** A request as the toolkit returns it (a `ResultAsync`): awaitable, resolving to a `ToolkitResult`. */
export interface ToolkitRequest<T> {
  then<A, B>(
    onResult?: (result: ToolkitResult<T>) => A | PromiseLike<A>,
    onError?: (reason: unknown) => B | PromiseLike<B>,
  ): PromiseLike<A | B>;
}

export type WalletOutcome<T> = { ok: true; value: T } | { ok: false; failure: WalletFailure };

/** The part of a dApp Toolkit instance needed to cancel what it has pending. */
export interface CancellableToolkit {
  walletApi: object;
}

export interface PendingWalletRequest {
  id: number;
  kind: WalletRequestKind;
  startedAt: number;
  /** The wallet has it: from here it is answered, or rejected, in the wallet. */
  inWallet: boolean;
}

interface Entry extends PendingWalletRequest {
  toolkit: CancellableToolkit;
  settle: (outcome: WalletOutcome<never>) => void;
}

const pending = new Map<number, Entry>();
const listeners = new Set<() => void>();
let snapshot: readonly PendingWalletRequest[] = [];
let lastId = 0;

function changed() {
  snapshot = [...pending.values()].map(({ id, kind, startedAt, inWallet }) => ({ id, kind, startedAt, inWallet }));
  listeners.forEach((listener) => listener());
}

export function subscribeWalletRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The requests waiting for the wallet, oldest first. Same array until one starts or ends. */
export function pendingWalletRequests(): readonly PendingWalletRequest[] {
  return snapshot;
}

/**
 * Sends one request to the wallet and waits for its outcome.
 *
 * `send` starts the request with the toolkit (`walletApi.sendTransaction`,
 * `sendOneTimeRequest`…). With `timeoutMs`, a request nobody answers in time
 * ends with `timeout` and is cancelled as if the person had.
 */
export function sendToWallet<T>(
  toolkit: CancellableToolkit,
  kind: WalletRequestKind,
  send: () => ToolkitRequest<T>,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<WalletOutcome<T>> {
  return new Promise((resolve) => {
    const id = ++lastId;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (outcome: WalletOutcome<T>) => {
      if (!pending.has(id)) return;
      clearTimeout(timer);
      pending.delete(id);
      changed();
      resolve(outcome);
    };

    pending.set(id, { id, kind, startedAt: Date.now(), inWallet: false, toolkit, settle });
    watchDelivery();
    changed();

    if (timeoutMs) {
      timer = setTimeout(() => {
        cancelInWallet(toolkit);
        settle({ ok: false, failure: walletFailure(TIMEOUT_CODE) });
      }, timeoutMs);
    }

    new Promise<ToolkitResult<T>>((answered, failed) => {
      send().then(answered, failed);
    }).then(
        (result) =>
          settle(
            result.isErr()
              ? { ok: false, failure: classifyWalletError(result.error) }
              : { ok: true, value: result.value as T },
          ),
        (error) => settle({ ok: false, failure: classifyWalletError(error) }),
      );
  });
}

/**
 * Cancels every request waiting for the wallet; each ends with `cancelled`.
 * All of them, as the toolkit cancels everything it has pending and the
 * wallet shows one request at a time anyway.
 */
export function cancelWalletRequests(): void {
  const cancelled = [...pending.values()];
  cancelInWallet(...new Set(cancelled.map((entry) => entry.toolkit)));
  const outcome = { ok: false, failure: walletFailure(CANCELLED_CODE) } as const;
  cancelled.forEach((entry) => entry.settle(outcome));
}

/** Tells the wallet that what these toolkits have pending is cancelled. */
function cancelInWallet(...toolkits: CancellableToolkit[]) {
  let throughButton = false;
  for (const toolkit of toolkits) {
    const walletApi = toolkit.walletApi as { cancelPendingRequests?: () => unknown };
    if (walletApi.cancelPendingRequests) walletApi.cancelPendingRequests();
    else throughButton = true;
  }
  // One button serves every toolkit, so it is asked once.
  if (throughButton) cancelThroughConnectButton();
}

/**
 * The Radix Connector extension tells the page when the wallet has received a
 * request (`receivedByWallet`, on the same window event the toolkit listens
 * to). The wallet shows one request at a time, so what is waiting here is
 * what it received.
 */
const EXTENSION_EVENT = 'radix#chromeExtension#receive';
let watchingDelivery = false;

function watchDelivery() {
  if (watchingDelivery || typeof window === 'undefined') return;
  watchingDelivery = true;
  window.addEventListener(EXTENSION_EVENT, (event) => {
    const detail = (event as CustomEvent<{ eventType?: string }>).detail;
    if (detail?.eventType !== 'receivedByWallet') return;
    const waiting = [...pending.values()].filter((entry) => !entry.inWallet);
    if (waiting.length === 0) return;
    waiting.forEach((entry) => (entry.inWallet = true));
    changed();
  });
}
