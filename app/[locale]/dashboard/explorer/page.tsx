import type { Metadata } from 'next';
import {
  DashboardPageShell,
  getDashboardDictionary,
} from '@/features/dashboard/server/dashboardPage';
import type { RawSearchParams } from '@/features/dashboard/lib/routes';
import { buildMetadata } from '@/lib/seo';

/** Heavy data is cached in the service layer; the page itself stays dynamic. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getDashboardDictionary(locale);
  return buildMetadata({
    locale,
    pathname: '/dashboard/explorer',
    title: t.seo.dashboard.title,
    description: t.seo.dashboard.description,
  });
}

/** Transaction explorer. The route decides the view; the shell does the rest. */
export default async function ExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  return <DashboardPageShell locale={locale} view="transactions" searchParams={search} />;
}
