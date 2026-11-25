'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  RotateCcw,
  UsersRound,
} from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useWalletRequests } from '@/features/wallet/hooks/useWalletRequests';
import { useDocumentSign } from '../hooks/useDocumentSign';
import { useSealSetup } from '../hooks/useSealRequest';
import { ShareLinkSection } from './ShareLinkSection';
import { RequestTransactionLinks } from './RequestTransactionLinks';
import { SealOnboarding } from './SealOnboarding';
import { SignErrorText } from './SignErrorText';
import type { PadesConfig } from './PadesSignSection';
import { signedPdfName } from '../lib/file';
import { downloadCertificate, isFullySigned } from '../lib/certificate';
import { signaturePageOptions } from '../lib/pdf-signature-page';
import {
  buildDeliverablePdf,
  deliverSignedArtifacts,
  isPdfFile,
} from '../lib/signed-pdf';
import type { WatermarkOptions } from '../lib/pdf-watermark';
import { buildSignatureOrFirstCollectionManifest } from '../lib/sign-request';
import { fetchLedgerNow } from '../lib/ledger-time';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { explorerTxUrl } from '../lib/explorer';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

/** Maps a PAdES/p12 signing failure to a dictionary error code. */
export function padesErrorCode(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /mac|password|pkcs12|invalid|decrypt/.test(msg)
    ? 'wrong_password'
    : 'generic';
}

export function SignerProgress({
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
  const rows = open
    ? Array.from(signed)
    : [...new Set([...required, ...signed])];

  return (
    <ToolSection title={t.progress.signaturesTitle}>
      <p
        className="text-sm font-semibold"
        style={{
          color: complete ? 'var(--color-success)' : 'var(--color-text-muted)',
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
              <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
            ) : (
              <Circle
                className="size-4 shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              />
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

export function ResultPanel({
  t,
  consoleT,
  result,
  outputs,
  onReset,
  allowAnchor = true,
  pades,
  watermark,
  padesError,
  onPadesError,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  result: SignResult;
  outputs: OutputFormat[];
  onReset: () => void;
  /** Basic mode hides the on-ledger anchoring option entirely. */
  allowAnchor?: boolean;
  /** PAdES/X.509 config lifted from the form, so downloads keep the cert. */
  pades?: PadesConfig | null;
  /** Watermark lifted from the form, so downloads keep it too. */
  watermark?: WatermarkOptions;
  padesError?: string;
  onPadesError?: (code: string) => void;
}) {
  const [envelope, setEnvelope] = useState<AttestationEnvelope>(result.envelope);
  const { anchor, phase, error } = useDocumentSign();
  const preview = useTransactionPreview();
  const { language, t: common } = useLanguage();
  const { activeNetworkId } = useRadixWallet();
  const anchoring = phase === 'anchoring';
  const { inWallet } = useWalletRequests();
  const anchorInWallet = anchoring && inWallet;

  const [shareArtifact, setShareArtifact] = useState<{
    bytes: Uint8Array;
    name: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isPdfFile(result)) {
        try {
          const pdf = await buildDeliverablePdf({
            fileBytes: result.fileBytes,
            envelope,
            watermark,
            pageOptions: await signaturePageOptions(
              envelope,
              t,
              language,
              !!pades?.enabled,
            ),
            pades,
          });
          if (!cancelled) {
            setShareArtifact({
              bytes: pdf,
              name: signedPdfName(result.fileName, isFullySigned(envelope)),
              type: 'application/pdf',
            });
          }
          return;
        } catch {
          // Fall back to sharing the original document below.
        }
      }
      if (!cancelled) {
        setShareArtifact({
          bytes: result.fileBytes,
          name: result.fileName,
          type: result.fileType,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelope, result, language, t, pades, watermark]);

  const { payload } = envelope;
  const lastSignature = envelope.signatures[envelope.signatures.length - 1];
  const padesErrorMsg = padesError
    ? ((t.pades.errors as Record<string, string>)[padesError] ??
      t.pades.errors.generic)
    : '';
  const pdfBtn = isPdfFile(result);
  const certBtn = true;

  const signed = new Set(envelope.signatures.map((s) => s.signerAccount));
  const complete = isFullySigned(envelope);
  const canAnchor =
    allowAnchor && complete && !envelope.onChain && !envelope.request;

  const anchorSigners = [...signed];
  const anchorAccount = anchorSigners[0] ?? null;
  const setup = useSealSetup(anchorAccount);
  const needsSetup =
    canAnchor && setup.ready && (!setup.seal || !setup.collection);

  const onSimulate = async () => {
    if (!anchorAccount || activeNetworkId == null || !setup.seal) return;
    const imageUrl = sealImageUrl(window.location.origin);
    const issuedAt = await fetchLedgerNow(activeNetworkId);
    preview.simulate(
      buildSignatureOrFirstCollectionManifest({
        account: anchorAccount,
        sealGlobalId: setup.seal.globalId,
        sealAddress: radixSealAddress(activeNetworkId),
        collection: setup.collection?.resourceAddress ?? null,
        nextId: setup.collection ? setup.collection.totalSupply + 1 : 1,
        docHash: payload.docHash,
        networkId: activeNetworkId,
        request: '',
        imageUrl,
        issuedAt,
      }),
    );
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
    onPadesError?.('');
    await deliverSignedArtifacts({
      envelope,
      fileBytes: result.fileBytes,
      fileName: result.fileName,
      fileType: result.fileType,
      outputs: ['embedded'],
      t,
      locale: language,
      watermark,
      pades,
      onPadesError: (err) => onPadesError?.(padesErrorCode(err)),
    });
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
          <DetailRow
            label={t.result.timestamp}
            value={new Date(payload.timestamp).toLocaleString()}
          />
          <DetailRow label={t.result.hash} value={payload.docHash} mono />
          {payload.message && (
            <DetailRow label={t.result.message} value={payload.message} />
          )}
          {lastSignature?.disclosedName && (
            <DetailRow label={t.result.name} value={lastSignature.disclosedName} />
          )}
          {lastSignature?.disclosedEmail && (
            <DetailRow label={t.result.email} value={lastSignature.disclosedEmail} />
          )}
        </dl>
        {payload.disclosure !== 'none' && !lastSignature?.disclosedName && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t.result.nameMissing}
          </p>
        )}
      </ToolSection>

      <SignerProgress t={t} envelope={envelope} />

      {envelope.request && !complete ? (
        <ShareLinkSection
          t={t}
          requestKey={envelope.request.requestId}
          docName={payload.fileName}
          fileName={shareArtifact?.name ?? result.fileName}
          fileType={shareArtifact?.type ?? result.fileType}
          bytes={shareArtifact?.bytes ?? result.fileBytes}
          outputs={outputs}
          networkId={envelope.request.networkId}
        >
          {envelope.request.transactionIntentHash && (
            <RequestTransactionLinks
              t={t}
              txId={envelope.request.transactionIntentHash}
              networkId={envelope.request.networkId}
            />
          )}
        </ShareLinkSection>
      ) : (
        shareArtifact && (
          <ShareLinkSection
            t={t}
            docName={shareArtifact.name}
            fileName={shareArtifact.name}
            fileType={shareArtifact.type}
            bytes={shareArtifact.bytes}
            outputs={outputs}
            networkId={payload.networkId}
            tab="sign"
            title={t.onchain.shareDocTitle}
            hint={t.onchain.shareDocHint}
          >
            {envelope.request?.transactionIntentHash && (
              <RequestTransactionLinks
                t={t}
                txId={envelope.request.transactionIntentHash}
                networkId={envelope.request.networkId}
              />
            )}
          </ShareLinkSection>
        )
      )}

      {canAnchor && needsSetup && (
        <SealOnboarding
          t={t}
          account={anchorAccount}
          onAccountChange={() => {}}
          setup={setup}
          lockedAccount
          consoleT={consoleT}
        />
      )}

      {canAnchor && !needsSetup && (
        <ToolSection title={t.options.anchorTitle} hint={t.options.anchorHint}>
          <p
            className="text-xs"
            style={{ color: 'var(--color-warning, #b45309)' }}
          >
            ⚠ {t.options.anchorWarning}
          </p>
          {error && (
            <p
              className="text-sm"
              style={{ color: 'var(--color-danger, #dc2626)' }}
            >
              <SignErrorText t={t} code={error} />
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

      {padesErrorMsg && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger, #dc2626)',
            color: 'var(--color-danger, #dc2626)',
          }}
        >
          {padesErrorMsg}
        </p>
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
        title={anchorInWallet ? common.nav?.wallet_request_in_wallet : undefined}
        className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <RotateCcw className="size-4" />
        {t.actions.newSignature}
      </button>
    </div>
  );
}

export function DetailRow({
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
