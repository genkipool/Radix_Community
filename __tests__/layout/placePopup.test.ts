import { describe, expect, it } from 'vitest';
import { placePopup, type Rect } from '@/components/layout/placePopup';

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });
const overlaps = (a: Rect, b: Rect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

describe('placePopup', () => {
  it('lines a right-aligned popup up with the right edge of its button, below it', () => {
    const spot = placePopup({
      trigger: rect(1300, 18, 1492, 62), width: 282, height: 135,
      viewportWidth: 1524, viewportHeight: 900, align: 'right',
    });
    expect(spot).toMatchObject({ left: 1492 - 282, top: 70, side: 'below' });
  });

  it('keeps a popup wider than the room to its left inside the window', () => {
    // The theme popup (440 px) under a button near the left of a phone screen.
    const spot = placePopup({
      trigger: rect(214, 20, 254, 60), width: 440, height: 280,
      viewportWidth: 360, viewportHeight: 740, align: 'right',
    });
    expect(spot.left).toBe(8);
    expect(spot.maxWidth).toBe(344);
  });

  it('never runs past the right edge either', () => {
    const spot = placePopup({
      trigger: rect(10, 20, 50, 60), width: 300, height: 100,
      viewportWidth: 320, viewportHeight: 600, align: 'left',
    });
    expect(spot.left + 300).toBeLessThanOrEqual(320 - 8);
  });

  it('opens above a button at the bottom of the screen instead of covering it', () => {
    // The connect button at the end of the mobile menu.
    const trigger = rect(89, 775, 291, 823);
    const spot = placePopup({
      trigger, width: 280, height: 135,
      viewportWidth: 390, viewportHeight: 844, align: 'center',
    });
    expect(spot.side).toBe('above');
    expect(overlaps(trigger, rect(spot.left, spot.top, spot.left + 280, spot.top + 135))).toBe(false);
    expect(spot.top + 135).toBeLessThanOrEqual(trigger.top);
  });

  it('centres a centre-aligned popup on its button', () => {
    const spot = placePopup({
      trigger: rect(400, 100, 600, 140), width: 280, height: 135,
      viewportWidth: 1200, viewportHeight: 900, align: 'center',
    });
    expect(spot.left).toBe(360);
  });

  it('caps the height to the larger side when it fits on neither, still clear of the button', () => {
    const trigger = rect(100, 280, 200, 320);
    const spot = placePopup({
      trigger, width: 200, height: 900,
      viewportWidth: 800, viewportHeight: 600, align: 'left',
    });
    expect(spot.maxHeight).toBeDefined();
    const box = rect(spot.left, spot.top, spot.left + 200, spot.top + (spot.maxHeight ?? 0));
    expect(overlaps(trigger, box)).toBe(false);
    expect(box.top).toBeGreaterThanOrEqual(8);
    expect(box.bottom).toBeLessThanOrEqual(600 - 8);
  });

  it('never covers its button at any common window size', () => {
    for (const [vw, vh] of [[360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1920, 1080], [2560, 1440]]) {
      for (const align of ['left', 'center', 'right'] as const) {
        for (const [w, h] of [[176, 127], [440, 255], [282, 135], [420, 235]]) {
          const trigger = rect(vw - 200, 18, vw - 16, 62);
          const spot = placePopup({ trigger, width: w, height: h, viewportWidth: vw, viewportHeight: vh, align });
          const box = rect(spot.left, spot.top, spot.left + (spot.maxWidth ?? w), spot.top + (spot.maxHeight ?? h));
          expect(overlaps(trigger, box)).toBe(false);
          expect(box.left).toBeGreaterThanOrEqual(8);
          expect(box.right).toBeLessThanOrEqual(vw - 8);
        }
      }
    }
  });
});
