/**
 * The epoch-history table must never skip an epoch.
 *
 * It has skipped twice, for different reasons. First, rows whose counts were
 * 0 made / 0 missed were discarded as if they carried no information, so a
 * validator simply not selected to propose had that epoch vanish. Then, the
 * row the SERVER marked live kept being discarded after the chain moved past
 * it, leaving a hole directly under the live row: "329450, 329448…".
 *
 * These exercise the real merge, not a copy of it: the previous version of
 * this file mirrored the logic by hand, which is how the second gap slipped
 * through with the tests green.
 */
import { describe, it, expect } from 'vitest';
import { unifyEpochRows } from '@/features/dashboard/staking/components/LiveProposals';

/** A contiguous server range, newest first, exactly as the gateway emits it. */
function serverRange(liveEpoch: number, count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    epoch: liveEpoch - i,
    completedProposals: i === 0 ? 3 : 10 + i,
    missedProposals: 0,
    isLive: i === 0,
  }));
}

const epochs = (rows: { epoch: number }[]) => rows.map((r) => r.epoch);

/** True when the epochs descend one by one with nothing missing. */
const contiguous = (rows: { epoch: number }[]) =>
  rows.every((row, i) => i === 0 || rows[i - 1].epoch - row.epoch === 1);

describe('epoch history rows', () => {
  it('stays contiguous while the server snapshot is still current', () => {
    const rows = unifyEpochRows({
      liveEpoch: 329450,
      epochMade: 3,
      epochMissed: 0,
      bridgedEpochs: [],
      serverPerformance: serverRange(329450),
    });
    expect(epochs(rows)).toEqual([329450, 329449, 329448, 329447, 329446, 329445]);
    expect(contiguous(rows)).toBe(true);
    expect(rows[0].isLive).toBe(true);
  });

  it('keeps the epoch the server called live once the chain moves past it', () => {
    // Rendered during 329449, and the browser has since seen 329450 start.
    // Nothing bridged it: this validator proposed nothing, so the live store
    // holds no entry for it.
    const rows = unifyEpochRows({
      liveEpoch: 329450,
      epochMade: 0,
      epochMissed: 0,
      bridgedEpochs: [],
      serverPerformance: serverRange(329449),
    });
    expect(epochs(rows)).toEqual([329450, 329449, 329448, 329447, 329446, 329445]);
    expect(contiguous(rows)).toBe(true);
    // It is no longer live, and it keeps the counts the server had for it.
    const previous = rows.find((r) => r.epoch === 329449)!;
    expect(previous.isLive).toBe(false);
    expect(previous.completedProposals).toBe(3);
  });

  it('prefers the bridged tally over the partial one the server saw', () => {
    const rows = unifyEpochRows({
      liveEpoch: 329450,
      epochMade: 1,
      epochMissed: 0,
      // The browser watched 329449 finish: 9 proposals, not the 3 the server
      // could see while the epoch was still running.
      bridgedEpochs: [
        { epoch: 329449, completedProposals: 9, missedProposals: 1, isLive: false },
      ],
      serverPerformance: serverRange(329449),
    });
    expect(rows.find((r) => r.epoch === 329449)).toMatchObject({
      completedProposals: 9,
      missedProposals: 1,
    });
    expect(contiguous(rows)).toBe(true);
  });

  it('keeps an epoch where the validator proposed nothing at all', () => {
    const server = serverRange(329450).map((row) =>
      row.epoch === 329448
        ? { ...row, completedProposals: 0, missedProposals: 0 }
        : row,
    );
    const rows = unifyEpochRows({
      liveEpoch: 329450,
      epochMade: 0,
      epochMissed: 0,
      bridgedEpochs: [],
      serverPerformance: server,
    });
    expect(epochs(rows)).toContain(329448);
    expect(contiguous(rows)).toBe(true);
  });

  it('never shows more than six, and always the newest six', () => {
    const rows = unifyEpochRows({
      liveEpoch: 329450,
      epochMade: 0,
      epochMissed: 0,
      bridgedEpochs: [
        { epoch: 329449, completedProposals: 5, missedProposals: 0, isLive: false },
        { epoch: 329444, completedProposals: 5, missedProposals: 0, isLive: false },
      ],
      serverPerformance: serverRange(329449, 8),
    });
    expect(rows).toHaveLength(6);
    expect(epochs(rows)).toEqual([329450, 329449, 329448, 329447, 329446, 329445]);
  });

  it('holds together before the live epoch is known', () => {
    const rows = unifyEpochRows({
      liveEpoch: null,
      epochMade: 0,
      epochMissed: 0,
      bridgedEpochs: [],
      serverPerformance: serverRange(329450),
    });
    // The server's own table is all there is: it survives whole, and no row
    // is invented for an epoch that does not exist.
    expect(epochs(rows)).toEqual([329450, 329449, 329448, 329447, 329446, 329445]);
    expect(contiguous(rows)).toBe(true);
    expect(rows.find((r) => r.epoch === 329450)?.isLive).toBe(true);
  });
});
