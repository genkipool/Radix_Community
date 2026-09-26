/**
 * Share card for one vote: its title, what kind of vote it is and where, and
 * how it stands (voters, turnout and share in favour when the tally is known).
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, headline, OG_SIZE, OG_CONTENT_TYPE, type OgStat } from '@/lib/og-card';
import { resolveGovernanceRoute, type GovernanceRouteParams } from '@/features/governance/services/governanceRoute.server';
import { fetchVoteTally } from '@/features/governance/services/voteCollector.server';
import { itemChoices, summarizeTally, uniqueVoters, votingPhase } from '@/features/governance/lib/governanceVotes';
import { formatPct, formatXrd } from '@/features/governance/lib/format';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Governance';

export default async function Image({ params }: { params: Promise<GovernanceRouteParams> }) {
    const p = await params;
    const [t, route] = await Promise.all([getFeatureDictionary(p.locale as Locale, ['governance']), resolveGovernanceRoute(p)]);
    const g = t.governance;
    if (!route) return ogCard({ title: headline(t.seo.governance.title), subtitle: t.seo.governance.description });

    const { entry, system } = route;
    const { item, kind } = entry;
    const phase = votingPhase(item, Date.now() / 1000);
    const kindLabel = kind === 'proposal' ? g.vote.kind_proposal : g.vote.kind_temperature_check;
    const tallyData = await fetchVoteTally(system.component, kind, entry.id).catch(() => null);
    const tally = tallyData ? summarizeTally(itemChoices(kind, item, s => (g.vote.stances as Record<string, string>)[s] || s), tallyData, item) : null;

    const stats: OgStat[] = [];
    const voters = uniqueVoters(item);
    if (voters !== null) stats.push({ label: g.kpi_voters, value: voters.toLocaleString(p.locale) });
    if (tally) {
        stats.push({ label: g.kpi_turnout, value: `${formatXrd(tally.turnout, p.locale)} XRD` });
        if (tally.approvalShare !== null) stats.push({ label: g.kpi_support, value: formatPct(tally.approvalShare, p.locale) });
    }

    return ogCard({
        title: item.title ?? `${kindLabel} #${entry.id}`,
        // The status goes in the subtitle: the card's badge is styled as a warning.
        subtitle: [`${kindLabel} #${entry.id}`, system.name, { open: g.og_open, upcoming: g.og_upcoming, closed: g.og_closed, unknown: '' }[phase]]
            .filter(Boolean).join(' · '),
        stats: stats.length ? stats : undefined,
    });
}
