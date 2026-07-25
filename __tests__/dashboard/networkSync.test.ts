/**
 * Reconciling the dashboard's network with the wallet's.
 *
 * This has produced two separate bugs, both of which sent the user somewhere
 * they never asked to go:
 *
 *  1. Reacting to "the wallet DIFFERS from the URL" rather than "the wallet
 *     CHANGED": a freshly opened entity link was navigated away before its
 *     wallet switch had landed.
 *  2. Treating the wallet's first report as a switch: the wallet connects a
 *     moment after mount and announces its default, which dragged a Stokenet
 *     link onto Mainnet on its own.
 *
 * The rule this pins down: the URL is the source of truth, so the wallet
 * follows it; only a genuine change made IN the wallet moves the dashboard.
 */
import { describe, it, expect } from 'vitest';

type Network = 'mainnet' | 'stokenet';
type Action =
  | { type: 'none' }
  | { type: 'switchWallet'; to: Network }
  | { type: 'moveDashboard'; to: Network };

/** Mirrors the reconciliation effect in DashboardClient. */
function reconcile(input: {
  activeNetwork: Network | null;
  urlNetwork: Network;
  previouslyKnown: Network | null;
  /** The URL named the network explicitly, which pins the page. */
  pinned?: boolean;
}): Action {
  const { activeNetwork, urlNetwork, previouslyKnown, pinned = false } = input;
  if (!activeNetwork) return { type: 'none' };

  if (previouslyKnown === null) {
    return activeNetwork !== urlNetwork
      ? { type: 'switchWallet', to: urlNetwork }
      : { type: 'none' };
  }

  if (pinned) return { type: 'none' };

  return activeNetwork !== previouslyKnown && activeNetwork !== urlNetwork
    ? { type: 'moveDashboard', to: activeNetwork }
    : { type: 'none' };
}

describe('network reconciliation', () => {
  it('does nothing before the wallet reports a network', () => {
    expect(
      reconcile({ activeNetwork: null, urlNetwork: 'stokenet', previouslyKnown: null }),
    ).toEqual({ type: 'none' });
  });

  it('brings the wallet to a Stokenet link instead of moving the page', () => {
    // The reported bug: opening a Stokenet resource with the wallet on Mainnet.
    expect(
      reconcile({
        activeNetwork: 'mainnet',
        urlNetwork: 'stokenet',
        previouslyKnown: null,
      }),
    ).toEqual({ type: 'switchWallet', to: 'stokenet' });
  });

  it('never moves the dashboard on the wallet’s first report', () => {
    for (const activeNetwork of ['mainnet', 'stokenet'] as Network[]) {
      for (const urlNetwork of ['mainnet', 'stokenet'] as Network[]) {
        const action = reconcile({ activeNetwork, urlNetwork, previouslyKnown: null });
        expect(action.type).not.toBe('moveDashboard');
      }
    }
  });

  it('settles once the wallet has followed the URL', () => {
    // Second pass: the wallet is now on Stokenet, matching the link.
    expect(
      reconcile({
        activeNetwork: 'stokenet',
        urlNetwork: 'stokenet',
        previouslyKnown: 'mainnet',
      }),
    ).toEqual({ type: 'none' });
  });

  it('follows a switch the user really made in the wallet', () => {
    expect(
      reconcile({
        activeNetwork: 'mainnet',
        urlNetwork: 'stokenet',
        previouslyKnown: 'stokenet',
      }),
    ).toEqual({ type: 'moveDashboard', to: 'mainnet' });
  });

  it('never leaves a pinned link, whatever the wallet does afterwards', () => {
    // The wallet provider restores its own network from a cookie just after
    // mount, and forces its choice when there is no session for the requested
    // ledger. A link that names its network must survive that.
    expect(
      reconcile({
        activeNetwork: 'mainnet',
        urlNetwork: 'stokenet',
        previouslyKnown: 'stokenet',
        pinned: true,
      }),
    ).toEqual({ type: 'none' });
  });

  it('still asks the wallet to follow a pinned link on first contact', () => {
    expect(
      reconcile({
        activeNetwork: 'mainnet',
        urlNetwork: 'stokenet',
        previouslyKnown: null,
        pinned: true,
      }),
    ).toEqual({ type: 'switchWallet', to: 'stokenet' });
  });

  it('stays put while the wallet merely re-reports the same network', () => {
    expect(
      reconcile({
        activeNetwork: 'mainnet',
        urlNetwork: 'stokenet',
        previouslyKnown: 'mainnet',
      }),
    ).toEqual({ type: 'none' });
  });
});
