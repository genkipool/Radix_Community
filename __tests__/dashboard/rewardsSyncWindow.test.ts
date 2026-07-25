/**
 * The rewards sync must repair holes, not just advance past them.
 *
 * Two separate defects produced the same visible symptom — the epoch-history
 * table showing v XRD / d XRD for only the newest few rows while the older ones
 * sat empty:
 *
 *  1. The fetch window was sized from the high-water mark alone. Once a late or
 *     failed run let the mark jump over an epoch, nothing ever looked back at
 *     it, so the hole was permanent.
 *  2. Events were filtered with `epoch > lastProcessedEpoch`, which discarded
 *     precisely the epochs a repair would need to re-fetch.
 *
 * The table draws the live epoch plus the 5 that closed before it, and all 5
 * must carry figures. These assertions pin that contract.
 */
import { describe, it, expect } from 'vitest';

const EPOCH_REWARDS_MIN_COVERAGE = 5;
const EPOCH_REWARDS_RETENTION = 10;
const MIN_EPOCH_FETCH = 3;

/** Mirrors the window calculation in the sync-validator-rewards route. */
function planSync(input: { currentEpoch: number; lastEpoch: number; stored: number[] }) {
  const { currentEpoch, lastEpoch, stored } = input;
  const have = new Set(stored);

  const missing: number[] = [];
  const oldestVisible = currentEpoch > 0 ? currentEpoch - EPOCH_REWARDS_MIN_COVERAGE : 0;
  for (let epoch = oldestVisible; epoch < currentEpoch; epoch++) {
    if (epoch > 0 && !have.has(epoch)) missing.push(epoch);
  }

  const reachBackTo = Math.min(
    lastEpoch > 0 ? lastEpoch : currentEpoch,
    missing.length > 0 ? Math.min(...missing) : currentEpoch,
  );
  const gap = currentEpoch > 0 && reachBackTo > 0 ? currentEpoch - reachBackTo : 0;
  const window = Math.min(Math.max(gap + 1, MIN_EPOCH_FETCH), EPOCH_REWARDS_RETENTION);

  return { missing, window };
}

/** Mirrors the event filter that decides what reaches Redis. */
function keptEpochs(fetched: number[], lastEpoch: number, missing: number[]): number[] {
  const missingSet = new Set(missing);
  if (lastEpoch <= 0) return fetched;
  return fetched.filter((epoch) => epoch > lastEpoch || missingSet.has(epoch));
}

/** The epochs the table renders with reward figures. */
const finishedRows = (currentEpoch: number) =>
  Array.from({ length: EPOCH_REWARDS_MIN_COVERAGE }, (_, i) => currentEpoch - 1 - i);

describe('rewards sync window', () => {
  it('stays cheap when nothing is missing', () => {
    // The happy path of a five-minute cron: one new epoch, no holes. Asking for
    // the full retention window every run pulled megabytes and blew past the
    // fetch cache's ceiling, so this must stay at the minimum.
    const { missing, window } = planSync({
      currentEpoch: 500,
      lastEpoch: 499,
      stored: [499, 498, 497, 496, 495],
    });

    expect(missing).toEqual([]);
    expect(window).toBe(MIN_EPOCH_FETCH);
  });

  it('reaches back far enough to cover a hole behind the high-water mark', () => {
    // The reported case: the mark already at 329134, with 329130 lost behind
    // it. Only 329130 is still on screen — 329129 has scrolled off the table,
    // so it is history rather than damage.
    const { missing, window } = planSync({
      currentEpoch: 329135,
      lastEpoch: 329134,
      stored: [329134, 329133, 329132, 329131, 329128, 329127],
    });

    expect(missing).toEqual([329130]);
    // Must span 329135 back to 329130 inclusive.
    expect(window).toBeGreaterThanOrEqual(329135 - 329130 + 1);
  });

  it('keeps re-fetched hole epochs instead of filtering them out', () => {
    const currentEpoch = 329135;
    const lastEpoch = 329134;
    const { missing } = planSync({
      currentEpoch,
      lastEpoch,
      stored: [329134, 329133, 329132, 329131],
    });

    const fetched = [329134, 329133, 329132, 329131, 329130, 329129];
    const kept = keptEpochs(fetched, lastEpoch, missing);

    // The old filter (`epoch > lastEpoch`) kept nothing at all here.
    expect(kept).toContain(329130);
    // Epochs off the table are not re-written, so a repair stays cheap.
    expect(kept).not.toContain(329129);
  });

  it('fills every row the table draws after one repairing run', () => {
    const currentEpoch = 329135;
    const lastEpoch = 329134;
    const stored = [329134, 329133, 329132, 329131, 329128, 329127];

    const { missing, window } = planSync({ currentEpoch, lastEpoch, stored });
    const fetched = Array.from({ length: window }, (_, i) => currentEpoch - 1 - i);
    const after = new Set([...stored, ...keptEpochs(fetched, lastEpoch, missing)]);

    for (const epoch of finishedRows(currentEpoch)) {
      expect(after.has(epoch), `epoch ${epoch} must have reward data`).toBe(true);
    }
  });

  it('never asks for more than is retained', () => {
    const { window } = planSync({ currentEpoch: 900, lastEpoch: 1, stored: [] });
    expect(window).toBeLessThanOrEqual(EPOCH_REWARDS_RETENTION);
  });

  it('does not treat epochs older than the table as damage', () => {
    // Epochs that scrolled out of the window are gone for good, and chasing
    // them would grow the fetch without ever satisfying the check.
    const { missing } = planSync({
      currentEpoch: 500,
      lastEpoch: 499,
      stored: [499, 498, 497, 496, 495],
    });

    expect(missing.every((epoch) => epoch >= 500 - EPOCH_REWARDS_MIN_COVERAGE)).toBe(true);
  });

  it('copes with an empty store on first ever run', () => {
    const { missing, window } = planSync({ currentEpoch: 100, lastEpoch: 0, stored: [] });
    expect(missing).toEqual([95, 96, 97, 98, 99]);
    expect(window).toBeGreaterThanOrEqual(EPOCH_REWARDS_MIN_COVERAGE);
  });
});

describe('sync metadata', () => {
  /** Mirrors the high-water mark calculation in syncRewardsToRedis. */
  const nextMark = (processed: number[], fetched: number[], previous: number) =>
    Math.max(...processed, ...fetched, previous);

  it('never moves the high-water mark backwards', () => {
    // `Math.max(...[], 0)` reset the mark to zero whenever every event was
    // skipped by the accumulation guard, making the next run redo all history.
    expect(nextMark([], [], 329134)).toBe(329134);
  });

  it('advances the mark to the newest epoch seen', () => {
    expect(nextMark([329138], [329138, 329137], 329134)).toBe(329138);
  });

  it('does not regress when a repair processes only old epochs', () => {
    expect(nextMark([329129], [329129, 329130], 329134)).toBe(329134);
  });
});
