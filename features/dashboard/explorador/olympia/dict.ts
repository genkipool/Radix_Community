/**
 * The Olympia strings (`dashboard.transactions.olympia` in the explorer
 * locales) and the small text helpers every Olympia component uses.
 */
import type { TranslationsT } from '@/features/dashboard/types';
import { OLYMPIA_END_ISO } from '@/features/dashboard/lib/olympia';

type TransactionsDict = TranslationsT['dashboard']['transactions'];
export type OlympiaDict = TransactionsDict['olympia'];

/** The Olympia strings out of the explorer's `tt` (dashboard.transactions). */
export function olympiaDict(tt: unknown): OlympiaDict {
  return ((tt as Partial<TransactionsDict> | undefined)?.olympia ?? {}) as OlympiaDict;
}

/** `{name}` placeholders filled in. */
export const fill = (template: string | undefined, values: Record<string, string | number>) =>
  (template ?? '').replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** "At 28 Sept 2023" / "Until 28 Sept 2023": what a figure at the end of Olympia refers to. */
export function endOfOlympia(o: OlympiaDict, locale: string): { at: string; until: string } {
  const date = new Date(OLYMPIA_END_ISO).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return { at: fill(o.as_of, { date }), until: fill(o.until, { date }) };
}

/** The label of an Olympia action type. */
export function actionLabel(o: OlympiaDict, type: string | null): string {
  const labels = o.action as Record<string, string> | undefined;
  return (type && labels?.[type]) || labels?.OTHER || type || '';
}
