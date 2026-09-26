'use client';

import React, { useState } from 'react';
import Link from 'next/link';

/**
 * A Link that fetches the whole destination page, data included, once the
 * pointer rests on it (or it gets focus or a touch). Clicking it then shows
 * the page straight away instead of its loading skeleton, without paying for
 * a full prefetch of every link that merely scrolls into view.
 */
export function HoverPrefetchLink({ onMouseEnter, onFocus, onTouchStart, ...props }: React.ComponentProps<typeof Link>) {
    const [intent, setIntent] = useState(false);
    return (
        <Link
            {...props}
            prefetch={intent ? true : null}
            onMouseEnter={e => { setIntent(true); onMouseEnter?.(e); }}
            onFocus={e => { setIntent(true); onFocus?.(e); }}
            onTouchStart={e => { setIntent(true); onTouchStart?.(e); }}
        />
    );
}
