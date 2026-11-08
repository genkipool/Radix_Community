/**
 * services/olympia/resources.ts
 *
 * Olympia tokens: metadata, supply at the end of Olympia, holders, and the
 * Babylon resource each one became.
 */
import 'server-only';
import { symbolOfRri } from '@/features/dashboard/lib/olympia';
import type { OlympiaResource } from '@/types/olympia';
import { OLYMPIA_FILES as F } from './files';
import { toNum } from './mappers';
import { attoToDecimal, attoToNumber, readEq } from './parquet';

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** The Olympia token an RRI names, with its top holders. */
export async function getResource(rri: string, topHolders = 50): Promise<OlympiaResource | null> {
  const [[r], holders] = await Promise.all([
    readEq(F.resourcesByRri.path, F.resourcesByRri.key, rri),
    readEq(F.holdersByResource.path, F.holdersByResource.key, rri),
  ]);
  if (!r) return null;
  return {
    rri,
    babylonAddress: str(r.babylon_resource_address),
    symbol: (str(r.symbol) ?? symbolOfRri(rri)).toUpperCase(),
    name: str(r.name),
    description: str(r.description),
    url: str(r.url),
    iconUrl: str(r.icon_url),
    isMutable: typeof r.is_mutable === 'boolean' ? r.is_mutable : null,
    granularity: str(r.granularity),
    owner: str(r.owner_address),
    createdStateVersion: toNum(r.created_state_version),
    totalSupply: attoToDecimal(r.total_supply ?? '0'),
    totalMinted: attoToDecimal(r.total_minted ?? '0'),
    totalBurnt: attoToDecimal(r.total_burnt ?? '0'),
    holders: toNum(r.holders),
    // The holders file is sorted by balance, largest first, within each token.
    topHolders: holders.slice(0, topHolders).map((h) => ({
      address: String(h.address),
      amount: attoToDecimal(h.balance),
      amountNum: attoToNumber(h.balance),
    })),
  };
}

/** The Olympia RRI a Babylon resource address was migrated from, if any. */
export async function findRriByBabylon(babylonAddress: string): Promise<string | null> {
  const [r] = await readEq(F.resourcesByBabylon.path, F.resourcesByBabylon.key, babylonAddress);
  return r ? String(r.rri) : null;
}
