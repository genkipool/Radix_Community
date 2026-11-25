'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import {
  useSealSetup,
  useSignCollections,
  useUserSeals,
} from '@/features/sign/hooks/useSealRequest';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import { CollectionsListTab } from '@/features/sign/components/collection/CollectionsListTab';
import { CollectionCreateTab } from '@/features/sign/components/collection/CollectionCreateTab';
import { CollectionIdentityTab } from '@/features/sign/components/collection/CollectionIdentityTab';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';

type Tab = 'collections' | 'create' | 'identity';

/**
 * Radix Seal · Collection.
 *
 * Orchestrates the 3 collection management tabs:
 *  - Collections & Seals overview (`CollectionsListTab`)
 *  - Create a new signing collection (`CollectionCreateTab`)
 *  - Edit collection issuer identity & metadata (`CollectionIdentityTab`)
 */
export default function SignCollectionTool({ t: consoleT }: ConsoleToolProps) {
  const { t: full, language } = useLanguage();
  const t = full.sign as SignDictionary;
  const labels = t?.collection;
  const { isConnected, accounts } = useRadixWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const collectionParam = searchParams.get('collection');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Legacy links to `/console/sign-collection?tab=audit&collection=...` redirect
  // seamlessly to the dedicated `/console/sign-audit` tool.
  useEffect(() => {
    if (tabParam === 'audit' || collectionParam) {
      const next = new URLSearchParams();
      if (collectionParam) next.set('collection', collectionParam);
      if (fromParam) next.set('from', fromParam);
      if (toParam) next.set('to', toParam);
      const qs = next.toString();
      router.replace(`/${language}/console/sign-audit${qs ? `?${qs}` : ''}`);
    }
  }, [tabParam, collectionParam, fromParam, toParam, language, router]);

  const initialTab: Tab =
    tabParam === 'collections' ||
    tabParam === 'create' ||
    tabParam === 'identity'
      ? tabParam
      : 'collections';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [account, setAccount] = useState<string | null>(null);
  const effectiveAccount = account ?? accounts[0]?.address ?? null;

  const setup = useSealSetup(effectiveAccount);
  const {
    collections,
    loading: collectionsLoading,
    refetch: refetchCollections,
  } = useSignCollections(effectiveAccount, isConnected && !!effectiveAccount);
  const { seals, refetch: refetchSeals } = useUserSeals(effectiveAccount);
  const [settling, setSettling] = useState(false);

  const showNewCollection = async (resourceAddress: string) => {
    setSettling(true);
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const fresh = await refetchCollections();
        if (fresh.some((c) => c.resourceAddress === resourceAddress)) return;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } finally {
      setSettling(false);
      void refetchSeals();
      void setup.refetch();
    }
  };

  if (!labels) return null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div
        className="flex flex-wrap gap-x-6 gap-y-2 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {(
          [
            ['collections', labels.tabs.collections],
            ['create', labels.tabs.create],
            ['identity', labels.tabs.identity],
          ] as const
        ).map(([key, label]) => (
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
            {label}
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
          {labels.intro.title}.
        </strong>{' '}
        {labels.intro.body}
      </p>

      <WalletConnectGate
        title={labels.connect.title}
        subtitle={labels.connect.subtitle}
        mainnetLabel={t.connect?.mainnet ?? 'Mainnet'}
        stokenetLabel={t.connect?.stokenet ?? 'Stokenet'}
      >
        <div className="space-y-6">
          <ToolSection title={labels.accountLabel}>
            <AccountPicker value={account} onChange={setAccount} />
          </ToolSection>

          {tab === 'collections' && (
            <CollectionsListTab
              labels={labels}
              account={effectiveAccount}
              setup={setup}
              seals={seals}
              collections={collections}
              loading={collectionsLoading || settling}
              onCreate={() => setTab('create')}
            />
          )}
          {tab === 'create' && (
            <CollectionCreateTab
              labels={labels}
              t={t}
              consoleT={consoleT}
              account={effectiveAccount}
              seals={seals}
              hasCollections={collections.length > 0}
              onCreated={(resourceAddress) => {
                if (effectiveAccount) setAccount(effectiveAccount);
                setTab('collections');
                void showNewCollection(resourceAddress);
              }}
            />
          )}
          {tab === 'identity' && (
            <CollectionIdentityTab
              labels={labels}
              t={t}
              consoleT={consoleT}
              account={effectiveAccount}
              setup={setup}
            />
          )}
        </div>
      </WalletConnectGate>
    </div>
  );
}
