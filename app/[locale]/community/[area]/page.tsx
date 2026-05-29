import { AREAS } from '@/features/community/data/communityData';

export const metadata = {
  title: 'Community',
};

// ═══════ SSG — generateStaticParams ═══════
// Pre-renders one URL per locale × area segment and the admin panel:
//   /en/community/development  /es/community/development
//   /en/community/marketing    /es/community/marketing
//   …
//   /en/community/admin        /es/community/admin
//
// All rendering is handled by the parent community layout (CommunityClient).
// CommunityClient reads usePathname() to derive the active segment on load.
export async function generateStaticParams() {
    const locales = ['en', 'es'];
    const segments = [...AREAS.map(a => a.id), 'admin'];

    return locales.flatMap(locale =>
        segments.map(area => ({ locale, area }))
    );
}

export default function CommunityAreaPage() {
    return null;
}
