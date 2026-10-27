'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Dictionary } from '@/i18n';
import ConsoleHome from './components/ConsoleHome';
import ConsoleSidebar from './components/ConsoleSidebar';
import ConsoleToolView from './components/ConsoleToolView';
import { isConsoleToolSlug, type ConsoleToolSlug } from './types/console.types';
import { ConsoleDictionaryProvider } from './ConsoleDictionary';
import { ConsoleNavProvider } from './ConsoleNav';
import { setPendingConsoleQuery } from './lib/console-query';
import { useLanguage } from '@/context/LanguageContext';

interface ConsoleShellProps {
  children: ReactNode;
  dictionary: Partial<Dictionary>;
  initialAutoCollapse: boolean;
  initialExpandedGroups: string;
  initialFlatView: boolean;
  /** Comma-separated favourite tool slugs, from the cookie. */
  initialFavorites: string;
  initialFavoritesOnly: boolean;
}

/** Extracts the active tool slug from `/{locale}/console/{slug}` paths. */
function slugFromPathname(pathname: string): ConsoleToolSlug | null {
  const segments = pathname.split('/').filter(Boolean);
  const consoleIndex = segments.indexOf('console');
  if (consoleIndex === -1) return null;
  const candidate = segments[consoleIndex + 1];
  return candidate && isConsoleToolSlug(candidate) ? candidate : null;
}

/** True for the tool page itself (`/{locale}/console/{slug}`), not for deeper routes under it. */
function isToolPage(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const consoleIndex = segments.indexOf('console');
  return consoleIndex !== -1 && segments.length === consoleIndex + 2;
}

/**
 * Console layout shell — persistent sidebar (docs-style), the landing and the
 * open tool. The tool is drawn here, from the slug, rather than by its route:
 * picking one shows it on the click, as Docs shows a doc, while the route
 * (metadata, structured data) catches up behind it.
 */
export default function ConsoleShell({
  children,
  dictionary,
  initialAutoCollapse,
  initialExpandedGroups,
  initialFlatView,
  initialFavorites,
  initialFavoritesOnly,
}: ConsoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();

  const currentSlug = slugFromPathname(pathname);
  // navigate() moves the URL on the click, but the router takes a moment to
  // report it; meanwhile the picked tool shows. The pick is spent as soon as
  // the router catches up, or as soon as the user goes back or forward.
  const [picked, setPicked] = useState<{ slug: ConsoleToolSlug | null; to: string } | null>(null);
  if (picked && picked.to === pathname) setPicked(null);
  const routeTool = currentSlug && isToolPage(pathname) ? currentSlug : null;
  const shownTool = picked ? picked.slug : routeTool;
  const shownSlug = picked ? picked.slug : currentSlug;

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      setPicked(null);
      // An entry whose route never finished loading (left with the back
      // button straight away) has no router state: load it now, in place.
      if (!(e.state as { __NA?: boolean } | null)?.__NA) {
        router.replace(window.location.pathname + window.location.search, { scroll: false });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [router]);

  // The landing is the one place every tool returns to: keep it warm.
  useEffect(() => {
    router.prefetch(`/${language}/console`);
  }, [router, language]);

  const navigate = (slug: ConsoleToolSlug | null, query = '') => {
    const target = slug ? `/${language}/console/${slug}` : `/${language}/console`;
    // Already there: there is nothing to show or load.
    if (!query && pathname === target) return;
    const url = query ? `${target}?${query}` : target;
    // The tool may mount before the router has caught up: hand it its query directly.
    setPendingConsoleQuery(query);
    // The history entry goes in on the click, not when the route has loaded
    // (seconds, the first time in development): otherwise the back button,
    // pressed meanwhile, skips the page the user just left. Moving the URL
    // also shows the tool at once. The router then loads the route
    // (metadata, structured data) into that same entry.
    window.history.pushState(null, '', url);
    setPicked({ slug, to: target });
    router.replace(url, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectTool = (slug: ConsoleToolSlug) => navigate(slug);
  const handleHomeClick = () => navigate(null);

  return (
    <ConsoleDictionaryProvider dictionary={dictionary}>
      <ConsoleNavProvider value={navigate}>
        <div
          className="flex flex-col md:flex-row w-full flex-1"
          style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingTop: '80px' }}
        >
          <ConsoleSidebar
            dictionary={dictionary}
            selectedSlug={shownSlug}
            onSelectTool={handleSelectTool}
            onHomeClick={handleHomeClick}
            initialAutoCollapse={initialAutoCollapse}
            initialExpandedGroups={initialExpandedGroups}
            initialFlatView={initialFlatView}
            initialFavorites={initialFavorites}
            initialFavoritesOnly={initialFavoritesOnly}
          />
          <main className="flex-1 relative min-w-0" style={{ overflowX: 'clip' }}>
            {/* The landing stays mounted and folds up when a tool opens, so the
                tool, already rendered below it, rises into place as in Docs. */}
            <ConsoleHome
              dictionary={dictionary}
              collapsed={shownSlug !== null}
              onOpenTool={handleSelectTool}
            />
            {shownTool && <ConsoleToolView key={shownTool} slug={shownTool} dictionary={dictionary} />}
            {children}
          </main>
        </div>
      </ConsoleNavProvider>
    </ConsoleDictionaryProvider>
  );
}
