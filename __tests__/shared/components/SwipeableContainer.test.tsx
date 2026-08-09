/**
 * Reading-mode swipe — the gesture the blog, the forum, staking and the explorer
 * all share.
 *
 * These tests guard a design decision that is easy to undo by accident: the
 * swipe is *progressive*. Content follows the finger while it moves, and what it
 * uncovers is the real previous/next item, never an empty panel. Lifting the
 * finger only decides where the movement settles.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwipeableContainer } from '@/components/ui/SwipeableContainer';

const VIEWPORT_WIDTH = 400;

function setup(overrides: Partial<React.ComponentProps<typeof SwipeableContainer>> = {}) {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const setDirection = vi.fn();

    const utils = render(
        <SwipeableContainer
            itemKey="current"
            direction={0}
            setDirection={setDirection}
            onPrev={onPrev}
            onNext={onNext}
            prevContent={<p>Previous item body</p>}
            nextContent={<p>Next item body</p>}
            {...overrides}
        >
            <p>Current item body</p>
        </SwipeableContainer>
    );

    const viewport = screen.getByTestId('swipe-viewport');
    const track = screen.getByTestId('swipe-track');

    // jsdom has no layout; give the viewport a width so the commit threshold
    // is computed the way it is on a real phone.
    Object.defineProperty(viewport, 'offsetWidth', { value: VIEWPORT_WIDTH, configurable: true });

    return { ...utils, viewport, track, onPrev, onNext, setDirection };
}

/** Reads the px the track has been moved by, from its inline transform. */
function trackOffset(track: HTMLElement): number {
    const match = /translate3d\((-?[\d.]+)px/.exec(track.style.transform);
    return match ? Number(match[1]) : 0;
}

const touch = (clientX: number, clientY = 0) => ({
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX,
    clientY,
});

/** Ends the settle animation, which is what hands over to the neighbour. */
function endSettle(track: HTMLElement) {
    act(() => {
        fireEvent.transitionEnd(track, { propertyName: 'transform' });
    });
}

describe('SwipeableContainer', () => {
    beforeEach(() => {
        // jsdom does not implement pointer capture
        if (!Element.prototype.setPointerCapture) {
            Element.prototype.setPointerCapture = () => undefined;
        }
    });

    describe('while the finger is down', () => {
        it('moves the content with the finger, frame by frame', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(260));
            const afterFirstMove = trackOffset(track);

            fireEvent.pointerMove(track, touch(200));
            const afterSecondMove = trackOffset(track);

            // Content travels left with the finger, and keeps travelling
            expect(afterFirstMove).toBeLessThan(0);
            expect(afterSecondMove).toBeLessThan(afterFirstMove);
        });

        it('shows the real next item behind the gesture, not a blank panel', () => {
            const { track } = setup();

            expect(screen.queryByText('Next item body')).not.toBeInTheDocument();

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(200));

            expect(screen.getByText('Next item body')).toBeInTheDocument();
            expect(screen.getByText('Current item body')).toBeInTheDocument();
        });

        it('shows the real previous item when dragging the other way', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(100));
            fireEvent.pointerMove(track, touch(200));

            expect(screen.getByText('Previous item body')).toBeInTheDocument();
            expect(trackOffset(track)).toBeGreaterThan(0);
        });

        it('places each neighbour exactly one panel away, so it slides in flush', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(200));

            const prev = screen.getByTestId('swipe-prev');
            const next = screen.getByTestId('swipe-next');

            // Asserted on the inline style, not on utility classes: the panels
            // also carry `relative`, and a Tailwind `absolute` utility loses to
            // it, which is exactly how the neighbours once ended up stacked in
            // the flow — off screen, and blank behind the finger.
            expect(prev.style.position).toBe('absolute');
            expect(next.style.position).toBe('absolute');
            expect(prev.style.left).toBe('-100%');
            expect(next.style.left).toBe('100%');
            expect(prev.style.width).toBe('100%');
            expect(next.style.width).toBe('100%');
        });

        it('keeps vertical panning available so the body still scrolls', () => {
            const { track } = setup();

            // The horizontal axis is ours, the vertical one stays the browser's
            expect(track.style.touchAction).toBe('pan-y');
            expect(screen.getByText('Current item body').closest('div')?.style.touchAction).toBe('pan-y');
        });

        it('does not navigate until the finger is lifted', () => {
            const { track, onNext, onPrev } = setup();

            fireEvent.pointerDown(track, touch(380));
            fireEvent.pointerMove(track, touch(200));
            fireEvent.pointerMove(track, touch(20));

            expect(onNext).not.toHaveBeenCalled();
            expect(onPrev).not.toHaveBeenCalled();
        });

        it('resists at the edges, where there is no neighbour to uncover', () => {
            const { track } = setup({ onNext: undefined, nextContent: null });

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(200));

            // Still moves — the gesture is acknowledged — but well short of the finger
            const offset = trackOffset(track);
            expect(offset).toBeLessThan(0);
            expect(Math.abs(offset)).toBeLessThan(50);
        });

        it('leaves vertical gestures to the scroller and stays put', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(200, 300));
            fireEvent.pointerMove(track, touch(204, 200));

            expect(trackOffset(track)).toBe(0);
            expect(screen.queryByText('Next item body')).not.toBeInTheDocument();
        });
    });

    describe('when the finger is lifted', () => {
        it('settles onto the next item after a decisive drag', () => {
            const { track, onNext, setDirection } = setup();

            fireEvent.pointerDown(track, touch(340));
            fireEvent.pointerMove(track, touch(100));
            fireEvent.pointerUp(track, touch(100));

            // Lands on the neighbour's own position — a full panel away
            expect(trackOffset(track)).toBe(-VIEWPORT_WIDTH);
            expect(onNext).not.toHaveBeenCalled();

            endSettle(track);

            expect(onNext).toHaveBeenCalledTimes(1);
            expect(setDirection).toHaveBeenCalledWith(1);
            // Back to rest, ready to draw the item that just arrived
            expect(trackOffset(track)).toBe(0);
        });

        it('settles onto the previous item when dragged the other way', () => {
            const { track, onPrev, setDirection } = setup();

            fireEvent.pointerDown(track, touch(60));
            fireEvent.pointerMove(track, touch(300));
            fireEvent.pointerUp(track, touch(300));

            expect(trackOffset(track)).toBe(VIEWPORT_WIDTH);
            endSettle(track);

            expect(onPrev).toHaveBeenCalledTimes(1);
            expect(setDirection).toHaveBeenCalledWith(-1);
        });

        it('springs back and stays put when the drag was too short', () => {
            const { track, onNext, onPrev } = setup();

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(280));
            fireEvent.pointerUp(track, touch(280));

            expect(trackOffset(track)).toBe(0);
            endSettle(track);

            expect(onNext).not.toHaveBeenCalled();
            expect(onPrev).not.toHaveBeenCalled();
        });

        it('does not navigate past an edge that has no neighbour', () => {
            const { track, onNext } = setup({ onNext: undefined, nextContent: null });

            fireEvent.pointerDown(track, touch(380));
            fireEvent.pointerMove(track, touch(20));
            fireEvent.pointerUp(track, touch(20));

            endSettle(track);
            expect(onNext).not.toHaveBeenCalled();
            expect(trackOffset(track)).toBe(0);
        });

        it('drops the neighbours once the gesture is over', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(300));
            fireEvent.pointerMove(track, touch(280));
            fireEvent.pointerUp(track, touch(280));
            endSettle(track);

            expect(screen.queryByText('Next item body')).not.toBeInTheDocument();
            expect(screen.queryByText('Previous item body')).not.toBeInTheDocument();
        });

        it('animates the hand-over instead of jumping to it', () => {
            const { track } = setup();

            fireEvent.pointerDown(track, touch(340));
            fireEvent.pointerMove(track, touch(100));
            expect(track.style.transition).toBe('none');

            fireEvent.pointerUp(track, touch(100));
            expect(track.style.transition).toContain('transform');
        });
    });

    it('ignores the mouse — a pointer navigates with the arrows and the buttons', () => {
        const { track, onNext } = setup();

        fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 0 });
        fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 0 });
        fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 0 });

        expect(trackOffset(track)).toBe(0);
        expect(onNext).not.toHaveBeenCalled();
    });

    it('still navigates with the arrow keys', () => {
        const { onNext, onPrev } = setup();

        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(onNext).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it('does nothing at all when disabled', () => {
        const { track, onNext } = setup({ disabled: true });

        fireEvent.pointerDown(track, touch(340));
        fireEvent.pointerMove(track, touch(20));
        fireEvent.pointerUp(track, touch(20));

        expect(trackOffset(track)).toBe(0);
        expect(onNext).not.toHaveBeenCalled();
    });
});
