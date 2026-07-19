'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Download, ExternalLink, Lock, RotateCcw, Share2, Stamp, XCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { explorerTxUrl } from '@/features/sign/lib/explorer';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { StringListField } from '@/features/console/components/shared/StringListField';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSealRequest, useSealSetup } from '@/features/sign/hooks/useSealRequest';
import { buildCipherInviteManifest } from '@/features/sign/lib/sign-request';
import { sealImageUrl } from '@/features/sign/constants/seal';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import type { CipherDictionary } from '../types/dictionary';
import type { EncryptResult } from '../hooks/useEncryptFlow';
import { useEncryptFlow } from '../hooks/useEncryptFlow';
import { formatBytes } from '../lib/format';
import { TransferProgress } from './TransferProgress';

type MintState = 'idle' | 'minting' | 'done' | 'error';

interface EncryptPanelProps {
  t: CipherDictionary;
  /** 'rola-ledger' adds authorized receivers + on-ledger invite minting. */
  mode?: 'rola' | 'rola-ledger';
  /** Selected file, lifted to the tool so it survives a mode switch (the panel
   *  itself remounts per mode to reset the flow). */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Account selected at the top of the tool. Used to dry-run the on-ledger
   *  record BEFORE encrypting (the real signer is only known after ROLA). */
  actingAccount: string | null;
  /** Console dictionary — provides the shared Simulate button/result strings. */
  consoleT: ConsoleDictionary;
  /** When provided, the result card offers sharing the file with a receiver. */
  onShare?: (result: EncryptResult) => void;
  /** Fired whenever the current result is discarded (new file / start over). */
  onReset?: () => void;
}

/** Encrypt tab body: pick a file, sign, stream-encrypt, download/share. */
export function EncryptPanel({ t, consoleT, mode = 'rola', file, onFileChange, actingAccount, onShare, onReset }: EncryptPanelProps) {
  const flow = useEncryptFlow();
  const preview = useTransactionPreview();
  const { language } = useLanguage();
  const [txHash, setTxHash] = useState<string | null>(null);
  const busy = flow.phase === 'signing' || flow.phase === 'encrypting';

  /* ── ROLA + Ledger: authorized receivers + invite minting ── */
  const ledger = mode === 'rola-ledger';
  const { activeNetworkId } = useRadixWallet();
  const [receivers, setReceivers] = useState<string[]>(['']);
  const [mintState, setMintState] = useState<MintState>('idle');
  const seal = useSealRequest();
  // The invites mint from the account that actually signed the encryption.
  const encryptorAccount = flow.result?.header.senderAccount ?? null;
  const setup = useSealSetup(ledger ? encryptorAccount : null);
  // Setup for the account selected at the top, so the mint can be dry-run
  // BEFORE encrypting (the real signer is only known after ROLA).
  const simSetup = useSealSetup(ledger ? actingAccount : null);

  const cleanReceivers = receivers.map((r) => r.trim()).filter(Boolean);
  const expectedPrefix =
    activeNetworkId === 1 ? 'account_rdx1' : 'account_tdx_2_1';
  const invalidReceiver = ledger
    ? cleanReceivers.find((r) => !r.startsWith(expectedPrefix))
    : undefined;
  // Receivers are OPTIONAL: any address given must be valid, but the list may be
  // empty. The mint ALWAYS runs on-ledger: the encryptor gets a cipher-signature
  // NFT marking them as the encryptor, plus one cipher-invite per receiver.
  const receiversOk = !ledger || !invalidReceiver;

  const mintInvites = async () => {
    if (!flow.result || !setup.seal || !setup.collection || !encryptorAccount) return;
    setMintState('minting');
    const hash = await seal.mintCipherInvites({
      account: encryptorAccount,
      sealGlobalId: setup.seal.globalId,
      collection: setup.collection.resourceAddress,
      nextId: setup.collection.totalSupply + 1,
      headerHash: flow.result.headerHash,
      receivers: cleanReceivers,
      imageUrl: sealImageUrl(window.location.origin),
    });
    setMintState(hash ? 'done' : 'error');
    if (hash) {
      setTxHash(hash);
      setup.refetch();
    }
  };

  // Auto-mint the on-ledger record right after encryption completes (one wallet
  // confirmation follows the ROLA one). Deferred: no sync setState in effects.
  const mintStartedRef = useRef(false);
  const mintInvitesRef = useRef(mintInvites);
  useEffect(() => {
    mintInvitesRef.current = mintInvites;
  });
  useEffect(() => {
    if (!ledger || flow.phase !== 'ready' || mintStartedRef.current) return;
    if (!setup.seal || !setup.collection) return;
    mintStartedRef.current = true;
    queueMicrotask(() => void mintInvitesRef.current());
  }, [ledger, flow.phase, setup.seal, setup.collection]);

  // Auto-download the encrypted file once it is ready: for ROLA when encryption
  // completes, for ROLA + Ledger once the on-ledger record is minted.
  const downloadedRef = useRef(false);
  const downloadable = flow.phase === 'ready' && !!flow.result && (!ledger || mintState === 'done');
  useEffect(() => {
    if (!downloadable || downloadedRef.current) return;
    downloadedRef.current = true;
    queueMicrotask(() => void flow.download());
  }, [downloadable, flow]);

  // Dry-run the mint BEFORE encrypting, using the selected account and a
  // placeholder header hash (locked string data — a placeholder is enough to
  // check the transaction's roles/deposits would succeed). Receivers may be
  // empty (the encryptor's cipher-signature is still minted).
  const onSimulateMint = () => {
    if (!actingAccount || !simSetup.seal || !simSetup.collection || activeNetworkId == null)
      return;
    preview.simulate(
      buildCipherInviteManifest({
        account: actingAccount,
        sealGlobalId: simSetup.seal.globalId,
        collection: simSetup.collection.resourceAddress,
        nextId: simSetup.collection.totalSupply + 1,
        headerHash: '0'.repeat(64),
        networkId: activeNetworkId,
        receivers: cleanReceivers,
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  // Cancel the pending ROLA signature (keeps the selected file so it can retry).
  const cancelSigning = () => {
    void flow.reset();
    setMintState('idle');
    mintStartedRef.current = false;
  };

  const onFile = (candidate: File | null) => {
    if (busy) return;
    onFileChange(candidate);
    if (flow.phase !== 'idle') {
      onReset?.();
      void flow.reset();
      setMintState('idle');
      mintStartedRef.current = false;
      downloadedRef.current = false;
      setTxHash(null);
    }
  };

  const restart = () => {
    onFileChange(null);
    onReset?.();
    void flow.reset();
    setMintState('idle');
    mintStartedRef.current = false;
    downloadedRef.current = false;
    setTxHash(null);
  };

  return (
    <div className="space-y-6">
      <ToolSection>
        <FileDropzone
          extension=""
          label={t.file.label}
          prompt={t.file.prompt}
          file={file}
          onFile={onFile}
          busy={busy}
          disabled={busy || flow.phase === 'ready'}
        />

        {ledger && flow.phase !== 'ready' && (
          <>
            <StringListField
              label={t.ledger.receiversLabel}
              values={receivers}
              onChange={setReceivers}
              addLabel={t.ledger.addReceiver}
              placeholder={t.ledger.receiverPlaceholder}
              disabled={busy}
            />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {t.ledger.receiversHint}
            </p>
            {invalidReceiver && (
              <p className="text-xs font-medium text-[var(--color-danger)]">
                {t.ledger.invalidReceiver}: {invalidReceiver}
              </p>
            )}
          </>
        )}

        {flow.phase === 'signing' && (
          <div className="space-y-3">
            <TransferProgress label={t.progress.signing} />
            <button
              type="button"
              onClick={cancelSigning}
              className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <XCircle className="size-3.5" />
              {t.progress.cancel}
            </button>
          </div>
        )}
        {flow.phase === 'encrypting' && (
          <TransferProgress label={t.progress.encrypting} fraction={flow.progress} />
        )}

        {flow.error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">
            {t.errors[flow.error]}
          </p>
        )}
      </ToolSection>

      {/* Primary action outside the box, full width. In ROLA + Ledger the
          Simulate button sits to its right and dry-runs the on-ledger record
          that is minted automatically after the ROLA signature. */}
      {(flow.phase === 'idle' || flow.phase === 'error') && (
        <>
          <div className={ledger ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <button
              type="button"
              disabled={!file || !receiversOk}
              onClick={() =>
                file &&
                void flow.encrypt(
                  file,
                  ledger ? { access: 'rola-ledger' } : undefined,
                )
              }
              className="flex w-full items-center justify-center gap-2 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <Lock className="size-4" />
              {t.encrypt.button}
            </button>
            {ledger && (
              <SimulateButton
                t={consoleT.simulate}
                onClick={onSimulateMint}
                loading={preview.isSimulating}
              />
            )}
          </div>
          {ledger && (
            <SimulateResultCard
              t={consoleT.simulate}
              preview={preview.preview}
              error={preview.error}
              onClose={preview.reset}
            />
          )}
        </>
      )}

      {/* On-ledger record (ROLA + Ledger): minted automatically right after the
          ROLA signature. With no receivers the encryptor's own record is minted. */}
      {ledger && flow.phase === 'ready' && (
        <ToolSection>
          {(mintState === 'minting' || mintState === 'idle') && (
            <TransferProgress label={t.ledger.minting} />
          )}
          {mintState === 'done' && (
            <p
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              <BadgeCheck className="size-4" />
              {t.ledger.minted}
            </p>
          )}
          {mintState === 'error' && (
            <>
              <p className="text-xs font-medium text-[var(--color-danger)]">{t.ledger.mintFailed}</p>
              <button
                type="button"
                onClick={() => void mintInvites()}
                className="flex items-center justify-center gap-2 px-5 h-10 rounded-full font-bold text-xs text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
              >
                <Stamp className="size-3.5" />
                {t.ledger.retryMint}
              </button>
            </>
          )}
        </ToolSection>
      )}

      {/* The file is only usable once the on-ledger record is minted: if that
          wallet transaction is cancelled or fails, do NOT show the download/share
          box (the mint status box shows the retry instead). */}
      {flow.phase === 'ready' && flow.result && (!ledger || mintState === 'done') && (
        <ToolSection title={t.encrypt.readyTitle} hint={t.encrypt.readyHint}>
          <p
            className="font-mono text-xs break-all"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {flow.result.encryptedName}
            {' · '}
            {formatBytes(flow.result.header.fileSize)}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void flow.download()}
              className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
            >
              <Download className="size-4" />
              {t.encrypt.download}
            </button>
            {onShare && (
              <button
                type="button"
                onClick={() => flow.result && onShare(flow.result)}
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                style={{
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              >
                <Share2 className="size-4" />
                {t.encrypt.share}
              </button>
            )}
            {txHash && (
              <a
                href={explorerTxUrl(language, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                style={{
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              >
                <ExternalLink className="size-4" />
                {t.encrypt.viewTransaction}
              </a>
            )}
            <button
              type="button"
              onClick={restart}
              className="flex items-center justify-center gap-2 px-5 h-11 rounded-full font-semibold text-sm transition-all hover:opacity-80 active:scale-95"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <RotateCcw className="size-4" />
              {t.encrypt.encryptAnother}
            </button>
          </div>
        </ToolSection>
      )}
    </div>
  );
}
