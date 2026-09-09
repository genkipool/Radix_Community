import { describe, it, expect } from 'vitest';

import enLocale from '@/features/console/locales/en.json';
import esLocale from '@/features/console/locales/es.json';

const SLUGS = [
  'validator-create',
  'validator-registration',
  'validator-profile',
  'validator-staking',
] as const;

const LOCALES = { en: enLocale, es: esLocale } as const;

type Guide = {
  guideTitle: string;
  guideDescription: string;
  guideSteps: string[];
  fields: Array<{ label: string; description: string; example?: string }>;
  example: Array<{ field?: string; type: string }>;
  glossary: Array<{ term: string; definition: string }>;
};

// Tools carry different guide shapes (some have no fields section at all), so
// the literal type of the JSON does not fit one record type.
const guideOf = (locale: typeof enLocale, slug: string) =>
  (locale.console.tools as unknown as Record<string, { guide?: Guide }>)[slug]?.guide;

describe('validator info-modal guides', () => {
  for (const [lang, locale] of Object.entries(LOCALES)) {
    describe(lang, () => {
      it('gives every validator tool a full guide', () => {
        for (const slug of SLUGS) {
          const guide = guideOf(locale, slug);
          expect(guide, slug).toBeDefined();
          expect(guide!.guideTitle, slug).toBeTruthy();
          expect(guide!.guideDescription.length, slug).toBeGreaterThan(80);
          expect(guide!.guideSteps.length, slug).toBeGreaterThanOrEqual(4);
          expect(guide!.glossary.length, slug).toBeGreaterThanOrEqual(3);
        }
      });

      it('explains what every field is for, with an example', () => {
        for (const slug of SLUGS) {
          const fields = guideOf(locale, slug)!.fields;
          expect(fields.length, slug).toBeGreaterThanOrEqual(4);
          for (const field of fields) {
            expect(field.label, `${slug}/${field.label}`).toBeTruthy();
            // A one-liner is a label, not an explanation.
            expect(field.description.length, `${slug}/${field.label}`).toBeGreaterThan(40);
            expect(field.example, `${slug}/${field.label}`).toBeTruthy();
          }
        }
      });

      it('renders a worked example the modal knows how to draw', () => {
        const drawable = ['button-group', 'dropdown', 'textarea', 'input'];
        for (const slug of SLUGS) {
          const example = guideOf(locale, slug)!.example;
          expect(example.length, slug).toBeGreaterThan(0);
          for (const item of example) {
            expect(drawable, `${slug}/${item.field}`).toContain(item.type);
          }
        }
      });

      it('localises the modal section headings instead of hardcoding Spanish', () => {
        const headings = (locale.console as unknown as { toolGuide: Record<string, string> })
          .toolGuide;
        for (const key of ['steps', 'fields', 'example', 'glossary', 'exampleTag']) {
          expect(headings[key], `${lang}/${key}`).toBeTruthy();
        }
      });
    });
  }

  it('keeps both languages structurally identical', () => {
    for (const slug of SLUGS) {
      const en = guideOf(enLocale, slug)!;
      const es = guideOf(esLocale, slug)!;
      expect(es.guideSteps.length, slug).toBe(en.guideSteps.length);
      expect(es.fields.map((f) => f.label).length, slug).toBe(en.fields.length);
      expect(es.glossary.length, slug).toBe(en.glossary.length);

      /*
       * Examples that are UI labels ("Registered → Unregister it") are meant to
       * be translated; the technical ones — addresses, keys, amounts — must be
       * byte-identical, because a translated address is a broken address.
       */
      const technical = (value?: string) =>
        !!value && /^(account_|validator_|resource_|0[23][0-9a-f]{64}|[\d.]+$)/.test(value);
      const enTechnical = en.fields.map((f) => f.example).filter(technical);
      const esTechnical = es.fields.map((f) => f.example).filter(technical);
      expect(esTechnical, slug).toEqual(enTechnical);
    }
  });

  it('calls the protocol vote field an identifier, not a name', () => {
    /*
     * It is an exact 32-character token announced network-wide, not a label an
     * operator writes, and the form seeds it from the configured signal — so
     * the wording has to say identifier or the field invites free text.
     */
    const labels = {
      en: (enLocale.console.validator.forms.registration.vote as { label: string }).label,
      es: (esLocale.console.validator.forms.registration.vote as { label: string }).label,
    };
    expect(labels.en.toLowerCase()).toContain('identifier');
    expect(labels.es.toLowerCase()).toContain('identificador');
    expect(labels.en.toLowerCase()).not.toContain('name');
    expect(labels.es.toLowerCase()).not.toContain('nombre');
  });

  it('has a hint for both states: an update announced and none', () => {
    for (const [lang, locale] of Object.entries(LOCALES)) {
      const vote = locale.console.validator.forms.registration.vote as {
        hintTarget: string;
        hintNone: string;
      };
      expect(vote.hintTarget, lang).toContain('{name}');
      expect(vote.hintNone, lang).toBeTruthy();
    }
  });

  it('does not leave the English guide written in Spanish', () => {
    const spanishTells = /\b(el |la |los |las |para |que |una |del )\b/i;
    for (const slug of SLUGS) {
      const guide = guideOf(enLocale, slug)!;
      expect(spanishTells.test(guide.guideDescription), slug).toBe(false);
      for (const field of guide.fields) {
        expect(spanishTells.test(field.description), `${slug}/${field.label}`).toBe(false);
      }
    }
  });
});
