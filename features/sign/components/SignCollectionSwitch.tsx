'use client';

import { useState } from 'react';
import { Check, Layers, RefreshCw } from 'lucide-react';
import { truncateAddress } from '@/utils/formatters';
import { CopyButton } from '@/components/ui/CopyButton';
import type { SignDictionary } from '../types/dictionary';
import { useSealSetup, useSignCollections } from '../hooks/useSealRequest';

/**
 * Shows which signing collection this account is working from, and lets it
 * switch to another one it holds.
 *
 * An account can end up with more than one (created in two tabs, by hand, or
 * because a discovery miss re-offered the onboarding). They are all valid, and
 * the issuer identity — org name, logo — lives per collection, so a second one
 * can even be deliberate. What must never happen is the tool silently working
 * from the empty duplicate while the account's history sits in the other, so
 * the active one is stated here and the choice is the user's.
 *
 * The list loads only when asked for: finding duplicates means scanning the
 * account's whole NFT holdings, and most accounts have none.
 */
export function SignCollectionSwitch({
  t,
  account,
  setup,
}: {
  t: SignDictionary;
  account: string | null;
  setup: ReturnType<typeof useSealSetup>;
}) {
  const [browsing, setBrowsing] = useState(false);
  const { collections, loading } = useSignCollections(account, browsing);
  const active = setup.collection;
  if (!active) return null;

  const others = collections.filter((c) => c.resourceAddress !== active.resourceAddress);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.activeCollection}
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--color-text-main)' }}
          title={active.resourceAddress}
        >
          {truncateAddress(active.resourceAddress)}
        </span>
        <CopyButton value={active.resourceAddress} variant="ghost" size="xs" />
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          disabled={browsing && loading}
          className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: 'var(--color-primary)' }}
        >
          <RefreshCw className={`size-3 ${browsing && loading ? 'animate-spin' : ''}`} />
          {t.onchain.useAnotherCollection}
        </button>
      </div>

      {browsing && !loading && (
        others.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.onlyOneCollection}
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.otherCollectionsHint}
            </p>
            {collections.map((collection) => {
              const isActive = collection.resourceAddress === active.resourceAddress;
              return (
                <button
                  key={collection.resourceAddress}
                  type="button"
                  disabled={isActive}
                  onClick={() => {
                    setup.selectCollection(collection.resourceAddress);
                    setBrowsing(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:opacity-80 disabled:opacity-100"
                  style={{
                    borderColor: isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <span
                    className="truncate font-mono text-xs"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    {truncateAddress(collection.resourceAddress)}
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-2 text-[11px]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t.onchain.collectionRecords.replace(
                      '{count}',
                      String(collection.totalSupply),
                    )}
                    {isActive && (
                      <Check className="size-3.5" style={{ color: 'var(--color-primary)' }} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
