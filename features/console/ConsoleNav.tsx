'use client';

import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import type { ConsoleToolSlug } from './types/console.types';

/**
 * Opens a console tool the way the sidebar does: drawn on the click, the URL
 * catching up behind it. `query` (e.g. `validator=…`) reaches the tool
 * through `consoleQueryParam`.
 */
export type OpenConsoleTool = (slug: ConsoleToolSlug, query?: string) => void;

const ConsoleNavContext = createContext<OpenConsoleTool | null>(null);

export const ConsoleNavProvider = ConsoleNavContext.Provider;

export const useOpenConsoleTool = () => useContext(ConsoleNavContext);

interface ConsoleToolLinkProps {
  slug: ConsoleToolSlug;
  query?: string;
  /** The real link, for a new tab or outside the console shell. */
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

/** A link to a console tool that opens it in place; a modified click still opens a new tab. */
export function ConsoleToolLink({ slug, query, href, className, style, children }: ConsoleToolLinkProps) {
  const open = useOpenConsoleTool();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!open || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(slug, query);
  };
  return (
    <a href={href} onClick={onClick} className={className} style={style}>
      {children}
    </a>
  );
}
