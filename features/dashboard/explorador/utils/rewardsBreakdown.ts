/**
 * Pure aggregation and fiat-valuation helpers for yearly, monthly, and daily
 * staking rewards (shared by Babylon and Olympia reward tables).
 */
import { formatCurrency, formatFiatPrecise, type FiatCurrency } from '@/utils/currencyUtils';
import { lookupXrdFiatPrice, type XrdDailyPricesMap } from '@/features/dashboard/hooks/useXrdDailyPrices';

/** Rewards earned on a single UTC day (`YYYY-MM-DD`). */
export interface DailyRewardPoint {
    date: string;
    delegatorXrd: number;
    feeXrd: number;
}

export type RewardsValuationMode = 'account' | 'validator';

export interface DailyRewardSummary extends DailyRewardPoint {
    /** XRD amount valued in fiat (`delegatorXrd + feeXrd` for accounts, `feeXrd` for validators). */
    primaryXrd: number;
    /** Unit price of 1 XRD in the selected fiat currency on `date`. */
    unitFiatAtReceipt: number | null;
    /** Fiat value of `primaryXrd` on `date`. */
    fiatAtReceipt: number | null;
    /** Fiat value of `primaryXrd` at the current XRD price. */
    fiatCurrent: number | null;
}

export interface MonthlyRewardSummary {
    /** `YYYY-MM` */
    month: string;
    days: number;
    delegatorXrd: number;
    feeXrd: number;
    primaryXrd: number;
    fiatAtReceipt: number | null;
    fiatCurrent: number | null;
}

export interface YearRewardsBreakdown {
    fiatAtReceipt: number | null;
    fiatCurrent: number | null;
    months: MonthlyRewardSummary[];
    days: DailyRewardSummary[];
}

/** Merges per-validator daily records into one `DailyRewardPoint` per UTC day, sorted ascending. */
export function mergeDailyRewards(
    delegatorEntries: { date: string; xrd: number }[],
    feeEntries: { date: string; xrd: number }[],
): DailyRewardPoint[] {
    const byDay = new Map<string, DailyRewardPoint>();
    const ensure = (date: string): DailyRewardPoint => {
        let entry = byDay.get(date);
        if (!entry) {
            entry = { date, delegatorXrd: 0, feeXrd: 0 };
            byDay.set(date, entry);
        }
        return entry;
    };
    for (const d of delegatorEntries) {
        if (d.xrd > 0) ensure(d.date).delegatorXrd += d.xrd;
    }
    for (const f of feeEntries) {
        if (f.xrd > 0) ensure(f.date).feeXrd += f.xrd;
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const primaryAmount = (p: DailyRewardPoint, mode: RewardsValuationMode): number =>
    mode === 'validator' ? p.feeXrd : p.delegatorXrd + p.feeXrd;

/**
 * Computes the yearly fiat totals, monthly breakdown, and daily breakdown for
 * one year of rewards using the shared historical daily XRD price map.
 */
export function summarizeYearRewards(
    dailyPoints: DailyRewardPoint[],
    prices: XrdDailyPricesMap | undefined,
    currency: FiatCurrency,
    currentPrice: number | null,
    mode: RewardsValuationMode = 'account',
): YearRewardsBreakdown {
    const days: DailyRewardSummary[] = [];
    const monthsMap = new Map<string, {
        month: string;
        days: number;
        delegatorXrd: number;
        feeXrd: number;
        primaryXrd: number;
        fiatAtReceipt: number;
        hasReceiptPrice: boolean;
        fiatCurrent: number;
        hasCurrentPrice: boolean;
    }>();

    let yearFiatAtReceipt = 0;
    let hasAnyReceiptPrice = false;
    let yearFiatCurrent = 0;
    let hasAnyCurrentPrice = false;

    for (const point of dailyPoints) {
        const primaryXrd = primaryAmount(point, mode);
        const unitFiatAtReceipt = lookupXrdFiatPrice(prices, point.date, currency);
        const fiatAtReceipt = unitFiatAtReceipt !== null ? primaryXrd * unitFiatAtReceipt : null;
        const fiatCurrent = currentPrice !== null ? primaryXrd * currentPrice : null;

        if (fiatAtReceipt !== null) {
            yearFiatAtReceipt += fiatAtReceipt;
            hasAnyReceiptPrice = true;
        }
        if (fiatCurrent !== null) {
            yearFiatCurrent += fiatCurrent;
            hasAnyCurrentPrice = true;
        }

        days.push({
            ...point,
            primaryXrd,
            unitFiatAtReceipt,
            fiatAtReceipt,
            fiatCurrent,
        });

        const month = point.date.slice(0, 7);
        let m = monthsMap.get(month);
        if (!m) {
            m = {
                month,
                days: 0,
                delegatorXrd: 0,
                feeXrd: 0,
                primaryXrd: 0,
                fiatAtReceipt: 0,
                hasReceiptPrice: false,
                fiatCurrent: 0,
                hasCurrentPrice: false,
            };
            monthsMap.set(month, m);
        }
        m.days += 1;
        m.delegatorXrd += point.delegatorXrd;
        m.feeXrd += point.feeXrd;
        m.primaryXrd += primaryXrd;
        if (fiatAtReceipt !== null) {
            m.fiatAtReceipt += fiatAtReceipt;
            m.hasReceiptPrice = true;
        }
        if (fiatCurrent !== null) {
            m.fiatCurrent += fiatCurrent;
            m.hasCurrentPrice = true;
        }
    }

    const months: MonthlyRewardSummary[] = [...monthsMap.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({
            month: m.month,
            days: m.days,
            delegatorXrd: m.delegatorXrd,
            feeXrd: m.feeXrd,
            primaryXrd: m.primaryXrd,
            fiatAtReceipt: m.hasReceiptPrice ? m.fiatAtReceipt : null,
            fiatCurrent: m.hasCurrentPrice ? m.fiatCurrent : null,
        }));

    return {
        fiatAtReceipt: hasAnyReceiptPrice ? yearFiatAtReceipt : null,
        fiatCurrent: hasAnyCurrentPrice ? yearFiatCurrent : null,
        months,
        days,
    };
}

/** Formats a small XRD unit price cleanly with the app's right-aligned symbol style. */
export function formatXrdUnitPrice(price: number | null, currency: FiatCurrency, locale: string): string {
    if (price === null || !Number.isFinite(price)) return '—';
    return formatFiatPrecise(price, currency, locale);
}

/** Formats `YYYY-MM` into a localized month name (e.g. `enero 2025` / `January 2025`). */
export function formatRewardMonth(month: string, locale: string): string {
    const [y, m] = month.split('-');
    if (!y || !m) return month;
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Formats `YYYY-MM-DD` into a localized UTC date (e.g. `18 nov 2025`). */
export function formatRewardDay(day: string, locale: string): string {
    const d = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return day;
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Percentage gain/loss if sold today compared to the value when received.
 * Returns `null` when either value is missing or `fiatAtReceipt <= 0`.
 */
export function computeFiatChangePct(fiatAtReceipt: number | null, fiatCurrent: number | null): number | null {
    if (fiatAtReceipt === null || fiatCurrent === null) return null;
    if (!Number.isFinite(fiatAtReceipt) || !Number.isFinite(fiatCurrent) || fiatAtReceipt <= 0) return null;
    return ((fiatCurrent - fiatAtReceipt) / fiatAtReceipt) * 100;
}

/** Formats a signed percentage (e.g. `+14,2 %`, `-68,4 %`, `0,0 %`). */
export function formatSignedPercent(pct: number | null, locale: string): string {
    if (pct === null || !Number.isFinite(pct)) return '—';
    const abs = Math.abs(pct);
    const digits = abs >= 100 ? 0 : 1;
    const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(abs);
    const sign = pct > 0.05 ? '+' : pct < -0.05 ? '-' : '';
    return `${sign}${formatted}%`;
}

/** Formats a signed fiat delta (e.g. `+12,40 €`, `-45,20 €`). */
export function formatSignedCurrency(delta: number | null, currency: FiatCurrency, locale: string): string {
    if (delta === null || !Number.isFinite(delta)) return '—';
    const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
    const abs = Math.abs(delta);
    const body = abs > 0 && abs < 1
        ? formatFiatPrecise(abs, currency, locale)
        : formatCurrency(abs, currency, locale);
    return `${sign}${body}`;
}

/** Semantic tone class for a percentage gain/loss cell. */
export function fiatChangeTone(pct: number | null): string {
    if (pct === null || !Number.isFinite(pct)) return 'text-[var(--color-text-muted)]';
    if (pct > 0.05) return 'font-semibold text-[var(--color-accent)]';
    if (pct < -0.05) return 'font-semibold text-red-500';
    return 'text-[var(--color-text-muted)]';
}
