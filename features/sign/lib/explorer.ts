/**
 * Links into THIS project's transaction explorer (not the official dashboard).
 * The explorer lives on the dashboard page and filters by `?tx=<intentHash>`.
 */
export function explorerTxUrl(locale: string, transactionIntentHash: string): string {
  return `/${locale}/dashboard?view=transactions&tx=${encodeURIComponent(
    transactionIntentHash,
  )}`;
}
