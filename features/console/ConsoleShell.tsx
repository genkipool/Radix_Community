'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/i18n';
import ConsoleSidebar from './components/ConsoleSidebar';
import ConsoleToolView from './components/ConsoleToolView';
import { isConsoleToolSlug, type ConsoleToolSlug } from './types/console.types';
import { useLanguage } from '@/context/LanguageContext';

interface ConsoleShellProps {
  children: ReactNode;
  dictionary: Partial<Dictionary>;
  initialAutoCollapse: boolean;
  initialExpandedGroups: string;
  initialFlatView: boolean;
}

/** Extracts the active tool slug from `/{locale}/console/{slug}` paths. */
function slugFromPathname(pathname: string): ConsoleToolSlug | null {
  const segments = pathname.split('/').filter(Boolean);
  const consoleIndex = segments.indexOf('console');
  if (consoleIndex === -1) return null;
  const candidate = segments[consoleIndex + 1];
  return candidate && isConsoleToolSlug(candidate) ? candidate : null;
}

/**
 * Console layout shell — persistent sidebar (docs-style) with the active
 * tool rendered in the main area via nested routes.
 */
export default function ConsoleShell({
  children,
  dictionary,
  initialAutoCollapse,
  initialExpandedGroups,
  initialFlatView,
}: ConsoleShellProps) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [activeSlug, setActiveSlug] = useState<ConsoleToolSlug | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setActiveSlug(slugFromPathname(pathname));
  }

  const handleSelectTool = (slug: ConsoleToolSlug) => {
    setActiveSlug(slug);
    const href = `/${language}/console/${slug}`;
    window.history.pushState(null, '', href);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleHomeClick = () => {
    setActiveSlug(null);
    window.history.pushState(null, '', `/${language}/console`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Use the active client state if available, fallback to path-derived slug
  const currentSlug = activeSlug ?? slugFromPathname(pathname);

  return (
    <div
      className="flex flex-col md:flex-row w-full flex-1"
      style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingTop: '80px' }}
    >
      <ConsoleSidebar
        dictionary={dictionary}
        selectedSlug={currentSlug}
        onSelectTool={handleSelectTool}
        onHomeClick={handleHomeClick}
        initialAutoCollapse={initialAutoCollapse}
        initialExpandedGroups={initialExpandedGroups}
        initialFlatView={initialFlatView}
      />
      <main className="flex-1 relative min-w-0" style={{ overflowX: 'clip' }}>
        {activeSlug ? <ConsoleToolView slug={activeSlug} dictionary={dictionary} /> : children}
      </main>
    </div>
  );
}
