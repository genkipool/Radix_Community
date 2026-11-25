'use client';

import { useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CollectionAuditTab } from '@/features/sign/components/audit/CollectionAuditTab';
import { useAllAccountsSignCollections } from '@/features/sign/hooks/useSealRequest';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import type { ConsoleToolProps } from '../ConsoleToolView';

/**
 * Radix Seal · Audit & Registry.
 *
 * Dedicated read-only compliance & registry workspace inside Radix Seal.
 * Automatically discovers signing collections across ALL accounts shared by
 * the connected Radix wallet (no manual account selection required), and also
 * works without a wallet for external auditors inspecting any public collection.
 */
export default function SignAuditTool(_props: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.sign as SignDictionary;
  const labels = t?.collection?.audit;
  const domainVerifyLabels = t?.collection?.identity?.domainVerify;
  const { isConnected, accounts } = useRadixWallet();
  const searchParams = useSearchParams();

  const collectionParam = searchParams.get('collection') ?? undefined;
  const fromParam = searchParams.get('from') ?? undefined;
  const toParam = searchParams.get('to') ?? undefined;

  const accountAddresses = accounts.map((a) => a.address);
  const { collections, loading: discovering } = useAllAccountsSignCollections(
    accountAddresses,
    isConnected && accountAddresses.length > 0,
  );

  if (!labels || !domainVerifyLabels) return null;

  if (isConnected && discovering && collections.length === 0 && !collectionParam) {
    return (
      <div className="mx-auto w-full max-w-6xl py-10">
        <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
          <RefreshCw className="size-4 animate-spin text-[var(--color-primary)]" />
          <span>{labels.states.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CollectionAuditTab
        labels={labels}
        domainVerifyLabels={domainVerifyLabels}
        isConnected={isConnected}
        ownedCollections={collections}
        activeCollection={collections[0]?.resourceAddress ?? null}
        initialCollection={collectionParam}
        initialFromDate={fromParam}
        initialToDate={toParam}
      />
    </div>
  );
}
