/**
 * services/olympia/catalog.ts
 *
 * The two small tables every Olympia view labels things with: the 920 tokens
 * and the 254 validators. Each is read once per instance and kept in memory
 * (Olympia's data never changes), so naming a token or a validator anywhere is
 * a map lookup.
 */
import 'server-only';
import { symbolOfRri } from '@/features/dashboard/lib/olympia';
import { OLYMPIA_FILES } from './files';
import { attoToNumber, readAll } from './parquet';

export interface TokenInfo {
  rri: string;
  symbol: string;
  name: string | null;
  iconUrl: string | null;
}

export interface ValidatorInfo {
  address: string;
  name: string | null;
  /** XRD staked to it when Olympia ended. */
  totalXrdStaked: number;
  /** The node key, compressed secp256k1 in hex. */
  publicKey: string | null;
}

let tokens: Promise<Map<string, TokenInfo>> | null = null;
let validators: Promise<Map<string, ValidatorInfo>> | null = null;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function tokenCatalog(): Promise<Map<string, TokenInfo>> {
  tokens ??= readAll(OLYMPIA_FILES.resourcesByRri.path, ['rri', 'symbol', 'name', 'icon_url']).then((rows) => {
    const map = new Map<string, TokenInfo>();
    for (const r of rows) {
      const rri = String(r.rri);
      map.set(rri, {
        rri,
        symbol: (str(r.symbol) ?? symbolOfRri(rri)).toUpperCase(),
        name: str(r.name),
        iconUrl: str(r.icon_url),
      });
    }
    return map;
  });
  tokens.catch(() => { tokens = null; });
  return tokens;
}

export function validatorCatalog(): Promise<Map<string, ValidatorInfo>> {
  validators ??= readAll(OLYMPIA_FILES.validatorsByAddress.path, ['address', 'name', 'total_xrd_staked', 'public_key']).then((rows) => {
    const map = new Map<string, ValidatorInfo>();
    for (const r of rows) {
      map.set(String(r.address), {
        address: String(r.address),
        name: str(r.name),
        totalXrdStaked: attoToNumber(r.total_xrd_staked ?? '0'),
        publicKey: str(r.public_key)?.toLowerCase() ?? null,
      });
    }
    return map;
  });
  validators.catch(() => { validators = null; });
  return validators;
}

export async function tokenInfo(rri: string | null | undefined): Promise<TokenInfo> {
  const fallback = { rri: rri ?? '', symbol: symbolOfRri(rri), name: null, iconUrl: null };
  if (!rri) return fallback;
  return (await tokenCatalog()).get(rri) ?? fallback;
}

/**
 * The Olympia validator that ran with this node key, if any. Many Babylon
 * validators kept the key their Olympia node had, which is the only link
 * between a Babylon validator and its Olympia past.
 */
export async function findValidatorByPublicKey(publicKey: string): Promise<ValidatorInfo | null> {
  const key = publicKey.toLowerCase();
  for (const v of (await validatorCatalog()).values()) if (v.publicKey === key) return v;
  return null;
}
