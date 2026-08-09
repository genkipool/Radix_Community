'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from "motion/react";

interface SwipeableContainerProps {
    children: React.ReactNode;
    /**
     * The previous / next item, already rendered. Mounted only while a finger is
     * dragging, so what slides in behind the gesture is the real information and
     * never an empty panel. Pass `null` when there is nothing on that side.
     */
    prevContent?: React.ReactNode;
    nextContent?: React.ReactNode;
    onNext?: () => void;
    onPrev?: () => void;
    direction: number;
    setDirection: (d: number) => void;
    itemKey: string | number;
    className?: string;
    threshold?: number;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
    /** Extra classes for the clipping viewport (the frame that never moves). */
    viewportClassName?: string;
}

/** Movement, in px, that decides whether the gesture is a swipe or a scroll. */
const AXIS_LOCK = 8;
/** Fraction of the panel width that always commits, however wide the modal is. */
const COMMIT_RATIO = 0.35;
/** Resistance applied when dragging towards an edge that has no neighbour. */
const RUBBER_BAND = 0.25;

const SETTLE_MS = 240;
const SETTLE_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

type Axis = 'x' | 'y';
type Side = 'prev' | 'next';

/**
 * SwipeableContainer
 *
 * Owns the whole reading-mode deck: the current item, its two neighbours, and
 * the horizontal gesture that moves between them.
 *
 * The gesture is progressive — content tracks the finger frame by frame while it
 * moves, and the neighbour it uncovers is mounted for real, so the reader sees
 * the previous/next item during the drag instead of a blank gap. Lifting the
 * finger only decides where the movement settles: past the threshold it lands on
 * the neighbour, otherwise it springs back to the current item.
 *
 * Uses manual pointer tracking instead of Framer Motion's drag="x" so that the
 * browser's text selection mechanism is never blocked.
 */
export const SwipeableContainer: React.FC<SwipeableContainerProps> = ({
    children,
    prevContent = null,
    nextContent = null,
    onNext,
    onPrev,
    direction,
    setDirection,
    itemKey,
    className = '',
    threshold = 80,
    disabled = false,
    onClick,
    style,
    viewportClassName = '',
}) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const startPos = useRef<{ x: number; y: number } | null>(null);
    const axis = useRef<Axis | null>(null);
    const offsetRef = useRef(0);
    const pending = useRef<Side | null>(null);
    const didSwipe = useRef(false);

    /**
     * True for the single render in which a swipe hands over to the next item.
     * The neighbour is already sitting exactly where the incoming item will be
     * drawn, so the enter/exit animation has to be skipped or the content would
     * visibly jump back and slide in a second time.
     */
    const instant = useRef(false);

    const [offset, setOffsetState] = useState(0);
    const [settling, setSettling] = useState(false);
    const [dragging, setDragging] = useState(false);

    const setOffset = (value: number) => {
        offsetRef.current = value;
        setOffsetState(value);
    };

    // A swipe hand-over lasts exactly one commit; every render clears the flag.
    useEffect(() => {
        instant.current = false;
    });

    // Direction-aware slide animation variants
    const variants = {
        initial: (d: number) => (instant.current
            ? { x: 0, opacity: 1 }
            : {
                x: d > 0 ? 300 : d < 0 ? -300 : 0,
                opacity: 0,
            }),
        animate: {
            x: 0,
            opacity: 1,
            zIndex: 1,
        },
        exit: (d: number) => (instant.current
            ? {
                opacity: 0,
                zIndex: 0,
                position: 'absolute' as const,
                top: 0,
                left: 0,
                right: 0,
                transition: { duration: 0 },
            }
            : {
                x: d > 0 ? -300 : d < 0 ? 300 : 0,
                opacity: 0,
                zIndex: 0,
                position: 'absolute' as const,
                top: 0,
                left: 0,
                right: 0,
            }),
    };

    // Keyboard navigation: ArrowLeft / ArrowRight
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && onPrev) {
                e.preventDefault();
                setDirection(-1);
                onPrev();
            } else if (e.key === 'ArrowRight' && onNext) {
                e.preventDefault();
                setDirection(1);
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onPrev, onNext, setDirection]);

    /** End of the settle animation: drop the neighbours and adopt the new item. */
    const finish = () => {
        const side = pending.current;
        pending.current = null;

        if (side) instant.current = true;

        setSettling(false);
        setDragging(false);
        setOffset(0);

        if (side === 'prev') {
            setDirection(-1);
            onPrev?.();
        } else if (side === 'next') {
            setDirection(1);
            onNext?.();
        }
    };

    /** Move to `target` px; if there is nothing to animate, land straight away. */
    const settleTo = (target: number) => {
        if (offsetRef.current === target) {
            finish();
            return;
        }
        setSettling(true);
        setOffset(target);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only track touch gestures — mouse users navigate via buttons/keyboard
        didSwipe.current = false;
        if (disabled || e.pointerType === 'mouse') return;
        // A second finger during a swipe would fight the first one for the track
        if (axis.current || settling) return;
        startPos.current = { x: e.clientX, y: e.clientY };
        axis.current = null;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (disabled || !startPos.current) return;

        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;

        if (!axis.current) {
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < AXIS_LOCK && absDy < AXIS_LOCK) return;

            if (absDy >= absDx) {
                // Vertical intent: hand the gesture back for native scrolling
                startPos.current = null;
                return;
            }

            axis.current = 'x';
            setDragging(true);
            try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // Pointer capture is best-effort; the gesture still works without it
            }
        }

        // Discount the lock distance so the content starts moving from where the
        // finger is, not 8px behind it
        const travel = dx - Math.sign(dx) * AXIS_LOCK;
        const hasNeighbour = travel > 0 ? !!onPrev : !!onNext;
        setOffset(hasNeighbour ? travel : travel * RUBBER_BAND);
    };

    const handlePointerUp = () => {
        if (disabled || axis.current !== 'x') {
            startPos.current = null;
            axis.current = null;
            return;
        }

        startPos.current = null;
        axis.current = null;

        const travel = offsetRef.current;
        const width = viewportRef.current?.offsetWidth || 0;
        const limit = width > 0 ? Math.min(threshold, width * COMMIT_RATIO) : threshold;
        const side: Side = travel > 0 ? 'prev' : 'next';
        const handler = side === 'prev' ? onPrev : onNext;

        if (handler && Math.abs(travel) > limit) {
            didSwipe.current = true;
            pending.current = side;
            // Land on the neighbour's own position; it is already drawn there
            settleTo(side === 'prev' ? (width || Math.abs(travel)) : -(width || Math.abs(travel)));
        } else {
            settleTo(0);
        }
    };

    const handleTransitionEnd = (e: React.TransitionEvent) => {
        if (e.target !== trackRef.current || e.propertyName !== 'transform') return;
        if (!settling) return;
        finish();
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        // If a swipe just happened, suppress the click
        if (didSwipe.current) {
            didSwipe.current = false;
            e.stopPropagation();
            return;
        }
        if (onClick) {
            onClick(e);
        } else {
            e.stopPropagation();
        }
    };

    const panelClass = `flex-1 flex flex-col min-h-0 relative select-text ${className}`;
    // touch-action is intersected down the tree, and some call sites carry
    // `touch-none` in their className — the panel has to re-open vertical
    // panning or the modal body would stop scrolling.
    const panelStyle: React.CSSProperties = { ...style, touchAction: 'pan-y' };

    /**
     * A neighbour parked one full panel away, to the given side.
     *
     * The placement has to be inline. `panelClass` and every call site's own
     * className carry `relative`, and Tailwind emits `.relative` after
     * `.absolute`, so an `absolute` utility here would silently lose: the
     * neighbours would drop into the flow underneath the current item and the
     * reader would drag a blank panel into view.
     */
    const neighbourStyle = (side: Side): React.CSSProperties => ({
        ...panelStyle,
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '100%',
        left: side === 'next' ? '100%' : '-100%',
        overflow: 'hidden',
        pointerEvents: 'none',
    });

    // Neighbours only exist for the length of the gesture: they are heavy
    // subtrees and mounting them permanently would cost every reader a second
    // (and a third) copy of the modal.
    const showNeighbours = dragging || settling;

    return (
        <div
            ref={viewportRef}
            data-testid="swipe-viewport"
            className={`flex-1 flex flex-col min-h-0 relative overflow-hidden ${viewportClassName}`}
        >
            <div
                ref={trackRef}
                data-testid="swipe-track"
                className="flex-1 flex flex-col min-h-0 relative"
                style={{
                    transform: `translate3d(${offset}px, 0, 0)`,
                    transition: settling ? `transform ${SETTLE_MS}ms ${SETTLE_EASING}` : 'none',
                    touchAction: 'pan-y',
                    userSelect: dragging ? 'none' : undefined,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onTransitionEnd={handleTransitionEnd}
                onClick={handleContainerClick}
            >
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                        key={itemKey}
                        custom={direction}
                        variants={variants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 450, damping: 40 }}
                        className={panelClass}
                        style={panelStyle}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>

                {showNeighbours && (
                    <>
                        <div
                            aria-hidden="true"
                            data-testid="swipe-prev"
                            className={panelClass}
                            style={neighbourStyle('prev')}
                        >
                            {prevContent}
                        </div>
                        <div
                            aria-hidden="true"
                            data-testid="swipe-next"
                            className={panelClass}
                            style={neighbourStyle('next')}
                        >
                            {nextContent}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

SwipeableContainer.displayName = 'SwipeableContainer';
