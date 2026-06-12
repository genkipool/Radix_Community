'use client';

import { useEffect, useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';

export type ManifestValidation =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid' }
  | { status: 'invalid'; error: string };

const VALIDATE_DEBOUNCE_MS = 700;

/**
 * Debounced static validation of a manifest against the Radix Engine Toolkit
 * (syntax + instruction-level checks, no execution).
 */
export function useManifestValidation(manifest: string): ManifestValidation {
  const { activeNetwork } = useRadixWallet();
  const [validation, setValidation] = useState<ManifestValidation>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const isEmpty = !manifest.trim();

    // All state updates happen inside the timer (never synchronously in the effect)
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (isEmpty) {
        setValidation({ status: 'idle' });
        return;
      }
      setValidation({ status: 'checking' });
      try {
        const res = await fetch('/api/ret/validate-manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest, network: activeNetwork }),
        });
        const data = (await res.json()) as { valid?: boolean; error?: string };
        if (cancelled) return;
        setValidation(
          data.valid ? { status: 'valid' } : { status: 'invalid', error: data.error ?? '' },
        );
      } catch {
        if (!cancelled) setValidation({ status: 'idle' });
      }
    }, isEmpty ? 0 : VALIDATE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [manifest, activeNetwork]);

  return validation;
}
