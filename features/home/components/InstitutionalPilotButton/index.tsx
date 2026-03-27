'use client';

import { useLayout } from '@/context/LayoutContext';
import type { InstitutionalPilotButtonProps } from '../../types';

export default function InstitutionalPilotButton({ label, className }: InstitutionalPilotButtonProps) {
  const { setShowInstitutionalPilot } = useLayout();

  return (
    <button
      type="button"
      onClick={() => setShowInstitutionalPilot(true)}
      className={className}
    >
      {label}
    </button>
  );
}
