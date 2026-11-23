'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { formatNumber } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import {
  buildCleanupBatches,
  inspectCleanupItems,
  type CleanupItem,
} from '../../lib/account-cleanup';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { BatchRunner } from '../shared/BatchRunner';
import { AddressField, SearchField } from '../shared/fields';
import { OptionButtons } from '../shared/OptionButtons';
import { ResourceCard } from '../shared/ResourceCard';
import { ToolSection } from '../shared/ToolSection';

type FilterMode = 'all' | 'burnable' | 'nonBurnable';

export default function AccountCleanupTool({ t }: ConsoleToolProps) {
  const labels = t.accountCleanup;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  const [account, setAccount] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [denyMode, setDenyMode] = useState<'deny' | 'keep'>('deny');
  const [sinkAccount, setSinkAccount] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const denyDeposits = denyMode === 'deny';
  const { data: holdings, isFetching: holdingsLoading } = useAccountResources(account);

  const { data: items = [], isFetching: inspecting } = useQuery<CleanupItem[]>({
    queryKey: ['console', 'cleanup-inspect-v2', activeNetwork, account, holdings?.fungibles.length ?? 0, holdings?.nonFungibles.length ?? 0],
    queryFn: () => inspectCleanupItems((ep, body) => gatewayPost(activeNetwork, ep, body), holdings!),
    enabled: !!account && !!holdings,
    staleTime: 60_000,
  });

  const cleanable = items.filter((it) => !it.protected);
  const byKind =
    filter === 'burnable'
      ? cleanable.filter((it) => it.burnable)
      : filter === 'nonBurnable'
        ? cleanable.filter((it) => !it.burnable)
        : cleanable;
  const q = search.trim().toLowerCase();
  const visible = !q
    ? byKind
    : byKind.filter(
        (it) =>
          it.name.toLowerCase().includes(q)
          || (it.symbol ?? '').toLowerCase().includes(q)
          || it.resourceAddress.toLowerCase().includes(q),
      );

  const handleFilterChange = (next: FilterMode) => {
    setFilter(next);
    // Keep only selections visible under the new filter so hidden resources never enter a tx.
    setSelected((prev) => {
      const allowed = new Set(
        (next === 'burnable'
          ? cleanable.filter((it) => it.burnable)
          : next === 'nonBurnable'
            ? cleanable.filter((it) => !it.burnable)
            : cleanable
        ).map((it) => it.resourceAddress),
      );
      return new Set([...prev].filter((addr) => allowed.has(addr)));
    });
  };

  const toggle = (addr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  const selectedItems = byKind.filter((it) => selected.has(it.resourceAddress));

  const hasNonBurnableSelected = selectedItems.some((it) => !it.burnable);

  const batches = account
    ? buildCleanupBatches({
        account,
        items: selectedItems,
        denyDeposits,
        sinkAccount: sinkAccount.trim() || undefined,
      })
    : [];

  const resetKey = `${account}|${denyDeposits}|${sinkAccount}|${[...selected].sort().join(',')}`;

  const blockedReason = !account
    ? labels.needAccount
    : selectedItems.length === 0
      ? labels.needSelection
      : batches.length === 0
        ? labels.nothingActionable
        : undefined;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle} hint={labels.accountHint}>
        <AccountPicker
          value={account}
          onChange={(next) => {
            setAccount(next);
            setSelected(new Set());
          }}
        />
        <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <ShieldCheck className="size-4 shrink-0" style={{ color: 'var(--color-success)' }} />
          <span>{labels.protectedNotice}</span>
        </p>
      </ToolSection>

      <ToolSection
        title={labels.resourcesTitle}
        hint={labels.resourcesHint}
        action={
          <div className="flex items-center gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelected(new Set(cleanable.filter((i) => i.burnable).map((i) => i.resourceAddress)))}
              className="hover:underline cursor-pointer"
              style={{ color: 'var(--color-primary)' }}
            >
              {labels.selectBurnable}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="hover:underline cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.clearSelection}
            </button>
          </div>
        }
      >
        <OptionButtons<FilterMode>
          size="md"
          value={filter}
          onChange={handleFilterChange}
          options={[
            { value: 'all', label: labels.filterAll, title: labels.filterAllTitle },
            { value: 'burnable', label: labels.filterBurnable, title: labels.filterBurnableTitle },
            { value: 'nonBurnable', label: labels.filterNonBurnable, title: labels.filterNonBurnableTitle },
          ]}
        />

        {cleanable.length > 6 && (
          <SearchField value={search} onChange={setSearch} placeholder={t.cryptoCompare.searchPlaceholder} />
        )}

        {holdingsLoading || inspecting ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.scanning}</p>
        ) : visible.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.noResources}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {visible.map((item) => {
              const checked = selected.has(item.resourceAddress);
              const qty = item.nftIds
                ? labels.nftCount.replace('{count}', String(item.nftIds.length))
                : `${formatNumber(parseFloat(item.amount ?? '0'), 4, language)} ${item.symbol ?? ''}`;
              const tag = item.burnable ? labels.badgeBurnable : labels.badgeNotBurnable;
              return (
                <ResourceCard
                  key={item.resourceAddress}
                  isActive={checked}
                  onClick={() => toggle(item.resourceAddress)}
                  name={item.name}
                  address={`${qty} · ${tag}`}
                  fullAddress={item.resourceAddress}
                  iconUrl={item.iconUrl}
                  title={`${item.name} (${tag}) · ${item.resourceAddress}`}
                />
              );
            })}
          </div>
        )}
      </ToolSection>

      <ToolSection title={labels.optionsTitle} hint={labels.optionsHint}>
        <OptionButtons<'deny' | 'keep'>
          size="md"
          value={denyMode}
          onChange={setDenyMode}
          options={[
            {
              value: 'deny',
              label: labels.denyDepositsLabel,
              description: labels.denyDepositsHint,
              icon: <Ban className="size-4" />,
            },
            {
              value: 'keep',
              label: labels.keepDepositsLabel,
              description: labels.keepDepositsHint,
            },
          ]}
        />

        {hasNonBurnableSelected && (
          <AddressField
            label={labels.sinkAccountLabel}
            hint={labels.sinkAccountHint}
            value={sinkAccount}
            onChange={setSinkAccount}
            categories={['account']}
            placeholder={labels.sinkAccountPlaceholder}
          />
        )}
      </ToolSection>

      <BatchRunner
        t={t}
        batches={batches}
        resetKey={resetKey}
        blockedReason={blockedReason}
        sendLabel={labels.sendButton}
        confirmBeforeSend={
          hasNonBurnableSelected
            ? {
                title: labels.confirmNonBurnableTitle,
                message: labels.confirmNonBurnableMessage,
                confirmLabel: labels.confirmNonBurnableButton,
                cancelLabel: labels.confirmCancelButton,
              }
            : undefined
        }
      />
    </div>
  );
}
