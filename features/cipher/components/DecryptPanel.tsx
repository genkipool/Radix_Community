'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, KeyRound, Send, Stamp, XCircle } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { requestAccountProof } from '@/features/wallet/lib/rola-proof';
import { randomRoomId } from '@/features/p2p/lib/session-url';
import { SealDeployPanel } from '@/features/sign/components/SealDeployPanel';
import { SealOnboarding } from '@/features/sign/components/SealOnboarding';
import { useSealRequest, useSealSetup } from '@/features/sign/hooks/useSealRequest';
import { sealImageUrl } from '@/features/sign/constants/seal';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import { FILE_EXTENSION } from '../constants/cipher';
import type { CipherDictionary } from '../types/dictionary';
import type { CipherErrorCode, ContainerHead } from '../types/cipher.types';
import { deriveUnlockChallenge } from '../lib/keys';
import { useDecryptFlow } from '../hooks/useDecryptFlow';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useRequestSession } from '../hooks/useRequestSession';
import { ContainerMetaCard } from './ContainerMetaCard';
import { ReceiverNameField, usePersonaName } from './ReceiverNameField';
import { SharePanel } from './SharePanel';
import { TransferProgress } from './TransferProgress';

/**
 * Decrypt tab body. Two paths once a .radixseal.enc is loaded:
 *  - the connected wallet IS the sender → sign and decrypt right here;
 *  - anyone else → share an unlock URL with the sender (flow B) and decrypt
 *    locally when the key arrives. The ciphertext never leaves this browser.
 *
 * The container header tells the tab HOW the file was protected: plain ROLA
 * (anyone may ask; the sender decides) or ROLA + Ledger (the request must
 * carry a ROLA proof from an account holding the file's cipher-invite NFT).
 */
export function DecryptPanel({
  t,
  signT,
}: {
  t: CipherDictionary;
  /** Sign namespace, for the Seal onboarding of the decryption receipt. */
  signT: SignDictionary;
}) {
  const flow = useDecryptFlow();
  const remote = useRequestSession();
  const personaName = usePersonaName();
  const [name, setName] = useState(() => personaName ?? '');
  useLeaveWarning(remote.sessionActive);

  const { activeNetworkId } = useRadixWallet();
  const [proofError, setProofError] = useState<CipherErrorCode | null>(null);
  const [signingProof, setSigningProof] = useState(false);
  // The account that proved itself for a ROLA + Ledger request; the optional
  // decryption receipt mints from this same account.
  const [provenAccount, setProvenAccount] = useState<string | null>(null);

  const ledgerProtected = flow.head?.header.access === 'rola-ledger';

  const localBusy = flow.phase === 'signing' || flow.phase === 'decrypting';
  const remoteActive = remote.phase !== 'idle';
  const busy = localBusy || remoteActive;

  const onFile = (candidate: File | null) => {
    if (remoteActive) remote.reset();
    setProofError(null);
    setProvenAccount(null);
    void flow.loadFile(candidate);
  };

  /** ROLA + Ledger request: sign the session-bound challenge, then open. */
  const requestWithProof = async (file: File, head: ContainerHead) => {
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
      const roomId = randomRoomId();
      const challenge = deriveUnlockChallenge({
        headerHash: head.headerHash,
        roomId,
        networkId: head.header.networkId,
      });
      const proof = await requestAccountProof(rdt, challenge);
      setProvenAccount(proof.account);
      await remote.open(file, head, name.trim() || proof.account, {
        roomId,
        proof: {
          account: proof.account,
          publicKey: proof.publicKey,
          signature: proof.signature,
          curve: proof.curve,
        },
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

  return (
    <div className="space-y-6">
      <ToolSection>
        <FileDropzone
          extension={FILE_EXTENSION}
          label={t.file.encLabel}
          prompt={t.file.encPrompt}
          file={flow.file}
          onFile={onFile}
          busy={localBusy}
          disabled={busy}
          error={
            flow.phase === 'error' && flow.error
              ? t.errors[flow.error]
              : undefined
          }
        />

        {flow.head && <ContainerMetaCard t={t} head={flow.head} />}

        {flow.phase === 'signing' && <TransferProgress label={t.progress.signing} />}
        {flow.phase === 'decrypting' && (
          <TransferProgress label={t.progress.decrypting} fraction={flow.progress} />
        )}
        {flow.phase === 'done' && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <CheckCircle2 className="size-4" />
            {t.receiver.saveDecrypted} ✓
          </p>
        )}
        {flow.phase === 'loaded' && flow.error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">{t.errors[flow.error]}</p>
        )}
      </ToolSection>

      {flow.head && flow.senderIsConnected && flow.phase === 'loaded' && !remoteActive && (
        <ToolSection title={t.localDecrypt.title} hint={t.localDecrypt.hint}>
          <button
            type="button"
            onClick={() => void flow.decryptLocally()}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
          >
            <KeyRound className="size-4" />
            {t.localDecrypt.button}
          </button>
        </ToolSection>
      )}

      {flow.file && flow.head && flow.phase === 'loaded' && !flow.senderIsConnected && !remoteActive && (
        ledgerProtected ? (
          // ROLA + Ledger: the request itself is a ROLA challenge signed by
          // the invited account — so a wallet connection is required.
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
              <button
                type="button"
                disabled={signingProof}
                onClick={() => {
                  if (flow.file && flow.head) {
                    void requestWithProof(flow.file, flow.head);
                  }
                }}
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {signingProof ? (
                  <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {signingProof ? t.progress.signing : t.ledger.requestWithProof}
              </button>
            </ToolSection>
          </WalletConnectGate>
        ) : (
          <ToolSection>
            <ReceiverNameField t={t} value={name} onChange={setName} />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                if (flow.file && flow.head) {
                  void remote.open(flow.file, flow.head, name.trim());
                }
              }}
              className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4" />
              {t.receiver.requestButton}
            </button>
          </ToolSection>
        )
      )}

      {remoteActive && (
        <>
          {remote.shareUrl &&
            (remote.phase === 'waiting' ||
              remote.phase === 'creating' ||
              remote.phase === 'waitingApproval') && (
              <SharePanel t={t} url={remote.shareUrl} hint={t.share.hintUnlock} />
            )}
          <ToolSection>
            {(remote.phase === 'creating' || remote.phase === 'waiting') && (
              <TransferProgress label={t.progress.waitingPeer} />
            )}
            {remote.phase === 'waitingApproval' && (
              <TransferProgress label={t.progress.waitingApproval} />
            )}
            {remote.phase === 'decrypting' && (
              <TransferProgress label={t.progress.decrypting} fraction={remote.progress} />
            )}
            {remote.phase === 'done' && (
              <p
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                <CheckCircle2 className="size-4" />
                {t.receiver.saveDecrypted} ✓
              </p>
            )}
            {remote.phase === 'denied' && (
              <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
                <XCircle className="size-4" />
                {remote.denyReason === 'rejected'
                  ? t.request.denied
                  : t.errors[
                      remote.denyReason === 'wallet_error'
                        ? 'wallet_rejected'
                        : remote.denyReason ?? 'unknown'
                    ]}
              </p>
            )}
            {remote.phase === 'error' && remote.error && (
              <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
                <XCircle className="size-4" />
                {t.errors[remote.error]}
              </p>
            )}
            {remote.phase !== 'done' && remote.phase !== 'decrypting' && (
              <button
                type="button"
                onClick={remote.reset}
                className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Ban className="size-3.5" />
                {t.share.cancel}
              </button>
            )}
          </ToolSection>
        </>
      )}

      {/* ROLA + Ledger: optional on-ledger decryption receipt, minted by the
          account that proved itself and obtained the key. */}
      {ledgerProtected && remote.phase === 'done' && flow.head && provenAccount && (
        <DecryptReceiptSection
          t={t}
          signT={signT}
          head={flow.head}
          account={provenAccount}
        />
      )}
    </div>
  );
}

/**
 * On-ledger acknowledgment that this account decrypted the container: a
 * `cipher-receipt` NFT minted into the receiver's own signing collection.
 * Needs the receiver's Seal + collection — the same one-time setup as the
 * sign-document tool, shown inline when missing.
 */
function DecryptReceiptSection({
  t,
  signT,
  head,
  account,
}: {
  t: CipherDictionary;
  signT: SignDictionary;
  head: ContainerHead;
  account: string;
}) {
  const setup = useSealSetup(account);
  const seal = useSealRequest();
  const [minted, setMinted] = useState(false);
  const needsSetup = setup.ready && !(setup.seal && setup.collection);
  const busy = seal.phase !== 'idle' && seal.phase !== 'done' && seal.phase !== 'error';

  const onMint = async () => {
    if (!setup.seal || !setup.collection || !head.header.inviteCollection) return;
    const ok = await seal.mintCipherReceipt({
      account,
      sealGlobalId: setup.seal.globalId,
      collection: setup.collection.resourceAddress,
      nextId: setup.collection.totalSupply + 1,
      headerHash: head.headerHash,
      inviteCollection: head.header.inviteCollection,
      imageUrl: sealImageUrl(window.location.origin),
    });
    if (ok) {
      setMinted(true);
      setup.refetch();
    }
  };

  return (
    <ToolSection title={t.ledger.receiptTitle} hint={t.ledger.receiptHint}>
      {needsSetup ? (
        <div className="space-y-5">
          <SealDeployPanel t={signT} />
          <SealOnboarding
            t={signT}
            account={account}
            onAccountChange={() => {}}
            setup={setup}
            lockedAccount
          />
        </div>
      ) : minted ? (
        <p
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--color-primary)' }}
        >
          <CheckCircle2 className="size-4" />
          {t.ledger.receiptDone}
        </p>
      ) : (
        <>
          {seal.error && (
            <p className="text-xs font-medium text-[var(--color-danger)]">
              {t.errors.unknown}
            </p>
          )}
          <button
            type="button"
            disabled={busy || !setup.collection}
            onClick={() => void onMint()}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {busy ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Stamp className="size-4" />
            )}
            {busy ? t.ledger.receiptMinting : t.ledger.receiptButton}
          </button>
        </>
      )}
    </ToolSection>
  );
}
