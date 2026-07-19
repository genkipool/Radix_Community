'use client';

import { useState } from 'react';
import { CheckCircle2, Download, KeyRound, Trash2, XCircle } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { requestAccountProof } from '@/features/wallet/lib/rola-proof';
import type { CipherDictionary } from '../types/dictionary';
import type { CipherErrorCode } from '../types/cipher.types';
import { deriveUnlockChallenge } from '../lib/keys';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useReceiveSession } from '../hooks/useReceiveSession';
import { ContainerMetaCard } from './ContainerMetaCard';
import { ReceiverNameField, usePersonaName } from './ReceiverNameField';
import { TransferProgress } from './TransferProgress';

/**
 * Flow A guest view (opened via a `#m=receive` share URL): receive the
 * encrypted file browser-to-browser, then ask the sender for the key. On
 * ROLA + Ledger containers the request itself is a signed ROLA challenge
 * from the invited account.
 */
export function ReceiveView({
  t,
  roomId,
}: {
  t: CipherDictionary;
  roomId: string;
}) {
  const session = useReceiveSession(roomId);
  const personaName = usePersonaName();
  const [name, setName] = useState(() => personaName ?? '');
  const [deleted, setDeleted] = useState(false);
  useLeaveWarning(
    session.phase === 'receiving' || session.phase === 'waitingApproval',
  );

  const { activeNetworkId } = useRadixWallet();
  const [proofError, setProofError] = useState<CipherErrorCode | null>(null);
  const [signingProof, setSigningProof] = useState(false);
  const ledgerProtected = session.head?.header.access === 'rola-ledger';

  /** ROLA + Ledger: sign the session-bound challenge, then send the request. */
  const requestWithProof = async () => {
    const head = session.head;
    if (!head) return;
    setProofError(null);
    if (activeNetworkId == null || activeNetworkId !== head.header.networkId) {
      setProofError('network_mismatch');
      return;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setProofError('wallet_rejected');
      return;
    }
    setSigningProof(true);
    try {
      const challenge = deriveUnlockChallenge({
        headerHash: head.headerHash,
        roomId,
        networkId: head.header.networkId,
      });
      const proof = await requestAccountProof(rdt, challenge);
      session.requestDecrypt(name.trim() || proof.account, {
        account: proof.account,
        publicKey: proof.publicKey,
        signature: proof.signature,
        curve: proof.curve,
      });
    } catch (e) {
      setProofError(
        e instanceof Error && e.message === 'wallet_rejected'
          ? 'wallet_rejected'
          : 'no_proof',
      );
    } finally {
      setSigningProof(false);
    }
  };

  const requestable = session.phase === 'received' || session.phase === 'denied';

  return (
    <div className="space-y-6">
      <ToolSection title={t.receiver.receivedTitle}>
        {session.head && <ContainerMetaCard t={t} head={session.head} />}

        {session.phase === 'connecting' && (
          <TransferProgress label={t.progress.connecting} />
        )}
        {session.phase === 'receiving' && (
          <TransferProgress label={t.progress.receiving} fraction={session.progress} />
        )}
        {session.phase === 'waitingApproval' && (
          <TransferProgress label={t.progress.waitingApproval} />
        )}
        {session.phase === 'decrypting' && (
          <TransferProgress label={t.progress.decrypting} fraction={session.progress} />
        )}
        {session.phase === 'done' && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <CheckCircle2 className="size-4" />
            {t.receiver.saveDecrypted} ✓
          </p>
        )}
        {session.phase === 'denied' && (
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
            <XCircle className="size-4" />
            {session.error ? t.errors[session.error] : t.request.denied}
          </p>
        )}
        {session.phase === 'error' && session.error && (
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
            <XCircle className="size-4" />
            {t.errors[session.error]}
          </p>
        )}
      </ToolSection>

      {requestable && (
        ledgerProtected ? (
          <WalletConnectGate
            title={t.ledger.requestGateTitle}
            subtitle={t.ledger.requestGateSubtitle}
            mainnetLabel={t.connect.mainnet}
            stokenetLabel={t.connect.stokenet}
          >
            <ToolSection hint={t.ledger.requestGateSubtitle}>
              <ReceiverNameField t={t} value={name} onChange={setName} />
              {proofError && (
                <p className="text-xs font-medium text-[var(--color-danger)]">
                  {t.errors[proofError]}
                </p>
              )}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <button
                  type="button"
                  disabled={signingProof}
                  onClick={() => void requestWithProof()}
                  className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                >
                  {signingProof ? (
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {signingProof ? t.progress.signing : t.ledger.requestWithProof}
                </button>
                <button
                  type="button"
                  onClick={() => void session.downloadEncrypted()}
                  className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                  style={{
                    borderColor: 'var(--color-card-border)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <Download className="size-4" />
                  {t.receiver.downloadEncrypted}
                </button>
              </div>
            </ToolSection>
          </WalletConnectGate>
        ) : (
          <ToolSection>
            <ReceiverNameField t={t} value={name} onChange={setName} />
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => session.requestDecrypt(name.trim())}
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                <KeyRound className="size-4" />
                {t.receiver.decryptButton}
              </button>
              <button
                type="button"
                onClick={() => void session.downloadEncrypted()}
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                style={{
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              >
                <Download className="size-4" />
                {t.receiver.downloadEncrypted}
              </button>
            </div>
          </ToolSection>
        )
      )}

      {session.phase === 'done' && !deleted && (
        <button
          type="button"
          onClick={() => {
            void session.deleteLocalCopy();
            setDeleted(true);
          }}
          className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Trash2 className="size-3.5" />
          {t.receiver.deleteLocal}
        </button>
      )}
    </div>
  );
}
