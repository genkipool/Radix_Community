import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';
import { GovernanceDetail } from '@/features/governance/components/GovernanceDetail';
import { resolveGovernanceRoute, type GovernanceRouteParams } from '@/features/governance/services/governanceRoute.server';
import { renderProposalMarkdown } from '@/features/governance/lib/markdown.server';
import { governanceItemPath } from '@/features/governance/lib/paths';
import { getCachedTranslation } from '@/features/governance/services/translation.server';

/** Ledger data is cached for minutes in the service layer; the page stays dynamic. */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<GovernanceRouteParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const p = await params;
    const [t, route] = await Promise.all([getFeatureDictionary(p.locale as Locale, ['governance']), resolveGovernanceRoute(p)]);
    if (!route) return { title: t.seo.governance.title, robots: { index: false } };
    const { entry, system } = route;
    const kindLabel = entry.kind === 'proposal' ? t.governance.vote.kind_proposal : t.governance.vote.kind_temperature_check;
    return buildMetadata({
        locale: p.locale,
        pathname: governanceItemPath(system.key, entry.kind, entry.id),
        title: `${entry.item.title ?? `#${entry.id}`} | ${kindLabel} #${entry.id} · ${system.name}`,
        description: entry.item.shortDescription ?? t.seo.governance.description,
        type: 'article',
    });
}

export default async function GovernanceItemPage({ params }: Props) {
    const p = await params;
    const [t, route] = await Promise.all([getFeatureDictionary(p.locale as Locale, ['governance']), resolveGovernanceRoute(p)]);
    if (!route) notFound();
    const { entry, system, serverNow } = route;
    // A stored translation is served with the page; otherwise the client asks for one.
    const cached = p.locale !== 'en' ? await getCachedTranslation(entry.item, p.locale) : null;
    const initialTranslation = cached
        ? { status: 'ready' as const, title: cached.title, shortDescription: cached.shortDescription, options: cached.options, descriptionHtml: renderProposalMarkdown(cached.description) }
        : null;

    return (
        <GovernanceDetail
            entry={{ ...entry, item: { ...entry.item, description: null } }}
            system={system}
            descriptionHtml={renderProposalMarkdown(entry.item.description)}
            g={t.governance}
            language={p.locale}
            serverNow={serverNow}
            initialTranslation={initialTranslation}
        />
    );
}
