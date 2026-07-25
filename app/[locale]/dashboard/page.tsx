import { permanentRedirect } from 'next/navigation';
import { legacyDashboardRedirect } from '@/features/dashboard/lib/routes';
import type { RawSearchParams } from '@/features/dashboard/lib/routes';

/**
 * `/dashboard` is no longer a page: it resolves to a canonical path.
 *
 * Every dashboard view now has its own URL (`/staking`, `/explorer`), so the
 * bare route exists to keep the links already out in the wild working. Old
 * `?view=transactions&tx=…` URLs are translated to their canonical equivalent
 * and redirected PERMANENTLY (308), which both preserves shared links and tells
 * search engines the address moved instead of leaving duplicates indexed.
 */
export const dynamic = 'force-dynamic';

export default async function DashboardIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  permanentRedirect(legacyDashboardRedirect(locale, search));
}
