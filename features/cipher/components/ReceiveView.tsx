'use client';

import { useState } from 'react';
import { CheckCircle2, Download, KeyRound, Trash2, XCircle } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { CipherDictionary } from '../types/dictionary';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useReceiveSession } from '../hooks/useReceiveSession';
import { ContainerMetaCard } from './ContainerMetaCard';
import { ReceiverNameField, usePersonaName } from './ReceiverNameField';
import { TransferProgress } from './TransferProgress';

/**
 * Flow A guest view (opened via a `#m=receive` share URL): receive the
 * encrypted file browser-to-browser, then ask the sender for the key.
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
          <p className="flex items-center gap-2 text-xs font-medium text-red-500">
            <XCircle className="size-4" />
            {session.error ? t.errors[session.error] : t.request.denied}
          </p>
        )}
        {session.phase === 'error' && session.error && (
          <p className="flex items-center gap-2 text-xs font-medium text-red-500">
            <XCircle className="size-4" />
            {t.errors[session.error]}
          </p>
        )}
      </ToolSection>

      {requestable && (
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
