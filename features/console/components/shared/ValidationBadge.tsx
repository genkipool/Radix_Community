'use client';

import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { ManifestValidation } from '../../hooks/useManifestValidation';
import type { ConsoleDictionary } from '../../types/i18n.types';

interface ValidationBadgeProps {
  t: ConsoleDictionary['validation'];
  validation: ManifestValidation;
}

/** Inline static-validation status shown under a manifest editor. */
export function ValidationBadge({ t, validation }: ValidationBadgeProps) {
  if (validation.status === 'idle') return null;

  if (validation.status === 'checking') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span className="size-3 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        {t.checking}
      </p>
    );
  }

  if (validation.status === 'valid') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500" title={t.validHint}>
        <CheckCircle2 className="size-3.5" />
        {t.valid}
      </p>
    );
  }

  return (
    <div className="flex items-start gap-1.5 text-xs">
      <CircleAlert className="size-3.5 shrink-0 text-red-500 mt-0.5" />
      <p className="min-w-0">
        <span className="font-semibold text-red-500">{t.invalid}</span>
        {validation.error && (
          <span className="block font-mono break-words mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {validation.error}
          </span>
        )}
      </p>
    </div>
  );
}
