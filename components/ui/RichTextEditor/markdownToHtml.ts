/**
 * markdownToHtml.ts
 * Lightweight, dependency-free Markdown → HTML converter for the RichTextEditor.
 */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function processInline(text: string): string {
    // Images
    text = text.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" class="editor-img" style="max-width:100%;border-radius:8px;margin:0.5rem 0;display:block;" />',
    );
    // Links
    text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    // Bold + italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');
    // Inline code
    text = text.replace(/`([^`\n]+?)`/g, '<code>$1</code>');
    return text;
}

export function markdownToHtml(md: string): string {
    if (!md.trim()) return '<p><br></p>';

    const codeBlocks: string[] = [];
    const src = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(escapeHtml(code.trimEnd()));
        return `%%CODE_BLOCK_${idx}%%`;
    });

    const lines = src.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    let inTable = false;

    const closeList = () => {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (inTable) { out.push('</tbody></table></div>'); inTable = false; }
    };

    for (const line of lines) {
        const codeMatch = line.match(/^%%CODE_BLOCK_(\d+)%%$/);
        if (codeMatch) {
            closeList();
            const idx = parseInt(codeMatch[1]);
            out.push(`<pre><code>${codeBlocks[idx]}</code></pre>`);
            continue;
        }

        const h3 = line.match(/^### (.+)/);
        if (h3) { closeList(); out.push(`<h3>${processInline(h3[1])}</h3>`); continue; }
        const h2 = line.match(/^## (.+)/);
        if (h2) { closeList(); out.push(`<h2>${processInline(h2[1])}</h2>`); continue; }
        const h1 = line.match(/^# (.+)/);
        if (h1) { closeList(); out.push(`<h1>${processInline(h1[1])}</h1>`); continue; }

        if (/^[-*_]{3,}\s*$/.test(line)) {
            closeList();
            out.push('<hr />');
            continue;
        }

        const bq = line.match(/^> (.+)/);
        if (bq) {
            closeList();
            out.push(`<blockquote>${processInline(bq[1])}</blockquote>`);
            continue;
        }

        const ul = line.match(/^[-*+] (.+)/);
        if (ul) {
            if (inOl) { out.push('</ol>'); inOl = false; }
            if (!inUl) { out.push('<ul>'); inUl = true; }
            out.push(`<li>${processInline(ul[1])}</li>`);
            continue;
        }

        const ol = line.match(/^\d+\. (.+)/);
        if (ol) {
            if (inUl) { out.push('</ul>'); inUl = false; }
            if (inTable) { out.push('</tbody></table></div>'); inTable = false; }
            if (!inOl) { out.push('<ol>'); inOl = true; }
            out.push(`<li>${processInline(ol[1])}</li>`);
            continue;
        }

        const tableRow = line.match(/^\|(.+)\|$/);
        if (tableRow) {
            if (inUl) { out.push('</ul>'); inUl = false; }
            if (inOl) { out.push('</ol>'); inOl = false; }
            if (!inTable) {
                out.push('<div class="table-responsive" style="overflow-x:auto; margin:1.5rem 0;"><table class="editor-table" style="width:100%; border-collapse:collapse; text-align:left;"><tbody>');
                inTable = true;
            }
            const cells = tableRow[1].split('|').map(c => c.trim());
            if (cells.every(c => /^:?-+:?$/.test(c))) continue;
            out.push('<tr>');
            for (const cell of cells) {
                out.push(`<td style="border:1px solid var(--color-card-border); padding:0.75rem;">${processInline(cell)}</td>`);
            }
            out.push('</tr>');
            continue;
        }

        if (!line.trim()) {
            closeList();
            out.push('<p><br></p>');
            continue;
        }

        closeList();
        out.push(`<p>${processInline(line)}</p>`);
    }

    closeList();
    return out.join('\n') || '<p><br></p>';
}
