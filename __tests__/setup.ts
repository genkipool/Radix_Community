import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no canvas: getContext() returns null after printing a "Not implemented" notice.
// Return null directly so code that measures text (and falls back without a canvas) stays quiet.
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
}

// Automatic cleanup after each test
afterEach(() => {
    cleanup();
});
