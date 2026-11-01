import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelWalletRequests,
  pendingWalletRequests,
  sendToWallet,
  subscribeWalletRequests,
} from '@/features/wallet/lib/wallet-requests';
import { classifyWalletError } from '@/features/wallet/lib/wallet-errors';
import type { ToolkitResult } from '@/features/wallet/lib/wallet-requests';

const ok = <T,>(value: T): ToolkitResult<T> => ({ isErr: () => false, value });
const err = <T,>(error: unknown): ToolkitResult<T> => ({ isErr: () => true, error });

/** A wallet that answers only when the test says so. */
function waitingWallet<T>() {
  let answer: (result: ToolkitResult<T>) => void = () => {};
  const answered = new Promise<ToolkitResult<T>>((resolve) => {
    answer = resolve;
  });
  return { send: () => answered, answer };
}

const toolkit = (cancelPendingRequests?: () => void) => ({
  walletApi: cancelPendingRequests ? { cancelPendingRequests } : {},
});

afterEach(() => {
  cancelWalletRequests();
  vi.useRealTimers();
});

describe('sendToWallet', () => {
  it('resolves with what the wallet answered, and is no longer pending', async () => {
    const wallet = waitingWallet<string>();
    const outcome = sendToWallet(toolkit(), 'transaction', wallet.send);
    expect(pendingWalletRequests().map((r) => r.kind)).toEqual(['transaction']);

    wallet.answer(ok('txid_1'));

    expect(await outcome).toEqual({ ok: true, value: 'txid_1' });
    expect(pendingWalletRequests()).toEqual([]);
  });

  it('classifies what the wallet refused', async () => {
    const wallet = waitingWallet<string>();
    const outcome = sendToWallet(toolkit(), 'data', wallet.send);

    wallet.answer(err({ error: 'rejectedByUser', message: 'user rejected' }));

    expect(await outcome).toEqual({
      ok: false,
      failure: { reason: 'rejected', code: 'rejectedByUser', message: 'user rejected' },
    });
  });

  it('ends with timeout when nobody answers in time, and cancels it', async () => {
    vi.useFakeTimers();
    const cancelPendingRequests = vi.fn();
    const outcome = sendToWallet(toolkit(cancelPendingRequests), 'connect', waitingWallet().send, {
      timeoutMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(await outcome).toMatchObject({ ok: false, failure: { reason: 'timeout' } });
    expect(cancelPendingRequests).toHaveBeenCalledOnce();
  });
});

describe('cancelWalletRequests', () => {
  it('ends every pending request as cancelled and tells each toolkit once', async () => {
    const cancelPendingRequests = vi.fn();
    const rdt = toolkit(cancelPendingRequests);
    const first = sendToWallet(rdt, 'transaction', waitingWallet().send);
    const second = sendToWallet(rdt, 'proof', waitingWallet().send);

    cancelWalletRequests();

    for (const outcome of await Promise.all([first, second])) {
      expect(outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    }
    expect(cancelPendingRequests).toHaveBeenCalledOnce();
    expect(pendingWalletRequests()).toEqual([]);
  });

  it('still stops the wait with a toolkit that cannot tell the wallet', async () => {
    const outcome = sendToWallet(toolkit(), 'transaction', waitingWallet().send);

    cancelWalletRequests();

    expect(await outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
  });

  it('ignores the wallet answering after the request was cancelled', async () => {
    const wallet = waitingWallet<string>();
    const outcome = sendToWallet(toolkit(), 'transaction', wallet.send);
    cancelWalletRequests();
    wallet.answer(ok('late'));

    expect(await outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
  });
});

describe('subscribeWalletRequests', () => {
  it('tells listeners when a request starts and ends', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWalletRequests(listener);
    const wallet = waitingWallet<string>();
    const outcome = sendToWallet(toolkit(), 'transaction', wallet.send);
    wallet.answer(ok('txid'));
    await outcome;
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('classifyWalletError', () => {
  it.each([
    [{ error: 'canceledByUser' }, 'cancelled'],
    [{ error: 'rejectedByUser' }, 'rejected'],
    [{ error: 'wrongNetwork' }, 'wrongNetwork'],
    [{ error: 'failedToSignTransaction' }, 'failed'],
    [new Error('timeout'), 'timeout'],
    ['rejectedByUser', 'rejected'],
    [undefined, 'failed'],
  ])('reads %o as %s', (error, reason) => {
    expect(classifyWalletError(error).reason).toBe(reason);
  });
});

describe('a request reaching the wallet', () => {
  const extensionSays = (eventType: string) =>
    window.dispatchEvent(new CustomEvent('radix#chromeExtension#receive', { detail: { eventType } }));

  it('is marked in the wallet when the extension says the wallet received it', () => {
    sendToWallet(toolkit(), 'transaction', waitingWallet().send);
    expect(pendingWalletRequests()[0].inWallet).toBe(false);

    extensionSays('receivedByExtension');
    expect(pendingWalletRequests()[0].inWallet).toBe(false);

    extensionSays('receivedByWallet');
    expect(pendingWalletRequests()[0].inWallet).toBe(true);
  });

  it('starts every new request outside the wallet', () => {
    sendToWallet(toolkit(), 'transaction', waitingWallet().send);
    extensionSays('receivedByWallet');
    cancelWalletRequests();

    sendToWallet(toolkit(), 'proof', waitingWallet().send);
    expect(pendingWalletRequests()[0].inWallet).toBe(false);
  });
});
