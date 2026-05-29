/**
 * Security utilities for sanitizing API data before rendering.
 * Prevents XSS, broken layouts, and malicious URL injection.
 */

const SCRIPT_STYLE_RE = /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const _IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|avif|ico)(\?|#|$)/i;

/** Strip HTML tags and excessive whitespace from API strings */
export function sanitizeText(text: string | undefined | null): string {
    if (!text) return '';
    return String(text)
        .replace(SCRIPT_STYLE_RE, '')
        .replace(HTML_TAG_RE, '')
        .trim();
}

/** Validate a URL uses http/https protocol (blocks javascript:, data:, etc.) */
export function isValidUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return ALLOWED_PROTOCOLS.includes(parsed.protocol);
    } catch {
        return false;
    }
}

/** Validate and return an image URL, or empty string if invalid */
export function sanitizeIconUrl(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return '';
    if (!isValidUrl(url)) return '';
    // Basic image URL check — allow any valid http(s) URL since many APIs serve images without extensions
    return url;
}

/** Color palette for generated avatars (deterministic per name) */
const AVATAR_PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
    '#f97316', '#a855f7',
] as const;

/**
 * Build a fallback avatar as an inline SVG data URI.
 * Generates a colored tile with the first two initials — no external requests.
 */
export function buildFallbackAvatar(name: string): string {
    const sanitized = sanitizeText(name) || 'V';

    const initials = sanitized
        .split(/\s+/)
        .slice(0, 2)
        .map(w => [...w][0]?.toUpperCase() ?? '')
        .join('') || '?';

    let hash = 0;
    for (let i = 0; i < sanitized.length; i++) {
        hash = (hash * 31 + sanitized.charCodeAt(i)) | 0;
    }
    const bg = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];

    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
        `<rect width="256" height="256" rx="48" fill="${bg}"/>`,
        `<text x="128" y="176" font-family="system-ui,-apple-system,sans-serif"`,
        ` font-size="108" font-weight="700" fill="white"`,
        ` text-anchor="middle" dominant-baseline="auto">${initials}</text>`,
        '</svg>',
    ].join('');

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ─── HTML sanitization for user-generated content ────────────────────────────

/**
 * Allowed HTML tags for user-generated document content.
 * Script, iframe, object, embed and similar exec-capable tags are excluded.
 */
const _REMOVED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript']);
const ALLOWED_TAGS = new Set([
    'p','br','b','i','u','s','strong','em','mark','small','del','ins','sup','sub',
    'h1','h2','h3','h4','h5','h6',
    'ul','ol','li','blockquote','pre','code','hr',
    'a','img',
    'table','thead','tbody','tr','th','td',
    'div','span',
]);

/** Allowed attributes per tag (others are stripped). */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a:     new Set(['href', 'title', 'target', 'rel']),
    img:   new Set(['src', 'alt', 'title', 'width', 'height']),
    td:    new Set(['colspan', 'rowspan']),
    th:    new Set(['colspan', 'rowspan', 'scope']),
    code:  new Set(['class']),
    pre:   new Set(['class']),
    span:  new Set(['class', 'style']),
    div:   new Set(['class']),
};

/** Protocols that are safe as href/src values. */
const SAFE_PROTOCOLS = /^(https?:|mailto:|#)/i;

/**
 * Sanitizes user-generated HTML to prevent XSS.
 * Uses the browser's own DOMParser so it runs only client-side.
 * Returns the input string unchanged when called server-side (SSR).
 *
 * This is intentionally conservative — it strips unknown tags rather than
 * blocking on them, so the worst case is lost formatting, not code execution.
 */
export function sanitizeUserHtml(html: string): string {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;

    const doc = new DOMParser().parseFromString(html, 'text/html');

    const walk = (node: Element) => {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child as Element;
                const tag = el.tagName.toLowerCase();

                if (_REMOVED_TAGS.has(tag)) {
                    el.remove();
                    continue;
                }

                if (!ALLOWED_TAGS.has(tag)) {
                    // Replace disallowed tag with its text content
                    const frag = document.createDocumentFragment();
                    Array.from(el.childNodes).forEach(c => frag.appendChild(c.cloneNode(true)));
                    node.replaceChild(frag, el);
                    continue;
                }

                // Strip disallowed attributes
                const allowedForTag = ALLOWED_ATTRS[tag] ?? new Set<string>();
                Array.from(el.attributes).forEach(attr => {
                    if (!allowedForTag.has(attr.name)) {
                        el.removeAttribute(attr.name);
                    } else if ((attr.name === 'href' || attr.name === 'src') &&
                               !SAFE_PROTOCOLS.test(attr.value.trim())) {
                        el.removeAttribute(attr.name);
                    }
                });

                // Force external links to open safely
                if (tag === 'a') {
                    el.setAttribute('rel', 'noopener noreferrer');
                    if (el.getAttribute('target') === '_blank') {
                        el.setAttribute('rel', 'noopener noreferrer');
                    }
                }

                walk(el);
            }
        }
    };

    walk(doc.body);
    return doc.body.innerHTML;
}
