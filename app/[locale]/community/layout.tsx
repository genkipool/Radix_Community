import { Suspense } from 'react';
import CommunityClient from '@/features/community/CommunityClient';
import { SuspenseSidebarFallback } from '@/components/ui/SuspenseSidebarFallback';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';

// ═══════ Community Layout ═══════
// Placing CommunityClient here (in the layout rather than the page) ensures it
// is NEVER unmounted when the user navigates between community sub-routes
// (/community, /community/development, /community/admin, …).
//
// Next.js preserves layout components across route changes that share the same
// layout segment. The page files under this layout only exist to register static
// params for SSG — their render output is intentionally null.
//
// CommunityClient uses useSearchParams() via useCommunityURLState, so it must
// be wrapped in Suspense to allow static generation of the shell HTML.
//
// Navigation flow:
//   Click card  → useCommunityURLState updates state instantly + pushes URL in background
//   Direct load → CommunityClient reads useSearchParams() to derive the active area
//   Back/fwd    → useCommunityURLState's useEffect syncs searchParams → local state
export default async function CommunityLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    // children comes from the page files, which return null — we intentionally
    // do not render it here since CommunityClient owns all community UI.
    void children;
    const { locale } = await params;
    const t = await getFeatureDictionary(locale as Locale, ['community']);

    return (
        <Suspense fallback={<SuspenseSidebarFallback />}>
            <DictionaryEnricher partial={t} />
            <CommunityClient />
        </Suspense>
    );
}
