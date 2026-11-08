/**
 * Olympia (the Radix mainnet before Babylon, July 2021 – 28 September 2023):
 * recognising its identifiers and reading its values.
 *
 * Olympia addresses have no `<entity>_` prefix: accounts are `rdx1…`,
 * validators `rv1…`, tokens `<symbol>_rr1…`, and transactions a bare 64-digit
 * hex id. Babylon prefixes all contain an underscore before the network part
 * (`account_rdx1…`), so neither format can be mistaken for the other.
 *
 * Pure: no React, no Node APIs, so client and server share it.
 */

/** bech32 data characters. */
const B32 = '[02-9ac-hj-np-z]';

const ACCOUNT_RE = new RegExp(`^rdx1${B32}{50,70}$`);
const VALIDATOR_RE = new RegExp(`^rv1${B32}{50,70}$`);
const RESOURCE_RE = new RegExp(`^[a-z0-9]{1,16}_rr1${B32}{6,70}$`);
const TX_RE = /^[0-9a-f]{64}$/i;

export type OlympiaKind = 'account' | 'validator' | 'resource' | 'tx';

/** The kind of Olympia identifier `value` is, or null when it is not one. */
export function olympiaKindOf(value: string | null | undefined): OlympiaKind | null {
  if (!value) return null;
  const v = value.trim();
  if (ACCOUNT_RE.test(v)) return 'account';
  if (VALIDATOR_RE.test(v)) return 'validator';
  if (RESOURCE_RE.test(v)) return 'resource';
  if (TX_RE.test(v)) return 'tx';
  return null;
}

export function isOlympiaValue(value: string | null | undefined): boolean {
  return olympiaKindOf(value) !== null;
}

/** The Olympia native token. */
export const OLYMPIA_XRD_RRI = 'xrd_rr1qy5wfsfh';

/** When the last Olympia mainnet transaction was confirmed (state version 337,759,839). */
export const OLYMPIA_END_ISO = '2023-09-28T06:33:34.523Z';
/** Olympia's first transaction (state version 1): nothing on Radix is older. */
export const OLYMPIA_START_ISO = '2021-07-26T20:13:01.600Z';

/** Last ledger state version of Olympia mainnet. */
export const OLYMPIA_FINAL_STATE_VERSION = 337_759_839;

export type OlympiaMessage =
  | { kind: 'text'; text: string }
  | { kind: 'encrypted'; hex: string }
  | { kind: 'binary'; hex: string };

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

const PRINTABLE = /^[\P{Cc}\n\r\t]*$/u;

/**
 * Decodes an Olympia transaction message, given as the hex of its stored bytes.
 *
 * The Gateway stored what the wallet sent: usually the message bytes written
 * out as hex text, where `00 00 …` is a plaintext message and `01 …` an
 * encrypted one (the same rule the original Olympia explorer applied); some
 * clients sent plain text instead.
 */
export function decodeOlympiaMessage(storedHex: string | null | undefined): OlympiaMessage | null {
  if (!storedHex || storedHex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(storedHex)) return null;
  const stored = hexToBytes(storedHex);
  const asText = utf8(stored);
  if (asText !== null && /^(00|01|30)[0-9a-f]+$/i.test(asText) && asText.length % 2 === 0) {
    const inner = hexToBytes(asText);
    if (inner[0] === 0x01) return { kind: 'encrypted', hex: asText };
    if (inner[0] === 0x00) {
      const text = utf8(inner.slice(2));
      if (text !== null && PRINTABLE.test(text)) return { kind: 'text', text };
    }
    const text = utf8(inner);
    if (text !== null && PRINTABLE.test(text)) return { kind: 'text', text };
    return { kind: 'binary', hex: asText };
  }
  if (stored[0] === 0x00 && stored[1] === 0x00) {
    const text = utf8(stored.slice(2));
    if (text !== null && PRINTABLE.test(text)) return { kind: 'text', text };
  }
  if (stored[0] === 0x01) return { kind: 'encrypted', hex: storedHex };
  if (asText !== null && PRINTABLE.test(asText)) return { kind: 'text', text: asText };
  return { kind: 'binary', hex: storedHex };
}

/** A short form of a long address for tight spaces. */
export function shortOlympia(value: string, head = 10, tail = 6): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** The symbol of a token RRI (`oci_rr1…` → `OCI`). */
export function symbolOfRri(rri: string | null | undefined): string {
  if (!rri) return '';
  const i = rri.indexOf('_rr1');
  return (i > 0 ? rri.slice(0, i) : rri).toUpperCase();
}

/** Inferred Olympia action types, as the Olympia Gateway classified them. */
export const OLYMPIA_ACTION_TYPES = [
  'SIMPLE_TRANSFER',
  'SELF_TRANSFER',
  'STAKE_TOKENS',
  'UNSTAKE_TOKENS',
  'BURN_XRD',
  'MINT_XRD',
  'CREATE_TOKEN_DEFINITION',
  'MINT_TOKENS',
  'BURN_TOKENS',
  'COMPLEX',
] as const;

/**
 * The instants (ms) a calendar range of local days (YYYY-MM-DD) covers, clipped
 * to Olympia's life; null when the range does not reach into Olympia.
 */
export function olympiaWindow(range: { start: string | null; end: string | null }): { from: number; to: number } | null {
  if (!range.start) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const end = range.end ?? range.start;
  if (!day.test(range.start) || !day.test(end)) return null;
  const from = new Date(`${range.start}T00:00:00`).getTime();
  const to = Math.min(new Date(`${end}T23:59:59.999`).getTime(), Date.parse(OLYMPIA_END_ISO));
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) return null;
  return { from, to };
}

/** A moment as the local day (YYYY-MM-DD) the explorer's calendar uses. */
export function localDay(at: Date | string | number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
