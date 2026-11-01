/**
 * One reading of every way a request to the Radix Wallet can fail, so each
 * feature decides what to show from a reason instead of matching strings.
 *
 * `code` keeps the wallet's own error (`rejectedByUser`, `wrongNetwork`,
 * `failedToSignTransaction`…), which features already translate; `reason`
 * groups those codes by what the person should be told.
 */

export type WalletFailureReason =
  /** The person cancelled it on purpose here: nothing to report. */
  | 'cancelled'
  /** The person rejected it in the wallet. */
  | 'rejected'
  /** Nobody answered in time. */
  | 'timeout'
  /** The wallet is on another network than the request. */
  | 'wrongNetwork'
  /** Anything else: preparing, signing or submitting failed. */
  | 'failed';

export interface WalletFailure {
  reason: WalletFailureReason;
  /** The wallet's or toolkit's error code, or ours (`timeout`, `canceledByUser`). */
  code: string;
  message?: string;
}

export const CANCELLED_CODE = 'canceledByUser';
export const TIMEOUT_CODE = 'timeout';

const REASON_BY_CODE: Record<string, WalletFailureReason> = {
  [CANCELLED_CODE]: 'cancelled',
  rejectedByUser: 'rejected',
  [TIMEOUT_CODE]: 'timeout',
  wrongNetwork: 'wrongNetwork',
};

/** Reads an error from the toolkit (`{ error, message }`), an `Error` or a bare code. */
export function classifyWalletError(error: unknown): WalletFailure {
  const { code, message } = codeAndMessage(error);
  return { reason: REASON_BY_CODE[code] ?? 'failed', code, message };
}

export function walletFailure(code: string, message?: string): WalletFailure {
  return classifyWalletError({ error: code, message });
}

function codeAndMessage(error: unknown): { code: string; message?: string } {
  if (typeof error === 'string') return { code: error || 'unknown' };
  if (error instanceof Error) return { code: error.message || 'unknown' };
  if (error && typeof error === 'object') {
    const { error: code, message } = error as { error?: unknown; message?: unknown };
    return {
      code: typeof code === 'string' && code ? code : 'unknown',
      message: typeof message === 'string' && message ? message : undefined,
    };
  }
  return { code: 'unknown' };
}

/**
 * Thrown by flows that throw on wallet failures, when the request was
 * cancelled here on purpose: catch it with `isWalletCancellation` and show
 * nothing.
 */
export class WalletCancelledError extends Error {
  constructor() {
    super('wallet_cancelled');
    this.name = 'WalletCancelledError';
  }
}

export function isWalletCancellation(error: unknown): boolean {
  return error instanceof WalletCancelledError;
}
