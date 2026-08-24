/**
 * Reconciling the dashboard's network with the wallet's.
 *
 * This tests the REAL reducer the dashboard runs (`reconcileNetwork`), not a
 * description of it. The previous version of this file re-implemented the rule
 * locally, so it kept passing while the component drifted underneath it — and
 * the bug it was written to prevent came back twice.
 *
 * The rule it pins down: the URL is the source of truth, so the wallet follows
 * it; only a genuine choice made IN the wallet moves the dashboard.
 */
import { describe, it, expect } from 'vitest';
import {
  reconcileNetwork,
  initialNetworkReconcileState,
  type NetworkReconcileState,
} from '@/features/dashboard/lib/networkReconcile';
import type { Network } from '@/features/dashboard/types';

/** Feeds a sequence of observations through the reducer, collecting actions. */
function run(
  steps: Array<{ pageNetwork: Network; walletNetwork: Network | null }>,
  from: NetworkReconcileState = initialNetworkReconcileState,
) {
  let state = from;
  const actions = steps.map((step) => {
    const next = reconcileNetwork(state, step);
    state = next.state;
    return next.action;
  });
  return { state, actions, last: actions[actions.length - 1] };
}

describe('network reconciliation', () => {
  it('does nothing before the wallet reports a network', () => {
    const { last } = run([{ pageNetwork: 'stokenet', walletNetwork: null }]);
    expect(last).toEqual({ type: 'none' });
  });

  it('brings the wallet to a Stokenet link instead of moving the page', () => {
    // The reported bug: opening a Stokenet entity with the wallet on Mainnet.
    const { last } = run([{ pageNetwork: 'stokenet', walletNetwork: 'mainnet' }]);
    expect(last).toEqual({ type: 'askWallet', to: 'stokenet' });
  });

  it('claims the ledger even when the wallet already agrees', () => {
    // Asking is what marks the choice as deliberate in the wallet provider, so
    // its cookie restore cannot assert the other ledger a tick later.
    const { last } = run([{ pageNetwork: 'mainnet', walletNetwork: 'mainnet' }]);
    expect(last).toEqual({ type: 'askWallet', to: 'mainnet' });
  });

  it('never moves the dashboard on the wallet’s first report', () => {
    for (const walletNetwork of ['mainnet', 'stokenet'] as Network[]) {
      for (const pageNetwork of ['mainnet', 'stokenet'] as Network[]) {
        const { last } = run([{ pageNetwork, walletNetwork }]);
        expect(last.type).not.toBe('moveDashboard');
      }
    }
  });

  it('ignores the wallet while the request is still in flight', () => {
    // THE regression: the effect re-runs on every render, and a switch takes a
    // render to land. Those in-between reports are not a choice — reading them
    // as one is what sent `?network=stokenet` links to `?network=mainnet`.
    const { actions } = run([
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // mount: ask
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // still in flight
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // and again
    ]);
    expect(actions).toEqual([
      { type: 'askWallet', to: 'stokenet' },
      { type: 'none' },
      { type: 'none' },
    ]);
  });

  it('settles once the wallet has followed the URL', () => {
    const { actions } = run([
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' },
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' }, // the switch landed
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' },
    ]);
    expect(actions.slice(1)).toEqual([{ type: 'none' }, { type: 'none' }]);
  });

  it('follows a switch the user really made in the wallet', () => {
    const { last } = run([
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' }, // settled…
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' },
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // …then a click
    ]);
    expect(last).toEqual({ type: 'moveDashboard', to: 'mainnet' });
  });

  it('does not bounce back after the page has moved with the wallet', () => {
    // The page follows to Mainnet, so the next observation must be quiet
    // instead of asking the wallet to go back where it came from.
    const { actions } = run([
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' },
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // moveDashboard
      { pageNetwork: 'mainnet', walletNetwork: 'mainnet' }, // page arrived
      { pageNetwork: 'mainnet', walletNetwork: 'mainnet' },
    ]);
    expect(actions[2]).toEqual({ type: 'askWallet', to: 'mainnet' });
    expect(actions[3]).toEqual({ type: 'none' });
  });

  it('re-asks when the reader switches ledger from the toolbar', () => {
    const { actions } = run([
      { pageNetwork: 'mainnet', walletNetwork: 'mainnet' },
      { pageNetwork: 'stokenet', walletNetwork: 'mainnet' }, // toolbar moved the URL
      { pageNetwork: 'stokenet', walletNetwork: 'stokenet' },
    ]);
    expect(actions[1]).toEqual({ type: 'askWallet', to: 'stokenet' });
    expect(actions[2]).toEqual({ type: 'none' });
  });
});
