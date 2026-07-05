/**
 * services/mcp/cli.ts
 *
 * Plain-text "CLI" renderer for MCP tool output. AI clients consume tool
 * results as text, so every tool renders through these helpers to produce a
 * consistent, highly legible terminal-style layout:
 *
 *   ┌──────────────────────────────┐
 *   │ RADIX CONSOLE · TOOL TITLE   │
 *   └──────────────────────────────┘
 *   Key            Value
 *   ── Section ─────────────────────
 *   • item
 */

const LINE_WIDTH = 72;

/** Top banner identifying the tool that produced the output. */
export function cliBanner(title: string): string {
  const label = ` ${title.toUpperCase()} `;
  const inner = label.length > LINE_WIDTH - 2 ? label : label.padEnd(LINE_WIDTH - 2, ' ');
  return [`┌${'─'.repeat(inner.length)}┐`, `│${inner}│`, `└${'─'.repeat(inner.length)}┘`].join('\n');
}

/** Section divider: `── Title ───────────` */
export function cliSection(title: string): string {
  const label = `── ${title} `;
  return `\n${label.padEnd(LINE_WIDTH, '─')}`;
}

/** Aligned key/value rows. Skips rows whose value is empty/undefined. */
export function cliKeyValues(rows: Array<[string, string | number | boolean | undefined | null]>): string {
  const kept = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (kept.length === 0) return '(none)';
  const keyWidth = Math.max(...kept.map(([key]) => key.length)) + 2;
  return kept.map(([key, value]) => `${key.padEnd(keyWidth)}${String(value)}`).join('\n');
}

/** Bullet list. */
export function cliList(items: string[]): string {
  return items.length === 0 ? '(none)' : items.map((item) => `• ${item}`).join('\n');
}

/** Monospace-aligned table with a header row and a rule under it. */
export function cliTable(headers: string[], rows: Array<Array<string | number>>): string {
  if (rows.length === 0) return '(no rows)';
  const cells = [headers, ...rows.map((row) => row.map(String))];
  const widths = headers.map((_, col) => Math.max(...cells.map((row) => (row[col] ?? '').length)));
  const renderRow = (row: string[]) =>
    row.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd();
  return [
    renderRow(headers),
    widths.map((width) => '─'.repeat(width)).join('──'),
    ...rows.map((row) => renderRow(row.map(String))),
  ].join('\n');
}

/** Fenced code block (manifests, JSON payloads, …). */
export function cliCode(code: string, lang = ''): string {
  return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
}

/** Final "what to do next" hint block. */
export function cliNext(hints: string[]): string {
  return `${cliSection('Next steps')}\n${hints.map((hint, i) => `${i + 1}. ${hint}`).join('\n')}`;
}

/** Assembles blocks into the final tool output, dropping empty ones. */
export function cliRender(...blocks: Array<string | false | undefined>): string {
  return blocks.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
