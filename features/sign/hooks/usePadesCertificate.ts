'use client';

import { useEffect, useState } from 'react';
import { readP12Info, type P12Info } from '../lib/pdf-pades';
import {
  emptyPadesConfig,
  type PadesConfig,
  type PadesStatus,
} from '../components/PadesSignSection';

/**
 * Manages optional X.509 / PAdES `.p12` certificate state and debounced
 * password validation so signing is blocked before opening the wallet when the
 * certificate or passphrase is invalid.
 */
export function usePadesCertificate(pdfOk: boolean) {
  const [pades, setPades] = useState<PadesConfig>(emptyPadesConfig);
  const [padesError, setPadesError] = useState('');
  const [padesStatus, setPadesStatus] = useState<PadesStatus>('idle');
  const [padesChecking, setPadesChecking] = useState(false);
  const [padesCert, setPadesCert] = useState<P12Info | null>(null);

  useEffect(() => {
    let cancelled = false;
    const file = pades.file;
    const password = pades.password;
    const ready = pades.enabled && !!file && !!password;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!ready || !file) {
        setPadesStatus('idle');
        setPadesError('');
        setPadesCert(null);
        return;
      }
      setPadesChecking(true);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const info = await readP12Info(bytes, password);
        if (cancelled) return;
        setPadesCert(info);
        setPadesStatus(info ? 'valid' : 'invalid');
        setPadesError(info ? '' : 'wrong_password');
      } catch {
        if (cancelled) return;
        setPadesCert(null);
        setPadesStatus('invalid');
        setPadesError('wrong_password');
      } finally {
        if (!cancelled) setPadesChecking(false);
      }
    }, ready ? 400 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pades.enabled, pades.file, pades.password]);

  const padesActive = pades.enabled && pdfOk;
  const padesBlocking = padesActive && padesStatus !== 'valid';

  return {
    pades,
    setPades,
    padesError,
    setPadesError,
    padesStatus,
    padesChecking,
    padesCert,
    padesActive,
    padesBlocking,
  };
}
