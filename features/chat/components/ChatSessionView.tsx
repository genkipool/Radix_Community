'use client';

import { MessageSquareLock, RotateCcw, XCircle } from 'lucide-react';
import { ShareLinkCard } from '@/features/p2p/components/ShareLinkCard';
import { ProgressRow } from '@/features/p2p/components/ProgressRow';
import { useLeaveWarning } from '@/features/p2p/hooks/useLeaveWarning';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { ChatDictionary } from '../types/dictionary';
import { useChatSession } from '../hooks/useChatSession';
import { ChatRoom } from './ChatRoom';

/**
 * One chat session, host (no roomId — creates and shares the invitation) or
 * guest (roomId from the share URL). `onRestart` remounts the view for a
 * fresh session.
 */
export function ChatSessionView({
  t,
  roomId,
  onRestart,
}: {
  t: ChatDictionary;
  roomId: string | null;
  onRestart: () => void;
}) {
  const session = useChatSession();
  const isGuest = roomId != null;
  useLeaveWarning(session.phase === 'secure' || session.phase === 'waiting');

  // Shown only BEFORE the room opens: once the secure chat is live the screen
  // stays clean (just the room, whose header already reads "Chat seguro con…").
  const disclaimer = (
    <p
      className="text-xs leading-relaxed"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <strong style={{ color: 'var(--color-text-main)' }}>
        {t.disclaimer.title}.
      </strong>{' '}
      {t.disclaimer.body}
    </p>
  );

  if ((session.phase === 'secure' || session.phase === 'closed') && session.peerIdentity) {
    return (
      <div className="space-y-4">
        <ChatRoom
          t={t}
          peer={session.peerIdentity}
          messages={session.messages}
          closed={session.phase === 'closed'}
          sendingFile={session.sendingFile}
          onSend={(text) => void session.send(text)}
          onSendFile={(file) => void session.sendFile(file)}
          onCancelFile={session.cancelSendFile}
          onLeave={session.leave}
        />
        {session.phase === 'closed' && (
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RotateCcw className="size-3.5" />
            {t.room.startAnother}
          </button>
        )}
      </div>
    );
  }

  // Idle: title/hint as a plain header + a full-width primary button OUTSIDE
  // any box, to match the rest of the console tools.
  if (session.phase === 'idle') {
    return (
      <div className="space-y-4">
        {disclaimer}
        <div className="space-y-1">
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
            {isGuest ? t.join.title : t.start.title}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {isGuest ? t.join.hint : t.start.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void (isGuest ? session.join(roomId) : session.start())}
          className="flex w-full items-center justify-center gap-2 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
        >
          <MessageSquareLock className="size-4" />
          {isGuest ? t.join.button : t.start.button}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {disclaimer}
      <ToolSection
        title={isGuest ? t.join.title : t.start.title}
        hint={isGuest ? t.join.hint : t.start.hint}
      >
      {session.phase === 'signing' && <ProgressRow label={t.status.signing} />}
      {session.phase === 'creating' && <ProgressRow label={t.status.creating} />}
      {session.phase === 'connecting' && <ProgressRow label={t.status.connecting} />}
      {session.phase === 'handshaking' && <ProgressRow label={t.status.handshaking} />}

      {session.phase === 'waiting' && session.shareUrl && (
        <div className="space-y-4">
          <ShareLinkCard
            bare
            title={t.share.title}
            hint={t.share.hint}
            url={session.shareUrl}
            qrAlt={t.share.qrAlt}
          />
          <ProgressRow label={t.status.waiting} />
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <XCircle className="size-3.5" />
            {t.status.cancel}
          </button>
        </div>
      )}

      {session.phase === 'closed' && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t.status.closed}
        </p>
      )}

      {session.phase === 'error' && session.error && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]">
            <XCircle className="size-4" />
            {t.errors[session.error]}
          </p>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RotateCcw className="size-3.5" />
            {t.room.startAnother}
          </button>
        </div>
      )}
      </ToolSection>
    </div>
  );
}
