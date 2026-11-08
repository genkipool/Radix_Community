/**
 * services/gateway/accountAt.ts
 *
 * A Babylon account as it was at the end of a UTC day: the same entity payload
 * the account card reads today (so its Tokens tab draws it unchanged) and its
 * staking rows valued at that moment, not today:
 *
 * - every read pins the same ledger state (`at_ledger_state`), the last one of
 *   the day;
 * - LSUs are worth the validator's stake vault over the LSU supply THEN;
 * - a claim NFT is still unstaking if its claim epoch is after the epoch THEN,
 *   claimable otherwise.
 */
import 'server-only';
import { BABYLON_FIRST_DAY } from '@/features/dashboard/lib/olympia';
import { parseClaimNft } from '@/features/dashboard/staking/lib/claimNfts';
import type { StakingEntry } from '@/features/dashboard/explorador/types/models.types';
import { gatewayPost } from './bases';
import { withRetry, type Network } from './client';


export interface LedgerPoint {
  state_version: number;
  epoch: number;
  proposer_round_timestamp: string;
}

export interface AccountAtDay {
  day: string;
  ledger: LedgerPoint;
  /** The account entity at that state, shaped as the card's own read (ledger_state included). */
  entity: Record<string, unknown>;
  stakingRows: StakingEntry[];
}

/** The card's opt-ins (keep in step with fetchEntityDetailsForCard / apiFetchEntityDetails). */
const CARD_OPT_INS = {
  explicit_metadata: [
    'name', 'symbol', 'icon_url', 'description', 'tags',
    'info_url', 'validator_fee_factor', 'claim_epoch_delay',
    'dapp_definition', 'dapp_definitions', 'pool', 'pool_address',
    'validator', 'claim_nft',
  ],
  ancestor_identities: false,
  component_royalty_vault_balance: false,
  package_royalty_vault_balance: false,
  non_fungible_include_nfids: true,
  dapp_two_way_links: true,
  native_resource_details: true,
};

type Vault = { amount?: string; items?: string[] };
type Holding = { resource_address: string; amount?: string; vaults?: { items?: Vault[] } };
interface EntityItem {
  fungible_resources?: { items?: Holding[] };
  non_fungible_resources?: { items?: Holding[] };
  details?: { total_supply?: string };
  address: string;
}
interface ValidatorItem {
  address: string;
  stake_vault?: { balance?: string };
  state?: { stake_unit_resource_address?: string; claim_token_resource_address?: string };
  metadata?: { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };
}

const post = <T>(network: Network, path: string, body: Record<string, unknown>) =>
  withRetry(() => gatewayPost<T>(network, path, body));

const amountOf = (h: Holding): number =>
  Number(h.amount ?? (h.vaults?.items ?? []).reduce((s, v) => s + Number(v.amount ?? 0), 0));

const metaOf = (v: ValidatorItem, key: string): string => {
  const value = v.metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
  return typeof value === 'string' ? value : '';
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function validatorsAt(network: Network, at: { state_version: number }): Promise<ValidatorItem[]> {
  const items: ValidatorItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await post<{ validators?: { items?: ValidatorItem[]; next_cursor?: string } }>(network, '/state/validators/list', {
      at_ledger_state: at,
      opt_ins: { explicit_metadata: ['name', 'icon_url'] },
      ...(cursor ? { cursor } : {}),
    });
    items.push(...(page.validators?.items ?? []));
    cursor = page.validators?.next_cursor ?? undefined;
  } while (cursor);
  return items;
}

/** Whether a UTC day can be read: from Babylon's first day to today. */
export function dayIsReadable(day: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return false;
  return day >= BABYLON_FIRST_DAY && day <= now.toISOString().slice(0, 10);
}

export async function readAccountAtDay(address: string, day: string, network: Network): Promise<AccountAtDay> {
  // The day's end. Today has not ended: the Gateway refuses a future moment, so
  // today is read now, and every later read is pinned to that same state.
  const today = day >= new Date().toISOString().slice(0, 10);
  const res = await post<{ ledger_state: LedgerPoint; items?: EntityItem[] }>(network, '/state/entity/details', {
    addresses: [address],
    aggregation_level: 'Vault',
    opt_ins: CARD_OPT_INS,
    ...(today ? {} : { at_ledger_state: { timestamp: `${day}T23:59:59.999Z` } }),
  });
  const ledger = res.ledger_state;
  const item = res.items?.[0];
  if (!item) throw new Error(`No entity ${address} at ${day}`);
  const at = { state_version: ledger.state_version };

  const fungibles = item.fungible_resources?.items ?? [];
  const nonFungibles = item.non_fungible_resources?.items ?? [];
  const validators = await validatorsAt(network, at);
  const byLsu = new Map(validators.filter((v) => v.state?.stake_unit_resource_address).map((v) => [v.state!.stake_unit_resource_address!, v]));
  const byClaim = new Map(validators.filter((v) => v.state?.claim_token_resource_address).map((v) => [v.state!.claim_token_resource_address!, v]));

  const rows = new Map<string, StakingEntry>();
  const row = (v: ValidatorItem): StakingEntry => {
    let r = rows.get(v.address);
    if (!r) {
      r = { validatorAddress: v.address, validatorName: metaOf(v, 'name') || 'Unknown Validator', validatorIcon: metaOf(v, 'icon_url'), xrdInStake: 0, xrdInUnstake: 0, xrdInClaim: 0, unstakes: [] };
      rows.set(v.address, r);
    }
    return r;
  };

  // LSUs, valued at the validator's XRD per unit at that state.
  const lsus = fungibles.filter((h) => byLsu.has(h.resource_address) && amountOf(h) > 0);
  const supply = new Map<string, number>();
  for (const batch of chunks(lsus.map((h) => h.resource_address), 20)) {
    const r = await post<{ items?: EntityItem[] }>(network, '/state/entity/details', { addresses: batch, at_ledger_state: at });
    for (const e of r.items ?? []) supply.set(e.address, Number(e.details?.total_supply ?? 0));
  }
  for (const h of lsus) {
    const v = byLsu.get(h.resource_address)!;
    const total = supply.get(h.resource_address) ?? 0;
    const rate = total > 0 ? Number(v.stake_vault?.balance ?? 0) / total : 0;
    row(v).xrdInStake += amountOf(h) * rate;
  }

  // Claim NFTs: unstaking until their claim epoch, claimable from it.
  for (const h of nonFungibles) {
    const v = byClaim.get(h.resource_address);
    if (!v) continue;
    const ids = (h.vaults?.items ?? []).flatMap((x) => x.items ?? []);
    for (const batch of chunks(ids, 100)) {
      const r = await post<{ non_fungible_ids?: Record<string, unknown>[] }>(network, '/state/non-fungible/data', {
        resource_address: h.resource_address, non_fungible_ids: batch, at_ledger_state: at,
      });
      for (const nft of r.non_fungible_ids ?? []) {
        const { amount, epoch } = parseClaimNft(nft);
        const entry = row(v);
        if (epoch > ledger.epoch) {
          entry.xrdInUnstake += amount;
          entry.unstakes.push({ amount, epoch });
        } else {
          entry.xrdInClaim += amount;
        }
      }
    }
  }

  return {
    day,
    ledger,
    entity: { ...item, ledger_state: ledger },
    stakingRows: [...rows.values()].sort((a, b) => b.xrdInStake - a.xrdInStake),
  };
}
