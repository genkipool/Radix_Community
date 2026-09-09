/**
 * Pure client-side inspection of Radix bech32m addresses: entity type,
 * network and checksum validity, without any network call.
 */

export interface AddressInspection {
  /** Human-readable part (everything before the separator '1') */
  hrp: string;
  /** Entity kind derived from the hrp prefix */
  entityType: string;
  network: 'mainnet' | 'stokenet' | 'other';
  checksumValid: boolean;
  /** The 30 node-id bytes the address encodes, hex. Null if undecodable. */
  nodeIdHex: string | null;
  /** How an account address is controlled, from its entity-type byte. */
  accountKind: AccountAddressKind | null;
}

/**
 * The three shapes an account address comes in.
 *
 * A *preallocated* account (what the wallets create) has no ledger state until
 * its first use: the address is the entity-type byte followed by the hash of
 * the public key that controls it, and the curve is written into that first
 * byte. Olympia accounts migrated into Babylon are the secp256k1 flavour;
 * accounts created by the Babylon wallet are the ed25519 one.
 *
 * An *allocated* account was instantiated on ledger by `create_advanced`, so
 * its address says nothing about who controls it — only its role assignment
 * does.
 */
export type AccountAddressKind =
  | 'preallocated-secp256k1'
  | 'preallocated-ed25519'
  | 'allocated';

/* ─── bech32m checksum ────────────────────────────────────────────────────── */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (const char of hrp) result.push(char.charCodeAt(0) >> 5);
  result.push(0);
  for (const char of hrp) result.push(char.charCodeAt(0) & 31);
  return result;
}

export function verifyBech32mChecksum(address: string): boolean {
  const lower = address.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length) return false;
  const hrp = lower.slice(0, separator);
  const data: number[] = [];
  for (const char of lower.slice(separator + 1)) {
    const value = CHARSET.indexOf(char);
    if (value === -1) return false;
    data.push(value);
  }
  return polymod(hrpExpand(hrp).concat(data)) === BECH32M_CONST;
}

/* ─── Payload decoding ────────────────────────────────────────────────────── */

/**
 * The bytes a Radix address carries: its node id. The checksum verifies the
 * whole string, this reads what the string is *about* — 30 bytes whose first
 * one is the entity type.
 *
 * Returns null when the address is malformed or the checksum fails, so a
 * caller can never derive anything from a typo.
 */
export function decodeAddressNodeId(address: string): Uint8Array | null {
  const lower = address.trim().toLowerCase();
  if (!verifyBech32mChecksum(lower)) return null;

  const separator = lower.lastIndexOf('1');
  const payload = lower.slice(separator + 1, -6); // the last 6 chars are checksum
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const char of payload) {
    const value = CHARSET.indexOf(char);
    if (value === -1) return null;
    accumulator = (accumulator << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
    }
  }
  return bytes.length === 30 ? Uint8Array.from(bytes) : null;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Hex of `decodeAddressNodeId`, the form the ledger prints in local ids. */
export function addressNodeIdHex(address: string): string | null {
  const bytes = decodeAddressNodeId(address);
  return bytes && toHex(bytes);
}

/** Entity-type byte → account flavour. Values from the engine's EntityType. */
const ACCOUNT_ENTITY_BYTES = new Map<number, AccountAddressKind>([
  [0b11010001, 'preallocated-secp256k1'],
  [0b01010001, 'preallocated-ed25519'],
  [0b11000001, 'allocated'],
]);

/** The account flavour an address encodes, or null if it is not an account. */
export function accountAddressKind(address: string): AccountAddressKind | null {
  const bytes = decodeAddressNodeId(address);
  return bytes ? (ACCOUNT_ENTITY_BYTES.get(bytes[0]) ?? null) : null;
}

/* ─── Entity classification ───────────────────────────────────────────────── */

const ENTITY_PREFIXES: Array<[string, string]> = [
  ['account_', 'account'],
  ['resource_', 'resource'],
  ['component_', 'component'],
  ['package_', 'package'],
  ['validator_', 'validator'],
  ['identity_', 'identity'],
  ['pool_', 'pool'],
  ['accesscontroller_', 'accessController'],
  ['locker_', 'locker'],
  ['consensusmanager_', 'consensusManager'],
  ['transactiontracker_', 'transactionTracker'],
  ['internal_vault_', 'internalVault'],
  ['internal_component_', 'internalComponent'],
  ['internal_keyvaluestore_', 'internalKeyValueStore'],
  ['txid_', 'transactionId'],
  ['subtxid_', 'subintentId'],
];

export function inspectAddress(rawAddress: string): AddressInspection | null {
  const address = rawAddress.trim().toLowerCase();
  const separator = address.lastIndexOf('1');
  if (separator < 1) return null;
  const hrp = address.slice(0, separator);

  const entityType =
    ENTITY_PREFIXES.find(([prefix]) => address.startsWith(prefix))?.[1] ?? 'unknown';

  const network = hrp.endsWith('_rdx') || hrp === 'rdx'
    ? 'mainnet'
    : hrp.includes('_tdx_2') || hrp === 'tdx_2'
      ? 'stokenet'
      : 'other';

  const nodeId = decodeAddressNodeId(address);

  return {
    hrp,
    entityType,
    network,
    checksumValid: verifyBech32mChecksum(address),
    nodeIdHex: nodeId && toHex(nodeId),
    accountKind: nodeId ? (ACCOUNT_ENTITY_BYTES.get(nodeId[0]) ?? null) : null,
  };
}
