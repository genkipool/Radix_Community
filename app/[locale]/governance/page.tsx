import type { Metadata } from 'next';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

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

/** The overview itself lives in the governance layout (see GovernanceShell), so it can fold away above a vote. */
export default function GovernancePage() {
    return null;
}
