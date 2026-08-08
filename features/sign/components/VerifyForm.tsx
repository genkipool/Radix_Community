'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentVerify } from '../hooks/useDocumentVerify';
import { fetchOnChainStatus } from '../services/signApi';
import { networkIdFromResource, parseRequestKey } from '../lib/share';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import type { DocumentFile } from '../hooks/useDocumentFile';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope, VerifiedSignature } from '../types/sign.types';

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

export function VerifyForm({
  t,
  doc,
  initialRequestKey,
}: {
  t: SignDictionary;
  doc: DocumentFile;
  /**
   * Request key carried by the link that opened this page — the one printed on
   * a signed PDF. Seeding it means the ledger check runs on arrival: who has
   * signed, and when, is answered without the visitor uploading anything or
   * even connecting a wallet. (The file-matches-the-hash half still needs the
   * document, which never leaves their browser.)
   */
  initialRequestKey?: string;
}) {
  const { bytes, docHash } = doc;
  const { activeNetworkId } = useRadixWallet();

  const [certFile, setCertFile] = useState<File | null>(null);
  const [envelope, setEnvelope] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  const [keyInput, setKeyInput] = useState(initialRequestKey ?? '');
  // When a signed PDF is dropped, the certificate + original are read from it.
  const [embedded, setEmbedded] = useState(false);
  // Bytes to hash for the file-match check (extracted original, or the file itself).
  const [verifyBytes, setVerifyBytes] = useState<Uint8Array | null>(null);

  const { verify, isVerifying, outcome, reset } = useDocumentVerify();

  // `verify`/`reset` are recreated on every render (this repo bans useCallback —
  // the React Compiler does NOT stabilise them here). Putting them in an effect's
  // dependency array makes that effect re-run every render → setState → re-render
  // → infinite loop. They only close over stable useState setters, so a
  // mount-time snapshot stays valid forever; we call them through these refs so
  // the effects can depend solely on real inputs.
  const verifyRef = useRef(verify);
  const resetRef = useRef(reset);
  // Whether the loaded certificate came out of the dropped PDF (vs a separate
  // .json file): removing the document must also remove that certificate.
  const envelopeFromPdfRef = useRef(false);

  // Auto-detect a signed PDF in the shared dropzone: pull out the embedded
  // certificate + original so the delivered PDF verifies on its own. All state
  // updates happen inside the async closure (never synchronously in the effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes) {
        if (!cancelled) {
          // Removing the document clears everything derived from it in real
          // time: the verification result AND the certificate that was read
          // out of the (now removed) PDF. A certificate loaded as a separate
          // .json file stays: it did not come from the document.
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

  // On-chain lookups must use the certificate's ORIGINAL hash, not the hash of
  // a mutated (watermarked/embedded) PDF.
  const effectiveDocHash = envelope?.payload.docHash ?? docHash;

  // On-chain: resolve the request. Prefer a pasted key, then the key carried by
  // the certificate (multi-party on-ledger), then a request pointer embedded in
  // the dropped PDF.
  const typedKey = keyInput.trim();
  const rawRequestId =
    typedKey ||
    envelope?.request?.requestId ||
    doc.embeddedRequest?.requestKey ||
    '';
  const parsedKey = parseRequestKey(rawRequestId);
  const requestId = parsedKey
    ? `${parsedKey.collection}:#${parsedKey.id}#`
    : undefined;
  const invalidKey = !!typedKey && !parseRequestKey(typedKey);
  /*
   * A key the verifier TYPED is the one piece of the puzzle whoever produced
   * the certificate did not choose, so it decides which on-ledger request the
   * signatures are measured against. Without it a certificate is checked
   * against the request it nominates itself — and anyone can mint a collection
   * with a one-name invitation batch that its own signature satisfies.
   */
  const overrideRequestId =
    typedKey && parsedKey ? `${parsedKey.collection}:#${parsedKey.id}#` : '';
  const overrideNetworkId = parsedKey
    ? networkIdFromResource(parsedKey.collection)
    : null;
  // The network is read from the key itself (the resource address prefix), so
  // request verification needs NO connected wallet; the certificate, the PDF
  // pointer and the wallet are fallbacks.
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
  // The dropped file (or the loaded certificate) vs the hash locked on-ledger.
  const onchainHashMismatch =
    !!onchain?.docHash && !!effectiveDocHash && onchain.docHash !== effectiveDocHash;

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

  // Verification runs automatically as soon as we have both the file to hash
  // and a certificate/envelope — no explicit button needed. The effect depends
  // only on the (stable) file and certificate references, and calls verify via
  // its ref, so it fires exactly when the inputs change. The dedupe ref guards
  // against StrictMode's double-invoke firing the request twice.
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

  // Required signers with no valid signature yet in the certificate.
  const pendingSigners = outcome
    ? outcome.requiredSigners.filter(
        (account) => !outcome.signatures.some((s) => s.signerAccount === account && s.valid),
      )
    : [];

  return (
    <div className="space-y-5">
      {/* ── Off-chain certificate verification ── */}
      <ToolSection title={t.verify.certLabel}>
        {embedded ? (
          <p
            className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
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

      {/* ── On-ledger status ── */}
      <ToolSection
        title={t.onchain.statusTitle}
        hint={t.onchain.statusHint}
        action={
          <button
            type="button"
            onClick={() => onchainQuery.refetch()}
            disabled={onchainQuery.isFetching || !requestId}
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
        {invalidKey && (
          <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
            {t.onchain.invalidKey}
          </p>
        )}

        {onchain?.signatures ? (
          <>
            {(onchain.issuer?.orgName || onchain.issuer?.account) && (
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {t.onchain.issuedBy}:{' '}
                {onchain.issuer.orgName && (
                  <span className="font-semibold">{onchain.issuer.orgName} · </span>
                )}
                <span className="font-mono break-all">{onchain.issuer.account}</span>
              </p>
            )}
            <p
              className="text-sm font-semibold"
              style={{ color: onchain.complete ? 'var(--color-success)' : 'var(--color-text-muted)' }}
            >
              {onchain.signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
              {onchain.signatures.length}
              {onchain.complete ? ` · ${t.onchain.complete}` : ''}
            </p>
            <ul className="space-y-1.5 text-sm">
              {onchain.signatures.map((s) => (
                <li key={s.account} className="flex items-center gap-2">
                  {s.signed ? (
                    <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
                  ) : (
                    <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                  <span className="font-mono text-[12px] break-all" style={{ color: 'var(--color-text-main)' }}>
                    {s.account}
                  </span>
                </li>
              ))}
            </ul>
            {/* Does the uploaded file match the hash locked in the on-ledger
                request? Only claimed while a document is actually loaded. */}
            {!bytes || !effectiveDocHash ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t.onchain.dropFileToCompare}
              </p>
            ) : onchainHashMismatch ? (
              <p className="text-sm font-semibold" style={{ color: 'var(--color-danger, #dc2626)' }}>
                {t.onchain.fileMismatch}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
                <CheckCircle2 className="size-3.5 shrink-0" />
                {t.onchain.hashMatches}
              </p>
            )}
          </>
        ) : (
          requestId &&
          !onchainQuery.isFetching &&
          onchainQuery.data?.found === false && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.notFound}
            </p>
          )
        )}
      </ToolSection>

      {outcome && (
        <ToolSection>
          <div className="flex items-center gap-3">
            {outcome.ok ? (
              <ShieldCheck className="size-7 text-[var(--color-success)]" />
            ) : (
              <ShieldX className="size-7 text-[var(--color-danger)]" />
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

          {/* Which request the required-signer set came from. A certificate
              choosing its own yardstick is worth saying out loud. */}
          {outcome.requestSource !== 'none' && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {outcome.requestSource === 'typed'
                ? t.verify.requestFromKey
                : t.verify.requestFromCert}
            </p>
          )}
          {outcome.requestMismatch && (
            <p
              className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: 'var(--color-warning, #eab308)',
                color: 'var(--color-text-main)',
              }}
            >
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0"
                style={{ color: 'var(--color-warning, #eab308)' }}
              />
              {t.verify.requestMismatch}
            </p>
          )}

          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-card-border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {t.verify.signersHeader}
            </p>
            {outcome.signatures.map((s) => (
              <div key={s.signerAccount} className="flex items-start gap-2 text-sm">
                {s.valid ? (
                  <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="font-mono text-[12px] break-all" style={{ color: 'var(--color-text-main)' }}>
                    {s.signerAccount}
                  </span>
                  {s.disclosedName && (
                    <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {' · '}
                      {s.disclosedName}
                    </span>
                  )}
                  {s.disclosedEmail && (
                    <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {s.disclosedEmail}
                    </p>
                  )}
                  {s.valid && <SignatureClock t={t} signature={s} />}
                </div>
              </div>
            ))}
            {outcome.signatures.some((s) => s.valid && s.disclosedName) && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {t.verify.nameDeclared}
              </p>
            )}
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
            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-card-border)' }}>
              {/* Without a ROLA proof nothing here is signed. Saying so beside
                  the values is the difference between showing evidence and
                  showing a form somebody filled in. */}
              {!outcome.payloadBound && (
                <>
                  <p
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t.verify.declaredHeader}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {t.verify.declaredNote}
                  </p>
                </>
              )}
              <dl className="grid gap-2 text-sm">
                <Row label={t.verify.message} value={outcome.message} />
                <Row label={t.verify.timestamp} value={new Date(outcome.timestamp).toLocaleString()} />
              </dl>
              {/* A creation date later than the signature is not a discrepancy
                  to weigh up, it is an impossibility. */}
              {outcome.createdAtCoherent === false && (
                <p className="text-xs font-semibold" style={{ color: 'var(--color-danger, #dc2626)' }}>
                  {t.verify.createdIncoherent}
                </p>
              )}
            </div>
          )}
        </ToolSection>
      )}
    </div>
  );
}

/**
 * The one clock a signature can be held to.
 *
 * A certificate states when it was signed, and that statement is worth exactly
 * as much as whatever corroborates it: the consensus time of the transaction
 * that minted an on-ledger signature, or the genTime of a timestamp token for
 * an off-ledger one. With neither, the date is shown as what it is — a claim.
 * With one that contradicts it, the contradiction is the headline.
 */
function SignatureClock({
  t,
  signature,
}: {
  t: SignDictionary;
  signature: VerifiedSignature;
}) {
  if (!signature.anchoredAt || !signature.anchorSource) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {t.verify.clockNone}
      </p>
    );
  }

  const disagrees = signature.signedAtAnchored === false;
  const source =
    signature.anchorSource === 'ledger'
      ? t.verify.clockLedger
      : t.verify.clockTimestamp.replace(
          '{authority}',
          signature.timestampAuthority || '—',
        );

  return (
    <>
      <p
        className="flex items-center gap-1.5 text-[11px]"
        style={{
          color: disagrees ? 'var(--color-danger, #dc2626)' : 'var(--color-text-muted)',
        }}
      >
        <Clock className="size-3 shrink-0" />
        <span>
          {source} · {new Date(signature.anchoredAt).toLocaleString()}
        </span>
      </p>
      {disagrees && (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-danger, #dc2626)' }}>
          {t.verify.clockMismatch}
        </p>
      )}
      {signature.timestampUntrustedAnchor && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.verify.clockUntrusted}
        </p>
      )}
      {/* The NFT's own `issued_at` is written before its transaction commits, so
          it is a claim. Shown only when the ledger contradicts it. */}
      {signature.issuedAtAnchored === false && (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-danger, #dc2626)' }}>
          {t.verify.clockIssuedAtMismatch}
        </p>
      )}
    </>
  );
}

function Check({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
      ) : (
        <XCircle className="size-4 text-[var(--color-danger)] shrink-0" />
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
