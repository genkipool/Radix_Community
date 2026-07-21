'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import { ChatSessionView } from '@/features/chat/components/ChatSessionView';
import type { ChatDictionary } from '@/features/chat/types/dictionary';
import { isRoomId, parseShareHash } from '@/features/p2p/lib/session-url';
import type { ConsoleToolProps } from '../ConsoleToolView';

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/**
 * Console tool: end-to-end encrypted chat with wallet-verified identities.
 * The page header comes from ConsoleToolView; strings live in the `chat`
 * namespace, enriched into the language context by the console layout.
 */
export default function ChatTool({}: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.chat as ChatDictionary;
  const { switchNetwork } = useRadixWallet();
  const [roomId, setRoomId] = useState<string | null>(null);
  // Network the inviter was on (from the link), applied once so the guest
  // connects on the same ledger and the handshake can verify.
  const [linkNetwork, setLinkNetwork] = useState<string | null>(null);
  // Bumping the epoch remounts the session view → clean state for a new chat.
  const [epoch, setEpoch] = useState(0);

  // Invitations carry the room in the URL fragment so it never reaches server
  // logs. Read it reactively (SSR sees no hash), latch it via render-time
  // adjustment, then scrub the address bar.
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => '',
  );
  const params = parseShareHash(hash);
  const fromHash = params.get('r');
  if (fromHash && isRoomId(fromHash) && roomId !== fromHash) {
    setRoomId(fromHash);
    setLinkNetwork(params.get('n'));
  }

  // Switch to the inviter's network once, before the guest signs in.
  const networkForced = useRef(false);
  useEffect(() => {
    if (!linkNetwork || networkForced.current) return;
    networkForced.current = true;
    const wanted =
      Number(linkNetwork) === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
    const timer = setTimeout(() => switchNetwork(wanted), 150);
    return () => clearTimeout(timer);
  }, [linkNetwork, switchNetwork]);

  useEffect(() => {
    if (roomId && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      // replaceState doesn't emit hashchange; notify the store so the stale
      // fragment can't re-latch after a restart.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [roomId]);

  if (!t) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <WalletConnectGate
        title={t.connect.title}
        subtitle={t.connect.subtitle}
        mainnetLabel={t.connect.mainnet}
        stokenetLabel={t.connect.stokenet}
      >
        <ChatSessionView
          key={epoch}
          t={t}
          roomId={roomId}
          onRestart={() => {
            setRoomId(null);
            setEpoch((current) => current + 1);
          }}
        />
      </WalletConnectGate>
    </div>
  );
}
