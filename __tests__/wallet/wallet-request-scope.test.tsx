import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWalletRequestScope } from '@/features/wallet/hooks/useWalletRequestScope';
import { sendToWallet, type ToolkitResult } from '@/features/wallet/lib/wallet-requests';

const neverAnswers = () => new Promise<ToolkitResult<string>>(() => {});

describe('useWalletRequestScope', () => {
  it('cancels in the wallet what is still waiting when the component goes away', async () => {
    const cancelPendingRequests = vi.fn();
    const { result, unmount } = renderHook(() => useWalletRequestScope());
    const outcome = sendToWallet({ walletApi: { cancelPendingRequests } }, 'transaction', neverAnswers, {
      signal: result.current.signal(),
    });

    unmount();

    expect(await outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(cancelPendingRequests).toHaveBeenCalledOnce();
  });

  it('abandon cancels what is waiting, and later requests go out normally', async () => {
    const { result } = renderHook(() => useWalletRequestScope());
    const first = sendToWallet({ walletApi: {} }, 'data', neverAnswers, { signal: result.current.signal() });

    act(() => result.current.abandon());

    expect(await first).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(result.current.signal().aborted).toBe(false);
  });

  it('a flow still running after unmount sends nothing more', async () => {
    const { result, unmount } = renderHook(() => useWalletRequestScope());
    const { signal } = result.current;
    unmount();

    const send = vi.fn();
    const outcome = await sendToWallet({ walletApi: {} }, 'transaction', send, { signal: signal() });

    expect(outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(send).not.toHaveBeenCalled();
  });
});
