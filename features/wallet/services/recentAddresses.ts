'use client';

/**
 * Accounts this wallet has actually dealt with lately, read from the ledger.
 *
 * The agenda only knows what you saved by hand, which is the wrong way round:
 * the address you want to keep is almost always one you just sent to or
 * received from. The Gateway can answer that directly, so nothing is stored
 * locally and nothing has to be maintained.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';

export interface RecentAddress {
  address: string;
  /** When it last appeared in a transaction of yours. */
  lastSeen: Date;
  /** How many of your transactions in the window touched it. */
  count: number;
}

interface StreamItem {
  confirmed_at?: string;
  affected_global_entities?: string[];
}

/** Only accounts: resources, components and validators are not contacts. */
const isAccount = (address: string) => address.startsWith('account_');

/**
 * The accounts seen in this wallet's transactions over the last `days`, most
 * recent first. Your own accounts are excluded — they are not contacts.
 */
export async function fetchRecentAddresses(options: {
  network: Network;
  /** The wallet's own accounts: the filter subject, and excluded from results. */
  accounts: string[];
  days?: number;
  limit?: number;
}): Promise<RecentAddress[]> {
  const { network, accounts, days = 30, limit = 50 } = options;
  if (accounts.length === 0) return [];

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const own = new Set(accounts);
  const seen = new Map<string, RecentAddress>();

  /**
   * ONE request per account. `affected_global_entities_filter` narrows to
   * transactions touching EVERY address in the list, so passing the whole
   * wallet asks for transactions that involved all of your accounts at once —
   * usually none, which is why the tab came back empty. The explorer's own
   * address search fetches per address and merges for the same reason.
   */
  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      const items: StreamItem[] = [];
      let cursor: string | undefined;
      // A couple of pages per account is plenty for 50 contacts and bounds the
      // work on a busy account.
      for (let page = 0; page < 3; page += 1) {
        const response = await gatewayPost<{
          items?: StreamItem[];
          next_cursor?: string;
        }>(network, '/stream/transactions', {
          affected_global_entities_filter: [account],
          from_ledger_state: { timestamp: from.toISOString() },
          opt_ins: { affected_global_entities: true },
          limit_per_page: 100,
          ...(cursor ? { cursor } : {}),
        });
        items.push(...(response.items ?? []));
        cursor = response.next_cursor;
        if (!cursor) break;
      }
      return items;
    }),
  );

  for (const item of perAccount.flat()) {
    const at = item.confirmed_at ? new Date(item.confirmed_at) : new Date();
    for (const entity of item.affected_global_entities ?? []) {
      if (!isAccount(entity) || own.has(entity)) continue;
      const previous = seen.get(entity);
      if (previous) {
        previous.count += 1;
        if (at > previous.lastSeen) previous.lastSeen = at;
      } else {
        seen.set(entity, { address: entity, lastSeen: at, count: 1 });
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    .slice(0, limit);
}
