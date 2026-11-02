/**
 * Where a navbar popup goes, worked out from where its button actually is.
 *
 * The popups used to be placed with fixed CSS offsets. Those were right for
 * the widths they were drawn at and wrong for the rest: between 768 and
 * 1279 px the wallet popup sat in the middle of the page, far from its button,
 * and the one in the mobile menu was pinned to the bottom of the screen right
 * on top of the very button that opens it.
 *
 * Here the popup is lined up with its button (right edges, left edges or
 * centres), put below it, or above when below has no room, and then kept
 * inside the window. It never covers the button: horizontal clamping can move
 * it sideways, but vertically it always starts past the button's edge.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
  side: 'below' | 'above';
  /** Set only when the popup is taller than the room it has. */
  maxHeight?: number;
  /** Set only when the popup is wider than the window. */
  maxWidth?: number;
}

export interface PlaceInput {
  trigger: Rect;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  align: 'left' | 'center' | 'right';
  /** Space between the button and the popup. */
  gap?: number;
  /** Space kept between the popup and the window's edges. */
  margin?: number;
}

export function placePopup({
  trigger,
  width,
  height,
  viewportWidth,
  viewportHeight,
  align,
  gap = 8,
  margin = 8,
}: PlaceInput): Placement {
  const room = viewportWidth - 2 * margin;
  const maxWidth = width > room ? room : undefined;
  const w = maxWidth ?? width;

  const wanted =
    align === 'right'
      ? trigger.right - w
      : align === 'center'
        ? (trigger.left + trigger.right) / 2 - w / 2
        : trigger.left;
  const left = Math.max(margin, Math.min(wanted, viewportWidth - margin - w));

  const below = viewportHeight - margin - (trigger.bottom + gap);
  const above = trigger.top - gap - margin;
  const side = height <= below || below >= above ? 'below' : 'above';
  const space = side === 'below' ? below : above;
  const maxHeight = height > space ? Math.max(space, 0) : undefined;
  const h = maxHeight ?? height;
  const top = side === 'below' ? trigger.bottom + gap : trigger.top - gap - h;

  return { left: Math.round(left), top: Math.round(top), side, maxHeight, maxWidth };
}

/**
 * Viewport position of the box a `position: fixed` element is laid out in.
 *
 * Normally that is the window, but an ancestor with a transform, a filter or a
 * backdrop filter takes its place: the navbar has both (it slides away in
 * theatre mode and blurs what is behind it). Its offset is subtracted so the
 * numbers above, which are in window coordinates, land where they should.
 */
export function fixedOrigin(el: HTMLElement): { x: number; y: number } {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const s = getComputedStyle(node);
    const backdrop = s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
    if (
      (s.transform && s.transform !== 'none') ||
      (s.translate && s.translate !== 'none') ||
      (s.filter && s.filter !== 'none') ||
      (backdrop && backdrop !== 'none') ||
      (s.perspective && s.perspective !== 'none') ||
      /transform|filter|perspective/.test(s.willChange) ||
      /paint|layout|strict|content/.test(s.contain)
    ) {
      const r = node.getBoundingClientRect();
      return { x: r.left + node.clientLeft, y: r.top + node.clientTop };
    }
  }
  return { x: 0, y: 0 };
}
