/**
 * Reconciling the ledger the PAGE is showing with the one the WALLET is on.
 *
 * The rule is simple and does not change: the URL is the source of truth, so
 * the wallet follows it. Only a change somebody really made in the wallet — the
 * connect popover, the profile modal — moves the page.
 *
 * Saying that in code is where it has gone wrong three times, always the same
 * way: the two values disagree for perfectly innocent reasons, and a
 * disagreement was read as a decision.
 *
 *  1. Reacting to "the wallet DIFFERS from the URL" rather than "the wallet
 *     CHANGED" navigated away from a freshly opened entity link before its
 *     wallet switch had landed.
 *  2. Treating the wallet's first report as a switch dragged a Stokenet link
 *     onto Mainnet the instant the wallet woke up.
 *  3. Trusting "we already asked once" was not enough either. The effect that
 *     drives this re-runs on every render, and a request takes a render to
 *     land; in between, the wallet still reports the OLD ledger. That looked
 *     exactly like case 2 again, and `?network=stokenet` links bounced to
 *     `/dashboard/staking?network=mainnet` before anyone could touch anything.
 *
 * So this is a small state machine with an explicit in-flight state, kept pure
 * so it can be tested for real rather than re-described in a test file. The
 * caller holds `NetworkReconcileState` in a ref, feeds it what it sees, and
 * performs the action it gets back.
 */
import type { Network } from '../types';

export interface NetworkReconcileState {
  /** Ledger the page has asked the wallet for, or null before the first ask. */
  requested: Network | null;
  /** Whether the wallet has since reported that same ledger. */
  agreed: boolean;
}

export type NetworkReconcileAction =
  | { type: 'none' }
  /** Tell the wallet which ledger this page is on. */
  | { type: 'askWallet'; to: Network }
  /** Someone picked a ledger in the wallet: take the page there. */
  | { type: 'moveDashboard'; to: Network };

export const initialNetworkReconcileState: NetworkReconcileState = {
  requested: null,
  agreed: false,
};

export function reconcileNetwork(
  state: NetworkReconcileState,
  input: { pageNetwork: Network; walletNetwork: Network | null },
): { state: NetworkReconcileState; action: NetworkReconcileAction } {
  const { pageNetwork, walletNetwork } = input;

  // Nothing to reconcile until the wallet reports a network.
  if (!walletNetwork) return { state, action: { type: 'none' } };

  // ── The page's ledger changed: mount, a link, the toolbar ─────────────────
  //
  // The wallet is asked even when the two already agree, and that is the point:
  // asking is what marks the ledger as deliberately chosen in the wallet
  // provider, and only a chosen ledger survives the cookie the provider
  // restores a tick after mount. Staying quiet when the values happened to
  // match left that cookie free to assert the other ledger, which then looked
  // exactly like somebody flipping the switch by hand.
  if (state.requested !== pageNetwork) {
    return {
      state: { requested: pageNetwork, agreed: walletNetwork === pageNetwork },
      action: { type: 'askWallet', to: pageNetwork },
    };
  }

  // ── The request is still in flight ────────────────────────────────────────
  if (!state.agreed) {
    return {
      state: walletNetwork === pageNetwork ? { ...state, agreed: true } : state,
      action: { type: 'none' },
    };
  }

  // ── Settled: a difference now IS a choice ─────────────────────────────────
  if (walletNetwork !== pageNetwork) {
    return { state, action: { type: 'moveDashboard', to: walletNetwork } };
  }

  return { state, action: { type: 'none' } };
}
