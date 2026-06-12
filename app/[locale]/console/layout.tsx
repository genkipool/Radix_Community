import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { SuspenseSidebarFallback } from '@/components/ui/SuspenseSidebarFallback';
import ConsoleShell from '@/features/console/ConsoleShell';
import { CONSOLE_GROUPS } from '@/features/console/data/consoleTools';

interface ConsoleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// Reading cookies() opts the console into per-request rendering so the sidebar
// expand/collapse state is already correct in the initial HTML (same pattern
// as the docs page — no flash on reload).
export default async function ConsoleLayout({ children, params }: ConsoleLayoutProps) {
  const { locale } = await params;
  const [cookieStore, t] = await Promise.all([
    cookies(),
    getFeatureDictionary(locale as Locale, ['console']),
  ]);

  const initialAutoCollapse = cookieStore.get('console_auto_collapse')?.value === 'true';
  // All groups start expanded the first time; afterwards the cookie wins
  // (including the empty string a collapse-all writes).
  const openGroupsCookie = cookieStore.get('console_open_groups');
  const initialExpandedGroups = openGroupsCookie
    ? openGroupsCookie.value
    : CONSOLE_GROUPS.map((group) => group.id).join(',');
  const initialFlatView = cookieStore.get('console_flat_view')?.value === 'true';

  return (
    <Suspense fallback={<SuspenseSidebarFallback />}>
      <DictionaryEnricher partial={t} />
      <ConsoleShell
        dictionary={t}
        initialAutoCollapse={initialAutoCollapse}
        initialExpandedGroups={initialExpandedGroups}
        initialFlatView={initialFlatView}
      >
        {children}
      </ConsoleShell>
    </Suspense>
  );
}
