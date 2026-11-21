/**
 * Returns true only when the user has a non-empty text selection whose
 * anchor or focus lies inside `container`.
 *
 * A global `window.getSelection()?.toString()` check also matches selections
 * made elsewhere on the page — which browsers do not clear when clicking a
 * `<button>` or `select-none` element — silently blocking card expand/collapse.
 */
export function hasSelectionInside(container: EventTarget | null): boolean {
    if (typeof window === 'undefined' || !(container instanceof Node)) return false;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
    if (!selection.toString().trim()) return false;

    const { anchorNode, focusNode } = selection;
    return (
        (anchorNode !== null && container.contains(anchorNode)) ||
        (focusNode !== null && container.contains(focusNode))
    );
}
