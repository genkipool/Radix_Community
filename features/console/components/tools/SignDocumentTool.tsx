'use client';

import { useState, type ReactNode } from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { SignForm } from '@/features/sign/components/SignForm';
import { VerifyForm } from '@/features/sign/components/VerifyForm';
import { useDocumentFile } from '@/features/sign/hooks/useDocumentFile';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import type { ConsoleToolProps } from '../ConsoleToolView';

type Tab = 'sign' | 'verify';

/**
 * Console tool: document signing & verification. The page header (title +
 * description) is supplied by ConsoleToolView. Strings come from the `sign`
 * namespace, enriched into the language context by the console layout.
 */
export default function SignDocumentTool({ t: consoleT }: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.sign as SignDictionary;
  const [tab, setTab] = useState<Tab>('sign');
  const doc = useDocumentFile(t);

  if (!t) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div
        className="flex gap-6 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {(['sign', 'verify'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="relative pb-2.5 text-sm font-bold transition-colors"
            style={{
              color:
                tab === key
                  ? 'var(--color-text-main)'
                  : 'var(--color-text-muted)',
            }}
          >
            {key === 'sign' ? t.tabs.sign : t.tabs.verify}
            {tab === key && (
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

      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <strong style={{ color: 'var(--color-text-main)' }}>
          {t.disclaimer.title}.
        </strong>{' '}
        {t.disclaimer.body}
      </p>

      <ToolSection>
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
      </ToolSection>

      {tab === 'sign' ? (
        <SignGate t={t}>
          <SignForm t={t} consoleT={consoleT} doc={doc} />
        </SignGate>
      ) : (
        <VerifyForm t={t} doc={doc} />
      )}
    </div>
  );
}

/** Renders children only when a wallet session is active; else a connect prompt. */
function SignGate({ t, children }: { t: SignDictionary; children: ReactNode }) {
  const { isConnected, isLoading, connect } = useRadixWallet();
  if (isConnected) return <>{children}</>;

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
          onClick={() => connect(RadixNetworkId.Mainnet)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          <ShieldCheck className="size-4" />
          {t.connect.mainnet}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => connect(RadixNetworkId.Stokenet)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          {t.connect.stokenet}
        </button>
      </div>
    </div>
  );
}
