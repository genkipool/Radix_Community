/**
 * Links into THIS project's transaction explorer (not the official Radix
 * dashboard). Delegates to the dashboard's route contract so the URL shape is
 * defined in exactly one place.
 */
import { dashboardRoutes } from '@/features/dashboard/lib/routes';

export function explorerTxUrl(locale: string, transactionIntentHash: string): string {
  return dashboardRoutes.entity(locale, transactionIntentHash);
}
