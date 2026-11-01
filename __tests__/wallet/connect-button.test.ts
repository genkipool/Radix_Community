import { afterEach, describe, expect, it } from 'vitest';
import { cancelThroughConnectButton, mountConnectButton } from '@/features/wallet/lib/connect-button';
import { cancelWalletRequests, sendToWallet, type ToolkitRequest } from '@/features/wallet/lib/wallet-requests';

type Item = { interactionId: string; status: string; showCancel?: boolean };

/** The hidden button, with the request items a toolkit would have written on it. */
function buttonWith(items: Item[]) {
  mountConnectButton();
  const button = document.querySelector('radix-connect-button') as HTMLElement & { requestItems?: Item[] };
  button.requestItems = items;
  const cancelled: string[] = [];
  button.addEventListener('onCancelRequestItem', (event) =>
    cancelled.push((event as CustomEvent<{ id: string }>).detail.id),
  );
  return { button, cancelled };
}

const never = <T,>(): ToolkitRequest<T> => new Promise(() => {});

afterEach(() => {
  cancelWalletRequests();
  document.querySelectorAll('radix-connect-button').forEach((button) => button.remove());
});

describe('mountConnectButton', () => {
  it('puts one hidden button on the page, however many toolkits are created', () => {
    mountConnectButton();
    mountConnectButton();

    const buttons = document.querySelectorAll<HTMLElement>('radix-connect-button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].style.display).toBe('none');
    expect(buttons[0].getAttribute('aria-hidden')).toBe('true');
  });
});

describe('cancelThroughConnectButton', () => {
  it('cancels each pending request that shows a Cancel, as its card would', () => {
    const { cancelled } = buttonWith([
      { interactionId: 'waiting', status: 'pending', showCancel: true },
      { interactionId: 'in-the-wallet', status: 'pending', showCancel: false },
      { interactionId: 'answered', status: 'success', showCancel: true },
    ]);

    cancelThroughConnectButton();

    expect(cancelled).toEqual(['waiting']);
  });

  it('does nothing without the button', () => {
    expect(() => cancelThroughConnectButton()).not.toThrow();
  });
});

describe('cancelWalletRequests', () => {
  it('goes through the button for a toolkit without cancelPendingRequests', async () => {
    const { cancelled } = buttonWith([{ interactionId: 'waiting', status: 'pending', showCancel: true }]);
    const outcome = sendToWallet({ walletApi: {} }, 'transaction', never);

    cancelWalletRequests();

    expect(await outcome).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(cancelled).toEqual(['waiting']);
  });

  it('uses cancelPendingRequests where the toolkit has it, and not the button', async () => {
    const { cancelled } = buttonWith([{ interactionId: 'waiting', status: 'pending', showCancel: true }]);
    let toldWallet = 0;
    const outcome = sendToWallet(
      { walletApi: { cancelPendingRequests: () => toldWallet++ } },
      'transaction',
      never,
    );

    cancelWalletRequests();
    await outcome;

    expect(toldWallet).toBe(1);
    expect(cancelled).toEqual([]);
  });
});
