import { describe, expect, it } from 'vitest';
import { OLYMPIA_END_ISO, olympiaWindow } from '@/features/dashboard/lib/olympia';

describe('olympiaWindow', () => {
  it('covers whole local days', () => {
    const w = olympiaWindow({ start: '2022-05-10', end: '2022-05-11' });
    expect(w).toEqual({ from: new Date('2022-05-10T00:00:00').getTime(), to: new Date('2022-05-11T23:59:59.999').getTime() });
  });

  it('treats a lone start as one day', () => {
    const w = olympiaWindow({ start: '2022-05-10', end: null });
    expect(w?.to).toBe(new Date('2022-05-10T23:59:59.999').getTime());
  });

  it('stops at the end of Olympia', () => {
    const w = olympiaWindow({ start: '2023-09-20', end: '2023-10-05' });
    expect(w?.to).toBe(Date.parse(OLYMPIA_END_ISO));
  });

  it('is null for days after Olympia or without a start', () => {
    expect(olympiaWindow({ start: '2024-01-01', end: '2024-01-02' })).toBeNull();
    expect(olympiaWindow({ start: null, end: null })).toBeNull();
    expect(olympiaWindow({ start: 'nope', end: null })).toBeNull();
  });
});
