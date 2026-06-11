'use client';

import { type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { createPortal } from 'react-dom';

/**
 * Portal component
 *
 * Renders children into a portal at the document body to escape
 * parent stacking contexts (overflow, z-index, etc.).
 *
 * Prevents hydration mismatches by only rendering on the client.
 */
export function Portal({ children, target }: { children: ReactNode, target?: HTMLElement }) {
  const mounted = useMounted();

  if (!mounted) return null;

  return createPortal(children, target || document.body);
}
