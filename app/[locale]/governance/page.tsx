import type { Metadata } from 'next';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';
import { GovernanceOverview } from '@/features/governance/components/GovernanceOverview';
import { loadGovernanceList } from '@/features/governance/services/governanceRoute.server';

/** Ledger data is cached for minutes in the service layer; the page stays dynamic. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getFeatureDictionary(locale as Locale, ['governance']);
    return buildMetadata({
        locale,
        pathname: '/governance',
        title: t.seo.governance.title,
        description: t.seo.governance.description,
        keywords: t.seo.governance.keywords,
    });
}

export default async function GovernancePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const [t, { entries, serverNow }] = await Promise.all([
        getFeatureDictionary(locale as Locale, ['governance']),
        loadGovernanceList(locale),
    ]);
    return <GovernanceOverview entries={entries} g={t.governance} language={locale} serverNow={serverNow} />;
}
