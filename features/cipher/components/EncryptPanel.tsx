'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Download, Lock, RotateCcw, Share2, Stamp } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { StringListField } from '@/features/console/components/shared/StringListField';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSealRequest, useSealSetup } from '@/features/sign/hooks/useSealRequest';
import { sealImageUrl } from '@/features/sign/constants/seal';
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
  /** When provided, the result card offers sharing the file with a receiver. */
  onShare?: (result: EncryptResult) => void;
  /** Fired whenever the current result is discarded (new file / start over). */
  onReset?: () => void;
}

/** Encrypt tab body: pick a file, sign, stream-encrypt, download/share. */
export function EncryptPanel({ t, mode = 'rola', onShare, onReset }: EncryptPanelProps) {
  const flow = useEncryptFlow();
  const [file, setFile] = useState<File | null>(null);
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

  const cleanReceivers = receivers.map((r) => r.trim()).filter(Boolean);
  const expectedPrefix =
    activeNetworkId === 1 ? 'account_rdx1' : 'account_tdx_2_1';
  const invalidReceiver = ledger
    ? cleanReceivers.find((r) => !r.startsWith(expectedPrefix))
    : undefined;
  const receiversOk = !ledger || (cleanReceivers.length > 0 && !invalidReceiver);

  const mintInvites = async () => {
    if (!flow.result || !setup.seal || !setup.collection || !encryptorAccount) return;
    setMintState('minting');
    const ok = await seal.mintCipherInvites({
      account: encryptorAccount,
      sealGlobalId: setup.seal.globalId,
      collection: setup.collection.resourceAddress,
      nextId: setup.collection.totalSupply + 1,
      headerHash: flow.result.headerHash,
      receivers: cleanReceivers,
      imageUrl: sealImageUrl(window.location.origin),
    });
    setMintState(ok ? 'done' : 'error');
    if (ok) setup.refetch();
  };

  // Chain the invite mint right after encryption completes (one wallet
  // confirmation follows another); failures surface a retry button. Deferred:
  // state updates must never run synchronously in an effect.
  const mintStartedRef = useRef(false);
  const mintInvitesRef = useRef(mintInvites);
  useEffect(() => {
    // Kept fresh post-commit; refs must not be written during render.
    mintInvitesRef.current = mintInvites;
  });
  useEffect(() => {
    if (!ledger || flow.phase !== 'ready' || mintStartedRef.current) return;
    if (!setup.seal || !setup.collection) return;
    mintStartedRef.current = true;
    queueMicrotask(() => void mintInvitesRef.current());
  }, [ledger, flow.phase, setup.seal, setup.collection]);

  const onFile = (candidate: File | null) => {
    if (busy) return;
    setFile(candidate);
    if (flow.phase !== 'idle') {
      onReset?.();
      void flow.reset();
      setMintState('idle');
      mintStartedRef.current = false;
    }
  };

  const restart = () => {
    setFile(null);
    onReset?.();
    void flow.reset();
    setMintState('idle');
    mintStartedRef.current = false;
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
              <p className="text-xs font-medium text-red-500">
                {t.ledger.invalidReceiver}: {invalidReceiver}
              </p>
            )}
          </>
        )}

        {flow.phase === 'signing' && (
          <TransferProgress label={t.progress.signing} />
        )}
        {flow.phase === 'encrypting' && (
          <TransferProgress label={t.progress.encrypting} fraction={flow.progress} />
        )}

        {flow.error && (
          <p className="text-xs font-medium text-red-500">
            {t.errors[flow.error]}
          </p>
        )}
      </ToolSection>

      {/* Primary action lives outside the box and spans the full width, to
          match the rest of the console tools. */}
      {(flow.phase === 'idle' || flow.phase === 'error') && (
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
      )}

      {/* Invite minting status (ROLA + Ledger) */}
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
              <p className="text-xs font-medium text-red-500">{t.ledger.mintFailed}</p>
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

      {flow.phase === 'ready' && flow.result && (
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
