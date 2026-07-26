'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, PictureInPicture2, Send, ShieldCheck } from 'lucide-react';
import { shortAddress } from '@/utils/format';
import { CopyButton } from '@/components/ui/CopyButton';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';
import type { SentTransactionSummary } from '@/features/wallet/components/TransactionBuilder';
import type { ChatDictionary } from '../types/dictionary';
import type { ChatMessage, VerifiedPeer } from '../types/chat.types';
import { ChatComposer } from './ChatComposer';
import { ChatTransactionModal } from './ChatTransactionModal';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useDocumentPip } from '../hooks/useDocumentPip';
import { useDetachedWindow } from '../hooks/useDetachedWindow';

/** The secure room: verified-identity header, message log and composer. */
export function ChatRoom({
  t,
  peer,
  messages,
  closed,
  sendingFile,
  peerTyping,
  onSend,
  onSendFile,
  onCancelFile,
  onTyping,
  onLeave,
}: {
  t: ChatDictionary;
  peer: VerifiedPeer;
  messages: ChatMessage[];
  /** The other side left; the log stays readable but input is disabled. */
  closed: boolean;
  /** An outgoing file is in flight (attach is disabled meanwhile). */
  sendingFile: boolean;
  /** The peer is composing right now: show the wave of dots. */
  peerTyping: boolean;
  onSend: (text: string) => void;
  onSendFile: (file: File) => void;
  /** Abort the file currently being sent. */
  onCancelFile: () => void;
  /** Mirror our own composing state to the peer. */
  onTyping: (typing: boolean) => void;
  onLeave: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { accounts } = useRadixWallet();
  const { entries: addressBook } = useAddressBook();
  const [txOpen, setTxOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Floating always-on-top window, so the conversation stays visible while the
  // user works elsewhere. Chromium-only, hence the capability check.
  const pip = useDocumentPip();
  // Only one Picture-in-Picture window is allowed per tab, so when the chat is
  // the one floating, the transaction form gets a detached window of its own
  // instead of being squeezed into the small chat window.
  const txWindow = useDetachedWindow();

  // Display name for the peer, most trustworthy source first: the name saved
  // for that address in the agenda, then its label if it is one of the
  // connected wallet's own accounts, and finally the persona label the peer
  // itself sent in the handshake. That last one is what shows for a stranger:
  // before, a peer who was not already in the local agenda had no name at all,
  // which is why the header only ever showed the raw address.
  const savedName =
    addressBook.find((e) => e.address === peer.account)?.name ??
    accounts.find((a) => a.address === peer.account)?.label ??
    null;
  const peerName = savedName ?? peer.declaredName ?? null;
  // Self-declared names are not proof of anything; say so on hover.
  const nameHint = savedName ? peerName! : t.room.declaredName;

  // Post a short summary of a committed transfer into the chat; the txid is
  // linkified to the explorer by MessageBubble.
  const closeTx = () => {
    setTxOpen(false);
    txWindow.close();
  };

  const announceTransaction = (summary: SentTransactionSummary) => {
    const amounts = summary.transfers
      .map((x) => `${x.amount} ${x.symbol}`)
      .join(', ');
    const fee = summary.feePaid
      ? `\n${t.room.txFeeLabel}: ${summary.feePaid} XRD`
      : '';
    onSend(`\u{1F4B8} ${t.room.txSentLabel}: ${amounts}${fee}\n${summary.hash}`);
  };
  // Exact pixel height that fits below whatever chrome sits above the card
  // (navbar + tool header), so the whole chat is visible without page scroll on
  // any resolution. Measured, not guessed, because the header height varies.
  const [deskHeight, setDeskHeight] = useState<number | null>(null);

  // On phones the chat takes over the whole screen (immersive); leaving the
  // room (closed) drops back to the normal in-page layout.
  const fullscreen = isMobile && !closed;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useLayoutEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const measure = () => {
      setIsMobile(mobileQuery.matches);
      const el = cardRef.current;
      if (!el || mobileQuery.matches) {
        setDeskHeight(null);
        return;
      }
      // Distance from the viewport top to the card, minus a bottom gap that
      // also covers the page's own bottom padding.
      const top = el.getBoundingClientRect().top;
      setDeskHeight(Math.max(320, window.innerHeight - top - 48));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Lock the background while the phone chat is fullscreen so it can't scroll
  // behind the overlay; restored on leave/unmount.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const height = pip.pipWindow
    ? '100dvh'
    : fullscreen
    ? '100dvh'
    : isMobile
      ? '70dvh'
      : deskHeight != null
        ? `${deskHeight}px`
        : 'calc(100dvh - 17rem)';

  const card = (
    <div
      ref={cardRef}
      className={`flex flex-col overflow-hidden ${
        pip.pipWindow
          ? 'h-full border-0'
          : fullscreen
            ? 'fixed inset-0 z-[100] border-0'
            : 'relative rounded-3xl border'
      }`}
      style={{
        height,
        // The floating window sizes itself, so no minimum may fight it.
        minHeight: fullscreen || pip.pipWindow ? undefined : '20rem',
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {t.room.securedWith}
            </p>
            {peerName && (
              <p
                className="truncate text-sm font-bold"
                style={{ color: 'var(--color-text-main)' }}
                title={nameHint}
              >
                {peerName}
              </p>
            )}
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="truncate font-mono text-sm font-bold"
                style={{
                  color: peerName
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-main)',
                }}
                title={peer.account}
              >
                {shortAddress(peer.account)}
              </span>
              <CopyButton
                value={peer.account}
                variant="ghost"
                size="xs"
                className="shrink-0"
              />
            </div>
          </div>
        </div>
        {!closed && (
          <button
            type="button"
            onClick={() => {
              if (pip.pipWindow) {
                txWindow.open({ title: t.room.txTitle });
              }
              setTxOpen(true);
            }}
            className="flex shrink-0 items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-primary)' }}
          >
            <Send className="size-3.5" />
            <span className="hidden sm:inline">{t.room.sendTx}</span>
          </button>
        )}
        {pip.supported && !closed && (
          <button
            type="button"
            onClick={() => (pip.pipWindow ? pip.close() : void pip.open())}
            className="flex shrink-0 items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
            title={pip.pipWindow ? t.room.pipExit : t.room.pip}
          >
            <PictureInPicture2 className="size-3.5" />
            <span className="hidden lg:inline">
              {pip.pipWindow ? t.room.pipExit : t.room.pip}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="flex shrink-0 items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">{t.room.leave}</span>
        </button>
      </header>

      {/* Relative wrapper so the typing dots can sit in the corner of the log
          instead of scrolling away with the messages. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p
              className="m-auto text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t.room.empty}
            </p>
          )}
          {messages.map((message: ChatMessage) => (
            <MessageBubble
              key={message.id}
              t={t}
              message={message}
              onCancel={onCancelFile}
            />
          ))}
          <div ref={endRef} />
        </div>
        {peerTyping && !closed && (
          <TypingIndicator
            label={peerName ? `${peerName} ${t.room.typing}` : t.room.typing}
          />
        )}
      </div>

      <footer
        className="shrink-0 border-t px-5 py-4"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {closed ? (
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {t.room.closedBanner}
          </p>
        ) : (
          <ChatComposer
            t={t}
            disabled={closed}
            sendingFile={sendingFile}
            onSend={onSend}
            onSendFile={onSendFile}
            onTyping={onTyping}
          />
        )}
      </footer>

      {txOpen && (
        <ChatTransactionModal
          t={t}
          peerAccount={peer.account}
          container={txWindow.detached?.document.body ?? null}
          onClose={closeTx}
          onTransactionSent={announceTransaction}
        />
      )}
    </div>
  );

  if (!pip.pipWindow) return card;

  // Live in the floating window, leaving a compact placeholder in the page so
  // the conversation is obviously still open and one click brings it back.
  return (
    <>
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-3xl border px-6 py-12 text-center"
        style={{
          background: 'var(--color-card-bg)',
          borderColor: 'var(--color-card-border)',
        }}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
          <PictureInPicture2 className="size-6 text-white" />
        </div>
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t.room.pipActive}
        </p>
        <button
          type="button"
          onClick={pip.close}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
        >
          {t.room.pipExit}
        </button>
      </div>
      {createPortal(card, pip.pipWindow.document.body)}
    </>
  );
}
