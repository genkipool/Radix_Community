import { describe, it, expect, afterEach } from 'vitest';
import { hasSelectionInside } from '@/features/dashboard/explorador/utils/selectionUtils';

describe('hasSelectionInside', () => {
    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        document.body.innerHTML = '';
    });

    it('returns false when there is no selection', () => {
        const button = document.createElement('button');
        button.textContent = 'XRD';
        document.body.appendChild(button);

        expect(hasSelectionInside(button)).toBe(false);
    });

    it('returns false when text is selected outside the clicked card header', () => {
        const otherPanel = document.createElement('div');
        otherPanel.textContent = 'https://assets.radixdlt.com/icons/icon-xrd.png';
        const button = document.createElement('button');
        button.textContent = 'XRD';
        document.body.append(otherPanel, button);

        const range = document.createRange();
        range.selectNodeContents(otherPanel.firstChild!);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        expect(sel.toString()).toBe('https://assets.radixdlt.com/icons/icon-xrd.png');
        expect(hasSelectionInside(button)).toBe(false);
    });

    it('returns true when text is selected inside the clicked card header', () => {
        const header = document.createElement('div');
        header.textContent = 'Radix XRD';
        document.body.appendChild(header);

        const range = document.createRange();
        range.selectNodeContents(header.firstChild!);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        expect(hasSelectionInside(header)).toBe(true);
    });

    it('returns false for null or non-Node targets', () => {
        expect(hasSelectionInside(null)).toBe(false);
        expect(hasSelectionInside({} as EventTarget)).toBe(false);
    });
});
