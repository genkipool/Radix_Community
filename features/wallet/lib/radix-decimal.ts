/**
 * Exact 18-decimal fixed-point arithmetic for Radix Engine `Decimal("...")`
 * manifest literals.
 *
 * Radix `Decimal` has 18 fractional digits (`10^-18`) and rejects scientific
 * notation (`1e-7`) as well as precision beyond 18 decimals. IEEE-754 float64
 * arithmetic drifts on sums (`1.1 + 1.2 + 1.3 = 3.5999999999999996 < 3.6`),
 * divisions (`10 / 3 * 3` vs `3 * 3.3333333333333335`), and 18-decimal vault
 * balances (`parseFloat` can round UP above the actual vault balance), causing
 * `WorktopError::InsufficientBalance` or `VaultError::NotEnoughBalance`.
 *
 * Every conversion here truncates (rounds down toward zero) beyond 18 decimal
 * places so a computed withdrawal can never exceed the underlying balance.
 */

const DECIMALS = 18;
const SCALE = 10n ** BigInt(DECIMALS);

/** Normalizes a finite non-negative number or decimal string into plain base-10 digits. */
function normalizePlainDecimal(value: number | string): string {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!raw || raw === 'NaN' || raw === 'Infinity' || raw === '-Infinity') {
    throw new Error(`Invalid Radix Decimal value: "${value}"`);
  }
  if (raw.startsWith('-')) {
    throw new Error(`Negative Radix Decimal value not allowed: "${value}"`);
  }

  const unsigned = raw.startsWith('+') ? raw.slice(1) : raw;

  // Expand scientific notation (e.g. "1.5e-7", "2e+21") into plain digits
  const sciMatch = unsigned.match(/^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (sciMatch) {
    const [, intPart, fracPart = '', expStr] = sciMatch;
    const exp = parseInt(expStr, 10);
    const digits = intPart + fracPart;
    const decimalPos = intPart.length + exp;

    if (decimalPos <= 0) {
      return `0.${'0'.repeat(-decimalPos)}${digits}`;
    }
    if (decimalPos >= digits.length) {
      return `${digits}${'0'.repeat(decimalPos - digits.length)}`;
    }
    return `${digits.slice(0, decimalPos)}.${digits.slice(decimalPos)}`;
  }

  if (!/^\d+(?:\.\d+)?$/.test(unsigned)) {
    throw new Error(`Invalid Radix Decimal syntax: "${value}"`);
  }

  return unsigned;
}

/** Parses a non-negative number or decimal string into exact atto-units (`10^-18`), truncating beyond 18 decimals. */
export function parseAtto(value: number | string): bigint {
  const plain = normalizePlainDecimal(value);
  const [intPart, fracPart = ''] = plain.split('.');
  const paddedFrac = fracPart.slice(0, DECIMALS).padEnd(DECIMALS, '0');
  return BigInt(intPart) * SCALE + BigInt(paddedFrac);
}

/** Formats exact non-negative atto-units (`10^-18`) as a clean Radix `Decimal` string without trailing zeros. */
export function formatAtto(atto: bigint): string {
  if (atto < 0n) {
    throw new Error(`Negative atto value not allowed: ${atto}`);
  }
  const intPart = atto / SCALE;
  const fracPart = atto % SCALE;
  if (fracPart === 0n) return intPart.toString();
  const fracStr = fracPart.toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${intPart.toString()}.${fracStr}`;
}

/** Converts a non-negative number or string into a valid Radix `Decimal("...")` literal string (<= 18 decimals, no scientific notation). */
export function toRadixDecimal(value: number | string): string {
  return formatAtto(parseAtto(value));
}

/** Exact sum of Radix Decimals in 18-decimal fixed-point arithmetic (guarantees withdraw === sum of takes). */
export function sumRadixDecimals(values: ReadonlyArray<number | string>): string {
  let total = 0n;
  for (const v of values) {
    total += parseAtto(v);
  }
  return formatAtto(total);
}

/**
 * Splits `total` into `parts` equal shares using exact floor division so that
 * `parts * share <= total` and every share is a valid 18-decimal string.
 */
export function splitRadixDecimal(total: number | string, parts: number): string[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`Invalid split count: ${parts}`);
  }
  const totalAtto = parseAtto(total);
  const shareAtto = totalAtto / BigInt(parts);
  const shareStr = formatAtto(shareAtto);
  return Array.from({ length: parts }, () => shareStr);
}

/** Returns the smaller of two Radix Decimals (exact 18-decimal comparison), preventing vault over-withdrawal. */
export function minRadixDecimal(a: number | string, b: number | string): string {
  const aAtto = parseAtto(a);
  const bAtto = parseAtto(b);
  return formatAtto(aAtto <= bAtto ? aAtto : bAtto);
}
