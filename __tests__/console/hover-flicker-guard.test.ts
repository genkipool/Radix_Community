// @vitest-environment node
/**
 * Guard against UI hover flicker and dropdown layout-shift regressions in Console components:
 * 1. Never combine `transition-colors` / `transition-all` with `hover:bg-[var(--...)]/<opacity>`
 *    (Tailwind v4 compiles opacity modifiers on CSS variables to `color-mix(in oklab, ...)` which
 *    flickers during CSS background transitions on dense lists/dropdowns; use solid
 *    `hover:bg-[var(--color-surface-hover)]` without transition lag on list rows).
 * 2. Never render `<SafeImage>` inside a dropdown option `<button>` without `zoomable={false}`
 *    (default `zoomable=true` adds a competing `hover:opacity-90 transition-opacity` and intercepts
 *    clicks with a lightbox modal).
 * 3. Never place a conditional `{open && <div className="absolute ...">` directly inside a
 *    `space-y-*` container (Tailwind v4 compiles `space-y-*` with `:not(:last-child)`, causing an
 *    8px layout jump every time the dropdown opens/closes).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONSOLE_COMPONENTS_DIR = join(process.cwd(), 'features', 'console', 'components');

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTsx(full));
    } else if (full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('console hover-flicker & dropdown layout-shift guard', () => {
  const files = walkTsx(CONSOLE_COMPONENTS_DIR);

  it('forbids Tailwind v4 color-mix opacity hover transitions (`transition-*` + `hover:bg-[var(...) ]/opacity`)', () => {
    const violations: string[] = [];
    const badClassRe =
      /(?:transition-colors|transition-all)[^"'`]*hover:bg-\[var\(--[^)]+\)\]\/|hover:bg-\[var\(--[^)]+\)\]\/[^"'`]*(?:transition-colors|transition-all)/g;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (badClassRe.test(line)) {
          violations.push(`${relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`);
        }
        badClassRe.lastIndex = 0;
      });
    }

    expect(violations).toEqual([]);
  });

  it('requires zoomable={false} on SafeImage inside dropdown option lists in CryptoCompareTool and LsuInfoTool', () => {
    const targets = [
      join(CONSOLE_COMPONENTS_DIR, 'tools', 'CryptoCompareTool.tsx'),
      join(CONSOLE_COMPONENTS_DIR, 'tools', 'LsuInfoTool.tsx'),
    ];
    const violations: string[] = [];
    const safeImageRe = /<SafeImage\b[^>]*>/g;

    for (const file of targets) {
      const content = readFileSync(file, 'utf8');
      for (const m of content.matchAll(safeImageRe)) {
        if (!m[0].includes('zoomable={false}')) {
          violations.push(`${relative(process.cwd(), file)}: ${m[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids `relative space-y-*` wrapper around dropdowns in CryptoCompareTool', () => {
    const file = join(CONSOLE_COMPONENTS_DIR, 'tools', 'CryptoCompareTool.tsx');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/ref=\{containerRef\}\s+className="relative\s+space-y-/);
  });
});
