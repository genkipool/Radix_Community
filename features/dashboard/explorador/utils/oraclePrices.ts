/**
 * features/dashboard/explorador/utils/oraclePrices.ts
 *
 * Pure helpers to read what an oracle update changed, straight from the
 * receipt. No React, no hooks, no requests.
 *
 * A price feed keeps its prices in a key-value store keyed by resource. The
 * receipt lists every entry the transaction rewrote with its value before and
 * after, SBOR-encoded: a key is the resource's node id, a value a tuple such as
 * PriceInfo { timestamp: i64, price: Decimal }. Both decode here, so the old
 * prices and when each side was set cost nothing beyond the receipt.
 */

interface SubstateValue {
  substate_data?: { value?: { data?: { struct_data?: { hex?: string | null } } } };
}

interface UpdatedSubstate {
  substate_id?: {
    entity_address?: string;
    substate_type?: string;
    substate_key?: { key_hex?: string };
  };
  previous_value?: SubstateValue;
  new_value?: SubstateValue;
}

/** A price as one side of the update left it. */
export interface PricePoint {
  price: string;
  /** When the feed set it, in seconds since the epoch, when its value records it. */
  timestamp: number | null;
}

/** What an update did to one resource's price. */
export interface PriceRewrite {
  before: PricePoint | null;
  after: PricePoint | null;
}

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/** The node id an address encodes, as hex: its bech32m data part, checksum dropped. */
export function addressNodeIdHex(address: string): string | null {
  const data = address.slice(address.lastIndexOf('1') + 1, -6);
  let acc = 0;
  let bits = 0;
  let hex = '';
  for (const char of data) {
    const value = BECH32.indexOf(char);
    if (value < 0) return null;
    acc = ((acc << 5) | value) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      hex += ((acc >> bits) & 0xff).toString(16).padStart(2, '0');
    }
  }
  return hex || null;
}

/** Little-endian two's-complement bytes as a bigint. */
function readInt(bytes: Uint8Array, start: number, length: number): bigint {
  let n = 0n;
  for (let i = length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[start + i]);
  const top = 1n << BigInt(length * 8 - 1);
  return n >= top ? n - (top << 1n) : n;
}

/** A Decimal (18 places) as a plain decimal string. */
function decimalString(raw: bigint): string {
  const negative = raw < 0n;
  const digits = (negative ? -raw : raw).toString().padStart(19, '0');
  const whole = digits.slice(0, -18);
  const fraction = digits.slice(-18).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Fixed-size SBOR value kinds: their byte length. */
const FIXED_SIZE: Record<number, number> = {
  0x01: 1, 0x02: 1, 0x03: 2, 0x04: 4, 0x05: 8, 0x06: 16,
  0x07: 1, 0x08: 2, 0x09: 4, 0x0a: 8, 0x0b: 16, 0xa0: 24, 0xa1: 32,
};

/**
 * The price a stored value holds: a bare Decimal, or the first Decimal of a
 * tuple of fixed-size fields, with the first i64 that reads as a time in
 * seconds. Null for any other shape.
 */
export function decodePricePoint(hex: string | null | undefined): PricePoint | null {
  if (!hex || !/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));
  if (bytes[0] !== 0x5c) return null;

  if (bytes[1] === 0xa0 && bytes.length >= 26) return { price: decimalString(readInt(bytes, 2, 24)), timestamp: null };
  if (bytes[1] !== 0x21) return null;

  let price: string | null = null;
  let timestamp: number | null = null;
  let at = 3;
  for (let field = 0; field < bytes[2]; field++) {
    const kind = bytes[at];
    const size = FIXED_SIZE[kind];
    if (size === undefined || at + 1 + size > bytes.length) return null;
    if (kind === 0xa0 && price === null) price = decimalString(readInt(bytes, at + 1, 24));
    if (kind === 0x05 && timestamp === null) {
      const seconds = Number(readInt(bytes, at + 1, 8));
      if (seconds > 1e9 && seconds < 1e11) timestamp = seconds;
    }
    at += 1 + size;
  }
  return price === null ? null : { price, timestamp };
}

/**
 * What the update did to each resource's price, from the receipt's rewritten
 * key-value entries keyed by those resources.
 */
export function priceRewrites(updatedSubstates: UpdatedSubstate[] | undefined, resources: string[]): Record<string, PriceRewrite> {
  const byKey = new Map<string, string>(resources.flatMap((resource) => {
    const id = addressNodeIdHex(resource);
    // A ResourceAddress key: payload prefix, custom Reference kind, node id.
    return id ? [[`5c80${id}`, resource] as const] : [];
  }));
  const rewrites: Record<string, PriceRewrite> = {};
  for (const substate of updatedSubstates ?? []) {
    const id = substate.substate_id;
    if (id?.substate_type !== 'GenericKeyValueStoreEntry') continue;
    const resource = byKey.get(id.substate_key?.key_hex?.toLowerCase() ?? '');
    if (!resource) continue;
    rewrites[resource] = {
      before: decodePricePoint(substate.previous_value?.substate_data?.value?.data?.struct_data?.hex),
      after: decodePricePoint(substate.new_value?.substate_data?.value?.data?.struct_data?.hex),
    };
  }
  return rewrites;
}

/** How much a price moved, in percent of the old one; null when there is no old one to compare. */
export function priceChange(previous: string | undefined, next: string): number | null {
  const before = Number(previous);
  const after = Number(next);
  if (previous === undefined || !Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  return ((after - before) / before) * 100;
}
