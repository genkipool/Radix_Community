/**
 * The epoch-history table must never skip an epoch.
 *
 * It used to: rows whose counts were 0 made / 0 missed were discarded as if
 * they carried no information, so a validator that was simply not selected to
 * propose during an epoch had that epoch vanish. The table then read
 * "…329121, 329116…" with four epochs silently missing.
 *
 * This pins the row-merging rules that `useLiveProposals` applies.
 */
import { describe, it, expect } from 'vitest';

interface Row {
  epoch: number;
  completedProposals: number;
  missedProposals: number;
  isLive: boolean;
}

/** Mirrors the de-duplication and ordering in useLiveProposals. */
function mergeEpochRows(liveRow: Row, bridged: Row[], serverRows: Row[]): Row[] {
  const combined = [liveRow, ...bridged, ...serverRows];
  const unique = Array.from(
    combined
      .reduce((map, row) => {
        const existing = map.get(row.epoch);
        if (!existing) {
          map.set(row.epoch, row);
          return map;
        }
        const hasData = row.completedProposals > 0 || row.missedProposals > 0;
        const existingHasData =
          existing.completedProposals > 0 || existing.missedProposals > 0;
        if (!existingHasData && hasData) map.set(row.epoch, row);
        return map;
      }, new Map<number, Row>())
      .values(),
  );
  return unique.sort((a, b) => b.epoch - a.epoch).slice(0, 6);
}

const row = (epoch: number, made: number, missed: number, isLive = false): Row => ({
  epoch,
  completedProposals: made,
  missedProposals: missed,
  isLive,
});

describe('epoch history rows', () => {
  it('keeps epochs where the validator proposed nothing', () => {
    // The reported case: only the newest epoch has proposals.
    const live = row(329121, 3, 0, true);
    const server = [
      row(329120, 0, 0),
      row(329119, 0, 0),
      row(329118, 0, 0),
      row(329117, 0, 0),
      row(329116, 2, 0),
    ];

    const epochs = mergeEpochRows(live, [], server).map((r) => r.epoch);

    expect(epochs).toEqual([329121, 329120, 329119, 329118, 329117, 329116]);
  });

  it('produces an unbroken descending sequence', () => {
    const live = row(500, 1, 0, true);
    const server = Array.from({ length: 6 }, (_, i) => row(499 - i, 0, 0));

    const epochs = mergeEpochRows(live, [], server).map((r) => r.epoch);

    epochs.forEach((epoch, i) => {
      if (i > 0) expect(epochs[i - 1] - epoch).toBe(1);
    });
  });

  it('prefers the row carrying real counts when both sources have the epoch', () => {
    // The server falls back to zeros when a snapshot is missing; the live
    // buffer knows better.
    const merged = mergeEpochRows(row(100, 0, 0, true), [row(99, 5, 1)], [row(99, 0, 0)]);
    const epoch99 = merged.find((r) => r.epoch === 99);
    expect(epoch99?.completedProposals).toBe(5);
    expect(epoch99?.missedProposals).toBe(1);
  });

  it('always keeps the live epoch first', () => {
    const merged = mergeEpochRows(row(700, 0, 0, true), [], [row(699, 4, 0)]);
    expect(merged[0].epoch).toBe(700);
    expect(merged[0].isLive).toBe(true);
  });

  it('shows at most six epochs', () => {
    const server = Array.from({ length: 20 }, (_, i) => row(900 - i - 1, 1, 0));
    expect(mergeEpochRows(row(900, 1, 0, true), [], server)).toHaveLength(6);
  });
});
