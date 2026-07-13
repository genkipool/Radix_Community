'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileSignature,
  RotateCcw,
  UsersRound,
} from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { StringListField } from '@/features/console/components/shared/StringListField';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentSign } from '../hooks/useDocumentSign';
import { useSealSetup } from '../hooks/useSealRequest';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { OnChainSignPanel } from './OnChainSignPanel';
import { SealDeployPanel } from './SealDeployPanel';
import { SealOnboarding } from './SealOnboarding';
import { stripExtension } from '../lib/file';
import { downloadBytes, downloadCertificate } from '../lib/certificate';
import { embedCertificateInPdf } from '../lib/pdf-embed';
import { buildCollectionCreateManifest } from '../lib/seal-collection';
import {
  DEFAULT_COLLECTION_NAME,
  radixSealAddress,
  sealImageUrl,
} from '../constants/seal';
import { networkNameForId } from '../lib/network';
import { explorerTxUrl } from '../lib/explorer';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

type IdentityOpt = DisclosurePolicy | 'email';

const isPdfResult = (r: { fileType: string; fileName: string }) =>
  r.fileType === 'application/pdf' || r.fileName.toLowerCase().endsWith('.pdf');

export function looksLikeEnvelope(v: unknown): v is AttestationEnvelope {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  const payload = e.payload as Record<string, unknown> | undefined;
  return (
    typeof payload?.docHash === 'string' &&
    Array.isArray(payload?.signers) &&
    Array.isArray(e.signatures)
  );
}

export function SignForm({
  t,
  consoleT,
  doc,
  onchainAccount,
  onOnchainAccountChange,
  setup,
  needsOnboarding,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  doc: DocumentFile;
  /** Acting on-chain account (lifted to the tool so it can gate the layout). */
  onchainAccount: string | null;
  onOnchainAccountChange: (account: string) => void;
  setup: ReturnType<typeof useSealSetup>;
  /** True while the seal/collection setup is missing → onboarding-only view. */
  needsOnboarding: boolean;
}) {
  const { file, bytes, docHash, hashing, pdf: pdfOk } = doc;

  const [certFile, setCertFile] = useState<File | null>(null);
  const [loadedCert, setLoadedCert] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');

  const [message, setMessage] = useState('');
  const [disclosure, setDisclosure] = useState<DisclosurePolicy>('none');
  const [includeEmail, setIncludeEmail] = useState(false);
  const [outputs, setOutputs] = useState<OutputFormat[]>(['detached']);
  // A shared link (?req=…) — or a dropped PDF carrying an embedded request
  // pointer — jumps straight into on-chain multi-sign.
  const requestParam = useSearchParams().get('req') ?? undefined;
  const sharedRequestId = requestParam ?? doc.embeddedRequest?.requestKey;
  const [multi, setMulti] = useState(!!requestParam);
  const [onchain, setOnchain] = useState(!!requestParam);
  const [coSigners, setCoSigners] = useState<string[]>(['']);
  const [result, setResult] = useState<SignResult | null>(null);

  const { sign, coSign, phase, error, reset } = useDocumentSign();

  const busy = phase === 'signing' || phase === 'anchoring';
  const coSignMode = !!loadedCert;
  const requiredSigners = coSigners.map((s) => s.trim()).filter(Boolean);
  const forcedOnchain = !!doc.embeddedRequest;
  // "On-chain" applies equally to single and multi signing — the only
  // difference downstream is whether the co-signer address list is shown.
  const onchainMode = onchain || forcedOnchain;

  const identityValue: IdentityOpt[] = includeEmail
    ? [disclosure, 'email']
    : [disclosure];
  const onIdentityChange = (v: IdentityOpt[]) => {
    const addedName = v.filter(
      (x) => x !== 'email' && x !== disclosure,
    ) as DisclosurePolicy[];
    if (addedName.length > 0) setDisclosure(addedName[addedName.length - 1]);
    setIncludeEmail(v.includes('email'));
  };

  const onCert = async (picked: File | null) => {
    setCertError('');
    setResult(null);
    reset();
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

  const deliver = async (res: SignResult, chosen: OutputFormat[]) => {
    let delivered = false;
    if (chosen.includes('embedded') && isPdfResult(res)) {
      try {
        // The original bytes are embedded intact so the PDF verifies alone.
        const pdf = await embedCertificateInPdf(res.fileBytes, res.envelope, res.fileBytes);
        downloadBytes(
          pdf,
          `${stripExtension(res.fileName)}-signed.pdf`,
          'application/pdf',
        );
        delivered = true;
      } catch {
        // Fall back to the detached certificate below.
      }
    }
    if (chosen.includes('detached') || !delivered) {
      downloadCertificate(res.envelope);
    }
  };

  const handleSign = async () => {
    if (!bytes || !docHash || !file) return;
    const cleanCoSigners = coSigners.map((s) => s.trim()).filter(Boolean);
    // Off-chain path only: on-chain signing lives in OnChainSignPanel.
    const res = await sign({
      fileBytes: bytes,
      docHash,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: message.trim(),
      disclosure,
      includeEmail,
      coSigners: multi ? cleanCoSigners : [],
      onChain: false,
    });
    if (res) {
      setResult(res);
      await deliver(res, outputs);
    }
  };

  const handleCoSign = async () => {
    if (!bytes || !file || !loadedCert) return;
    const res = await coSign(loadedCert, bytes, file.name, file.type);
    if (res) {
      setResult(res);
      downloadCertificate(res.envelope);
    }
  };

  const startOver = () => {
    setResult(null);
    doc.onFile(null);
    setMessage('');
    setCertFile(null);
    setLoadedCert(null);
    reset();
  };

  if (result) {
    return (
      <ResultPanel
        t={t}
        consoleT={consoleT}
        result={result}
        outputs={outputs}
        onReset={startOver}
      />
    );
  }

  const errorMsg = error
    ? (t.errors as Record<string, string>)[error] ?? t.errors.generic
    : '';
  const hashMismatch =
    coSignMode && !!docHash && docHash !== loadedCert!.payload.docHash;

  // One-time on-ledger setup, ALONE on screen until completed — nothing
  // else competes for attention. Co-signers arriving via a shared request
  // are exempt (they get a compact inline checklist instead).
  if (needsOnboarding && !sharedRequestId) {
    return (
      <div className="space-y-5">
        <SealDeployPanel t={t} />
        <SealOnboarding
          t={t}
          account={onchainAccount}
          onAccountChange={onOnchainAccountChange}
          setup={setup}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SealDeployPanel t={t} />

      <ToolSection title={t.cosign.title} hint={t.cosign.hint}>
        <FileDropzone
          extension=".json"
          label={t.cosign.certLabel}
          prompt={t.cosign.certPrompt}
          file={certFile}
          onFile={onCert}
          error={certError}
          disabled={busy}
        />
      </ToolSection>

      {coSignMode ? (
        <>
          <SignerProgress t={t} envelope={loadedCert!} />
          {hashMismatch && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-danger, #dc2626)',
                color: 'var(--color-danger, #dc2626)',
              }}
            >
              {t.cosign.fileMismatch}
            </p>
          )}
          {errorMsg && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-danger, #dc2626)',
                color: 'var(--color-danger, #dc2626)',
              }}
            >
              {errorMsg}
            </p>
          )}
          <button
            type="button"
            disabled={!bytes || hashMismatch || busy}
            onClick={handleCoSign}
            className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <FileSignature className="size-4" />
            )}
            {busy ? t.actions.signing : t.cosign.addSignature}
          </button>
        </>
      ) : (
        <>
          {forcedOnchain && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
                background: 'var(--color-surface)',
              }}
            >
              {t.onchain.requestDetected}
            </p>
          )}

          {!onchainMode && (
            <>
              <ToolSection title={t.options.messageTitle} hint={t.options.messageHint}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  disabled={busy}
                  placeholder={t.options.messagePlaceholder}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none outline-none"
                  style={{
                    background: 'var(--color-input-bg, var(--color-card-bg))',
                    borderColor: 'var(--color-card-border)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </ToolSection>

              <ToolSection
                title={t.options.identityTitle}
                hint={t.options.identityHint}
              >
                <OptionButtons<IdentityOpt>
                  multiple
                  layout="grid"
                  className="grid-cols-2 sm:grid-cols-3"
                  value={identityValue}
                  onChange={onIdentityChange}
                  disabled={busy}
                  options={[
                    {
                      value: 'none',
                      label: t.options.identityNone,
                      description: t.options.identityNoneDesc,
                    },
                    {
                      value: 'full_name',
                      label: t.options.identityFull,
                      description: t.options.identityFullDesc,
                    },
                    {
                      value: 'email',
                      label: t.options.identityEmail,
                      description: t.options.identityEmailDesc,
                    },
                  ]}
                />
              </ToolSection>

              <ToolSection title={t.options.outputTitle} hint={t.options.outputHint}>
                <OptionButtons<OutputFormat>
                  multiple
                  value={outputs}
                  onChange={(v) => {
                    // At least one output format must stay selected.
                    if (v.length > 0) setOutputs(v);
                  }}
                  disabled={busy}
                  options={[
                    {
                      value: 'detached',
                      label: t.options.outputDetached,
                      description: t.options.outputDetachedDesc,
                    },
                    {
                      value: 'embedded',
                      label: t.options.outputEmbedded,
                      description: t.options.outputEmbeddedDesc,
                      disabled: !pdfOk,
                      title: pdfOk ? undefined : t.options.embeddedPdfOnly,
                    },
                  ]}
                />
              </ToolSection>
            </>
          )}

          <ToolSection title={t.options.multiTitle} hint={t.options.multiHint}>
            <OptionButtons<'single' | 'multiple'>
              value={multi || forcedOnchain ? 'multiple' : 'single'}
              onChange={(v) => setMulti(v === 'multiple')}
              disabled={busy || forcedOnchain}
              options={[
                {
                  value: 'single',
                  label: t.options.multiSingle,
                  description: t.options.multiSingleDesc,
                },
                {
                  value: 'multiple',
                  label: t.options.multiMultiple,
                  description: t.options.multiMultipleDesc,
                },
              ]}
            />
            {/* The signing method is the same alone or with others — only
                the address list below changes. */}
            <div className="space-y-1.5">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.onchain.modeTitle}
              </p>
              <OptionButtons<'off' | 'on'>
                value={onchainMode ? 'on' : 'off'}
                onChange={(v) => setOnchain(v === 'on')}
                disabled={busy || forcedOnchain}
                options={[
                  {
                    value: 'off',
                    label: t.onchain.off,
                    description: t.onchain.offDesc,
                  },
                  {
                    value: 'on',
                    label: t.onchain.on,
                    description: t.onchain.onDesc,
                  },
                ]}
              />
            </div>
            {(multi || forcedOnchain) && !sharedRequestId && (
              <>
                <StringListField
                  label={t.options.coSignersLabel}
                  values={coSigners}
                  onChange={setCoSigners}
                  addLabel={t.options.addSigner}
                  placeholder={t.options.signerPlaceholder}
                  disabled={busy}
                />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {onchainMode
                    ? t.options.onchainSignersHint
                    : t.options.coSignersHint}
                </p>
              </>
            )}
            {multi && !onchainMode && (
              <div
                className="rounded-xl border p-3.5 space-y-1.5"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                }}
              >
                <p
                  className="text-xs font-bold"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {t.steps.title}
                </p>
                <ol
                  className="text-xs leading-relaxed list-decimal pl-4 space-y-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <li>{t.steps.s1}</li>
                  <li>{t.steps.s2}</li>
                  <li>{t.steps.s3}</li>
                  <li>{t.steps.s4}</li>
                  <li>{t.steps.s5}</li>
                </ol>
              </div>
            )}
          </ToolSection>

          {onchainMode ? (
            <OnChainSignPanel
              key={sharedRequestId ?? 'new'}
              t={t}
              consoleT={consoleT}
              doc={doc}
              requiredSigners={requiredSigners}
              initialRequestId={sharedRequestId}
              account={onchainAccount}
              solo={!multi && !forcedOnchain}
            />
          ) : (
            <>
              {errorMsg && (
                <p
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: 'var(--color-danger, #dc2626)',
                    color: 'var(--color-danger, #dc2626)',
                  }}
                >
                  {errorMsg}
                </p>
              )}

              <button
                type="button"
                disabled={!docHash || hashing || busy}
                onClick={handleSign}
                className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                {busy ? (
                  <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <FileSignature className="size-4" />
                )}
                {phase === 'signing' ? t.actions.signing : t.actions.sign}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Signer progress (shared) ─────────────────────────────────────────────────

function SignerProgress({
  t,
  envelope,
}: {
  t: SignDictionary;
  envelope: AttestationEnvelope;
}) {
  const required = envelope.payload.signers;
  const signed = new Set(envelope.signatures.map((s) => s.signerAccount));
  const open = required.length === 0;
  const complete = open ? signed.size > 0 : required.every((a) => signed.has(a));
  const rows = open ? Array.from(signed) : required;

  return (
    <ToolSection title={t.progress.signaturesTitle}>
      <p
        className="text-sm font-semibold"
        style={{
          color: complete ? '#10b981' : 'var(--color-text-muted)',
        }}
      >
        {open
          ? `${signed.size} ${t.progress.signaturesTitle.toLowerCase()}`
          : `${required.filter((a) => signed.has(a)).length} ${t.progress.of} ${required.length}`}{' '}
        · {complete ? t.progress.allSigned : t.progress.partial}
      </p>
      <ul className="space-y-1.5 text-sm">
        {rows.map((acc) => (
          <li key={acc} className="flex items-center gap-2">
            {signed.has(acc) ? (
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            )}
            <span
              className="font-mono text-[12px] break-all"
              style={{ color: 'var(--color-text-main)' }}
            >
              {acc}
            </span>
          </li>
        ))}
      </ul>
      {!complete && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t.progress.passToNext}
        </p>
      )}
    </ToolSection>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

export function ResultPanel({
  t,
  consoleT,
  result,
  outputs,
  onReset,
  allowAnchor = true,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  result: SignResult;
  outputs: OutputFormat[];
  onReset: () => void;
  /** Basic mode hides the on-ledger anchoring option entirely. */
  allowAnchor?: boolean;
}) {
  const [envelope, setEnvelope] = useState<AttestationEnvelope>(result.envelope);
  const { anchor, phase, error } = useDocumentSign();
  const preview = useTransactionPreview();
  const { language } = useLanguage();
  const { activeNetworkId } = useRadixWallet();
  const anchoring = phase === 'anchoring';

  const { payload } = envelope;
  const pdfBtn = outputs.includes('embedded') && isPdfResult(result);
  const certBtn = outputs.includes('detached') || !pdfBtn;

  const signed = new Set(envelope.signatures.map((s) => s.signerAccount));
  const complete =
    payload.signers.length === 0
      ? signed.size > 0
      : payload.signers.every((a) => signed.has(a));
  const canAnchor = allowAnchor && complete && !envelope.onChain;

  const anchorSigners = [...signed];
  const anchorErrorMsg = error
    ? (t.errors as Record<string, string>)[error] ?? t.errors.generic
    : '';

  const onSimulate = async () => {
    const anchorAccount = anchorSigners[0];
    if (!anchorAccount || activeNetworkId == null) return;
    const sealAddress = radixSealAddress(activeNetworkId);
    const manifest = await buildCollectionCreateManifest({
      account: anchorAccount,
      curve: 'curve25519',
      networkId: activeNetworkId,
      collectionName: DEFAULT_COLLECTION_NAME,
      imageUrl: sealImageUrl(window.location.origin),
      sealAddress,
      attestation: {
        docHash: payload.docHash,
        timestamp: new Date().toISOString(),
        docName: payload.fileName,
        signers: anchorSigners.join(','),
        network: networkNameForId(activeNetworkId),
        sealAddress,
      },
    });
    preview.simulate(manifest);
  };

  const onAnchor = async () => {
    const res = await anchor(
      envelope,
      result.fileBytes,
      result.fileName,
      result.fileType,
    );
    if (res) {
      setEnvelope(res.envelope);
      downloadCertificate(res.envelope);
    }
  };

  const downloadPdf = async () => {
    try {
      // Embed the original bytes so the signed PDF verifies on its own.
      const pdf = await embedCertificateInPdf(result.fileBytes, envelope, result.fileBytes);
      downloadBytes(
        pdf,
        `${stripExtension(result.fileName)}-signed.pdf`,
        'application/pdf',
      );
    } catch {
      downloadCertificate(envelope);
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
            <UsersRound className="size-5 text-white" />
          </div>
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {t.result.title}
          </h3>
        </div>

        <dl className="grid gap-2 text-sm">
          <Row label={t.result.timestamp} value={new Date(payload.timestamp).toLocaleString()} />
          <Row label={t.result.hash} value={payload.docHash} mono />
          {payload.message && (
            <Row label={t.result.message} value={payload.message} />
          )}
        </dl>
      </ToolSection>

      <SignerProgress t={t} envelope={envelope} />

      {canAnchor && (
        <ToolSection title={t.options.anchorTitle} hint={t.options.anchorHint}>
          <p className="text-xs" style={{ color: 'var(--color-warning, #b45309)' }}>
            ⚠ {t.options.anchorWarning}
          </p>
          {anchorErrorMsg && (
            <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
              {anchorErrorMsg}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={anchoring}
              onClick={onAnchor}
              className="flex w-full items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {anchoring ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {anchoring ? t.actions.anchoringNow : t.actions.anchorNow}
            </button>
            <SimulateButton
              t={consoleT.simulate}
              onClick={onSimulate}
              disabled={anchoring}
              loading={preview.isSimulating}
            />
          </div>
          <SimulateResultCard
            t={consoleT.simulate}
            preview={preview.preview}
            error={preview.error}
            onClose={preview.reset}
          />
        </ToolSection>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {certBtn && (
          <button
            type="button"
            onClick={() => downloadCertificate(envelope)}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
          >
            <Download className="size-4" />
            {t.actions.downloadCert}
          </button>
        )}
        {pdfBtn && (
          <button
            type="button"
            onClick={downloadPdf}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
          >
            <Download className="size-4" />
            {t.actions.downloadPdf}
          </button>
        )}

        {envelope.onChain && (
          <a
            href={explorerTxUrl(language, envelope.onChain.transactionIntentHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          >
            <ExternalLink className="size-4" />
            {t.actions.viewOnLedger}
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <RotateCcw className="size-4" />
        {t.actions.newSignature}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt
        className="sm:w-40 shrink-0 font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </dt>
      <dd
        className={`break-all ${mono ? 'font-mono text-[12px]' : ''}`}
        style={{ color: 'var(--color-text-main)' }}
      >
        {value}
      </dd>
    </div>
  );
}
