'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Fingerprint, HardDriveDownload } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { DecryptPanel } from '@/features/cipher/components/DecryptPanel';
import { EncryptPanel } from '@/features/cipher/components/EncryptPanel';
import { ReceiveView } from '@/features/cipher/components/ReceiveView';
import { SendSessionView } from '@/features/cipher/components/SendSessionView';
import { UnlockView } from '@/features/cipher/components/UnlockView';
import type { EncryptResult } from '@/features/cipher/hooks/useEncryptFlow';
import { cleanupExpired } from '@/features/cipher/lib/idb';
import { parseSessionHash } from '@/features/cipher/lib/session-url';
import type { CipherDictionary } from '@/features/cipher/types/dictionary';
import type { SessionMode } from '@/features/cipher/types/cipher.types';
import type { ConsoleToolProps } from '../ConsoleToolView';

type Tab = 'encrypt' | 'decrypt';
type EncryptMode = 'rola' | 'rola-ledger';

interface PeerSession {
  mode: SessionMode;
  roomId: string;
}

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/**
 * Console tool: encrypt & decrypt files with wallet-derived keys, shared
 * peer-to-peer. The page header comes from ConsoleToolView; strings live in
 * the `cipher` namespace, enriched into the language context by the console
 * layout.
 */
export default function EncryptDocumentTool({}: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.cipher as CipherDictionary;
  const [tab, setTab] = useState<Tab>('encrypt');
  const [mode, setMode] = useState<EncryptMode>('rola');
  const [session, setSession] = useState<PeerSession | null>(null);
  const [shared, setShared] = useState<EncryptResult | null>(null);

  // The share URL carries the session in the fragment so it never reaches
  // server logs. Read it reactively (SSR sees no hash) and latch it into
  // state via render-time adjustment; an effect then scrubs the address bar.
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => '',
  );
  const fromHash = parseSessionHash(hash);
  if (fromHash && session?.roomId !== fromHash.roomId) {
    setSession(fromHash);
  }

  useEffect(() => {
    if (session && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      // replaceState doesn't emit hashchange; notify the store so the stale
      // fragment can't re-latch a new session later.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [session]);

  // Local copies of past transfers expire after 24 h.
  useEffect(() => {
    void cleanupExpired().catch(() => undefined);
  }, []);

  if (!t) return null;

  if (session?.mode === 'receive') {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <ReceiveView t={t} roomId={session.roomId} />
      </div>
    );
  }
  if (session?.mode === 'unlock') {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <CipherGate t={t}>
          <UnlockView t={t} roomId={session.roomId} />
        </CipherGate>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div
        className="flex gap-6 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {(['encrypt', 'decrypt'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="relative pb-2.5 text-sm font-bold transition-colors"
            style={{
              color:
                tab === key
                  ? 'var(--color-text-main)'
                  : 'var(--color-text-muted)',
            }}
          >
            {key === 'encrypt' ? t.tabs.encrypt : t.tabs.decrypt}
            {tab === key && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, var(--color-accent), var(--color-primary))',
                }}
              />
            )}
          </button>
        ))}
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <strong style={{ color: 'var(--color-text-main)' }}>
          {t.disclaimer.title}.
        </strong>{' '}
        {t.disclaimer.body}
      </p>

      {tab === 'encrypt' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t.modes.label}
            </p>
            <OptionButtons<EncryptMode>
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'rola',
                  label: t.modes.rola,
                  description: t.modes.rolaDescription,
                  icon: <Fingerprint className="size-4" />,
                },
                {
                  value: 'rola-ledger',
                  label: t.modes.rolaLedger,
                  description: t.modes.rolaLedgerDescription,
                  icon: <HardDriveDownload className="size-4" />,
                  disabled: true,
                  title: t.modes.comingSoon,
                },
              ]}
            />
          </div>

          <CipherGate t={t}>
            <EncryptPanel t={t} onShare={setShared} onReset={() => setShared(null)} />
            {shared && (
              <SendSessionView t={t} result={shared} onCancel={() => setShared(null)} />
            )}
          </CipherGate>
        </div>
      ) : (
        <DecryptPanel t={t} />
      )}
    </div>
  );
}

/** Wallet gate with the cipher feature's own explanatory copy. */
function CipherGate({ t, children }: { t: CipherDictionary; children: ReactNode }) {
  return (
    <WalletConnectGate
      title={t.connect.title}
      subtitle={t.connect.subtitle}
      mainnetLabel={t.connect.mainnet}
      stokenetLabel={t.connect.stokenet}
    >
      {children}
    </WalletConnectGate>
  );
}
