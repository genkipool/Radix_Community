'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentVerify } from '../hooks/useDocumentVerify';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { looksLikeEnvelope } from '../lib/certificate';
import { networkIdFromResource } from '../lib/network';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import { parseRequestKey } from '../lib/share';
import { requestKey as formatRequestKey } from '../lib/sign-request';
import { fetchOnChainStatus } from '../services/signApi';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope } from '../types/sign.types';
import { VerifyOnChainCard } from './verify/VerifyOnChainCard';
import { VerifyOutcomeCard } from './verify/VerifyOutcomeCard';

export function VerifyForm({
  t,
  doc,
  initialRequestKey,
}: {
  t: SignDictionary;
  doc: DocumentFile;
  initialRequestKey?: string;
}) {
  const { bytes, docHash } = doc;
  const { activeNetworkId } = useRadixWallet();

  const [certFile, setCertFile] = useState<File | null>(null);
  const [envelope, setEnvelope] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  const [keyInput, setKeyInput] = useState(initialRequestKey ?? '');
  const [embedded, setEmbedded] = useState(false);
  const [verifyBytes, setVerifyBytes] = useState<Uint8Array | null>(null);

  const { verify, isVerifying, outcome, reset } = useDocumentVerify();
  const verifyRef = useRef(verify);
  const resetRef = useRef(reset);
  const envelopeFromPdfRef = useRef(false);

  // Auto-detect a signed PDF in the shared dropzone: extract embedded
  // certificate + intact original so the delivered PDF verifies on its own.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes) {
        if (!cancelled) {
          if (envelopeFromPdfRef.current) {
            envelopeFromPdfRef.current = false;
            setEnvelope(null);
          }
          setEmbedded(false);
          setVerifyBytes(null);
          resetRef.current();
        }
        return;
      }
      if (!isPdfBytes(bytes)) {
        if (!cancelled) {
          setEmbedded(false);
          setVerifyBytes(bytes);
        }
        return;
      }
      const att = await extractRadixAttachments(bytes).catch(() => null);
      if (cancelled) return;
      if (att?.envelope) {
        envelopeFromPdfRef.current = true;
        setEnvelope(att.envelope);
        setCertFile(null);
        setCertError('');
        setEmbedded(true);
        setVerifyBytes(att.originalBytes ?? bytes);
      } else {
        setEmbedded(false);
        setVerifyBytes(bytes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  const effectiveDocHash = envelope?.payload.docHash ?? docHash;

  const typedKey = keyInput.trim();
  const rawRequestId =
    typedKey ||
    envelope?.request?.requestId ||
    doc.embeddedRequest?.requestKey ||
    '';
  const parsedKey = parseRequestKey(rawRequestId);
  const requestId = parsedKey
    ? formatRequestKey(parsedKey.collection, Number(parsedKey.id))
    : undefined;
  const invalidKey = !!typedKey && !parseRequestKey(typedKey);

  const overrideRequestId =
    typedKey && parsedKey
      ? formatRequestKey(parsedKey.collection, Number(parsedKey.id))
      : '';
  const overrideNetworkId = parsedKey
    ? networkIdFromResource(parsedKey.collection)
    : null;
  const queryNetworkId =
    (parsedKey ? networkIdFromResource(parsedKey.collection) : null) ??
    envelope?.payload.networkId ??
    doc.embeddedRequest?.networkId ??
    activeNetworkId ??
    null;

  const onchainQuery = useQuery({
    queryKey: ['verify-onchain', queryNetworkId, effectiveDocHash, requestId],
    queryFn: () =>
      fetchOnChainStatus({
        networkId: queryNetworkId!,
        docHash: effectiveDocHash || undefined,
        requestId,
      }),
    enabled: !!requestId && queryNetworkId != null,
  });
  const onchain = onchainQuery.data?.found ? onchainQuery.data : null;
  const onchainHashMismatch =
    !!onchain?.docHash &&
    !!effectiveDocHash &&
    onchain.docHash !== effectiveDocHash;

  const onCert = async (picked: File | null) => {
    reset();
    setCertError('');
    envelopeFromPdfRef.current = false;
    setEnvelope(null);
    setEmbedded(false);
    setCertFile(picked);
    if (!picked) return;
    try {
      const parsed = JSON.parse(await picked.text());
      if (!looksLikeEnvelope(parsed)) {
        setCertError(t.verify.badCert);
        return;
      }
      setEnvelope(parsed);
    } catch {
      setCertError(t.verify.badCert);
    }
  };

  const verifyTarget = verifyBytes ?? bytes;
  const lastVerifiedRef = useRef<{
    target: Uint8Array;
    env: AttestationEnvelope;
    key: string;
  } | null>(null);
  useEffect(() => {
    if (!verifyTarget || !envelope) {
      lastVerifiedRef.current = null;
      return;
    }
    if (
      lastVerifiedRef.current?.target === verifyTarget &&
      lastVerifiedRef.current?.env === envelope &&
      lastVerifiedRef.current?.key === overrideRequestId
    ) {
      return;
    }
    lastVerifiedRef.current = {
      target: verifyTarget,
      env: envelope,
      key: overrideRequestId,
    };
    void verifyRef.current(
      verifyTarget,
      envelope,
      overrideRequestId && overrideNetworkId != null
        ? { networkId: overrideNetworkId, requestId: overrideRequestId }
        : null,
    );
  }, [verifyTarget, envelope, overrideRequestId, overrideNetworkId]);

  return (
    <div className="space-y-5">
      <VerifyOnChainCard
        t={t}
        keyInput={keyInput}
        onKeyInputChange={setKeyInput}
        invalidKey={invalidKey}
        requestId={requestId}
        onchain={onchain}
        isFetching={onchainQuery.isFetching}
        notFound={
          !!requestId &&
          !onchainQuery.isFetching &&
          onchainQuery.data?.found === false
        }
        hasFileBytes={!!bytes}
        effectiveDocHash={effectiveDocHash}
        onchainHashMismatch={onchainHashMismatch}
        onRefresh={() => onchainQuery.refetch()}
      />

      <ToolSection title={t.verify.certLabel}>
        {embedded ? (
          <p
            className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          >
            <BadgeCheck className="size-4 text-[var(--color-success)] shrink-0" />
            {t.verify.embeddedDetected}
          </p>
        ) : (
          <FileDropzone
            extension=".json"
            label=""
            prompt={t.verify.certPrompt}
            file={certFile}
            onFile={onCert}
            error={certError}
            disabled={isVerifying}
          />
        )}
        {isVerifying && (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="size-4 rounded-full border-2 border-current/40 border-t-transparent animate-spin" />
            {t.verify.verifying}
          </p>
        )}
      </ToolSection>

      {outcome && <VerifyOutcomeCard t={t} outcome={outcome} />}
    </div>
  );
}
