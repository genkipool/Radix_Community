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
}

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

  return {
    hrp,
    entityType,
    network,
    checksumValid: verifyBech32mChecksum(address),
  };
}
