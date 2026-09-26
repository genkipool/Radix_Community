import { NextRequest, NextResponse, after } from 'next/server';
import { systemByKey } from '@/features/governance/config/systems';
import { kindFromSegment } from '@/features/governance/lib/paths';
import { fetchGovernanceEntry } from '@/features/governance/services/governanceLedger.server';
import { isTranslatable, requestTranslation } from '@/features/governance/services/translation.server';
import { renderProposalMarkdown } from '@/features/governance/lib/markdown.server';

/** Translating a long proposal takes a while; the work runs after the response. */
export const maxDuration = 300;

const NO_STORE = { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' };

/**
 * GET /api/governance-translate?system=…&kind=proposal|temperature-check&id=…&lang=es
 *
 * `ready` with the translated texts (the description already rendered and
 * sanitised), `pending` while it is being produced (poll again), or
 * `unavailable` when translation is not configured for this language.
 */
export async function GET(request: NextRequest) {
    const params = new URL(request.url).searchParams;
    const system = systemByKey(params.get('system') ?? '');
    const kind = kindFromSegment(params.get('kind') ?? '');
    const id = params.get('id') ?? '';
    const lang = params.get('lang') ?? '';
    if (!system || !kind || !/^\d{1,19}$/.test(id) || !isTranslatable(lang)) {
        return NextResponse.json({ status: 'unavailable' }, { status: 400, headers: NO_STORE });
    }

    const entry = await fetchGovernanceEntry(system.key, kind, id).catch(() => null);
    if (!entry || entry.item.hidden) return NextResponse.json({ status: 'unavailable' }, { status: 404, headers: NO_STORE });

    const { state, run } = await requestTranslation(entry.item, lang);
    if (run) after(run);

    if (state.status !== 'ready') return NextResponse.json(state, { headers: NO_STORE });
    const { description, ...rest } = state.translation;
    return NextResponse.json(
        { status: 'ready', ...rest, descriptionHtml: renderProposalMarkdown(description) },
        // A translation of a given text never changes.
        { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
}
