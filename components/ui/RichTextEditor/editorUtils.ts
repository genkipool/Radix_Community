/**
 * editorUtils.ts
 * Shared utilities for the RichTextEditor.
 */

export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function buildResizableImageHtml(src: string, alt = '') {
    return `
    <div class="editor-img-wrap relative group inline-block max-w-full my-4" style="line-height: 0;">
      <img src="${src}" alt="${alt}" class="editor-img rounded-2xl shadow-lg border border-white/10 transition-all" style="max-width: 100%; height: auto;" />
      <div class="img-size-toolbar absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/20 shadow-2xl z-10 scale-90 group-hover:scale-100 pointer-events-auto">
        <button type="button" class="img-size-btn flex items-center justify-center size-8 rounded-lg text-[10px] font-black hover:bg-[var(--color-primary)] hover:text-white transition-all text-white/70" data-size="25">25%</button>
        <button type="button" class="img-size-btn flex items-center justify-center size-8 rounded-lg text-[10px] font-black hover:bg-[var(--color-primary)] hover:text-white transition-all text-white/70" data-size="50">50%</button>
        <button type="button" class="img-size-btn flex items-center justify-center size-8 rounded-lg text-[10px] font-black hover:bg-[var(--color-primary)] hover:text-white transition-all text-white/70" data-size="75">75%</button>
        <button type="button" class="img-size-btn flex items-center justify-center size-8 rounded-lg text-[10px] font-black hover:bg-[var(--color-primary)] hover:text-white transition-all text-white/70" data-size="100">100%</button>
      </div>
    </div>
  `.trim();
}

/** Check if selection is inside a <pre> or <code> block */
export function isInCodeBlock(sel: Selection | null, container: HTMLElement | null): HTMLElement | null {
    if (!sel || !container) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== container) {
        if (node.nodeName === 'PRE' || node.nodeName === 'CODE') {
            return node as HTMLElement;
        }
        node = node.parentNode;
    }
    return null;
}

/** Check if selection is inside a <blockquote> block */
export function isInBlockquote(sel: Selection | null, container: HTMLElement): HTMLElement | null {
    if (!sel?.rangeCount) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== container) {
        if (node.nodeName.toUpperCase() === 'BLOCKQUOTE') return node as HTMLElement;
        node = node.parentNode;
    }
    return null;
}

/**
 * sanitizePasteHtml: Cleans raw HTML from clipboard to keep only what's supported by our toolbar.
 * Now even more aggressive to strip browser-specific junk (Apple, MS Word, etc).
 */
export function sanitizePasteHtml(rawHtml: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Allowed tags list
    const ALLOWED_TAGS = ['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'PRE', 'CODE', 'BLOCKQUOTE', 'HR'];

    const cleanNodes = (parentElement: Element, isInsideBlockquote = false) => {
        const nodes = Array.from(parentElement.childNodes);

        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tagName = el.tagName.toUpperCase();

                if (ALLOWED_TAGS.includes(tagName)) {
                    // Prevent nested blockquotes by flattening internal ones
                    if (tagName === 'BLOCKQUOTE' && isInsideBlockquote) {
                        while (el.firstChild) {
                            parentElement.insertBefore(el.firstChild, el);
                        }
                        el.remove();
                        return;
                    }

                    // Filter attributes aggressively
                    const attrs = Array.from(el.attributes);
                    attrs.forEach(attr => {
                        // Keep ONLY href for 'a'
                        if (tagName === 'A' && attr.name === 'href') return;

                        // Keep ONLY color/bg-color for 'style'
                        if (attr.name === 'style') {
                            const styles = el.style;
                            const color = styles.color;
                            const bgColor = styles.backgroundColor;
                            el.removeAttribute('style');
                            if (color) el.style.color = color;
                            if (bgColor) el.style.backgroundColor = bgColor;
                            return;
                        }

                        // Strip EVERYTHING else (including classes, IDs, etc)
                        el.removeAttribute(attr.name);
                    });

                    // Recursive clean
                    cleanNodes(el, isInsideBlockquote || tagName === 'BLOCKQUOTE');
                } else {
                    // Not allowed tag: replace with its children (flatten)
                    const DISCARD_ENTIRELY = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK'];
                    if (DISCARD_ENTIRELY.includes(tagName)) {
                        el.remove();
                    } else {
                        while (el.firstChild) {
                            parentElement.insertBefore(el.firstChild, el);
                        }
                        el.remove();
                    }
                }
            }
        });
    };

    cleanNodes(doc.body);
    return doc.body.innerHTML;
}

const _BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'DIV']);

/** Find the closest block ancestor within the container */

function _getBlockAncestor(node: Node | null, container: HTMLElement): HTMLElement | null {
    let curr = node;
    while (curr && curr !== container) {
        if (curr instanceof HTMLElement && _BLOCK_TAGS.has(curr.tagName)) {
            return curr;
        }
        curr = curr.parentNode;
    }
    return null;
}
