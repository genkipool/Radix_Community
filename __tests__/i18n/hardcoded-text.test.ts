// @vitest-environment node
/**
 * Text a person reads belongs in the locale files, so a new language is one
 * more file per dictionary. This scans the components for text written in the
 * code instead, and holds the count of each file to a baseline:
 *
 * - a file with more than its baseline (or a new file with any) fails, and
 *   the message lists what was found so it can move to the locale files;
 * - a file with fewer fails too, asking for the baseline to be lowered, so
 *   the debt can only shrink.
 *
 * After moving texts out, refresh the baseline with
 *   UPDATE_I18N_BASELINE=1 npx vitest run __tests__/i18n/hardcoded-text.test.ts
 *
 * What counts as text written in the code:
 * - `language === 'es' ? 'texto' : 'text'` choosing between sentences;
 * - an inline dictionary (`es: { … }`) in a component;
 * - JSX text, and title / placeholder / aria-label / alt / label attributes;
 * - a sentence used as fallback for a dictionary entry (`t.x || 'Some text'`).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const BASELINE_FILE = join(__dirname, 'hardcoded-text.baseline.json');
const SCANNED = ['app', 'components', 'features'];
const SKIPPED = /(^|\/)(node_modules|locales|__tests__)(\/|$)/;

const LETTERS = '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]';

interface Finding {
  rule: string;
  line: number;
  text: string;
}

const RULES: Array<{ rule: string; re: RegExp; keep?: (text: string) => boolean }> = [
  {
    rule: 'language ternary',
    re: /(?:language|locale|lang)\s*===\s*'[a-z]{2}'\s*\?\s*(['"`])([^'"`]*)\1/g,
    // 'es-ES', 'EUR': a format or code, not a sentence.
    keep: (text) => /\s|[áéíóúñ]/.test(text),
  },
  { rule: 'inline dictionary', re: /^\s+(es|en): \{$/gm },
  {
    rule: 'JSX text',
    re: new RegExp(`>\\s*([^<>{}\\n]*${LETTERS}{3,}[^<>{}\\n]*?)\\s*<`, 'g'),
    // A bare identifier is code shown as code; an operator or a `) : cond ? (` between two elements is code too.
    keep: (text) =>
      !(/^[\w.-]+$/.test(text) && !/^[A-ZÁÉÍÓÚÑ]/.test(text)) &&
      !/=>|&&|\|\||;|\(\)/.test(text) &&
      !(/[()]/.test(text) && /[?:]/.test(text)),
  },
  {
    rule: 'text attribute',
    re: new RegExp(`\\b(?:title|placeholder|aria-label|alt|label|closeLabel|headerTitle)=(["'])([^"']*${LETTERS}{3,}[^"']*)\\1`, 'g'),
  },
  {
    rule: 'fallback sentence',
    re: new RegExp(`(?:\\|\\||\\?\\?)\\s*(['"])([^'"]*\\s[^'"]*${LETTERS}{3,}[^'"]*)\\1`, 'g'),
  },
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(ROOT, path);
    if (SKIPPED.test(rel)) continue;
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

function scan(source: string): Finding[] {
  const findings: Finding[] = [];
  for (const { rule, re, keep } of RULES) {
    for (const match of source.matchAll(re)) {
      const text = (match[2] ?? match[1] ?? '').trim();
      if (keep && !keep(text)) continue;
      findings.push({ rule, line: source.slice(0, match.index).split('\n').length, text });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

const files = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir)));
const found = new Map(files.map((file) => [relative(ROOT, file), scan(readFileSync(file, 'utf8'))] as const));
const counts = Object.fromEntries(
  [...found].filter(([, list]) => list.length > 0).sort(([a], [b]) => a.localeCompare(b)).map(([file, list]) => [file, list.length]),
);

if (process.env.UPDATE_I18N_BASELINE) writeFileSync(BASELINE_FILE, `${JSON.stringify(counts, null, 2)}\n`);
const baseline: Record<string, number> = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

const describeFindings = (file: string) =>
  (found.get(file) ?? []).map((f) => `  ${file}:${f.line} [${f.rule}] ${JSON.stringify(f.text).slice(0, 100)}`).join('\n');

describe('text written in the code instead of the locale files', () => {
  it('scans the components', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('flags the patterns it looks for', () => {
    const sample = [
      `const L = language === 'es' ? 'Hola mundo' : 'Hello world';`,
      `const TEXT = {`,
      `  es: {`,
      `<span>Cargando datos</span>`,
      `<button title="Cerrar popup" />`,
      `{t.close || 'Close the popup'}`,
      `const fmt = language === 'es' ? 'es-ES' : 'en-US';`,
      `<code>owner</code>`,
      `</div>) : items.length === 0 ? (<p>`,
      `<span>{t.close}</span>`,
    ].join('\n');
    expect(scan(sample).map((f) => f.rule)).toEqual([
      'language ternary',
      'inline dictionary',
      'JSX text',
      'text attribute',
      'fallback sentence',
    ]);
  });

  it('adds no new text to any file', () => {
    const grown = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
    const message = grown
      .map(([file, n]) => `${file}: ${n} (baseline ${baseline[file] ?? 0})\n${describeFindings(file)}`)
      .join('\n\n');
    expect(grown.map(([file]) => file), `Move these texts to the locale files:\n\n${message}\n`).toEqual([]);
  });

  it('keeps the baseline as low as the code is', () => {
    const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n);
    expect(
      shrunk.map(([file]) => file),
      `Fewer texts in the code than the baseline says: lower it with\n  UPDATE_I18N_BASELINE=1 npx vitest run __tests__/i18n/hardcoded-text.test.ts\n`,
    ).toEqual([]);
  });
});
