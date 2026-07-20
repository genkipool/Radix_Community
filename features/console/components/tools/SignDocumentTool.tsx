'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ShieldCheck, Wallet } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSealSetup } from '@/features/sign/hooks/useSealRequest';
import { useReceiveFileChannel } from '@/features/sign/hooks/useFileChannel';
import {
  networkIdFromResource,
  parseOutputsParam,
  parseSendRoom,
  parseWatermarkParams,
} from '@/features/sign/lib/share';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { AccountPicker } from '@/features/console/components/shared/AccountPicker';
import { BasicSignForm } from '@/features/sign/components/BasicSignForm';
import { EmbeddedPdfDetails } from '@/features/sign/components/EmbeddedPdfDetails';
import { SignForm } from '@/features/sign/components/SignForm';
import { VerifyForm } from '@/features/sign/components/VerifyForm';
import { useDocumentFile } from '@/features/sign/hooks/useDocumentFile';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import type { ConsoleToolProps } from '../ConsoleToolView';

type Tab = 'basic' | 'sign' | 'verify';

/**
 * Console tool: document signing & verification. The page header (title +
 * description) is supplied by ConsoleToolView. Strings come from the `sign`
 * namespace, enriched into the language context by the console layout.
 */
export default function SignDocumentTool({ t: consoleT }: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.sign as SignDictionary;
  const { isConnected, accounts, switchNetwork } = useRadixWallet();
  // A shared on-chain request link belongs to the advanced tab. Two formats:
  // directory (`…/sign-document/r/<collection>/<id>`) and legacy `?req=`.
  const routeParams = useParams<{ collection?: string; id?: string }>();
  const searchParams = useSearchParams();
  const sharedRequestKey =
    searchParams.get('req') ??
    (routeParams.collection && routeParams.id
      ? `${routeParams.collection}:#${routeParams.id}#`
      : undefined);
  const requestDocName = searchParams.get('doc') ?? undefined;
  // Delivery choices the initiator baked into the link, so the co-signer gets
  // the exact same output without re-picking anything.
  const sharedOutputs = parseOutputsParam(searchParams.get('out'));
  const sharedWatermark = parseWatermarkParams(
    searchParams.get('wm'),
    searchParams.get('wmt'),
  );
  const hasRequestParam = !!sharedRequestKey;
  // The request key names its network in the resource prefix: the connect
  // gate pre-selects it so the co-signer lands on the right network.
  const requestNetworkId = sharedRequestKey
    ? (networkIdFromResource(sharedRequestKey) as RadixNetworkId | null)
    : null;

  // Opening a shared link switches the app to the request's network once, so
  // the page loads pointed at the right ledger (the user can still switch).
  // Deferred past the wallet provider's own cookie-restore tick (setTimeout 0
  // on mount) so the link's network wins the initial selection.
  const networkForced = useRef(false);
  useEffect(() => {
    if (requestNetworkId == null || networkForced.current) return;
    networkForced.current = true;
    const wanted =
      requestNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
    setTimeout(() => switchNetwork(wanted), 150);
  }, [requestNetworkId, switchNetwork]);

  // Direct document delivery: the share link may carry a P2P room id in the
  // URL fragment. Read it once, strip it from the address bar (it is a
  // capability), and receive the document straight into the dropzone.
  const [sendRoom, setSendRoom] = useState<string | null>(null);
  useEffect(() => {
    const room = parseSendRoom(window.location.hash);
    if (!room) return;
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
    // Deferred: state updates must never run synchronously in an effect.
    const timer = setTimeout(() => setSendRoom(room), 0);
    return () => clearTimeout(timer);
  }, []);
  // A shared request forces the advanced tab; otherwise an optional `?tab=`
  // param can deep-link into a specific tab (e.g. verify from the seal page).
  const tabParam = searchParams.get('tab');
  const initialTab: Tab = hasRequestParam
    ? 'sign'
    : tabParam === 'verify' || tabParam === 'sign' || tabParam === 'basic'
      ? tabParam
      : 'basic';
  const [tab, setTab] = useState<Tab>(initialTab);
  const doc = useDocumentFile(t);
  // The room fragment alone is enough: document-delivery links (no on-ledger
  // request) also feed the received file into the dropzone.
  const receive = useReceiveFileChannel({
    roomId: sendRoom,
    onFile: (file) => {
      void doc.onFile(file);
    },
  });
  // A dropped PDF carrying an embedded request also needs the advanced flow.
  const effectiveTab: Tab =
    tab === 'basic' && doc.embeddedRequest ? 'sign' : tab;

  // One-time on-ledger setup (seal + collection) for the acting account.
  // While it is missing, the advanced tab shows ONLY the onboarding — no
  // file upload, no other boxes (co-signers via shared request are exempt).
  const [onchainAccount, setOnchainAccount] = useState<string | null>(null);
  const effectiveOnchainAccount =
    onchainAccount ?? accounts[0]?.address ?? null;
  const setup = useSealSetup(effectiveOnchainAccount);
  // On-chain ("en cadena") toggle, lifted here so the seal/collection check only
  // runs once on-chain is selected: off-chain signing never needs them.
  const [onchain, setOnchain] = useState(hasRequestParam);
  const needsOnboarding =
    isConnected &&
    !hasRequestParam &&
    !doc.embeddedRequest &&
    onchain &&
    setup.ready &&
    !(setup.seal && setup.collection);
  const cleanOnboarding = effectiveTab === 'sign' && needsOnboarding;

  if (!t) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div
        className="flex gap-6 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {(['basic', 'sign', 'verify'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="relative pb-2.5 text-sm font-bold transition-colors"
            style={{
              color:
                effectiveTab === key
                  ? 'var(--color-text-main)'
                  : 'var(--color-text-muted)',
            }}
          >
            {key === 'basic'
              ? t.tabs.basic
              : key === 'sign'
                ? t.tabs.sign
                : t.tabs.verify}
            {effectiveTab === key && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, var(--color-accent), var(--color-primary))',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* On-chain acting account at the very top (advanced tab): the selectable
          address buttons live here, not inside the Seal onboarding box, so you
          can pick/check the address whether or not it already has its seal. */}
      {effectiveTab === 'sign' && isConnected && (
        <ToolSection title={t.onchain.account}>
          <AccountPicker value={onchainAccount} onChange={setOnchainAccount} />
        </ToolSection>
      )}

      {/* During onboarding the advanced tab shows ONLY what must be done now. */}
      {!cleanOnboarding && (
        <>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <strong style={{ color: 'var(--color-text-main)' }}>
              {effectiveTab === 'verify' ? t.verify.aboutTitle : t.disclaimer.title}.
            </strong>{' '}
            {effectiveTab === 'verify' ? t.verify.aboutBody : t.disclaimer.body}
          </p>

          <ToolSection>
            {/* The request context lives WITH the document box: the co-signer's
                one job here is uploading the file the request refers to. */}
            {hasRequestParam && effectiveTab === 'sign' && (
              <div
                className="rounded-xl border px-4 py-3 space-y-1 text-sm"
                style={{
                  borderColor: 'var(--color-card-border)',
                  background: 'var(--color-surface)',
                }}
              >
                {requestDocName && (
                  <p style={{ color: 'var(--color-text-main)' }}>
                    <span className="font-semibold">
                      {t.onchain.requestDocLabel}:
                    </span>{' '}
                    {requestDocName}
                  </p>
                )}
                <p style={{ color: 'var(--color-text-muted)' }}>
                  {t.onchain.requestFilePrompt}
                </p>
                {receive.phase !== 'idle' && (
                  <p
                    className="text-xs font-semibold"
                    style={{
                      color:
                        receive.phase === 'error'
                          ? 'var(--color-danger, #dc2626)'
                          : receive.phase === 'done'
                            ? 'var(--color-success)'
                            : 'var(--color-text-muted)',
                    }}
                  >
                    {receive.phase === 'connecting'
                      ? t.onchain.recvConnecting
                      : receive.phase === 'receiving'
                        ? `${t.onchain.recvReceiving} ${Math.round(receive.progress * 100)}%`
                        : receive.phase === 'done'
                          ? t.onchain.recvDone
                          : t.onchain.recvError}
                  </p>
                )}
              </div>
            )}
            {effectiveTab === 'basic' && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.basic.hint}
              </p>
            )}
            {/* Document-delivery links have no request box, so the live
                receive status shows here, next to the dropzone it fills. */}
            {!hasRequestParam && receive.phase !== 'idle' && (
              <p
                className="text-xs font-semibold"
                style={{
                  color:
                    receive.phase === 'error'
                      ? 'var(--color-danger, #dc2626)'
                      : receive.phase === 'done'
                        ? 'var(--color-success)'
                        : 'var(--color-text-muted)',
                }}
              >
                {receive.phase === 'connecting'
                  ? t.onchain.recvConnecting
                  : receive.phase === 'receiving'
                    ? `${t.onchain.recvReceiving} ${Math.round(receive.progress * 100)}%`
                    : receive.phase === 'done'
                      ? t.onchain.recvDone
                      : t.onchain.recvError}
              </p>
            )}
            <FileDropzone
              extension=""
              label={t.file.label}
              prompt={t.file.prompt}
              file={doc.file}
              onFile={doc.onFile}
              busy={doc.hashing}
              error={doc.fileError}
            />
            {doc.docHash && !doc.hashing && (
              <div className="space-y-1">
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {t.file.ready}
                </p>
                <p
                  className="font-mono text-[11px] break-all"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  blake2b-256: {doc.docHash}
                </p>
              </div>
            )}
            {/* What the dropped PDF carries inside (certificate, original,
                request pointer), broken down where the file lives. */}
            <EmbeddedPdfDetails t={t} doc={doc} />
          </ToolSection>
        </>
      )}

      {effectiveTab === 'basic' ? (
        <SignGate t={t}>
          <BasicSignForm t={t} consoleT={consoleT} doc={doc} />
        </SignGate>
      ) : effectiveTab === 'sign' ? (
        <SignGate t={t} preferredNetwork={requestNetworkId}>
          <SignForm
            t={t}
            consoleT={consoleT}
            doc={doc}
            sharedRequestKey={sharedRequestKey}
            sharedOutputs={sharedOutputs ?? undefined}
            sharedWatermark={sharedWatermark ?? undefined}
            onchainAccount={effectiveOnchainAccount}
            onOnchainAccountChange={setOnchainAccount}
            onchain={onchain}
            onOnchainChange={setOnchain}
            setup={setup}
            needsOnboarding={needsOnboarding}
          />
        </SignGate>
      ) : (
        <VerifyForm t={t} doc={doc} />
      )}
    </div>
  );
}

/** Renders children only when a wallet session is active; else a connect prompt. */
function SignGate({
  t,
  preferredNetwork,
  children,
}: {
  t: SignDictionary;
  /** Network named by a shared request key: its connect button goes primary. */
  preferredNetwork?: RadixNetworkId | null;
  children: ReactNode;
}) {
  const { isConnected, isLoading, connect } = useRadixWallet();
  if (isConnected) return <>{children}</>;

  const primary = preferredNetwork ?? RadixNetworkId.Mainnet;
  const secondary =
    primary === RadixNetworkId.Mainnet
      ? RadixNetworkId.Stokenet
      : RadixNetworkId.Mainnet;
  const label = (id: RadixNetworkId) =>
    id === RadixNetworkId.Mainnet ? t.connect.mainnet : t.connect.stokenet;

  return (
    <div
      className="rounded-3xl border p-10 flex flex-col items-center text-center gap-5"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <div className="size-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] shadow-lg">
        <Wallet className="size-7 text-white" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t.connect.title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t.connect.subtitle}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => connect(primary)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          <ShieldCheck className="size-4" />
          {label(primary)}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => connect(secondary)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          {label(secondary)}
        </button>
      </div>
    </div>
  );
}
