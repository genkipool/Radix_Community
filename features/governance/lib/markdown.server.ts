import 'server-only';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Proposal texts are written by anyone who can submit one, so they are
 * rendered on the server and sanitised strictly: no raw HTML, no inline
 * styles, no scripts or embeds, and links only to http(s), opening in a new
 * tab without referrer.
 */
const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote',
        'ul', 'ol', 'li', 'strong', 'em', 'del', 'code', 'pre', 'a',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], th: ['align'], td: ['align'] },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
    },
};

const renderer = new marked.Renderer();
// Raw HTML inside the Markdown is shown as text, never interpreted.
renderer.html = ({ text }: { text: string }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderProposalMarkdown(markdown: string | null): string {
    if (!markdown?.trim()) return '';
    const html = marked.parse(markdown, { renderer, gfm: true, breaks: false, async: false }) as string;
    return sanitizeHtml(html, OPTIONS);
}
