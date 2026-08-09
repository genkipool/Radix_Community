'use client';

/**
 * The ledger the validators ON SCREEN belong to, which is not always the one
 * the toolbar is highlighting.
 *
 * Picking a network flips the requested one at once, but the list for it may
 * not be in hand yet — and React Query's `placeholderData` hands back the OTHER
 * ledger's validators while it arrives. Everything that reads a network
 * alongside that list (the stakes that pin the wallet's own nodes, the live
 * proposal store, the network each card links into) has to read this value
 * instead, or for a moment Mainnet's validators are rendered against Stokenet's
 * context: wrong stakes, wrong links, and an epoch history whose live row comes
 * from a ledger where that epoch number means nothing.
 *
 * Nothing is torn down while it catches up. The previous ledger's cards stay
 * exactly as they are until their replacements exist — no skeletons, no empty
 * grid. Warm, which is the normal case since the toolbar prefetches on hover
 * and on touch, this advances in the same render as the click.
 */
import { useEffect, useState } from 'react';
import type { Network } from '../types';

export interface CommitNetworkInput {
  /** The ledger currently on screen. */
  committed: Network;
  /** The ledger the user has asked for. */
  requested: Network;
  /** Whether the view showing validators is the one on screen. */
  isStakingView: boolean;
  /**
   * Whether the list in hand is the requested ledger's own, rather than the
   * previous one standing in for it (`isPlaceholderData`).
   */
  hasOwnList: boolean;
  /**
   * Whether the connected wallet's stakes on the requested ledger have been
   * read, which is what decides WHICH CARDS GO FIRST.
   *
   * The list alone is not enough to draw the grid. Arriving without this, the
   * validators paint in plain order and then visibly reorder themselves as the
   * wallet's own nodes jump to the top. `true` when no wallet is connected,
   * because then there is nothing to pin.
   */
  walletPinsReady: boolean;
}

/**
 * How long the grid will wait for a tidy switch before taking a scruffy one.
 *
 * The wait is a courtesy, never a condition. A read that hangs — a wallet whose
 * accounts belong to the other ledger and are retried against this one, a
 * Gateway having a bad minute — must not leave the page stuck on a network the
 * user did not ask for. Past this, it switches with whatever it has.
 */
const PATIENCE_MS = 700;

/**
 * Whether the page may now say it is on the requested ledger.
 *
 * Outside staking there is no validator list to stay in step with, so the
 * switch takes effect immediately.
 */
export function shouldCommitNetwork({
  committed,
  requested,
  isStakingView,
  hasOwnList,
  walletPinsReady,
  outOfPatience = false,
}: CommitNetworkInput & { outOfPatience?: boolean }): boolean {
  if (committed === requested) return false;
  if (!isStakingView) return true;
  // Waited long enough: showing the wrong ledger beats showing no switch at all.
  if (outOfPatience) return true;
  // Both, or the grid paints once in the wrong order and again in the right one.
  return hasOwnList && walletPinsReady;
}

export function useCommittedNetwork(
  initial: Network,
  input: Omit<CommitNetworkInput, 'committed'>,
): Network {
  const [committed, setCommitted] = useState<Network>(initial);
  const [outOfPatience, setOutOfPatience] = useState(false);
  const waitingFor = committed === input.requested ? null : input.requested;

  // Each new request starts its own clock.
  const [clockFor, setClockFor] = useState<Network | null>(waitingFor);
  if (clockFor !== waitingFor) {
    setClockFor(waitingFor);
    setOutOfPatience(false);
  }

  useEffect(() => {
    if (!waitingFor) return;
    const timer = setTimeout(() => setOutOfPatience(true), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [waitingFor]);

  // Updating during render rather than in an effect: an effect would commit one
  // paint later, which is a frame of the new ledger's name over the old
  // ledger's cards.
  if (shouldCommitNetwork({ ...input, committed, outOfPatience })) {
    setCommitted(input.requested);
  }

  return committed;
}
