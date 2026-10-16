/**
 * Decimal amounts as the Radix engine accepts them: up to 18 fractional
 * digits, no exponent, no sign. Kept as strings end to end so a manifest never
 * carries a float rounding artefact.
 */

const DECIMAL_RE = /^\d+(\.\d{1,18})?$/;

/** A well-formed, strictly positive engine Decimal. */
export const isPositiveDecimal = (value: string): boolean => {
  const v = value.trim();
  return DECIMAL_RE.test(v) && /[1-9]/.test(v);
};

/** Normalises user input: trims, accepts a decimal comma. */
export const normalizeDecimal = (value: string): string => value.trim().replace(',', '.');

/**
 * Adds decimal strings exactly (as 18-digit fixed point), for totals that go
 * into a manifest. Invalid entries count as zero.
 */
export function sumDecimals(values: string[]): string {
  const SCALE = 18n;
  const total = values.reduce((acc, raw) => {
    const v = normalizeDecimal(raw);
    if (!DECIMAL_RE.test(v)) return acc;
    const [int, frac = ''] = v.split('.');
    return acc + BigInt(int) * 10n ** SCALE + BigInt(frac.padEnd(18, '0'));
  }, 0n);
  const int = total / 10n ** SCALE;
  const frac = (total % 10n ** SCALE).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${int}.${frac}` : String(int);
}

/**
 * Exact sum of signed decimal strings, such as Gateway balance changes
 * (negative on the way out). The result keeps its sign.
 */
export function sumSignedDecimals(values: string[]): string {
  const SCALE = 10n ** 18n;
  const total = values.reduce((acc, raw) => {
    const m = /^(-)?(\d+)(?:\.(\d{1,18}))?$/.exec(raw.trim());
    if (!m) return acc;
    const v = BigInt(m[2]) * SCALE + BigInt((m[3] ?? '').padEnd(18, '0'));
    return m[1] ? acc - v : acc + v;
  }, 0n);
  const sign = total < 0n ? '-' : '';
  const abs = total < 0n ? -total : total;
  const frac = (abs % SCALE).toString().padStart(18, '0').replace(/0+$/, '');
  return `${sign}${abs / SCALE}${frac ? `.${frac}` : ''}`;
}

/** a <= b, both engine decimals. */
export function lteDecimal(a: string, b: string): boolean {
  const toFixed = (raw: string) => {
    const v = normalizeDecimal(raw);
    if (!DECIMAL_RE.test(v)) return null;
    const [int, frac = ''] = v.split('.');
    return BigInt(int) * 10n ** 18n + BigInt(frac.padEnd(18, '0'));
  };
  const x = toFixed(a);
  const y = toFixed(b);
  return x !== null && y !== null && x <= y;
}
