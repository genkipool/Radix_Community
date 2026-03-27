'use client';
/**
 * InfraReadButton — Client Component (boundary)
 *
 * Owns only the single useState needed to open/close InfrastructureModal.
 * Instituciones.tsx can be a pure RSC because all its client state lives here.
 */
import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
const InfrastructureModal = dynamic(() => import('@/features/infrastructure/InfrastructureModal').then(mod => mod.InfrastructureModal), {
  ssr: false,
});

import type { InfraReadButtonProps } from '../../../types';

export default function InfraReadButton({ label, className: _className }: InfraReadButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex justify-center items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
      >
        <BookOpen className="w-5 h-5 shrink-0" />
        {label}
      </button>
      <InfrastructureModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
