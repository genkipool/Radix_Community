'use client';

import type { ReactNode } from 'react';
import { FileDown, ShieldCheck, Wallet } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { ProgressRow } from '@/features/p2p/components/ProgressRow';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { useReceiveFileChannel } from '../hooks/useFileChannel';
import type { ReceivedSignedFile } from '../hooks/useSharedSignLink';
import { downloadBytes, downloadCertificate } from '../lib/certificate';
import type { SignDictionary } from '../types/dictionary';

type ReceiveState = ReturnType<typeof useReceiveFileChannel>;

/** Compact live P2P transfer status line shared by request & plain links. */
export function ReceiveStatusLine({
  t,
  receive,
}: {
  t: SignDictionary;
  receive: ReceiveState;
}) {
  if (receive.phase === 'idle') return null;
  return (
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
  );
}

/** Focused full-page progress card while a P2P document transfer is in flight. */
export function ReceivingChannelCard({
  t,
  receive,
}: {
  t: SignDictionary;
  receive: ReceiveState;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ToolSection title={t.onchain.recvTitle} hint={t.onchain.recvHint}>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
            <FileDown className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-bold"
              style={{ color: 'var(--color-text-main)' }}
            >
              {t.onchain.recvTitle}
            </p>
          </div>
        </div>
        <ProgressRow
          label={
            receive.phase === 'connecting'
              ? t.onchain.recvConnecting
              : t.onchain.recvReceiving
          }
          fraction={receive.phase === 'receiving' ? receive.progress : undefined}
        />
      </ToolSection>
    </div>
  );
}

/** Download bar shown when a fully-signed PDF arrived over a P2P share link. */
export function ReceivedSignedActions({
  t,
  receivedSigned,
}: {
  t: SignDictionary;
  receivedSigned: ReceivedSignedFile;
}) {
  return (
    <div className="space-y-3">
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <strong style={{ color: 'var(--color-text-main)' }}>
          {t.onchain.recvSignedTitle}.
        </strong>{' '}
        {t.onchain.recvSignedHint}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() =>
            downloadBytes(
              receivedSigned.bytes,
              receivedSigned.name,
              'application/pdf',
            )
          }
          className="flex flex-1 items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-md transition-all hover:opacity-90 active:scale-95"
        >
          <FileDown className="size-4" />
          {t.actions.downloadPdf}
        </button>
        <button
          type="button"
          onClick={() => downloadCertificate(receivedSigned.envelope)}
          className="flex flex-1 items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <FileDown className="size-4" />
          {t.actions.downloadCert}
        </button>
      </div>
    </div>
  );
}

/** Renders children only when a wallet session is active; else a connect prompt. */
export function SignGate({
  t,
  preferredNetwork,
  children,
}: {
  t: SignDictionary;
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
        <h3
          className="text-lg font-bold"
          style={{ color: 'var(--color-text-main)' }}
        >
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
