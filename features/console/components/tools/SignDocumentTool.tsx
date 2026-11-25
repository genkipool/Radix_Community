'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentFile } from '@/features/sign/hooks/useDocumentFile';
import { useSealSetup } from '@/features/sign/hooks/useSealRequest';
import { useSharedSignLink } from '@/features/sign/hooks/useSharedSignLink';
import { BasicSignForm } from '@/features/sign/components/BasicSignForm';
import { EmbeddedPdfDetails } from '@/features/sign/components/EmbeddedPdfDetails';
import {
  ReceiveStatusLine,
  ReceivedSignedActions,
  ReceivingChannelCard,
  SignGate,
} from '@/features/sign/components/SignDocumentChrome';
import { SignForm } from '@/features/sign/components/SignForm';
import { VerifyForm } from '@/features/sign/components/VerifyForm';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import { AccountPicker } from '../shared/AccountPicker';
import { FileDropzone } from '../shared/FileDropzone';
import { ToolSection } from '../shared/ToolSection';
import type { ConsoleToolProps } from '../ConsoleToolView';

type Tab = 'basic' | 'sign' | 'verify';

/**
 * Console tool: document signing & verification.
 * Coordinates tabs (Basic / Advanced / Verify), shared request links, P2P file
 * receipt, and acting on-chain account selection.
 */
export default function SignDocumentTool({ t: consoleT }: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.sign as SignDictionary;
  const { isConnected, accounts } = useRadixWallet();
  const doc = useDocumentFile(t);

  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const shared = useSharedSignLink({
    doc,
    onAutoSwitchVerify: () => setTabOverride('verify'),
  });

  const initialTab: Tab =
    shared.tabParam === 'verify' ||
    shared.tabParam === 'sign' ||
    shared.tabParam === 'basic'
      ? shared.tabParam
      : shared.hasRequestParam
        ? 'sign'
        : 'basic';
  const tab = tabOverride ?? initialTab;
  const effectiveTab: Tab =
    tab === 'basic' && doc.embeddedRequest ? 'sign' : tab;

  const [onchainAccount, setOnchainAccount] = useState<string | null>(null);
  const effectiveOnchainAccount =
    onchainAccount ?? accounts[0]?.address ?? null;
  const setup = useSealSetup(effectiveOnchainAccount);

  const [onchain, setOnchain] = useState(shared.hasRequestParam);
  const needsOnboarding =
    isConnected &&
    !shared.hasRequestParam &&
    !doc.embeddedRequest &&
    onchain &&
    setup.ready &&
    !(setup.seal && setup.collection);
  const cleanOnboarding = effectiveTab === 'sign' && needsOnboarding;

  if (!t) return null;
  if (shared.receiving) {
    return <ReceivingChannelCard t={t} receive={shared.receive} />;
  }

  const hasMatchingFileForRequest =
    shared.hasRequestParam &&
    effectiveTab === 'sign' &&
    !!doc.file &&
    !!doc.docHash &&
    !doc.fileError &&
    (shared.receive.phase === 'done' ||
      (!!shared.sharedRequestDocHash &&
        doc.docHash.toLowerCase() ===
          shared.sharedRequestDocHash.toLowerCase()));

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
            onClick={() => setTabOverride(key)}
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

      {effectiveTab === 'sign' && isConnected && (
        <ToolSection title={t.onchain.account}>
          <AccountPicker value={onchainAccount} onChange={setOnchainAccount} />
        </ToolSection>
      )}

      {effectiveTab === 'verify' && (
        <VerifyForm
          t={t}
          doc={doc}
          initialRequestKey={shared.sharedRequestKey}
        />
      )}

      {!cleanOnboarding && (
        <>
          {effectiveTab !== 'verify' && (
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <strong style={{ color: 'var(--color-text-main)' }}>
                {t.disclaimer.title}.
              </strong>{' '}
              {t.disclaimer.body}
            </p>
          )}

          <ToolSection>
            {shared.hasRequestParam && effectiveTab === 'sign' && (
              <div
                className="rounded-xl border px-4 py-3 space-y-1 text-sm"
                style={{
                  borderColor: hasMatchingFileForRequest
                    ? 'var(--color-success)'
                    : 'var(--color-card-border)',
                  background: 'var(--color-surface)',
                }}
              >
                {(shared.requestDocName || doc.file?.name) && (
                  <p style={{ color: 'var(--color-text-main)' }}>
                    <span className="font-semibold">
                      {t.onchain.requestDocLabel}:
                    </span>{' '}
                    {doc.file?.name ?? shared.requestDocName}
                  </p>
                )}
                {!hasMatchingFileForRequest && (
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    {t.onchain.requestFilePrompt}
                  </p>
                )}
                <ReceiveStatusLine t={t} receive={shared.receive} />
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
            {!shared.hasRequestParam && (
              <ReceiveStatusLine t={t} receive={shared.receive} />
            )}
            {!hasMatchingFileForRequest && (
              <FileDropzone
                extension=""
                label={t.file.label}
                prompt={t.file.prompt}
                file={doc.file}
                onFile={doc.onFile}
                busy={doc.hashing}
                error={doc.fileError}
              />
            )}
            {doc.docHash && !doc.hashing && (
              <div className="space-y-1">
                <p
                  className="text-[11px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
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
            <EmbeddedPdfDetails t={t} doc={doc} />
          </ToolSection>
        </>
      )}

      {effectiveTab === 'basic' ? (
        <SignGate t={t}>
          <BasicSignForm t={t} consoleT={consoleT} doc={doc} />
        </SignGate>
      ) : effectiveTab === 'sign' ? (
        <SignGate t={t} preferredNetwork={shared.requestNetworkId}>
          <SignForm
            t={t}
            consoleT={consoleT}
            doc={doc}
            sharedRequestKey={shared.sharedRequestKey}
            sharedOutputs={shared.sharedOutputs ?? undefined}
            sharedWatermark={shared.sharedWatermark ?? undefined}
            onchainAccount={effectiveOnchainAccount}
            onOnchainAccountChange={setOnchainAccount}
            onchain={onchain}
            onOnchainChange={setOnchain}
            setup={setup}
            needsOnboarding={needsOnboarding}
          />
        </SignGate>
      ) : null}

      {shared.receivedSigned && (
        <ReceivedSignedActions
          t={t}
          receivedSigned={shared.receivedSigned}
        />
      )}
    </div>
  );
}
