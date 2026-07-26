'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Circle,
  Download,
  FileSignature,
  RefreshCw,
  Send,
  Stamp,
} from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSealRequest, useSealSetup } from '../hooks/useSealRequest';
import { SignCollectionSwitch } from './SignCollectionSwitch';
import type { DocumentFile } from '../hooks/useDocumentFile';
import {
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
} from '../lib/sign-request';
import { embedCertificateInPdf, embedRequestInPdf } from '../lib/pdf-embed';
import { signaturePageOptions } from '../lib/pdf-signature-page';
import { applyWatermark, type WatermarkOptions } from '../lib/pdf-watermark';
import { useLanguage } from '@/context/LanguageContext';
import type { OutputFormat } from '../types/sign.types';
import {
  buildOnChainCertificate,
  downloadBytes,
  downloadCertificate,
} from '../lib/certificate';
import { NETWORKS } from '@/features/wallet/constants/network';
import { randomNonceHex } from '../lib/hash';
import { networkIdFromResource } from '../lib/share';
import { ShareLinkSection } from './ShareLinkSection';
import { stripExtension } from '../lib/file';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { fetchOnChainStatus, type OnChainStatus } from '../services/signApi';
import type { SignDictionary } from '../types/dictionary';

const REFRESH_MS = 30_000;

type InviteMode = 'sign' | 'send';

/**
 * On-ledger signing panel — identical UI whether you sign alone or with
 * others; "alone" simply means the invitation list is just your account.
 * Setup (seal + collection) is guaranteed by the parent's onboarding for
 * the create path; co-signers arriving via a shared request get a compact
 * inline checklist instead.
 */
export function OnChainSignPanel({
  t,
  consoleT,
  doc,
  requiredSigners,
  initialRequestId,
  account,
  solo,
  outputs,
  watermark,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  doc: DocumentFile;
  requiredSigners: string[];
  initialRequestId?: string;
  /** Acting account (selected during onboarding / first shared account). */
  account: string | null;
  /** Single-signer mode: the invitation list is implicitly [account]. */
  solo: boolean;
  /** Delivery formats chosen for the completed certificate. */
  outputs: OutputFormat[];
  /** Watermark applied to the delivered (signed) PDF. */
  watermark: WatermarkOptions;
}) {
  const { activeNetworkId, accounts } = useRadixWallet();
  const { language } = useLanguage();
  const { mintSeal, createCollection, createRequest, signRequest, phase, error } =
    useSealRequest();
  const preview = useTransactionPreview();

  const docHash = doc.docHash;
  const [inviteMode, setInviteMode] = useState<InviteMode>('sign');
  const [requestId, setRequestId] = useState(initialRequestId ?? '');
  const [keyInput, setKeyInput] = useState(initialRequestId ?? '');

  const sealDeployed = !!activeNetworkId && !!radixSealAddress(activeNetworkId);
  const nftImage =
    typeof window !== 'undefined' ? sealImageUrl(window.location.origin) : '';

  // The request key names its network (resource prefix): the status loads on
  // that network regardless of what the wallet is connected to.
  const requestNetworkId = requestId ? networkIdFromResource(requestId) : null;
  const statusNetworkId = requestNetworkId ?? activeNetworkId;
  const wrongNetwork =
    requestNetworkId != null &&
    activeNetworkId != null &&
    requestNetworkId !== activeNetworkId;
  const statusQuery = useQuery({
    queryKey: ['sign-onchain-status', statusNetworkId, requestId],
    queryFn: () =>
      fetchOnChainStatus({ networkId: statusNetworkId!, requestId }),
    enabled: !!requestId && statusNetworkId != null,
    refetchInterval: (query) =>
      query.state.data?.found && !query.state.data.complete
        ? REFRESH_MS
        : false,
  });
  const status = statusQuery.data?.found ? statusQuery.data : null;
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';


  /* ── Eligibility (UX only — the real checks live on the ledger) ── */
  const walletAddresses = new Set(accounts.map((a) => a.address));
  const signatures = status?.signatures ?? [];
  const myEntries = signatures.filter((s) => walletAddresses.has(s.account));
  const myPending = myEntries.filter((s) => !s.signed);
  const signerAccount = myPending[0]?.account ?? myEntries[0]?.account ?? null;

  // Setup state for whichever account is acting in the current mode.
  const actingAccount = requestId ? signerAccount : account;
  const setup = useSealSetup(actingAccount);

  const hashMismatch =
    !!status?.docHash && !!docHash && status.docHash !== docHash;
  const loading = statusQuery.isFetching;
  const notFound =
    !!requestId && !statusQuery.isFetching && statusQuery.data?.found === false;

  const errorMsg = error
    ? ((t.errors as Record<string, string>)[error] ?? t.errors.generic)
    : '';

  /* ── Create request (solo = invitation list is just yourself) ── */

  const cleanSigners = requiredSigners.map((s) => s.trim()).filter(Boolean);
  const alsoSign = solo ? true : inviteMode === 'sign';
  // "Sign and send" makes the initiator a required signer too: they get
  // their own invitation and appear in the on-ledger signer list.
  const effectiveSigners = solo
    ? account
      ? [account]
      : []
    : alsoSign && account && !cleanSigners.includes(account)
      ? [...cleanSigners, account]
      : cleanSigners;
  const expectedPrefix =
    activeNetworkId === 1 ? 'account_rdx1' : 'account_tdx_2_1';
  const invalidSigner = solo
    ? undefined
    : cleanSigners.find((s) => !s.startsWith(expectedPrefix));
  const setupReady = !!setup.seal && !!setup.collection;
  const canCreate =
    !!account &&
    !!docHash &&
    !busy &&
    setupReady &&
    effectiveSigners.length > 0 &&
    !invalidSigner;

  const onCreate = async () => {
    if (!canCreate || !setup.seal || !setup.collection) return;
    const key = await createRequest({
      account: account!,
      sealGlobalId: setup.seal.globalId,
      collection: setup.collection.resourceAddress,
      nextId: setup.collection.totalSupply + 1,
      docHash,
      requiredSigners: effectiveSigners,
      alsoSign,
      imageUrl: nftImage,
    });
    if (key) {
      setRequestId(key);
      setup.refetch();
    }
  };

  const simulateCreate = () => {
    if (!canCreate || !setup.seal || !setup.collection) return;
    preview.simulate(
      buildSignRequestManifest({
        account: account!,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        networkId: activeNetworkId ?? 2,
        requiredSigners: effectiveSigners,
        alsoSign,
        imageUrl: nftImage,
      }),
    );
  };

  /* ── Sign (invited co-signer; the initiator signs the same way) ── */

  const eligible = !!signerAccount;
  const alreadySigned =
    eligible && myPending.length === 0 && myEntries.some((s) => s.signed);
  const canSign =
    eligible &&
    !alreadySigned &&
    !wrongNetwork &&
    !!status?.docHash &&
    !!docHash &&
    !hashMismatch &&
    !!setup.seal &&
    !busy;

  const onSign = async () => {
    if (!canSign || !status?.docHash || !setup.seal || !signerAccount) return;
    let ok: boolean;
    if (setup.collection) {
      ok = await signRequest({
        account: signerAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash: status.docHash,
        request: status.requestId ?? requestId,
        imageUrl: nftImage,
      });
    } else {
      // First signature ever: the collection is created WITH the signature
      // bundled — one transaction less for first-time signers.
      ok = !!(await createCollection({
        account: signerAccount,
        sealGlobalId: setup.seal.globalId,
        collectionName: '',
        imageUrl: nftImage,
        firstSignature: {
          docHash: status.docHash,
          request: status.requestId ?? requestId,
        },
      }));
    }
    if (ok) {
      setup.refetch();
      statusQuery.refetch();
    }
  };

  const simulateSign = () => {
    if (!canSign || !status?.docHash || !setup.seal || !signerAccount) return;
    preview.simulate(
      setup.collection
        ? buildSignatureMintManifest({
            account: signerAccount,
            sealGlobalId: setup.seal.globalId,
            collection: setup.collection.resourceAddress,
            nextId: setup.collection.totalSupply + 1,
            docHash: status.docHash,
            networkId: activeNetworkId ?? 2,
            request: status.requestId ?? requestId,
            imageUrl: nftImage,
          })
        : buildSignCollectionCreateManifest({
            account: signerAccount,
            sealGlobalId: setup.seal.globalId,
            sealAddress: radixSealAddress(activeNetworkId ?? 2),
            networkId: activeNetworkId ?? 2,
            collectionName: '',
            imageUrl: nftImage,
            firstSignature: {
              docHash: status.docHash,
              request: status.requestId ?? requestId,
              signedAt: new Date().toISOString(),
            },
          }),
    );
  };

  /* ── Share helpers ── */

  const canShareAsPdf =
    !!status &&
    doc.pdf &&
    !doc.embeddedRequest &&
    !!doc.bytes &&
    !!doc.file &&
    !hashMismatch;

  const downloadRequestPdf = async () => {
    if (!canShareAsPdf || !status?.docHash || activeNetworkId == null) return;
    try {
      const pdf = await embedRequestInPdf(
        doc.bytes!,
        {
          v: 1,
          requestKey: status.requestId ?? requestId,
          networkId: activeNetworkId,
          docHash: status.docHash,
        },
        doc.bytes!,
        doc.file!.name,
      );
      downloadBytes(
        pdf,
        `${stripExtension(doc.file!.name)}-request.pdf`,
        'application/pdf',
      );
    } catch {
      /* the share link keeps working */
    }
  };

  /* ── Completed on-ledger signing → downloadable certificate ── */
  // Every mode yields an artifact: an on-chain-backed certificate (signatures
  // have no ROLA proof; each is proven by its on-ledger signature NFT).
  const onChainCertificate = () =>
    buildOnChainCertificate({
      docHash: status?.docHash ?? docHash,
      fileName: doc.file?.name ?? 'document',
      fileSize: doc.file?.size ?? 0,
      networkId: activeNetworkId ?? 2,
      requiredSigners: status?.requiredSigners ?? [],
      signedAccounts: (status?.signatures ?? [])
        .filter((s) => s.signed)
        .map((s) => s.account),
      nonce: randomNonceHex(),
      requestId: status?.requestId ?? requestId,
    });

  const downloadCert = () => downloadCertificate(onChainCertificate());

  const downloadSignedPdf = async () => {
    const cert = onChainCertificate();
    if (!doc.pdf || !doc.bytes || !doc.file) return downloadCertificate(cert);
    try {
      // Watermark is a visible layer; the original bytes are embedded intact so
      // the document hash is preserved for verification.
      const visible = await applyWatermark(doc.bytes, watermark);
      const pdf = await embedCertificateInPdf(
        visible,
        cert,
        doc.bytes,
        await signaturePageOptions(cert, t, language),
      );
      downloadBytes(pdf, `${stripExtension(doc.file.name)}-signed.pdf`, 'application/pdf');
    } catch {
      downloadCertificate(cert);
    }
  };

  /* ── Create mode (no request yet) ── */
  if (!requestId) {
    return (
      <div className="space-y-4">
        <ToolSection
          title={solo ? t.onchain.soloTitle : t.onchain.requestTitle}
          hint={solo ? t.onchain.soloHint : t.onchain.requestHint}
        >
          {!solo && (
            <OptionButtons<InviteMode>
              value={inviteMode}
              onChange={setInviteMode}
              disabled={busy}
              options={[
                {
                  value: 'sign',
                  label: t.onchain.inviteSign,
                  description: t.onchain.inviteSignDesc,
                },
                {
                  value: 'send',
                  label: t.onchain.inviteSend,
                  description: t.onchain.inviteSendDesc,
                },
              ]}
            />
          )}
          {!docHash && <Muted text={t.onchain.needFile} />}
          {!solo && docHash && cleanSigners.length === 0 && (
            <Muted text={t.onchain.needSigners} />
          )}
          {invalidSigner && (
            <Danger text={`${t.onchain.invalidSigner}: ${invalidSigner}`} />
          )}
          {errorMsg && <Danger text={errorMsg} />}
          {!solo && (
            <p className="text-xs" style={{ color: 'var(--color-warning, #b45309)' }}>
              ⚠ {t.onchain.depositWarning}
            </p>
          )}
        </ToolSection>

        {/* Action buttons render at the panel's bottom level (outside the box)
            so they match the off-ledger layout. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!canCreate}
            onClick={onCreate}
            className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : alsoSign ? (
              <FileSignature className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {busy
              ? t.onchain.creating
              : alsoSign
                ? t.actions.sign
                : t.onchain.sendInvites}
          </button>
          <SimulateButton
            t={consoleT.simulate}
            onClick={simulateCreate}
            disabled={!canCreate}
            loading={preview.isSimulating}
          />
        </div>
        <SimulateResultCard
          t={consoleT.simulate}
          preview={preview.preview}
          error={preview.error}
          onClose={preview.reset}
        />

        <ManualKey
          t={t}
          value={keyInput}
          onChange={setKeyInput}
          onLoad={() => setRequestId(keyInput.trim())}
          busy={busy}
        />
      </div>
    );
  }

  /* ── Request loaded: summary + share + status + sign ── */
  return (
    <div className="space-y-4">
      <ToolSection title={t.onchain.summaryTitle}>
        {status && <RequestSummary t={t} status={status} />}
        {notFound && <Danger text={t.onchain.notFound} />}
        {hashMismatch && <Danger text={t.onchain.fileMismatch} />}
        {!docHash && <Muted text={t.onchain.needFile} />}
        {status && !!docHash && !hashMismatch && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {t.onchain.hashMatches}
          </p>
        )}
      </ToolSection>

      {requestId && status && !status.complete && (
        <ShareLinkSection
          t={t}
          requestKey={status.requestId ?? requestId}
          docName={doc.file?.name}
          fileName={doc.file?.name ?? null}
          fileType={doc.file?.type ?? null}
          bytes={doc.bytes}
          outputs={outputs}
          watermark={{ kind: watermark.kind, text: watermark.text }}
          networkId={statusNetworkId ?? undefined}
        >
          {canShareAsPdf && (
            <>
              <button
                type="button"
                onClick={downloadRequestPdf}
                className="flex items-center gap-2 text-xs font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                <Download className="size-3.5" />
                {t.onchain.downloadRequestPdf}
              </button>
              <Muted text={t.onchain.downloadRequestPdfHint} />
            </>
          )}
        </ShareLinkSection>
      )}

      <ToolSection
        title={t.onchain.statusTitle}
        action={
          <button
            type="button"
            onClick={() => statusQuery.refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t.onchain.checking : t.onchain.refresh}
          </button>
        }
      >
        {status?.signatures && (
          <>
            <p
              className="text-sm font-semibold"
              style={{ color: status.complete ? 'var(--color-success)' : 'var(--color-text-muted)' }}
            >
              {signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
              {signatures.length}
              {status.complete ? ` · ${t.onchain.complete}` : ''}
            </p>
            <ul className="space-y-1.5 text-sm">
              {signatures.map((s) => (
                <li key={s.account} className="flex items-center gap-2">
                  {s.signed ? (
                    <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
                  ) : (
                    <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                  <span
                    className="font-mono text-[12px] break-all"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    {s.account}
                  </span>
                  {walletAddresses.has(s.account) && (
                    <span
                      className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: 'var(--color-surface)',
                        color: 'var(--color-primary)',
                        border: '1px solid var(--color-card-border)',
                      }}
                    >
                      {t.onchain.youBadge}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!status.complete && <Muted text={t.onchain.autoRefreshNote} />}
          </>
        )}
      </ToolSection>

      {status?.complete ? (
        <ToolSection>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)]">
              <BadgeCheck className="size-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                {t.onchain.completeTitle}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t.onchain.completeBody}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {(outputs.includes('detached') ||
              !(outputs.includes('embedded') && doc.pdf)) && (
              <button
                type="button"
                onClick={downloadCert}
                className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
              >
                <Download className="size-4" />
                {t.actions.downloadCert}
              </button>
            )}
            {outputs.includes('embedded') && doc.pdf && (
              <button
                type="button"
                onClick={downloadSignedPdf}
                className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
              >
                <Download className="size-4" />
                {t.actions.downloadPdf}
              </button>
            )}
          </div>
        </ToolSection>
      ) : (
        // Rendered even before the status resolves (or if the lookup fails):
        // the sign + simulate buttons must always be visible on a shared-link
        // page, disabled until signing is actually possible.
        <ToolSection title={t.onchain.signSectionTitle}>
          {loading && !statusQuery.data ? (
            <Muted text={t.onchain.checkingEligibility} />
          ) : statusQuery.isError ? (
            <Danger text={t.onchain.statusError} />
          ) : notFound ? (
            <Muted text={t.onchain.notFound} />
          ) : wrongNetwork ? (
            <Danger
              text={t.onchain.wrongNetwork.replace(
                /\{network\}/g,
                NETWORKS[requestNetworkId!]?.networkName ?? '',
              )}
            />
          ) : status && !eligible ? (
            <>
              <Danger text={t.onchain.notEligible} />
              <Muted text={t.onchain.notEligibleHint} />
            </>
          ) : alreadySigned ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
              <BadgeCheck className="size-4 shrink-0" />
              {t.onchain.alreadySigned}
            </p>
          ) : status ? (
            <>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <BadgeCheck className="size-3.5 shrink-0 text-[var(--color-success)]" />
                {t.onchain.inviteInWallet}
              </p>
              {!setup.seal && setup.ready && (
                <div
                  className="rounded-xl border p-3.5 space-y-2"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-card-border)',
                  }}
                >
                  <p
                    className="flex items-center gap-2 text-xs font-bold"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    {t.onchain.sealStep}
                  </p>
                  <div className="space-y-2 pl-6">
                    {!sealDeployed ? (
                      <Muted text={t.onchain.sealNotDeployed} />
                    ) : (
                      <>
                        <Muted text={t.onchain.sealMissing} />
                        <button
                          type="button"
                          disabled={busy || !actingAccount}
                          onClick={async () => {
                            if (!actingAccount) return;
                            const ok = await mintSeal({
                              account: actingAccount,
                              imageUrl: nftImage,
                            });
                            if (ok) setup.refetch();
                          }}
                          className="flex items-center gap-2 px-4 h-9 rounded-full font-bold text-xs text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                        >
                          {phase === 'minting-seal' ? (
                            <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          ) : (
                            <Stamp className="size-3.5" />
                          )}
                          {phase === 'minting-seal'
                            ? t.onchain.sealMinting
                            : t.onchain.sealGet}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {setup.seal && !setup.collection && (
                <Muted text={t.onchain.firstSignNote} />
              )}
              {/* Which collection this signature will be recorded in, and a
                  way out if the account holds more than one. */}
              <SignCollectionSwitch t={t} account={actingAccount} setup={setup} />
              {errorMsg && <Danger text={errorMsg} />}
            </>
          ) : null}
          {!alreadySigned && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!canSign}
                  onClick={onSign}
                  className="flex w-full items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {phase === 'signing' || phase === 'creating-collection' ? (
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {phase === 'signing' || phase === 'creating-collection'
                    ? t.onchain.signing
                    : t.onchain.sign}
                </button>
                <SimulateButton
                  t={consoleT.simulate}
                  onClick={simulateSign}
                  disabled={!canSign}
                  loading={preview.isSimulating}
                />
              </div>
              {status && !!docHash && hashMismatch && (
                <Danger text={t.onchain.fileMismatch} />
              )}
              {status && !docHash && <Muted text={t.onchain.needFile} />}
              <SimulateResultCard
                t={consoleT.simulate}
                preview={preview.preview}
                error={preview.error}
                onClose={preview.reset}
              />
            </>
          )}
        </ToolSection>
      )}

      <ManualKey
        t={t}
        value={keyInput}
        onChange={setKeyInput}
        onLoad={() => setRequestId(keyInput.trim())}
        busy={busy}
      />
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────────── */

function RequestSummary({
  t,
  status,
}: {
  t: SignDictionary;
  status: OnChainStatus;
}) {
  const issuer = status.issuer;
  return (
    <div className="space-y-2">
      {(issuer?.orgName || issuer?.orgWebsite) && (
        <span
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--color-text-main)' }}
        >
          <Building2 className="size-3.5 shrink-0" />
          {issuer.orgName ?? ''}
          {issuer.orgWebsite && (
            <a
              href={issuer.orgWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {issuer.orgWebsite.replace(/^https?:\/\//, '')}
            </a>
          )}
        </span>
      )}
      {issuer?.account && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.issuedBy}:{' '}
          <span className="font-mono break-all">{issuer.account}</span>
        </p>
      )}
      {status.docHash && (
        <p className="font-mono text-[11px] break-all" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.requestHash}: {status.docHash}
        </p>
      )}
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return (
    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      {text}
    </p>
  );
}

function Danger({ text }: { text: string }) {
  return (
    <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
      {text}
    </p>
  );
}

function ManualKey({
  t,
  value,
  onChange,
  onLoad,
  busy,
}: {
  t: SignDictionary;
  value: string;
  onChange: (v: string) => void;
  onLoad: () => void;
  busy: boolean;
}) {
  return (
    <ToolSection title={t.onchain.keyLabel}>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.onchain.keyPlaceholder}
          disabled={busy}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        />
        <button
          type="button"
          onClick={onLoad}
          disabled={busy || !value.trim()}
          className="px-4 rounded-xl border font-bold text-xs disabled:opacity-40"
          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
        >
          {t.onchain.load}
        </button>
      </div>
    </ToolSection>
  );
}
