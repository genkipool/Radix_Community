import { describe, it, expect } from 'vitest';
import { markdownToHtml, htmlToMarkdown, applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';

// ─── markdownToHtml ──────────────────────────────────────────────────────────
describe('markdownToHtml', () => {
    it('converts headings correctly (h1–h3)', () => {
        expect(markdownToHtml('# Title')).toContain('<h1');
        expect(markdownToHtml('## Subtitle')).toContain('<h2');
        expect(markdownToHtml('### Section')).toContain('<h3');
    });

    it('converts bold and italic', () => {
        const result = markdownToHtml('**bold** and *italic*');
        expect(result).toContain('<strong>bold</strong>');
        expect(result).toContain('<em>italic</em>');
    });

    it('converts inline code', () => {
        expect(markdownToHtml('Use `npm install`')).toContain('<code>npm install</code>');
    });

    it('converts fenced code blocks', () => {
        const md = '```js\nconsole.log("hello");\n```';
        const result = markdownToHtml(md);
        expect(result).toContain('<pre>');
        expect(result).toContain('<code');
    });

    it('converts blockquotes', () => {
        expect(markdownToHtml('> This is a quote')).toContain('<blockquote');
    });

    it('converts unordered lists', () => {
        const md = '- Item 1\n- Item 2\n- Item 3';
        const result = markdownToHtml(md);
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
    });

    it('converts ordered lists', () => {
        const md = '1. First\n2. Second\n3. Third';
        const result = markdownToHtml(md);
        expect(result).toContain('<ol>');
        expect(result).toContain('<li>');
    });

    it('converts links', () => {
        const result = markdownToHtml('[Radix](https://radix.com)');
        expect(result).toContain('<a href="https://radix.com"');
        expect(result).toContain('Radix');
    });

    it('converts horizontal rules', () => {
        expect(markdownToHtml('---')).toContain('<hr');
    });

    it('converts GFM tables', () => {
        const md = '| Header1 | Header2 |\n| --- | --- |\n| Cell1 | Cell2 |';
        const result = markdownToHtml(md);
        expect(result).toContain('<table>');
        expect(result).toContain('<th>');
        expect(result).toContain('<td>');
        expect(result).toContain('Header1');
        expect(result).toContain('Cell1');
    });

    it('converts strikethrough text', () => {
        expect(markdownToHtml('~~deleted~~')).toContain('<del>deleted</del>');
    });

    it('returns empty paragraph for empty input', () => {
        expect(markdownToHtml('')).toBe('<p><br></p>');
        expect(markdownToHtml('   ')).toBe('<p><br></p>');
    });

    it('handles combined markdown syntax', () => {
        const md = '## Title\n\nSome **bold** text with `code` and a [link](https://example.com).\n\n> A blockquote\n\n- List item';
        const result = markdownToHtml(md);
        expect(result).toContain('<h2');
        expect(result).toContain('<strong>bold</strong>');
        expect(result).toContain('<code>code</code>');
        expect(result).toContain('<a href=');
        expect(result).toContain('<blockquote');
        expect(result).toContain('<li>');
    });
});

// ─── htmlToMarkdown ──────────────────────────────────────────────────────────
describe('htmlToMarkdown', () => {
    it('converts HTML headings to ATX-style markdown', () => {
        expect(htmlToMarkdown('<h1>Title</h1>')).toContain('# Title');
        expect(htmlToMarkdown('<h2>Subtitle</h2>')).toContain('## Subtitle');
    });

    it('converts bold/italic tags to asterisk syntax', () => {
        const result = htmlToMarkdown('<strong>bold</strong> and <em>italic</em>');
        expect(result).toContain('**bold**');
        expect(result).toContain('*italic*');
    });

    it('converts code blocks to fenced syntax', () => {
        const result = htmlToMarkdown('<pre><code>const x = 1;</code></pre>');
        expect(result).toContain('```');
        expect(result).toContain('const x = 1;');
    });

    it('converts blockquotes', () => {
        expect(htmlToMarkdown('<blockquote>Quote text</blockquote>')).toContain('> Quote text');
    });

    it('converts HTML tables to pipe syntax', () => {
        const html = '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>';
        const result = htmlToMarkdown(html);
        expect(result).toContain('|');
        expect(result).toContain('Name');
        expect(result).toContain('Value');
    });

    it('returns empty string for empty input', () => {
        expect(htmlToMarkdown('')).toBe('');
        expect(htmlToMarkdown('   ')).toBe('');
    });

    it('preserves raw markdown characters without escaping', () => {
        // This tests our custom escape override
        const result = htmlToMarkdown('<p>## My heading</p>');
        expect(result).toContain('## My heading');
        expect(result).not.toContain('\\#');
    });
});

// ─── applyMarkdownToHtml (Super Parser Pipeline) ────────────────────────────
describe('applyMarkdownToHtml', () => {
    it('converts raw markdown typed in editor to semantic HTML', () => {
        // Simulates editor HTML where user typed "## Hello" as plain text inside a <p>
        const editorHtml = '<p>## Hello World</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<h2');
        expect(result).toContain('Hello World');
    });

    it('converts bold markdown syntax from editor to HTML', () => {
        const editorHtml = '<p>This is **bold** text</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<strong>bold</strong>');
    });

    it('converts HTML table from toolbar or paste to rendered table', () => {
        // When a user pastes or creates a table via toolbar, it arrives as an HTML table
        const editorHtml = '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<table>');
        expect(result).toContain('Alice');
    });

    it('converts pipe-table rows typed in contentEditable (separate <p> tags)', () => {
        // Each row typed by the user gets its own <p> tag in contentEditable
        const editorHtml = '<p>| Encabezado 1 | Encabezado 2 |</p><p>| :--- | :--- |</p><p>| Celda 1A | Celda 1B |</p><p>| Celda 2A | Celda 2B |</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<table>');
        expect(result).toContain('Encabezado 1');
        expect(result).toContain('Encabezado 2');
        expect(result).toContain('Celda 1A');
        expect(result).toContain('Celda 2B');
    });

    it('preserves existing rich formatting from toolbar (bold, italic)', () => {
        const editorHtml = '<p>Normal text <strong>toolbar bold</strong> more text</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('toolbar bold');
        // The bold should be preserved through the pipeline
        expect(result).toContain('<strong>');
    });

    it('converts code blocks typed as fenced markdown', () => {
        const editorHtml = '<p>```javascript</p><p>const x = 42;</p><p>```</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<pre>');
        expect(result).toContain('<code');
    });

    it('converts blockquote syntax', () => {
        const editorHtml = '<p>&gt; This is a quote</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<blockquote');
    });

    it('returns empty paragraph for empty or whitespace input', () => {
        expect(applyMarkdownToHtml('')).toBe('<p><br></p>');
        expect(applyMarkdownToHtml('   ')).toBe('<p><br></p>');
    });

    it('handles mixed toolbar-formatted and raw-markdown content', () => {
        // User typed "## Title" and also used toolbar for bold
        const editorHtml = '<p>## My Document</p><p><strong>Important</strong> information here</p><p>- Item one</p><p>- Item two</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<h2');
        expect(result).toContain('My Document');
        expect(result).toContain('<strong>');
        expect(result).toContain('<li>');
    });

    it('does not produce literal \\n in the output', () => {
        const editorHtml = '<p>Line one</p><p>Line two</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).not.toContain('\\n');
    });

    it('handles horizontal rules', () => {
        const editorHtml = '<p>---</p>';
        const result = applyMarkdownToHtml(editorHtml);
        expect(result).toContain('<hr');
    });
});

// ─── Edge Cases & Security ──────────────────────────────────────────────────
describe('Edge cases and security', () => {
    it('handles deeply nested markdown', () => {
        const md = '> **bold inside blockquote** with `code`';
        const result = markdownToHtml(md);
        expect(result).toContain('<blockquote');
        expect(result).toContain('<strong>');
        expect(result).toContain('<code>');
    });

    it('handles very long content without breaking', () => {
        const longMd = '## Title\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(500);
        const result = markdownToHtml(longMd);
        expect(result).toContain('<h2');
        expect(result.length).toBeGreaterThan(1000);
    });

    it('round-trips HTML through htmlToMarkdown then markdownToHtml', () => {
        const original = '<h2>Title</h2><p>Some <strong>bold</strong> text</p>';
        const md = htmlToMarkdown(original);
        const backToHtml = markdownToHtml(md);
        expect(backToHtml).toContain('<h2');
        expect(backToHtml).toContain('<strong>');
        expect(backToHtml).toContain('bold');
    });

    it('handles multiple headings without corruption', () => {
        const editorHtml = '<p>## First</p><p>Some text</p><p>## Second</p><p>More text</p>';
        const result = applyMarkdownToHtml(editorHtml);
        const h2Count = (result.match(/<h2/g) || []).length;
        expect(h2Count).toBe(2);
    });
});
