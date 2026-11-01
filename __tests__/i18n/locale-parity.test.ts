// @vitest-environment node
/**
 * Every dictionary says the same things in every language: the same keys, no
 * text missing in one language that the other has, and the same {placeholders}.
 * A key missing in English shows the Spanish text (or nothing) to English
 * readers; a placeholder missing in one language leaves "{count}" on screen.
 *
 * Dictionaries come in sets: `es.json` + `en.json` in a locales folder, or
 * `name.es.json` + `name.en.json`. A new language is one more file per set.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const LANGUAGES = ['es', 'en'];

/** Every locales folder: features/<name>/locales and i18n/locales/<name>. */
function localeFolders(): string[] {
  const features = readdirSync(join(ROOT, 'features'))
    .map((name) => join(ROOT, 'features', name, 'locales'))
    .filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());
  const shared = readdirSync(join(ROOT, 'i18n', 'locales')).map((name) => join(ROOT, 'i18n', 'locales', name));
  return [...features, ...shared];
}

/** Each set of the same dictionary in every language, keyed by its name without the language. */
function dictionarySets(): Array<{ name: string; files: Record<string, string> }> {
  const sets = new Map<string, Record<string, string>>();
  for (const dir of localeFolders()) {
    for (const file of readdirSync(dir)) {
      const match = file.match(/^(?:(.+)\.)?([a-z]{2})\.json$/);
      if (!match || !LANGUAGES.includes(match[2])) continue;
      const name = relative(ROOT, join(dir, match[1] ?? '*'));
      sets.set(name, { ...sets.get(name), [match[2]]: join(dir, file) });
    }
  }
  return [...sets].map(([name, files]) => ({ name, files }));
}

type Leaves = Map<string, unknown>;

/** Path → value. A list of plain strings (keywords, steps) is one value: lengths may differ. */
function leaves(value: unknown, path = '', out: Leaves = new Map()): Leaves {
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) leaves(v, path ? `${path}.${key}` : key, out);
  } else out.set(path, value);
  return out;
}

const isEmpty = (v: unknown) => (typeof v === 'string' ? !v.trim() : Array.isArray(v) ? v.length === 0 : false);
const placeholders = (v: unknown) =>
  typeof v === 'string' ? [...new Set([...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort() : [];

const sets = dictionarySets();

describe('locale parity', () => {
  it('finds the dictionaries', () => {
    expect(sets.length).toBeGreaterThan(10);
  });

  for (const { name, files } of sets) {
    describe(name, () => {
      it('exists in every language', () => {
        expect(Object.keys(files).sort()).toEqual([...LANGUAGES].sort());
      });

      const parsed = Object.fromEntries(
        Object.entries(files).map(([lang, file]) => [lang, leaves(JSON.parse(readFileSync(file, 'utf8')))]),
      ) as Record<string, Leaves>;
      const [reference, ...others] = LANGUAGES;

      for (const lang of others) {
        it(`has the same keys in ${reference} and ${lang}`, () => {
          const a = parsed[reference];
          const b = parsed[lang];
          if (!a || !b) return;
          expect({ [`only in ${reference}`]: [...a.keys()].filter((k) => !b.has(k)), [`only in ${lang}`]: [...b.keys()].filter((k) => !a.has(k)) }).toEqual({
            [`only in ${reference}`]: [],
            [`only in ${lang}`]: [],
          });
        });

        it(`leaves no text blank in only one of ${reference} and ${lang}`, () => {
          const a = parsed[reference];
          const b = parsed[lang];
          if (!a || !b) return;
          const blankInOne = [...a.keys()].filter((k) => b.has(k) && isEmpty(a.get(k)) !== isEmpty(b.get(k)));
          expect(blankInOne).toEqual([]);
        });

        it(`uses the same {placeholders} in ${reference} and ${lang}`, () => {
          const a = parsed[reference];
          const b = parsed[lang];
          if (!a || !b) return;
          const differ = [...a.keys()]
            .filter((k) => b.has(k) && placeholders(a.get(k)).join() !== placeholders(b.get(k)).join())
            .map((k) => `${k}: ${placeholders(a.get(k))} vs ${placeholders(b.get(k))}`);
          expect(differ).toEqual([]);
        });
      }
    });
  }
});
