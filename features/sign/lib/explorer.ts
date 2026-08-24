/**
 * Links into THIS project's transaction explorer (not the official Radix
 * dashboard). Delegates to the dashboard's route contract so the URL shape is
 * defined in exactly one place.
 */
import { dashboardRoutes, networkOfAddress } from '@/features/dashboard/lib/routes';
import type { Network } from '@/features/dashboard/types';

export interface ExplorerTxUrlOptions {
  /**
   * Absolute origin, for a URL that has to work outside the app — the signed
   * PDF's link annotations above all. Omitted, the URL is relative, which is
   * what an in-app `<Link>` wants.
   */
  origin?: string;
  /**
   * Ledger the transaction lives on. Defaults to the one the hash itself names,
   * which is almost always what you want; pass it only to override.
   */
  network?: Network;
}

/**
 * A transaction's page, on the ledger the transaction actually belongs to.
 *
 * The network is NOT left implicit. Without it the page falls back to whatever
 * the reader's last-used-network cookie says, so a Stokenet transaction opened
 * from a certificate, a chat message or an encrypted-file receipt landed on
 * Mainnet — where that hash does not exist. The hash names its own ledger
 * (`txid_rdx1…` / `txid_tdx_2_1…`), so every link built here can say so.
 */
export function explorerTxUrl(
  locale: string,
  transactionIntentHash: string,
  options: ExplorerTxUrlOptions = {},
): string {
  const { origin = '', network } = options;
  const ledger = network ?? networkOfAddress(transactionIntentHash) ?? undefined;
  return `${origin}${dashboardRoutes.entity(locale, transactionIntentHash, { network: ledger })}`;
}
