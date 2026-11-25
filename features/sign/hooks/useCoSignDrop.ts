'use client';

import { useEffect, useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { isFullySigned, looksLikeEnvelope } from '../lib/certificate';
import { blake2b256Hex } from '../lib/hash';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import type { WatermarkOptions } from '../lib/pdf-watermark';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope } from '../types/sign.types';
import { useSealSetup, useSealSetups } from './useSealRequest';

/**
 * Manages co-sign certificate loading (from a dropped signed PDF or manual
 * `.json` file), extracted original bytes/hash/watermark, and on-ledger
 * co-signer Seal/collection eligibility checks.
 */
export function useCoSignDrop({
  t,
  bytes,
  docHash,
  onResetSign,
}: {
  t: SignDictionary;
  bytes: Uint8Array | null;
  docHash: string;
  onResetSign: () => void;
}) {
  const { accounts } = useRadixWallet();
  const [certFile, setCertFile] = useState<File | null>(null);
  const [loadedCert, setLoadedCert] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  const [coSignBytes, setCoSignBytes] = useState<Uint8Array | null>(null);
  const [coSignHash, setCoSignHash] = useState('');
  const [inheritedWatermark, setInheritedWatermark] =
    useState<WatermarkOptions | null>(null);
  const [blockedAccount, setBlockedAccount] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes) {
        if (!cancelled) {
          setCoSignBytes(null);
          setCoSignHash('');
        }
        return;
      }
      if (isPdfBytes(bytes)) {
        const att = await extractRadixAttachments(bytes).catch(() => null);
        if (cancelled) return;
        if (att?.envelope) {
          const original = att.originalBytes ?? bytes;
          setLoadedCert(att.envelope);
          setCertFile(null);
          setCertError('');
          setCoSignBytes(original);
          setCoSignHash(blake2b256Hex(original));
          setInheritedWatermark(att.watermark);
          return;
        }
      }
      if (!cancelled) {
        setCoSignBytes(bytes);
        setCoSignHash(docHash);
        setInheritedWatermark(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, docHash]);

  const onCert = async (picked: File | null) => {
    setCertError('');
    onResetSign();
    setCertFile(picked);
    if (!picked) {
      setLoadedCert(null);
      return;
    }
    try {
      const parsed = JSON.parse(await picked.text());
      if (!looksLikeEnvelope(parsed)) {
        setCertError(t.cosign.fileMismatch);
        setLoadedCert(null);
        return;
      }
      setLoadedCert(parsed);
    } catch {
      setCertError(t.cosign.fileMismatch);
      setLoadedCert(null);
    }
  };

  const resetCert = () => {
    setCertFile(null);
    setLoadedCert(null);
    setCertError('');
    setBlockedAccount(null);
  };

  const coSignMode = !!loadedCert;
  const coSignComplete =
    coSignMode &&
    loadedCert!.payload.signers.length > 0 &&
    isFullySigned(loadedCert!);

  const cosignRequest = coSignMode ? (loadedCert!.request ?? null) : null;
  const cosignRequired = coSignMode ? loadedCert!.payload.signers : [];
  const cosignCandidates = accounts
    .map((a) => a.address)
    .filter((a) => cosignRequired.length === 0 || cosignRequired.includes(a))
    .slice(0, 8);
  const cosignEligible = useSealSetups(cosignCandidates, !!cosignRequest);
  const cosignAccount =
    blockedAccount ?? cosignEligible.ready[0] ?? cosignCandidates[0] ?? null;
  const cosignSetup = useSealSetup(cosignRequest ? cosignAccount : null);
  const cosignNeedsSetup =
    !!cosignRequest &&
    !!cosignAccount &&
    cosignEligible.resolved &&
    cosignEligible.ready.length === 0;

  return {
    certFile,
    loadedCert,
    certError,
    coSignBytes,
    coSignHash,
    inheritedWatermark,
    blockedAccount,
    setBlockedAccount,
    onCert,
    resetCert,
    coSignMode,
    coSignComplete,
    cosignRequest,
    cosignCandidates,
    cosignEligible,
    cosignAccount,
    cosignSetup,
    cosignNeedsSetup,
  };
}
