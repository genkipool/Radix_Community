/**
 * Wiring guard for the progressive swipe.
 *
 * `SwipeableContainer` can only slide the real previous/next item into view if
 * the modal hands it those neighbours. Drop the `prevContent`/`nextContent`
 * props and every test in SwipeableContainer.test.tsx still passes while the
 * reader gets a blank panel behind their finger — which is exactly the failure
 * these assertions exist to catch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

/** Every reading-mode modal that navigates between items by swiping. */
const READING_MODALS = [
    ['blog', 'features/blog/components/BlogOverlay.tsx'],
    ['forum', 'features/forum/components/ForumReadingMode.tsx'],
    ['staking validator', 'features/dashboard/staking/components/ValidatorDetailView.tsx'],
    ['explorer transaction', 'features/dashboard/explorador/components/TransactionDetailModal.tsx'],
] as const;

describe('progressive swipe wiring', () => {
    it.each(READING_MODALS)('the %s modal feeds the deck both neighbours', (_name, path) => {
        const source = read(path);

        expect(source).toContain('<SwipeableContainer');
        expect(source).toMatch(/prevContent=\{/);
        expect(source).toMatch(/nextContent=\{/);
    });

    it.each(READING_MODALS)('the %s modal renders its body from a shared function', (_name, path) => {
        const source = read(path);

        // The same body has to serve the current item and both previews, or the
        // neighbours would drift out of sync with what the reader sees.
        expect(source).toMatch(/renderPost|renderValidator|TransactionDetailBody/);
    });

    it.each(READING_MODALS)('the %s modal draws neighbours exactly like the current item', (_name, path) => {
        const source = read(path);

        // A neighbour that hides its close button, or fades in when the real one
        // does not, makes the content shift the instant the swipe lands on it.
        // Any `preview` branch inside the body is that bug waiting to happen.
        expect(source).not.toMatch(/preview\s*&&/);
        expect(source).not.toMatch(/!preview/);
    });

    it('the dashboard passes the neighbouring validator and transaction down', () => {
        const source = read('features/dashboard/components/DashboardModals.tsx');

        expect(source).toMatch(/prevValidator=\{/);
        expect(source).toMatch(/nextValidator=\{/);
        expect(source).toMatch(/prevTx=\{/);
        expect(source).toMatch(/nextTx=\{/);
    });

    it('the deck keeps the gesture live instead of acting on release only', () => {
        const source = read('components/ui/SwipeableContainer.tsx');

        // Tracking the finger requires pointermove; an onPointerUp-only version
        // is the shape this feature replaced.
        expect(source).toContain('onPointerMove');
        expect(source).toContain('onPointerCancel');
    });
});
