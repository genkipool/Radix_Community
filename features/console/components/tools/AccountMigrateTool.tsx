'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { formatNumber } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import {
  buildMigrateBatches,
  buildMigrateItems,
  computeSendableXrd,
  inspectNonWithdrawableResources,
  type MigrateItem,
} from '../../lib/account-migrate';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { BatchRunner } from '../shared/BatchRunner';
import { AddressField, SearchField, TextField } from '../shared/fields';
import { ResourceCard } from '../shared/ResourceCard';
import { ToolSection } from '../shared/ToolSection';

export default function AccountMigrateTool({ t }: ConsoleToolProps) {
  const labels = t.accountMigrate;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  const [fromAccount, setFromAccount] = useState<string | null>(null);
  const [toAccount, setToAccount] = useState('');
  const [xrdReserve, setXrdReserve] = useState('2');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initializedFor, setInitializedFor] = useState('');

  const { data: holdings, isFetching: holdingsLoading } = useAccountResources(fromAccount);
  const rawItems = holdings ? buildMigrateItems(holdings) : [];
  const resourceAddrs = rawItems.map((it) => it.resourceAddress);

  const { data: nonWithdrawable, isFetching: checkingRoles } = useQuery<Set<string>>({
    queryKey: ['console', 'migrate-withdrawable-v2', activeNetwork, fromAccount, resourceAddrs.join(',')],
    enabled: !!fromAccount && resourceAddrs.length > 0,
    staleTime: 60_000,
    queryFn: () => inspectNonWithdrawableResources((ep, body) => gatewayPost(activeNetwork, ep, body), resourceAddrs),
  });

  const isFetching = holdingsLoading || (resourceAddrs.length > 0 && (checkingRoles || nonWithdrawable === undefined));
  const items = resourceAddrs.length === 0
    ? []
    : nonWithdrawable
      ? rawItems.filter((it) => !nonWithdrawable.has(it.resourceAddress))
      : [];

  if (fromAccount && holdings && !isFetching && initializedFor !== fromAccount) {
    setInitializedFor(fromAccount);
    setSelectedIds(new Set(items.filter((it) => !it.isCriticalBadge).map((it) => it.id)));
  }

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const q = search.trim().toLowerCase();
  const filteredItems = !q
    ? items
    : items.filter(
        (it) =>
          it.name.toLowerCase().includes(q)
          || (it.symbol ?? '').toLowerCase().includes(q)
          || it.resourceAddress.toLowerCase().includes(q),
      );

  const selectedItems = items.filter((it) => selectedIds.has(it.id));

  const hasCriticalSelected = selectedItems.some((it) => it.isCriticalBadge);
  const sameAccount = !!fromAccount && fromAccount === toAccount.trim();

  const batches = sameAccount || !fromAccount
    ? []
    : buildMigrateBatches(fromAccount, toAccount.trim(), selectedItems, xrdReserve);

  const resetKey = `${fromAccount}|${toAccount}|${xrdReserve}|${[...selectedIds].sort().join(',')}`;

  const renderGroup = (title: string, groupItems: MigrateItem[], warning?: string) => {
    if (groupItems.length === 0) return null;
    return (
      <div className="space-y-2.5">
        <span className="block text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title} ({groupItems.length})
        </span>
        {warning && (
          <p className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-danger)' }}>
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{warning}</span>
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {groupItems.map((item) => {
            const checked = selectedIds.has(item.id);
            const subtitle = item.kind === 'xrd'
              ? `${formatNumber(parseFloat(computeSendableXrd(item.amount ?? '0', xrdReserve)), 2, language)} ${item.symbol ?? ''} (${labels.ofBalance.replace('{amount}', formatNumber(parseFloat(item.amount ?? '0'), 2, language))})`
              : item.nftIds
                ? labels.nftCount.replace('{count}', String(item.nftIds.length))
                : `${formatNumber(parseFloat(item.amount ?? '0'), 4, language)} ${item.symbol ?? ''}`;
            return (
              <ResourceCard
                key={item.id}
                isActive={checked}
                onClick={() => toggleItem(item.id)}
                name={item.name}
                address={subtitle}
                fullAddress={item.resourceAddress}
                iconUrl={item.iconUrl}
                title={`${item.name} · ${item.resourceAddress}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const xrdItems = filteredItems.filter((i) => i.kind === 'xrd');
  const fungibleItems = filteredItems.filter((i) => i.kind === 'fungible');
  const nftItems = filteredItems.filter((i) => i.kind === 'nft');
  const criticalItems = filteredItems.filter((i) => i.kind === 'criticalBadge');

  const blockedReason = !fromAccount
    ? labels.needSource
    : !toAccount.trim()
      ? labels.needDestination
      : sameAccount
        ? labels.sameAccountError
        : selectedItems.length === 0
          ? labels.needSelection
          : batches.length === 0
            ? labels.xrdReserveHint
            : undefined;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountsTitle} hint={labels.accountsHint}>
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {labels.sourceAccount}
            </span>
            <AccountPicker value={fromAccount} onChange={setFromAccount} />
          </div>

          <AddressField
            label={labels.destinationAccount}
            value={toAccount}
            onChange={setToAccount}
            categories={['account']}
            placeholder={labels.destinationPlaceholder}
            error={sameAccount ? labels.sameAccountError : undefined}
            reserveMessage
          />

          <TextField
            label={labels.xrdReserveLabel}
            hint={labels.xrdReserveHint}
            value={xrdReserve}
            onChange={setXrdReserve}
            placeholder="2"
          />
        </div>
      </ToolSection>

      <ToolSection
        title={labels.assetsTitle}
        hint={labels.assetsHint}
        action={
          <div className="flex items-center gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set(items.map((it) => it.id)))}
              className="hover:underline cursor-pointer"
              style={{ color: 'var(--color-primary)' }}
            >
              {labels.selectAllSafe}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="hover:underline cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.clearSelection}
            </button>
          </div>
        }
      >
        {items.length > 6 && (
          <SearchField value={search} onChange={setSearch} placeholder={t.cryptoCompare.searchPlaceholder} />
        )}

        {isFetching ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.loadingAssets}</p>
        ) : items.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.noAssets}</p>
        ) : (
          <div className="space-y-4">
            {renderGroup(labels.groupXrd, xrdItems)}
            {renderGroup(labels.groupFungibles, fungibleItems)}
            {renderGroup(labels.groupNfts, nftItems)}
            {renderGroup(labels.groupCritical, criticalItems, labels.criticalWarning)}
          </div>
        )}
      </ToolSection>

      {hasCriticalSelected && (
        <p className="flex items-start gap-2 text-xs font-semibold px-1" style={{ color: 'var(--color-danger)' }}>
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{labels.criticalSelectedBanner}</span>
        </p>
      )}

      <BatchRunner
        t={t}
        batches={batches}
        resetKey={resetKey}
        blockedReason={blockedReason}
        note={batches.length > 0 ? labels.summaryLine.replace('{items}', String(selectedItems.length)).replace('{batches}', String(batches.length)) : undefined}
        sendLabel={labels.sendButton}
      />
    </div>
  );
}
