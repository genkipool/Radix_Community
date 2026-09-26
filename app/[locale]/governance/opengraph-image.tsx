/**
 * Share card for the governance overview: the page's own title and
 * description, plus how many votes are open right now.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, headline, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';
import { fetchGovernanceEntries } from '@/features/governance/services/governanceLedger.server';
import { votingPhase } from '@/features/governance/lib/governanceVotes';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Governance';

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const [t, entries] = await Promise.all([
        getFeatureDictionary(locale as Locale, ['governance']),
        fetchGovernanceEntries().catch(() => []),
    ]);
    const now = Date.now() / 1000;
    const g = t.governance;
    return ogCard({
        title: headline(t.seo.governance.title),
        subtitle: t.seo.governance.description,
        stats: entries.length
            ? [
                { label: g.stats_open, value: String(entries.filter(e => votingPhase(e.item, now) === 'open').length) },
                { label: g.stats_total, value: String(entries.length) },
            ]
            : undefined,
    });
}
