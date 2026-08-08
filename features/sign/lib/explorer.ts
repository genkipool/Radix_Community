/**
 * Links into THIS project's transaction explorer (not the official Radix
 * dashboard). Delegates to the dashboard's route contract so the URL shape is
 * defined in exactly one place.
 */
import { dashboardRoutes } from '@/features/dashboard/lib/routes';

/**
 * A transaction's page. Relative by default (what an in-app `<Link>` wants);
 * pass `origin` for an absolute URL, which is what anything leaving the app —
 * the signed PDF's link annotations, above all — needs.
 */
export function explorerTxUrl(
  locale: string,
  transactionIntentHash: string,
  origin = '',
): string {
  return `${origin}${dashboardRoutes.entity(locale, transactionIntentHash)}`;
}
