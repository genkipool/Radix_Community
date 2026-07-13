'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Circle, RefreshCw, ShieldCheck, ShieldX, XCircle } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentVerify } from '../hooks/useDocumentVerify';
import { fetchOnChainStatus } from '../services/signApi';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import type { DocumentFile } from '../hooks/useDocumentFile';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope } from '../types/sign.types';

function looksLikeEnvelope(v: unknown): v is AttestationEnvelope {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  const payload = e.payload as Record<string, unknown> | undefined;
  return (
    typeof payload?.docHash === 'string' &&
    Array.isArray(payload?.signers) &&
    Array.isArray(e.signatures)
  );
}

export function VerifyForm({ t, doc }: { t: SignDictionary; doc: DocumentFile }) {
  const { bytes, docHash } = doc;
  const { accounts, activeNetworkId } = useRadixWallet();
  const account = accounts[0]?.address;

  const [certFile, setCertFile] = useState<File | null>(null);
  const [envelope, setEnvelope] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  const [keyInput, setKeyInput] = useState('');
  // When a signed PDF is dropped, the certificate + original are read from it.
  const [embedded, setEmbedded] = useState(false);
  // Bytes to hash for the file-match check (extracted original, or the file itself).
  const [verifyBytes, setVerifyBytes] = useState<Uint8Array | null>(null);

  const { verify, isVerifying, outcome, reset } = useDocumentVerify();

  // Auto-detect a signed PDF in the shared dropzone: pull out the embedded
  // certificate + original so the delivered PDF verifies on its own. All state
  // updates happen inside the async closure (never synchronously in the effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes) {
        if (!cancelled) {
          setEmbedded(false);
          setVerifyBytes(null);
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

  // On-chain lookups must use the certificate's ORIGINAL hash, not the hash of
  // a mutated (watermarked/embedded) PDF.
  const effectiveDocHash = envelope?.payload.docHash ?? docHash;

  // On-chain: resolve the request from the connected wallet (or a pasted key).
  const onchainQuery = useQuery({
    queryKey: ['verify-onchain', activeNetworkId, effectiveDocHash, keyInput, account],
    queryFn: () =>
      fetchOnChainStatus({
        networkId: activeNetworkId!,
        docHash: effectiveDocHash,
        account,
        requestId: keyInput.trim() || undefined,
      }),
    enabled: !!effectiveDocHash && !!activeNetworkId,
  });
  const onchain = onchainQuery.data?.found ? onchainQuery.data : null;

  const onCert = async (picked: File | null) => {
    reset();
    setCertError('');
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

  // Required signers with no valid signature yet in the certificate.
  const pendingSigners = outcome
    ? outcome.requiredSigners.filter(
        (account) => !outcome.signatures.some((s) => s.signerAccount === account && s.valid),
      )
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {t.verify.intro}
      </p>

      {!docHash && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.needFile}
        </p>
      )}

      {/* ── On-ledger status ── */}
      <ToolSection
        title={t.onchain.statusTitle}
        action={
          <button
            type="button"
            onClick={() => onchainQuery.refetch()}
            disabled={onchainQuery.isFetching || !docHash}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RefreshCw className={`size-3.5 ${onchainQuery.isFetching ? 'animate-spin' : ''}`} />
            {onchainQuery.isFetching ? t.onchain.checking : t.onchain.refresh}
          </button>
        }
      >
        <div className="flex gap-2">
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={t.onchain.keyPlaceholder}
            className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.keyLabel}
        </p>

        {onchain?.signatures ? (
          <>
            <p
              className="text-sm font-semibold"
              style={{ color: onchain.complete ? '#10b981' : 'var(--color-text-muted)' }}
            >
              {onchain.signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
              {onchain.signatures.length}
              {onchain.complete ? ` · ${t.onchain.complete}` : ''}
            </p>
            <ul className="space-y-1.5 text-sm">
              {onchain.signatures.map((s) => (
                <li key={s.account} className="flex items-center gap-2">
                  {s.signed ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                  <span className="font-mono text-[12px] break-all" style={{ color: 'var(--color-text-main)' }}>
                    {s.account}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          docHash &&
          !onchainQuery.isFetching && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.notFound}
            </p>
          )
        )}
      </ToolSection>

      {/* ── Off-chain certificate verification ── */}
      <ToolSection title={t.verify.certLabel}>
        {embedded ? (
          <p
            className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
          >
            <BadgeCheck className="size-4 text-emerald-500 shrink-0" />
            {t.verify.embeddedDetected}
          </p>
        ) : (
          <FileDropzone
            extension=".json"
            label={t.verify.certLabel}
            prompt={t.verify.certPrompt}
            file={certFile}
            onFile={onCert}
            error={certError}
            disabled={isVerifying}
          />
        )}
        {!embedded && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.verify.dropSignedPdfHint}
          </p>
        )}
        <button
          type="button"
          disabled={!verifyTarget || !envelope || isVerifying}
          onClick={() => verifyTarget && envelope && verify(verifyTarget, envelope)}
          className="flex w-full items-center justify-center gap-2.5 px-7 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isVerifying ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {isVerifying ? t.verify.verifying : t.verify.button}
        </button>
      </ToolSection>

      {outcome && (
        <ToolSection>
          <div className="flex items-center gap-3">
            {outcome.ok ? (
              <ShieldCheck className="size-7 text-emerald-500" />
            ) : (
              <ShieldX className="size-7 text-red-500" />
            )}
            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>
              {outcome.ok ? t.verify.validTitle : t.verify.invalidTitle}
            </h3>
          </div>

          <ul className="space-y-2 text-sm">
            <Check ok={outcome.fileMatches} okText={t.verify.fileMatch} badText={t.verify.fileMismatch} />
            <Check ok={outcome.complete} okText={t.verify.complete} badText={t.verify.incomplete} />
            {outcome.onChainValid === null ? (
              <li style={{ color: 'var(--color-text-muted)' }}>• {t.verify.offchain}</li>
            ) : (
              <Check ok={outcome.onChainValid} okText={t.verify.onchainValid} badText={t.verify.onchainInvalid} />
            )}
            {outcome.sealValid !== null && (
              <Check ok={outcome.sealValid} okText={t.verify.sealValid} badText={t.verify.sealInvalid} />
            )}
          </ul>

          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-card-border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {t.verify.signersHeader}
            </p>
            {outcome.signatures.map((s) => (
              <div key={s.signerAccount} className="flex items-start gap-2 text-sm">
                {s.valid ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="font-mono text-[12px] break-all" style={{ color: 'var(--color-text-main)' }}>
                    {s.signerAccount}
                  </span>
                  {(s.disclosedName || s.disclosedEmail) && (
                    <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {[s.disclosedName, s.disclosedEmail].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pendingSigners.length > 0 && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-card-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {t.verify.pendingHeader}
              </p>
              {pendingSigners.map((account) => (
                <div key={account} className="flex items-center gap-2 text-sm">
                  <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  <span className="font-mono text-[12px] break-all" style={{ color: 'var(--color-text-main)' }}>
                    {account}
                  </span>
                </div>
              ))}
            </div>
          )}

          {outcome.message && (
            <dl className="grid gap-2 text-sm">
              <Row label={t.verify.message} value={outcome.message} />
              <Row label={t.verify.timestamp} value={new Date(outcome.timestamp).toLocaleString()} />
            </dl>
          )}
        </ToolSection>
      )}
    </div>
  );
}

function Check({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="size-4 text-red-500 shrink-0" />
      )}
      <span style={{ color: 'var(--color-text-main)' }}>{ok ? okText : badText}</span>
    </li>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="sm:w-40 shrink-0 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </dt>
      <dd className={`break-all ${mono ? 'font-mono text-[12px]' : ''}`} style={{ color: 'var(--color-text-main)' }}>
        {value}
      </dd>
    </div>
  );
}
