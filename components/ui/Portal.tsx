'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portal component
 *
 * Renders children into a portal at the document body to escape
 * parent stacking contexts (overflow, z-index, etc.).
 *
 * Prevents hydration mismatches by only rendering on the client.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
