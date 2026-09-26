import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { GovernanceShell } from '@/features/governance/components/GovernanceShell';
import { loadGovernanceList } from '@/features/governance/services/governanceRoute.server';
import '@/features/governance/styles/prose.css';

/**
 * Governance section frame: the sidebar with every vote stays mounted while
 * moving between the overview and each vote's page.
 */
export default async function GovernanceLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const [t, { entries, serverNow }] = await Promise.all([
        getFeatureDictionary(locale as Locale, ['governance']),
        loadGovernanceList(locale),
    ]);

    return (
        <>
            <DictionaryEnricher partial={t} />
            <GovernanceShell entries={entries} g={t.governance} language={locale} serverNow={serverNow}>
                {children}
            </GovernanceShell>
        </>
    );
}
