'use client';

import { useEffect, useRef } from 'react';
import { Ban, CheckCircle2, XCircle } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { CipherDictionary } from '../types/dictionary';
import type { EncryptResult } from '../hooks/useEncryptFlow';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useSendSession } from '../hooks/useSendSession';
import { DecryptRequestCard } from './DecryptRequestCard';
import { SharePanel } from './SharePanel';
import { TransferProgress } from './TransferProgress';

/**
 * Flow A host view, shown after "Share with a receiver": share URL + QR,
 * live transfer state, then the receiver's decrypt request to approve.
 */
export function SendSessionView({
  t,
  result,
  onCancel,
}: {
  t: CipherDictionary;
  result: EncryptResult;
  /** Ends the session (the peer gets a clean close) and dismisses this view. */
  onCancel: () => void;
}) {
  const session = useSendSession();
  useLeaveWarning(session.sessionActive);

  // The session must start exactly once per encrypted file; the ref guard
  // absorbs re-runs caused by the hook returning a fresh object every render.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (openedFor.current === result.fileId) return;
    openedFor.current = result.fileId;
    void session.open(result);
  }, [session, result]);

  return (
    <div className="space-y-6">
      {session.shareUrl && session.phase !== 'keySent' && (
        <SharePanel t={t} url={session.shareUrl} hint={t.share.hintReceive} />
      )}

      <ToolSection>
        {(session.phase === 'creating' || session.phase === 'waiting') && (
          <TransferProgress label={t.progress.waitingPeer} />
        )}
        {session.phase === 'transferring' && (
          <TransferProgress label={t.progress.transferring} fraction={session.progress} />
        )}
        {session.phase === 'transferred' && !session.request && (
          <TransferProgress label={t.progress.waitingRequest} />
        )}
        {session.phase === 'approving' && (
          <TransferProgress label={t.progress.signing} />
        )}
        {session.phase === 'keySent' && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <CheckCircle2 className="size-4" />
            {t.progress.keySent}
          </p>
        )}
        {session.phase === 'error' && session.error && (
          <p className="flex items-center gap-2 text-xs font-medium text-red-500">
            <XCircle className="size-4" />
            {t.errors[session.error]}
          </p>
        )}
        {session.phase === 'transferred' && session.error && (
          <p className="text-xs font-medium text-red-500">{t.errors[session.error]}</p>
        )}

        {session.phase !== 'keySent' && (
          <button
            type="button"
            onClick={() => {
              session.reset();
              onCancel();
            }}
            className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Ban className="size-3.5" />
            {t.share.cancel}
          </button>
        )}
      </ToolSection>

      {session.request && session.phase !== 'keySent' && (
        <DecryptRequestCard
          t={t}
          requesterName={session.request.requesterName}
          fileName={result.header.fileName}
          headerHash={result.headerHash}
          busy={session.phase === 'approving'}
          onApprove={() => void session.approve()}
          onDeny={session.deny}
        />
      )}
    </div>
  );
}
