/**
 * The live-proposal store must follow the ledger the dashboard is showing.
 *
 * It was pinned to mainnet by a module constant that nothing could change, even
 * though the persistence key already branched on stokenet: the intent was
 * there, the switch was never wired. On Stokenet the epoch-history table
 * therefore showed MAINNET's live epoch and mainnet's proposal counts beside
 * Stokenet validators, and because the two ledgers just report different
 * numbers rather than erroring, nothing looked broken.
 *
 * The epochs are nowhere near each other (mainnet was at 329309 while stokenet
 * was at 242272 when this was written), so the fault was plainly visible once
 * you knew to compare.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setLiveNetwork,
  getLiveSnapshot,
  getLastKnownEpoch,
} from '@/services/liveDataStore';

const STORAGE_PREFIX = 'radix_live_v2_';

// This environment does not ship a localStorage, and the store persists a
// snapshot per network through it. A minimal in-memory stand-in is enough.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}

/** Shape the store persists per network. */
function persist(network: 'mainnet' | 'stokenet', epoch: number) {
  localStorage.setItem(
    STORAGE_PREFIX + network,
    JSON.stringify({ currentEpoch: epoch, finalizedEpochs: [] }),
  );
}

describe('live store network switching', () => {
  beforeEach(() => {
    localStorage.clear();
    // Back to the module default so each case starts from the same place.
    setLiveNetwork('mainnet');
  });

  it('reads the epoch persisted for the network it is switched to', () => {
    persist('mainnet', 329309);
    persist('stokenet', 242272);

    setLiveNetwork('stokenet');
    expect(getLastKnownEpoch()).toBe(242272);

    setLiveNetwork('mainnet');
    expect(getLastKnownEpoch()).toBe(329309);
  });

  it('never carries one ledger’s epoch onto the other', () => {
    // The reported bug, stated directly: nothing is stored for stokenet, so the
    // epoch must be unknown rather than mainnet's.
    persist('mainnet', 329309);

    setLiveNetwork('stokenet');

    expect(getLastKnownEpoch()).not.toBe(329309);
    expect(getLastKnownEpoch()).toBeNull();
  });

  it('drops proposal counts belonging to the previous ledger', () => {
    persist('mainnet', 329309);
    setLiveNetwork('mainnet');

    setLiveNetwork('stokenet');
    const snapshot = getLiveSnapshot();

    expect(snapshot.epochProposals.size).toBe(0);
    expect(snapshot.finalizedEpochs).toHaveLength(0);
  });

  it('keeps each network’s history under its own key', () => {
    persist('mainnet', 100);
    persist('stokenet', 200);

    setLiveNetwork('stokenet');
    expect(getLastKnownEpoch()).toBe(200);
    setLiveNetwork('mainnet');
    expect(getLastKnownEpoch()).toBe(100);
    setLiveNetwork('stokenet');
    expect(getLastKnownEpoch()).toBe(200);
  });

  it('is a no-op when the network does not change', () => {
    persist('stokenet', 242272);
    setLiveNetwork('stokenet');
    const first = getLiveSnapshot();

    setLiveNetwork('stokenet');

    // Same object: re-selecting the current ledger must not reset anything.
    expect(getLiveSnapshot()).toBe(first);
    expect(getLastKnownEpoch()).toBe(242272);
  });
});
