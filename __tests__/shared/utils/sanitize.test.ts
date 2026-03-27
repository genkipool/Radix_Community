import { describe, it, expect } from 'vitest';
import { sanitizeText, isValidUrl, sanitizeIconUrl, buildFallbackAvatar, sanitizeUserHtml } from '@/utils/sanitize';

// ─── sanitizeText ────────────────────────────────────────────────────────────
describe('sanitizeText', () => {
    it('strips HTML tags completely including block content', () => {
        expect(sanitizeText('<b>Hello</b> <script>alert("xss")</script>World')).toBe('Hello World');
    });

    it('trims whitespace', () => {
        expect(sanitizeText('   hello   ')).toBe('hello');
    });

    it('returns empty string for null', () => {
        expect(sanitizeText(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(sanitizeText(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(sanitizeText('')).toBe('');
    });

    it('preserves normal text without tags', () => {
        expect(sanitizeText('Radix Validator Node')).toBe('Radix Validator Node');
    });
});

// ─── isValidUrl ──────────────────────────────────────────────────────────────
describe('isValidUrl', () => {
    it('accepts https URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('accepts http URLs', () => {
        expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('rejects javascript: protocol', () => {
        expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects data: protocol', () => {
        expect(isValidUrl('data:text/html,<h1>xss</h1>')).toBe(false);
    });

    it('rejects null', () => {
        expect(isValidUrl(null)).toBe(false);
    });

    it('rejects undefined', () => {
        expect(isValidUrl(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidUrl('')).toBe(false);
    });

    it('rejects malformed URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('rejects ftp: protocol', () => {
        expect(isValidUrl('ftp://files.example.com/file.txt')).toBe(false);
    });
});

// ─── sanitizeIconUrl ─────────────────────────────────────────────────────────
describe('sanitizeIconUrl', () => {
    it('passes through valid https URLs', () => {
        expect(sanitizeIconUrl('https://cdn.example.com/icon.png')).toBe('https://cdn.example.com/icon.png');
    });

    it('rejects javascript: URLs', () => {
        expect(sanitizeIconUrl('javascript:void(0)')).toBe('');
    });

    it('returns empty for null', () => {
        expect(sanitizeIconUrl(null)).toBe('');
    });

    it('returns empty for undefined', () => {
        expect(sanitizeIconUrl(undefined)).toBe('');
    });

    it('returns empty for non-string types', () => {
        // @ts-expect-error testing runtime safety
        expect(sanitizeIconUrl(12345)).toBe('');
    });
});

// ─── buildFallbackAvatar ─────────────────────────────────────────────────────
describe('buildFallbackAvatar', () => {
    it('builds a valid inline SVG data URI', () => {
        const url = buildFallbackAvatar('Radix Node');
        expect(url).toContain('data:image/svg+xml');
        expect(url).toContain('RN'); // Initials
    });

    it('uses "?" as fallback for empty name', () => {
        const url = buildFallbackAvatar('');
        expect(url).toContain('V'); // Name defaults to 'V' making initials 'V'
    });

    it('handles special characters by returning initials', () => {
        const url = buildFallbackAvatar('Ñoño & Friends');
        expect(url).toContain('data:image/svg+xml');
        expect(url).toContain('%C3%91%26'); // URL encoded Ñ&
    });

    it('strips HTML from name before generating', () => {
        const url = buildFallbackAvatar('<script>xss</script>Test Node');
        expect(url).not.toContain('xss');
        expect(url).toContain('TN'); // Tests Node
    });
});

// ─── sanitizeUserHtml ─────────────────────────────────────────────────────────
// sanitizeUserHtml uses DOMParser — available in jsdom (vitest environment).
describe('sanitizeUserHtml', () => {
    it('passes through safe HTML unchanged', () => {
        const safe = '<p>Hello <strong>world</strong></p>';
        const result = sanitizeUserHtml(safe);
        expect(result).toContain('Hello');
        expect(result).toContain('strong');
    });

    it('strips script tags entirely', () => {
        const xss = '<p>Hello</p><script>alert("xss")</script>';
        const result = sanitizeUserHtml(xss);
        expect(result).not.toContain('script');
        expect(result).not.toContain('alert');
        expect(result).toContain('Hello');
    });

    it('strips onclick and other event handlers', () => {
        const xss = '<p onclick="alert(1)">Click me</p>';
        const result = sanitizeUserHtml(xss);
        expect(result).not.toContain('onclick');
        expect(result).toContain('Click me');
    });

    it('strips iframe tags', () => {
        const xss = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
        const result = sanitizeUserHtml(xss);
        expect(result).not.toContain('iframe');
        expect(result).toContain('Safe');
    });

    it('strips javascript: href values', () => {
        const xss = '<a href="javascript:alert(1)">Click</a>';
        const result = sanitizeUserHtml(xss);
        expect(result).not.toContain('javascript:');
        expect(result).toContain('Click');
    });

    it('preserves safe href links', () => {
        const safe = '<a href="https://example.com" title="Test">Link</a>';
        const result = sanitizeUserHtml(safe);
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('noopener noreferrer');
    });

    it('strips data: URLs from img src', () => {
        const xss = '<img src="data:text/html,<script>alert(1)</script>">';
        const result = sanitizeUserHtml(xss);
        expect(result).not.toContain('data:text/html');
    });

    it('preserves allowed tags: h1-h6, ul, ol, li, blockquote, pre, code', () => {
        const content = '<h1>Title</h1><ul><li>Item</li></ul><blockquote>Quote</blockquote>';
        const result = sanitizeUserHtml(content);
        expect(result).toContain('<h1>');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
        expect(result).toContain('<blockquote>');
    });

    it('strips style attribute from non-span elements', () => {
        const html = '<p style="color:red;position:fixed">Text</p>';
        const result = sanitizeUserHtml(html);
        expect(result).not.toContain('style=');
        expect(result).toContain('Text');
    });

    it('handles empty string', () => {
        expect(sanitizeUserHtml('')).toBe('');
    });
});
