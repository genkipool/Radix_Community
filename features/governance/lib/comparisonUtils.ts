import type { VoterRow } from '../types';
import {
    METHOD_PARAMS, RESISTANCE_SCORE, concentrationLevel,
    type Attack, type MethodFamily, type MethodKey, type Resistance,
} from './votingMethods';
import { fill, formatPct, formatShare } from './format';
import type { G } from '../components/GovernanceBadges';

export type CompareDict = Partial<NonNullable<G['compare']>>;
export type HistoricalDict = Partial<NonNullable<G['historical']>>;
export type Params = Record<string, string>;
export type SortState = { by: 'spread' | 'resistance'; dir: 'asc' | 'desc' } | null;

/** True when a voter row has been counted by the collector with positive XRD voting power. */
export function isCountedVoter(v: Pick<VoterRow, 'votePower'>): boolean {
    return v.votePower !== null && Number(v.votePower) > 0;
}

/** Figures the rule texts quote, in the reader's locale. */
export function ruleParams(language: string): Params {
    const n = (x: number) => x.toLocaleString(language);
    return {
        cap: n(METHOD_PARAMS.cap),
        min: n(METHOD_PARAMS.minBalance),
        balance: n(METHOD_PARAMS.sybilBalance),
        years_sybil: n(METHOD_PARAMS.sybilDays / 365),
        years: n(METHOD_PARAMS.veteranDays / 365),
        bonus: formatPct(METHOD_PARAMS.bonusPerYear, language),
        n: n(METHOD_PARAMS.whales),
        share: formatPct(METHOD_PARAMS.capShare, language),
        share_veterans: formatPct(METHOD_PARAMS.veteranShareCap, language),
        bracket_first: n(METHOD_PARAMS.marginalBrackets.first),
        bracket_second: n(METHOD_PARAMS.marginalBrackets.second),
        whale: n(METHOD_PARAMS.whaleMin),
    };
}

/** Hover text, filled with the figures it quotes. */
export function tip(c: CompareDict, key: string, values: Params = {}): string | undefined {
    const text = ((c.tips ?? {}) as Record<string, string>)[key];
    return text ? fill(text, values) : undefined;
}

export function methodText(c: CompareDict, key: MethodKey, params: Params) {
    const m = (c.methods as Record<string, { name?: string; rule?: string; attack?: string }> | undefined)?.[key] ?? {};
    return { name: fill(m.name || key, params), rule: fill(m.rule || '', params), attack: fill(m.attack || '', params) };
}

const fold = (s: string) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Normalize thousands separators in numbers so "10000", "10.000" and "10,000" all match.
    .replace(/(?<=\d)[.,](?=\d{3}\b)/g, '');

const wordsOf = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Multi-token, word-prefix search across a method's visible fields:
 * name, rule subtitle, family, resistance level, decentralisation level, and outcome.
 * Word-prefix matching avoids false positives like "alta" matching "falta" or
 * "centralizado" matching "descentralizado".
 */
export function matchesMethodQuery(
    c: CompareDict,
    meta: {
        key: MethodKey;
        family: MethodFamily;
        resistance: Resistance;
        spread: number | null;
        nakamoto: number | null;
        extra?: Array<string | undefined | null>;
    },
    params: Params,
    query: string,
): boolean {
    const tokens = wordsOf(query);
    if (tokens.length === 0) return true;
    const { name, rule } = methodText(c, meta.key, params);
    const familyLabel = ((c.families ?? {}) as Record<string, string>)[meta.family] || meta.family;
    const resistanceLabel = ((c.resistance ?? {}) as Record<string, string>)[meta.resistance] || meta.resistance;
    const level = concentrationLevel({
        nakamoto: meta.nakamoto === null ? null : Math.round(meta.nakamoto),
        spread: meta.spread,
    });
    const levelLabel = level ? (((c.levels ?? {}) as Record<string, string>)[level] || level) : '';
    const words = wordsOf([
        name,
        rule,
        meta.key,
        familyLabel,
        resistanceLabel,
        levelLabel,
        ...(meta.extra ?? []),
    ].filter(Boolean).join(' '));
    return tokens.every(t => words.some(w => w.startsWith(t)));
}

/** Multi-line native tooltip describing a method's resistance to manipulation. */
export function resistanceTooltip(c: CompareDict, resistance: Resistance, attack: string, extraLine?: string): string {
    const label = ((c.resistance ?? {}) as Record<string, string>)[resistance] || resistance;
    return [
        fill(c.resistance_title ?? '', { level: label }),
        tip(c, `resistance_${resistance}`),
        '',
        `${c.resistance_how ?? ''}: ${attack}`,
        extraLine,
    ].filter((line): line is string => line !== undefined).join('\n');
}

/** Formatted hint for the most/least balanced KPI tile in both comparison views. */
export function formatBalanceHint(
    c: CompareDict,
    resistance: Resistance,
    nakamoto: number | null,
    ofCount: number,
    spread: number | null,
    language: string,
    maxFractionDigits = 0,
): string {
    return fill(c.kpi_balance_hint ?? '', {
        resistance: (((c.resistance ?? {}) as Record<string, string>)[resistance] || resistance).toLowerCase(),
        n: (nakamoto ?? 0).toLocaleString(language, { maximumFractionDigits: maxFractionDigits }),
        of: ofCount.toLocaleString(language),
        pct: formatPct(spread ?? 0, language),
    });
}

/**
 * Cycles column sort:
 * - `spread`: most->least centralised (`asc`) -> least->most (`desc`) -> grouped (`null`)
 * - `resistance`: high->low (`desc`) -> low->high (`asc`) -> grouped (`null`)
 */
export function nextSort(prev: SortState, by: 'spread' | 'resistance'): SortState {
    const firstDir: 'asc' | 'desc' = by === 'spread' ? 'asc' : 'desc';
    const secondDir: 'asc' | 'desc' = firstDir === 'asc' ? 'desc' : 'asc';
    if (!prev || prev.by !== by) return { by, dir: firstDir };
    if (prev.dir === firstDir) return { by, dir: secondDir };
    return null;
}

/** Sorts comparison rows by decentralisation (`spread`) or manipulation resistance. */
export function sortComparisonRows<T>(
    rows: T[],
    sort: SortState,
    getSpread: (row: T) => number | null,
    getResistance: (row: T) => Resistance,
): T[] {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
        if (sort.by === 'spread') {
            const sa = getSpread(a) ?? (sort.dir === 'asc' ? Infinity : -Infinity);
            const sb = getSpread(b) ?? (sort.dir === 'asc' ? Infinity : -Infinity);
            return sort.dir === 'asc' ? sa - sb : sb - sa;
        }
        const ra = RESISTANCE_SCORE[getResistance(a)];
        const rb = RESISTANCE_SCORE[getResistance(b)];
        if (ra !== rb) return sort.dir === 'desc' ? rb - ra : ra - rb;
        return (getSpread(b) ?? -1) - (getSpread(a) ?? -1);
    });
}

function yearsText(c: CompareDict, years: number, language: string): string {
    return fill(years === 1 ? (c.year_one ?? '') : (c.year_many ?? ''), { n: years.toLocaleString(language) });
}

/** Human-readable explanation of what it would take one person to flip a single vote under a rule. */
export function formatAttackCost(
    attack: Attack | null,
    eligibleXrd: number,
    c: CompareDict,
    language: string,
): string {
    if (!attack) return c.cost_none ?? '';
    if (attack.impossible) return c.cost_impossible ?? '';
    const amount = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 2 });
    const values = {
        xrd: amount(attack.xrd),
        addresses: attack.addresses.toLocaleString(language),
        each: amount(attack.addresses ? attack.xrd / attack.addresses : 0),
        years: yearsText(c, attack.years, language),
        pct: eligibleXrd > 0 ? formatShare(attack.xrd / eligibleXrd, language) : '—',
    };
    if (attack.perAddress) return fill(attack.years ? (c.cost_addresses_aged ?? '') : (c.cost_addresses ?? ''), values);
    if (attack.years) return fill(attack.addresses > 1 ? (c.cost_capital_split_aged ?? c.cost_capital_aged ?? '') : (c.cost_capital_aged ?? ''), values);
    return fill(attack.addresses > 1 ? (c.cost_capital_split ?? '') : (c.cost_capital ?? ''), values);
}
