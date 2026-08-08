// @vitest-environment jsdom
/**
 * Where a floating panel lands.
 *
 * The menus and QR codes this places hang off controls inside cards that clip
 * their own overflow, and the cards sit anywhere on screen: bottom row, last
 * column. Opening downward by default put half a menu below the fold and half
 * a QR outside its card, which is exactly the case nobody notices while
 * building on a tall window.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';

const PANEL = { width: 200, height: 300 };

/** A trigger whose rectangle the test dictates (set once it is in the DOM). */
function Harness() {
  const { anchorRef, position, open, place } = useAnchoredPosition(PANEL);
  return (
    <>
      <button ref={anchorRef} onClick={place}>
        open
      </button>
      {open && position && (
        <div data-testid="panel" data-top={position.top} data-left={position.left} />
      )}
    </>
  );
}

function openAt(rect: { top: number; bottom: number; right: number }) {
  render(<Harness />);
  const button = screen.getByRole('button');
  button.getBoundingClientRect = () =>
    ({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.right - 32,
      right: rect.right,
      width: 32,
      height: rect.bottom - rect.top,
      x: rect.right - 32,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  act(() => {
    button.click();
  });
  const panel = screen.getByTestId('panel');
  return {
    top: Number(panel.dataset.top),
    left: Number(panel.dataset.left),
  };
}

beforeEach(() => {
  window.innerHeight = 800;
  window.innerWidth = 1200;
});
afterEach(cleanup);

describe('anchored panel placement', () => {
  it('opens under the trigger when the space below fits it', () => {
    const { top } = openAt({ top: 100, bottom: 130, right: 500 });
    expect(top).toBe(138); // 130 + 8 margin
  });

  it('opens above when the space below does not fit it', () => {
    // 600 + 8 + 300 runs past an 800px window, so it flips.
    const { top } = openAt({ top: 570, bottom: 600, right: 500 });
    expect(top).toBe(262); // 570 - 8 - 300
  });

  it('never leaves the top of the window, however tight it is', () => {
    // No room either way: pinned to the margin rather than pushed off screen.
    window.innerHeight = 320;
    const { top } = openAt({ top: 40, bottom: 70, right: 500 });
    expect(top).toBe(8);
  });

  it('keeps the panel inside the right edge', () => {
    // A trigger in the last column: the panel would end at 1195 + margin.
    const { left } = openAt({ top: 100, bottom: 130, right: 1195 });
    expect(left).toBe(992); // 1200 - 200 - 8
  });

  it('keeps the panel inside the left edge', () => {
    const { left } = openAt({ top: 100, bottom: 130, right: 60 });
    expect(left).toBe(8);
  });
});
