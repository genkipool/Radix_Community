'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { CipherDictionary } from '../types/dictionary';
import { useLeaveWarning } from '../hooks/useLeaveWarning';
import { useUnlockSession } from '../hooks/useUnlockSession';
import { fillTemplate, shortAddress } from '../lib/format';
import { ContainerMetaCard } from './ContainerMetaCard';
import { DecryptRequestCard } from './DecryptRequestCard';
import { TransferProgress } from './TransferProgress';

/**
 * Flow B guest view (the original sender opened a `#m=unlock` URL, e.g. from
 * WhatsApp): shows who wants to decrypt what, and approves with a signature.
 * Needs the wallet account the file is bound to; the surrounding tool
 * provides the connect gate.
 */
export function UnlockView({
  t,
  roomId,
}: {
  t: CipherDictionary;
  roomId: string;
}) {
  const { isConnected, accounts } = useRadixWallet();
  const session = useUnlockSession(roomId);
  useLeaveWarning(session.phase === 'requestReceived' || session.phase === 'approving');

  const senderAccount = session.request?.head.header.senderAccount ?? null;
  const holdsSenderAccount =
    senderAccount != null &&
    accounts.some((account) => account.address === senderAccount);

  return (
    <div className="space-y-6">
      <ToolSection title={t.unlock.title} hint={t.unlock.gateSubtitle}>
        {session.request && <ContainerMetaCard t={t} head={session.request.head} />}

        {session.phase === 'connecting' && (
          <TransferProgress label={t.progress.connecting} />
        )}
        {session.phase === 'authorizing' && (
          <TransferProgress label={t.ledger.authorizing} />
        )}
        {session.phase === 'keySent' && session.request && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <CheckCircle2 className="size-4" />
            {fillTemplate(t.unlock.done, {
              name: session.request.requesterName || t.request.anonymous,
            })}
          </p>
        )}
        {session.phase === 'rejected' && (
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {t.request.denied}
          </p>
        )}
        {session.error && session.phase !== 'keySent' && (
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
            <XCircle className="size-4" />
            {t.errors[session.error]}
          </p>
        )}
        {isConnected && senderAccount && !holdsSenderAccount && (
          <p className="text-xs font-medium text-[var(--color-danger)]">
            {fillTemplate(t.unlock.wrongAccount, {
              account: shortAddress(senderAccount),
            })}
          </p>
        )}
      </ToolSection>

      {session.request &&
        (session.phase === 'requestReceived' || session.phase === 'approving') && (
          <DecryptRequestCard
            t={t}
            requesterName={session.request.requesterName}
            requesterAccount={session.request.requesterAccount}
            ledgerVerified={session.request.ledgerVerified}
            fileName={session.request.head.header.fileName}
            headerHash={session.request.head.headerHash}
            busy={session.phase === 'approving'}
            onApprove={() => void session.approve()}
            onDeny={session.deny}
          />
        )}
    </div>
  );
}
