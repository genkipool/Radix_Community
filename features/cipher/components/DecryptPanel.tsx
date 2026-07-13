'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, KeyRound, Send, XCircle } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { FILE_EXTENSION } from '../constants/cipher';
import type { CipherDictionary } from '../types/dictionary';
import { useDecryptFlow } from '../hooks/useDecryptFlow';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useRequestSession } from '../hooks/useRequestSession';
import { ContainerMetaCard } from './ContainerMetaCard';
import { ReceiverNameField, usePersonaName } from './ReceiverNameField';
import { SharePanel } from './SharePanel';
import { TransferProgress } from './TransferProgress';

/**
 * Decrypt tab body. Two paths once a .radixenc is loaded:
 *  - the connected wallet IS the sender → sign and decrypt right here;
 *  - anyone else → share an unlock URL with the sender (flow B) and decrypt
 *    locally when the key arrives. The ciphertext never leaves this browser.
 */
export function DecryptPanel({ t }: { t: CipherDictionary }) {
  const flow = useDecryptFlow();
  const remote = useRequestSession();
  const personaName = usePersonaName();
  const [name, setName] = useState(() => personaName ?? '');
  useLeaveWarning(remote.sessionActive);

  const localBusy = flow.phase === 'signing' || flow.phase === 'decrypting';
  const remoteActive = remote.phase !== 'idle';
  const busy = localBusy || remoteActive;

  const onFile = (candidate: File | null) => {
    if (remoteActive) remote.reset();
    void flow.loadFile(candidate);
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
          <p className="text-xs font-medium text-red-500">{t.errors[flow.error]}</p>
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
              <p className="flex items-center gap-2 text-xs font-medium text-red-500">
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
              <p className="flex items-center gap-2 text-xs font-medium text-red-500">
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
    </div>
  );
}
