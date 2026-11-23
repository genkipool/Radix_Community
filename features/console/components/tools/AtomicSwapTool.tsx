'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Big from 'big.js';
import { useSearchParams } from 'next/navigation';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Ban, BookmarkPlus, Check, Clock, ExternalLink, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { ShareTargets } from '@/components/ui/ShareTargets';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CARD_ENTITY_OPT_INS, gatewayPost } from '@/services/gateway/bases';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useCollectionNfts } from '../../hooks/useCollectionNfts';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useSubintentRequest } from '../../hooks/useSubintentRequest';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import {
  type AtomicSwapOffer,
  buildCancelSwapMoveManifest,
  buildDirectAtomicSwapManifest,
  buildMakerSubintentManifest,
  buildMakerSubintentPreviewManifest,
  buildTakerSubintentManifest,
  buildTakerV2SettlementManifest,
  type CommittedSwapTransaction,
  decodeSwapOffer,
  encodeSwapOffer,
  EXPIRATION_PRESETS,
  extractTakerAccountFromCommittedTx,
  getSavedSwapOffersServerSnapshot,
  getSavedSwapOffersSnapshot,
  normalizeSwapAssets,
  parseSubintentIdInput,
  reconstructOfferFromCommittedTx,
  removeSavedSwapOffer,
  saveSignedSwapOffer,
  subscribeSavedSwapOffers,
  type SwapAsset,
} from '../../lib/atomic-swap';
import { isNonFungibleResource } from '../../lib/bulk-send';
import { getMetadataString, type GatewayMetadataItem } from '../../lib/metadata-manifests';
import { isFreelyWithdrawable } from '../../lib/role-lookup';
import { settleAtomicSwapV2 } from '../../lib/v2-settler';
import type { AccountHoldings, ConsoleTxResult } from '../../types/console.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { AddressField, TextField } from '../shared/fields';
import { OptionButtons } from '../shared/OptionButtons';
import { ResourceCard } from '../shared/ResourceCard';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { resolveConsoleError, TxResultBanner } from '../shared/TxResultBanner';

type TabMode = 'create' | 'accept' | 'offers';
type SwapFlow = 'subintent' | 'direct';

interface LegDraft {
  id: number;
  resource: string;
  amount: string;
  selectedNftIds: string[];
  manualNftIds: string;
}

interface ResourceSummary {
  isNft: boolean;
  withdrawable: boolean;
  name: string;
  symbol: string;
  iconUrl?: string;
}

const XRD_LOGO_URL = 'https://assets.coingecko.com/coins/images/4374/standard/Radix.png';

async function fetchResourceSummary(trimmed: string, network: 'mainnet' | 'stokenet'): Promise<ResourceSummary> {
  const isXrd = trimmed.includes('tknxxxxxxxxxradxrd');
  const res = await gatewayPost<{
    items?: Array<{
      details?: { type?: string; role_assignments?: unknown };
      explicit_metadata?: { items?: GatewayMetadataItem[] };
    }>;
  }>(network, '/state/entity/details', {
    addresses: [trimmed],
    opt_ins: { explicit_metadata: CARD_ENTITY_OPT_INS.explicit_metadata },
  });
  const item = res.items?.[0];
  const meta = item?.explicit_metadata?.items;
  return {
    isNft: item?.details?.type === 'NonFungibleResource',
    withdrawable: item ? isFreelyWithdrawable(item) : true,
    name: getMetadataString(meta, 'name') || (isXrd ? 'Radix' : ''),
    symbol: getMetadataString(meta, 'symbol') || (isXrd ? 'XRD' : ''),
    iconUrl: getMetadataString(meta, 'icon_url') || (isXrd ? XRD_LOGO_URL : undefined),
  };
}

/** Detects resource kind (NFT vs fungible), withdrawer role, and metadata on-ledger. */
function useResourceInfo(resourceAddress: string, network: 'mainnet' | 'stokenet'): ResourceSummary {
  const trimmed = resourceAddress.trim();
  const heuristic = isNonFungibleResource(trimmed);
  const { data } = useQuery<ResourceSummary>({
    queryKey: ['console', 'resource-info-v3', network, trimmed],
    enabled: trimmed.startsWith('resource_') && trimmed.length >= 20,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => fetchResourceSummary(trimmed, network),
  });
  return data ?? { isNft: heuristic, withdrawable: true, name: '', symbol: '' };
}

/** Batch-resolves `ResourceSummary` for a list of draft swap legs on the active network. */
function useLegsResourceInfos(
  legs: LegDraft[],
  activeNetwork: 'mainnet' | 'stokenet',
  expectedResourcePrefix: string,
): ResourceSummary[] {
  const queries = useQueries({
    queries: legs.map((leg) => {
      const trimmed = leg.resource.trim();
      return {
        queryKey: ['console', 'resource-info-v3', activeNetwork, trimmed],
        enabled: trimmed.startsWith(expectedResourcePrefix) && trimmed.length >= 20,
        staleTime: 5 * 60_000,
        retry: false,
        queryFn: () => fetchResourceSummary(trimmed, activeNetwork),
      };
    }),
  });
  return legs.map(
    (leg, idx) =>
      queries[idx]?.data ?? {
        isNft: isNonFungibleResource(leg.resource.trim()),
        withdrawable: true,
        name: '',
        symbol: '',
      },
  );
}

function parsePositiveBig(raw: string): Big | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  try {
    const value = new Big(cleaned);
    return value.gt(0) ? value : null;
  } catch {
    return null;
  }
}

function getLegBalanceState(
  leg: LegDraft,
  allLegs: LegDraft[],
  isNft: boolean,
  holdings?: AccountHoldings,
) {
  const trimmed = leg.resource.trim();
  const hasResource = trimmed.startsWith('resource_') && trimmed.length >= 20;
  const typed = parsePositiveBig(leg.amount);
  const isInvalidAmount = !isNft && leg.amount.trim().length > 0 && typed === null;

  if (!holdings || isNft || !hasResource) {
    return {
      hasBalanceContext: false,
      available: null as Big | null,
      remaining: null as Big | null,
      isOverBalance: false,
      isInvalidAmount,
    };
  }

  const fungibleHolding = holdings.fungibles.find((f) => f.resourceAddress === trimmed);
  const totalHolding = fungibleHolding ? new Big(fungibleHolding.amount) : new Big(0);

  let otherUsed = new Big(0);
  for (const other of allLegs) {
    if (other.id === leg.id || other.resource.trim() !== trimmed) continue;
    const otherAmt = parsePositiveBig(other.amount);
    if (otherAmt) otherUsed = otherUsed.plus(otherAmt);
  }

  const available = totalHolding.gt(otherUsed) ? totalHolding.minus(otherUsed) : new Big(0);
  const remaining = typed ? available.minus(typed) : available;
  const isOverBalance = typed !== null && typed.gt(available);

  return {
    hasBalanceContext: true,
    available,
    remaining,
    isOverBalance,
    isInvalidAmount,
  };
}

function formatBigForDisplay(val: Big, locale: string): string {
  const clamped = val.lt(0) ? new Big(0) : val;
  const num = Number(clamped.toFixed());
  return formatNumber(num, num >= 100 ? 2 : 4, locale);
}

function AssetLegRow({
  leg,
  allLegs,
  onChange,
  onRemove,
  canRemove,
  info,
  holdings,
  network,
  locale,
  labels,
}: {
  leg: LegDraft;
  allLegs: LegDraft[];
  onChange: (next: LegDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
  info: ResourceSummary;
  holdings?: AccountHoldings;
  network: 'mainnet' | 'stokenet';
  locale: string;
  labels: ConsoleToolProps['t']['atomicSwap'];
}) {
  const trimmed = leg.resource.trim();
  const nftHolding = holdings?.nonFungibles.find((nf) => nf.resourceAddress === trimmed);
  const balanceState = getLegBalanceState(leg, allLegs, info.isNft, holdings);
  const localNftIds = nftHolding?.ids ?? [];
  const { items: nftCards, isLoading: loadingNfts } = useCollectionNfts(trimmed, info.isNft, network, localNftIds);
  const nftFallbackName = nftHolding?.name || info.name || truncateAddress(trimmed, 10, 6);
  const nftFallbackIcon = nftHolding?.iconUrl || info.iconUrl;

  const amountError = balanceState.isInvalidAmount
    ? labels.invalidAmountError
    : balanceState.isOverBalance && balanceState.available
      ? labels.insufficientBalanceError.replace('{max}', formatBigForDisplay(balanceState.available, locale))
      : undefined;

  const toggleNftId = (id: string) => {
    const nextIds = leg.selectedNftIds.includes(id)
      ? leg.selectedNftIds.filter((x) => x !== id)
      : [...leg.selectedNftIds, id];
    onChange({ ...leg, selectedNftIds: nextIds });
  };

  return (
    <div className="space-y-3">
      <AddressField
        label={labels.resourceLabel}
        labelEnd={
          canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 className="size-3" />
              {labels.removeResource}
            </button>
          ) : undefined
        }
        value={leg.resource}
        onChange={(v) => onChange({ ...leg, resource: v, selectedNftIds: [], manualNftIds: '' })}
        categories={['resource']}
        pickerSendableOnly
        placeholder={labels.resourcePlaceholder}
        error={!info.withdrawable ? labels.notWithdrawableError : undefined}
        reserveMessage
      />

      {info.isNft ? (
        loadingNfts && nftCards.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
            {labels.loadingNfts}
          </p>
        ) : nftCards.length > 0 ? (
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {labels.nftIdsLabel} ({leg.selectedNftIds.length}/{nftCards.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
              {nftCards.map((card) => (
                <ResourceCard
                  key={card.id}
                  isActive={leg.selectedNftIds.includes(card.id)}
                  onClick={() => toggleNftId(card.id)}
                  name={card.name || nftFallbackName}
                  address={card.id}
                  iconUrl={card.image || nftFallbackIcon}
                />
              ))}
            </div>
          </div>
        ) : (
          <TextField
            label={labels.nftIdsLabel}
            hint={labels.emptyNftCollectionHint}
            value={leg.manualNftIds}
            onChange={(v) => onChange({ ...leg, manualNftIds: v })}
            placeholder="#1#, #2#"
          />
        )
      ) : (
        <TextField
          label={labels.amountLabel}
          value={leg.amount}
          onChange={(v) => onChange({ ...leg, amount: v })}
          placeholder="100"
          error={amountError}
          reserveMessage
          trailingPadding={balanceState.hasBalanceContext ? 'pr-32' : undefined}
          trailing={
            balanceState.hasBalanceContext && balanceState.available && balanceState.remaining ? (
              <button
                type="button"
                onClick={() => onChange({ ...leg, amount: balanceState.available!.toFixed() })}
                className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors hover:opacity-80 cursor-pointer tabular-nums"
                style={{
                  background: balanceState.isOverBalance
                    ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                    : 'rgba(var(--color-primary-rgb), 0.12)',
                  color: balanceState.isOverBalance ? 'var(--color-danger)' : 'var(--color-primary)',
                }}
                title={balanceState.available.toFixed()}
              >
                {`${labels.maxShort} ${formatBigForDisplay(balanceState.remaining, locale)}`}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function toSwapAsset(isNft: boolean, leg: LegDraft): SwapAsset {
  if (!isNft) {
    return {
      kind: 'fungible',
      resourceAddress: leg.resource.trim(),
      amount: leg.amount.trim().replace(',', '.'),
    };
  }
  const ids = leg.selectedNftIds.length > 0
    ? leg.selectedNftIds
    : leg.manualNftIds.split(',').map((s) => s.trim()).filter(Boolean);
  return { kind: 'nft', resourceAddress: leg.resource.trim(), ids };
}

function OfferAssetBox({
  label,
  accentVar,
  asset,
  network,
}: {
  label: string;
  accentVar: string;
  asset: SwapAsset;
  network: 'mainnet' | 'stokenet';
}) {
  const info = useResourceInfo(asset.resourceAddress, network);
  const displayName = info.name || info.symbol || truncateAddress(asset.resourceAddress, 12, 8);
  const quantity = asset.kind === 'fungible'
    ? `${asset.amount}${info.symbol ? ` ${info.symbol}` : ''}`
    : asset.ids.join(', ');

  return (
    <div
      className="rounded-xl border p-4 space-y-2.5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
    >
      <span className="block text-[11px] font-black uppercase tracking-wider" style={{ color: accentVar }}>
        {label}
      </span>
      <div className="flex items-center gap-3 min-w-0">
        {info.iconUrl ? (
          <SafeImage src={info.iconUrl} alt={displayName} fallbackName={displayName} className="size-9 rounded-full shrink-0" />
        ) : (
          <span
            className="size-9 rounded-full shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: 'var(--color-card-bg)', color: accentVar }}
          >
            {(info.symbol || displayName).slice(0, 3).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-black font-mono tabular-nums truncate" style={{ color: 'var(--color-text-main)' }}>
            {quantity}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {displayName}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-3.5 -mb-0.5 border-t text-[11px] font-mono" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
        <span className="truncate leading-none">{truncateAddress(asset.resourceAddress, 14, 10)}</span>
        <CopyButton value={asset.resourceAddress} size="xs" variant="ghost" className="shrink-0" />
      </div>
    </div>
  );
}

interface SubintentStatusInfo {
  status: string | null;
  txid: string | null;
  committedTx: CommittedSwapTransaction | null;
}

async function fetchSubintentStatusInfo(
  network: 'mainnet' | 'stokenet',
  subintentHash: string,
): Promise<SubintentStatusInfo> {
  try {
    const res = await gatewayPost<{
      subintent_status?: string;
      finalized_at_transaction_intent_hash?: string;
    }>(
      network,
      '/transaction/subintent-status',
      { subintent_hash: subintentHash },
    );
    const status = res.subintent_status ?? null;
    const txid = res.finalized_at_transaction_intent_hash ?? null;
    if (!txid) {
      return { status, txid: null, committedTx: null };
    }
    try {
      const details = await gatewayPost<{ transaction?: CommittedSwapTransaction }>(
        network,
        '/transaction/committed-details',
        {
          intent_hash: txid,
          opt_ins: {
            manifest_instructions: true,
            balance_changes: true,
            affected_global_entities: true,
            confirmed_at: true,
          },
        },
      );
      return { status, txid, committedTx: details.transaction ?? null };
    } catch {
      return { status, txid, committedTx: null };
    }
  } catch {
    return { status: null, txid: null, committedTx: null };
  }
}

function EditableSwapSideColumn({
  title,
  hint,
  accentColor,
  legs,
  onChangeLegs,
  infos,
  holdings,
  network,
  locale,
  labels,
}: {
  title: string;
  hint: string;
  accentColor: string;
  legs: LegDraft[];
  onChangeLegs: (updater: (prev: LegDraft[]) => LegDraft[]) => void;
  infos: ResourceSummary[];
  holdings?: AccountHoldings;
  network: 'mainnet' | 'stokenet';
  locale: string;
  labels: ConsoleToolProps['t']['atomicSwap'];
}) {
  return (
    <div className="space-y-4">
      <div className="pb-2 border-b space-y-0.5" style={{ borderColor: 'var(--color-card-border)' }}>
        <span className="block text-xs font-black uppercase tracking-widest" style={{ color: accentColor }}>
          {title}
        </span>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      </div>
      {legs.map((leg, idx) => (
        <div key={leg.id} className={idx > 0 ? 'pt-3 border-t' : ''} style={{ borderColor: 'var(--color-card-border)' }}>
          <AssetLegRow
            leg={leg}
            allLegs={legs}
            onChange={(next) => onChangeLegs((prev) => prev.map((l) => (l.id === leg.id ? next : l)))}
            onRemove={() => onChangeLegs((prev) => prev.filter((l) => l.id !== leg.id))}
            canRemove={legs.length > 1}
            info={infos[idx]}
            holdings={holdings}
            network={network}
            locale={locale}
            labels={labels}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChangeLegs((prev) => [...prev, emptyLeg()])}
        className="inline-flex items-center gap-1.5 text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer"
        style={{ color: accentColor }}
      >
        <Plus className="size-3.5" />
        {labels.addResource}
      </button>
    </div>
  );
}

function SwapOfferAssetsGrid({
  leftAssets,
  leftLabel,
  leftAccent,
  rightAssets,
  rightLabel,
  rightAccent,
  network,
}: {
  leftAssets: SwapAsset[];
  leftLabel: string;
  leftAccent: string;
  rightAssets: SwapAsset[];
  rightLabel: string;
  rightAccent: string;
  network: 'mainnet' | 'stokenet';
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
      <div className="space-y-2.5">
        {leftAssets.map((asset, idx) => (
          <OfferAssetBox
            key={`${asset.resourceAddress}-${idx}`}
            label={leftLabel}
            accentVar={leftAccent}
            asset={asset}
            network={network}
          />
        ))}
      </div>
      <div className="flex items-center justify-center self-center py-1 md:py-0">
        <ArrowLeftRight className="size-5" style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <div className="space-y-2.5">
        {rightAssets.map((asset, idx) => (
          <OfferAssetBox
            key={`${asset.resourceAddress}-${idx}`}
            label={rightLabel}
            accentVar={rightAccent}
            asset={asset}
            network={network}
          />
        ))}
      </div>
    </div>
  );
}

function OfferStatusBadge({
  status,
  labels,
}: {
  status: 'active' | 'expired' | 'committed';
  labels: ConsoleToolProps['t']['atomicSwap'];
}) {
  const isCommitted = status === 'committed';
  const isExpired = status === 'expired';
  const Icon = isCommitted ? Check : Clock;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{
        color: isCommitted
          ? 'var(--color-primary)'
          : isExpired
            ? 'var(--color-danger)'
            : 'var(--color-success)',
        background: isCommitted
          ? 'rgba(var(--color-primary-rgb), 0.12)'
          : isExpired
            ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
            : 'color-mix(in srgb, var(--color-success) 12%, transparent)',
      }}
    >
      <Icon className="size-3.5" />
      {isCommitted
        ? labels.offerStatusCommitted
        : isExpired
          ? labels.offerStatusExpired
          : labels.offerStatusActive}
    </span>
  );
}

function OfferMetadataBar({
  makerAccount,
  takerAccount,
  subintentHash,
  txid,
  network,
  expirationTimestamp,
  language,
  borderedBottom,
  labels,
}: {
  makerAccount: string;
  takerAccount: string | null;
  subintentHash: string;
  txid?: string | null;
  network: 'mainnet' | 'stokenet';
  expirationTimestamp: number;
  language: string;
  borderedBottom?: boolean;
  labels: ConsoleToolProps['t']['atomicSwap'];
}) {
  return (
    <div
      className={`${borderedBottom ? 'py-5 border-y' : 'pt-5 sm:pt-6 border-t'} flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 text-xs`}
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <div className="flex flex-col justify-center">
        <span className="block text-[10px] uppercase font-bold tracking-wider leading-none" style={{ color: 'var(--color-text-muted)' }}>
          {labels.makerLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 mt-2 font-mono leading-none" style={{ color: 'var(--color-text-main)' }}>
          <span>{truncateAddress(makerAccount, 10, 6)}</span>
          <CopyButton value={makerAccount} size="xs" variant="ghost" className="-my-1" />
        </span>
      </div>

      <div className="flex flex-col justify-center sm:items-center">
        <span className="block text-[10px] uppercase font-bold tracking-wider leading-none" style={{ color: 'var(--color-text-muted)' }}>
          {labels.takerLabel}
        </span>
        <span
          className="inline-flex items-center gap-1.5 mt-2 font-mono leading-none"
          style={{ color: takerAccount ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
        >
          {takerAccount ? (
            <>
              <span>{truncateAddress(takerAccount, 10, 6)}</span>
              <CopyButton value={takerAccount} size="xs" variant="ghost" className="-my-1" />
            </>
          ) : (
            <span>{labels.takerPending}</span>
          )}
        </span>
      </div>

      <div className="flex flex-col justify-center sm:items-center">
        <span className="block text-[10px] uppercase font-bold tracking-wider leading-none" style={{ color: 'var(--color-text-muted)' }}>
          {labels.subintentHashLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 mt-2 font-mono leading-none" style={{ color: 'var(--color-text-main)' }}>
          {txid ? (
            <>
              <a
                href={`/${language}/dashboard/tx/${txid}?network=${network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                <span>{truncateAddress(txid, 10, 6)}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
              <CopyButton value={txid} size="xs" variant="ghost" className="-my-1" />
            </>
          ) : (
            <>
              <span>{truncateAddress(subintentHash, 10, 6)}</span>
              <CopyButton value={subintentHash} size="xs" variant="ghost" className="-my-1" />
            </>
          )}
        </span>
      </div>

      <div className="flex flex-col justify-center sm:items-center">
        <span className="block text-[10px] uppercase font-bold tracking-wider leading-none" style={{ color: 'var(--color-text-muted)' }}>
          {labels.networkLabel}
        </span>
        <span className="inline-flex items-center mt-2 font-mono font-semibold uppercase leading-none" style={{ color: 'var(--color-text-main)' }}>
          {network}
        </span>
      </div>

      <div className="flex flex-col justify-center sm:items-center">
        <span className="block text-[10px] uppercase font-bold tracking-wider leading-none" style={{ color: 'var(--color-text-muted)' }}>
          {labels.expiresAtLabel}
        </span>
        <span className="inline-flex items-center mt-2 font-mono leading-none" style={{ color: 'var(--color-text-main)' }}>
          {new Date(expirationTimestamp * 1000).toLocaleString(language)}
        </span>
      </div>
    </div>
  );
}

let nextLegId = 2;
const emptyLeg = (): LegDraft => ({
  id: nextLegId++,
  resource: '',
  amount: '',
  selectedNftIds: [],
  manualNftIds: '',
});

export default function AtomicSwapTool({ t }: ConsoleToolProps) {
  const labels = t.atomicSwap;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const expectedAccountPrefix = activeNetwork === 'stokenet' ? 'account_tdx_2_' : 'account_rdx1';
  const expectedResourcePrefix = activeNetwork === 'stokenet' ? 'resource_tdx_2_' : 'resource_rdx1';
  const expectedSubintentPrefix = activeNetwork === 'stokenet' ? 'subtxid_tdx_2_' : 'subtxid_rdx1';
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialOfferParam = searchParams.get('offer')?.trim() ?? '';

  const subintent = useSubintentRequest();
  const takerSubintent = useSubintentRequest();
  const tx = useConsoleTransaction();
  const preview = useTransactionPreview();
  const acceptPreview = useTransactionPreview();

  const [tab, setTab] = useState<TabMode>(initialOfferParam ? 'accept' : 'create');
  const [flow, setFlow] = useState<SwapFlow>('subintent');

  const [makerAccountRaw, setMakerAccount] = useState<string | null>(null);
  const [takerAccountRaw, setTakerAccount] = useState<string | null>(null);
  const makerAccount = makerAccountRaw?.startsWith(expectedAccountPrefix) ? makerAccountRaw : null;
  const takerAccount = takerAccountRaw?.startsWith(expectedAccountPrefix) ? takerAccountRaw : null;

  const [offerLegsByNet, setOfferLegsByNet] = useState<Record<'mainnet' | 'stokenet', LegDraft[]>>({
    mainnet: [{ id: 1, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }],
    stokenet: [{ id: 2, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }],
  });
  const [wantLegsByNet, setWantLegsByNet] = useState<Record<'mainnet' | 'stokenet', LegDraft[]>>({
    mainnet: [{ id: 1000, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }],
    stokenet: [{ id: 1001, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }],
  });
  const offerLegs = offerLegsByNet[activeNetwork];
  const wantLegs = wantLegsByNet[activeNetwork];
  const setOfferLegs = (updater: (prev: LegDraft[]) => LegDraft[]) => {
    setOfferLegsByNet((prev) => ({ ...prev, [activeNetwork]: updater(prev[activeNetwork]) }));
  };
  const setWantLegs = (updater: (prev: LegDraft[]) => LegDraft[]) => {
    setWantLegsByNet((prev) => ({ ...prev, [activeNetwork]: updater(prev[activeNetwork]) }));
  };

  const [expirySec, setExpirySec] = useState<string>(String(EXPIRATION_PRESETS[1].seconds));
  const [customMinutes, setCustomMinutes] = useState('');
  const [message, setMessage] = useState('');

  const parsedCustomMinutes = parseFloat(customMinutes.replace(',', '.'));
  const effectiveExpirySec =
    customMinutes.trim() && Number.isFinite(parsedCustomMinutes) && parsedCustomMinutes > 0
      ? Math.max(60, Math.round(parsedCustomMinutes * 60))
      : Number(expirySec);

  const [offerCodeByNet, setOfferCodeByNet] = useState<Record<'mainnet' | 'stokenet', string>>(() => {
    if (!initialOfferParam) return { mainnet: '', stokenet: '' };
    const initDecoded = decodeSwapOffer(initialOfferParam);
    const initSubtx = parseSubintentIdInput(initialOfferParam);
    const initNet = initDecoded?.network ?? initSubtx?.network ?? null;
    if (initNet === 'mainnet') return { mainnet: initialOfferParam, stokenet: '' };
    if (initNet === 'stokenet') return { mainnet: '', stokenet: initialOfferParam };
    return { mainnet: initialOfferParam, stokenet: initialOfferParam };
  });
  const offerCodeInput = offerCodeByNet[activeNetwork];
  const setOfferCodeInput = (val: string) => {
    setOfferCodeByNet((prev) => ({ ...prev, [activeNetwork]: val }));
  };

  const [acceptAccountRaw, setAcceptAccount] = useState<string | null>(null);
  const acceptAccount = acceptAccountRaw?.startsWith(expectedAccountPrefix) ? acceptAccountRaw : null;
  const [isSettlingV2, setIsSettlingV2] = useState(false);
  const [v2TxResult, setV2TxResult] = useState<ConsoleTxResult | null>(null);
  const [v2TxError, setV2TxError] = useState<string | null>(null);
  const [cancelingHash, setCancelingHash] = useState<string | null>(null);
  const [cancelDestAccountRaw, setCancelDestAccount] = useState<string | null>(null);
  const cancelDestAccount = cancelDestAccountRaw?.startsWith(expectedAccountPrefix) ? cancelDestAccountRaw : null;
  const [offersFilter, setOffersFilter] = useState<'pending' | 'settled'>('pending');
  const cancelTx = useConsoleTransaction();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const allSavedOffers = useSyncExternalStore(
    subscribeSavedSwapOffers,
    getSavedSwapOffersSnapshot,
    getSavedSwapOffersServerSnapshot,
  );
  const networkSavedOffers = allSavedOffers.filter((entry) => entry.offer.network === activeNetwork);

  const savedStatusQueries = useQueries({
    queries: networkSavedOffers.map((entry) => ({
      queryKey: ['console', 'subintent-status-v3', entry.offer.network, entry.offer.subintentHash],
      staleTime: 15_000,
      retry: false,
      queryFn: () => fetchSubintentStatusInfo(entry.offer.network, entry.offer.subintentHash),
    })),
  });

  const activePendingCount = networkSavedOffers.filter((entry, idx) => {
    const status = savedStatusQueries[idx]?.data?.status;
    return status !== 'CommittedSuccess' && entry.offer.expirationTimestamp * 1000 > nowMs;
  }).length;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: makerHoldings } = useAccountResources(makerAccount);
  const { data: takerHoldings } = useAccountResources(flow === 'direct' ? takerAccount : null);

  const offerInfos = useLegsResourceInfos(offerLegs, activeNetwork, expectedResourcePrefix);
  const wantInfos = useLegsResourceInfos(wantLegs, activeNetwork, expectedResourcePrefix);

  const hasWrongNetworkResource = [...offerLegs, ...wantLegs].some((leg) => {
    const trimmed = leg.resource.trim();
    return trimmed.startsWith('resource_') && !trimmed.startsWith(expectedResourcePrefix);
  });
  const hasLockedResource = offerInfos.some((i) => !i.withdrawable) || wantInfos.some((i) => !i.withdrawable);
  const offerBalanceStates = offerLegs.map((leg, i) => getLegBalanceState(leg, offerLegs, offerInfos[i].isNft, makerHoldings));
  const wantBalanceStates = wantLegs.map((leg, i) =>
    getLegBalanceState(leg, wantLegs, wantInfos[i].isNft, flow === 'direct' ? takerHoldings : undefined),
  );
  const firstOverBalance = [...offerBalanceStates, ...wantBalanceStates].find((s) => s.isOverBalance && s.available);
  const hasInvalidAmount = [...offerBalanceStates, ...wantBalanceStates].some((s) => s.isInvalidAmount);
  const balanceBlockedReason = hasWrongNetworkResource
    ? t.common.otherNetworkField
    : hasInvalidAmount
      ? labels.invalidAmountError
      : firstOverBalance?.available
        ? labels.insufficientBalanceError.replace('{max}', formatBigForDisplay(firstOverBalance.available, language))
        : undefined;

  const offerAssets = offerLegs.map((leg, i) => toSwapAsset(offerInfos[i].isNft, leg));
  const wantAssets = wantLegs.map((leg, i) => toSwapAsset(wantInfos[i].isNft, leg));

  const makerSubintentManifest =
    makerAccount && !hasLockedResource && !hasWrongNetworkResource
      ? buildMakerSubintentManifest(makerAccount, offerAssets, wantAssets)
      : '';

  const makerSubintentPreviewManifest =
    makerAccount && !hasLockedResource && !hasWrongNetworkResource && makerSubintentManifest
      ? buildMakerSubintentPreviewManifest(makerAccount, offerAssets)
      : '';

  const directSwapManifest =
    makerAccount && takerAccount && !hasLockedResource && !hasWrongNetworkResource
      ? buildDirectAtomicSwapManifest(makerAccount, takerAccount, offerAssets, wantAssets)
      : '';

  const activeSubintentResult =
    subintent.result?.subintentHash.startsWith(expectedSubintentPrefix) ? subintent.result : null;

  const signedOfferCode =
    !activeSubintentResult || !makerAccount
      ? ''
      : encodeSwapOffer({
          v: 1,
          network: activeNetwork === 'stokenet' ? 'stokenet' : 'mainnet',
          makerAccount,
          offer: offerAssets.length === 1 ? offerAssets[0] : offerAssets,
          want: wantAssets.length === 1 ? wantAssets[0] : wantAssets,
          subintentHash: activeSubintentResult.subintentHash,
          signedPartialTransaction: activeSubintentResult.signedPartialTransaction,
          expirationTimestamp: activeSubintentResult.expirationTimestamp,
          ...(message.trim() ? { message: message.trim() } : {}),
        });

  const directDecodedOffer = decodeSwapOffer(offerCodeInput);
  const parsedSubintentId = directDecodedOffer ? null : parseSubintentIdInput(offerCodeInput);
  const inputOfferNetwork = directDecodedOffer?.network ?? parsedSubintentId?.network ?? null;
  const isWrongNetworkOffer = !!inputOfferNetwork && inputOfferNetwork !== activeNetwork;

  const savedMatchedOffer =
    parsedSubintentId && !isWrongNetworkOffer
      ? allSavedOffers.find(
          (entry) => entry.offer.subintentHash.toLowerCase() === parsedSubintentId.subintentHash,
        )?.offer ?? null
      : null;

  const targetSubintentHash = !isWrongNetworkOffer
    ? (directDecodedOffer?.subintentHash ?? savedMatchedOffer?.subintentHash ?? parsedSubintentId?.subintentHash ?? '')
    : '';

  // Check on-ledger status of the Subintent via Gateway so settled offers show as Committed and expose their txid & committed details.
  const { data: subintentStatusInfo, isLoading: isLoadingSubintentStatus } = useQuery<SubintentStatusInfo>({
    queryKey: ['console', 'subintent-status-v3', activeNetwork, targetSubintentHash],
    enabled: !!targetSubintentHash,
    staleTime: 15_000,
    retry: false,
    queryFn: () => fetchSubintentStatusInfo(activeNetwork, targetSubintentHash),
  });

  const reconstructedOffer: AtomicSwapOffer | null =
    parsedSubintentId
    && !isWrongNetworkOffer
    && !savedMatchedOffer
    && subintentStatusInfo?.committedTx
      ? reconstructOfferFromCommittedTx(
          parsedSubintentId.subintentHash,
          activeNetwork,
          subintentStatusInfo.committedTx,
        )
      : null;

  const decodedOffer = isWrongNetworkOffer
    ? null
    : (directDecodedOffer ?? savedMatchedOffer ?? reconstructedOffer ?? null);
  const isLookingUpRawSubintent =
    !!parsedSubintentId
    && !isWrongNetworkOffer
    && !savedMatchedOffer
    && isLoadingSubintentStatus;
  const isUnsettledOffLedgerSubintent =
    !!parsedSubintentId
    && !isWrongNetworkOffer
    && !savedMatchedOffer
    && !isLoadingSubintentStatus
    && !decodedOffer;

  const isOfferExpired = decodedOffer ? decodedOffer.expirationTimestamp * 1000 < nowMs : false;
  const isOfferCommitted = subintentStatusInfo?.status === 'CommittedSuccess';
  const hasSignedPartialTx = Boolean(decodedOffer?.signedPartialTransaction);
  const settledTakerAccount =
    decodedOffer && subintentStatusInfo?.committedTx
      ? extractTakerAccountFromCommittedTx(decodedOffer.makerAccount, subintentStatusInfo.committedTx)
      : null;

  const takerSettlementManifest =
    decodedOffer && hasSignedPartialTx && acceptAccount ? buildTakerV2SettlementManifest(acceptAccount, decodedOffer) : '';

  const takerCounterSubintentManifest =
    decodedOffer && hasSignedPartialTx && acceptAccount ? buildTakerSubintentManifest(acceptAccount, decodedOffer.want, decodedOffer.offer) : '';

  // Simulate the full two-sided swap (Maker <-> Taker) so Preview displays the exact
  // real balance changes (-paid / +received for both accounts) using assume_all_signature_proofs.
  const takerPreviewManifest =
    decodedOffer && hasSignedPartialTx && acceptAccount
      ? buildDirectAtomicSwapManifest(decodedOffer.makerAccount, acceptAccount, decodedOffer.offer, decodedOffer.want)
        || buildMakerSubintentPreviewManifest(acceptAccount, decodedOffer.want)
      : '';

  const shareUrl =
    signedOfferCode && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?offer=${signedOfferCode}`
      : '';

  const buildOfferShareUrl = (code: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?offer=${code}` : '';

  const handleSignMakerSubintent = async () => {
    if (!makerAccount || !makerSubintentManifest) return;
    const signed = await subintent.sendSubintent(makerSubintentManifest, effectiveExpirySec, message);
    if (!signed) return;
    saveSignedSwapOffer({
      v: 1,
      network: activeNetwork === 'stokenet' ? 'stokenet' : 'mainnet',
      makerAccount,
      offer: offerAssets.length === 1 ? offerAssets[0] : offerAssets,
      want: wantAssets.length === 1 ? wantAssets[0] : wantAssets,
      subintentHash: signed.subintentHash,
      signedPartialTransaction: signed.signedPartialTransaction,
      expirationTimestamp: signed.expirationTimestamp,
      ...(message.trim() ? { message: message.trim() } : {}),
    });
  };

  const handleAcceptAndSettleV2 = async () => {
    if (!decodedOffer || !acceptAccount || !takerCounterSubintentManifest) return;
    setV2TxError(null);
    setV2TxResult(null);

    const ttl = Math.max(60, decodedOffer.expirationTimestamp - Math.floor(nowMs / 1000));
    const signedTaker = await takerSubintent.sendSubintent(takerCounterSubintentManifest, ttl, decodedOffer.message);
    if (!signedTaker) return;

    setIsSettlingV2(true);
    try {
      const settled = await settleAtomicSwapV2({
        network: decodedOffer.network,
        makerSubintentHash: decodedOffer.subintentHash,
        makerSignedPartialTxHex: decodedOffer.signedPartialTransaction,
        takerSubintentHash: signedTaker.subintentHash,
        takerSignedPartialTxHex: signedTaker.signedPartialTransaction,
        offer: decodedOffer.offer,
        want: decodedOffer.want,
      });
      setV2TxResult({
        transactionIntentHash: settled.transactionIntentHash,
        status: settled.status,
        createdEntities: [],
      });
      void queryClient.invalidateQueries({
        queryKey: ['console', 'subintent-status-v3', decodedOffer.network, decodedOffer.subintentHash],
      });
    } catch (err) {
      setV2TxError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setIsSettlingV2(false);
    }
  };

  const sameAccountError = flow === 'direct' && !!makerAccount && !!takerAccount && makerAccount === takerAccount;
  const directBlockedReason = sameAccountError
    ? t.accountMigrate.sameAccountError
    : hasLockedResource
      ? labels.notWithdrawableError
      : balanceBlockedReason
        ? balanceBlockedReason
        : !directSwapManifest
          ? labels.fillAllFields
          : undefined;

  const errorMessages = t.common.errors as Record<string, string>;

  return (
    <div className="space-y-6">
      {/* Radix Seal style underline tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
        <div className="flex flex-wrap gap-6">
          {(['create', 'accept', 'offers'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="relative pb-2.5 text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              style={{ color: tab === key ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
            >
              <span>
                {key === 'create'
                  ? labels.tabCreate
                  : key === 'accept'
                    ? labels.tabAccept
                    : labels.tabMyOffers}
              </span>
              {key === 'offers' && activePendingCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums leading-none"
                  style={{
                    background: 'rgba(var(--color-primary-rgb), 0.14)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {activePendingCount}
                </span>
              )}
              {tab === key && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(to right, var(--color-accent), var(--color-primary))' }}
                />
              )}
            </button>
          ))}
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold pb-2" style={{ color: 'var(--color-success)' }}>
          <ShieldCheck className="size-4" />
          {labels.zeroFeeBadge}
        </span>
      </div>

      {tab === 'create' ? (
        <div className="space-y-6">
          {/* Subintent V2 first (default), Direct V1 second */}
          <OptionButtons<SwapFlow>
            size="md"
            value={flow}
            onChange={(next) => {
              setFlow(next);
              subintent.reset();
              preview.reset();
            }}
            options={[
              { value: 'subintent', label: labels.flowSubintentTitle, description: labels.flowSubintentDesc },
              { value: 'direct', label: labels.flowDirectTitle, description: labels.flowDirectDesc },
            ]}
          />

          {flow === 'subintent' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.makerAccount}
                </span>
                <AccountPicker value={makerAccount} onChange={setMakerAccount} />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.expirationLabel}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                  {EXPIRATION_PRESETS.map((p) => {
                    const active = !customMinutes.trim() && expirySec === String(p.seconds);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setCustomMinutes('');
                          setExpirySec(String(p.seconds));
                        }}
                        className="min-h-[56px] w-full px-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer hover:border-[var(--color-primary)]/60"
                        style={{
                          background: active ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-surface)',
                          borderColor: active ? 'var(--color-primary)' : 'var(--color-card-border)',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        }}
                      >
                        {p.key}
                      </button>
                    );
                  })}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder={labels.customExpiryPlaceholder}
                    className="min-h-[56px] w-full px-3 rounded-xl border text-xs font-mono text-center outline-none focus:border-[var(--color-primary)]"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: customMinutes.trim() ? 'var(--color-primary)' : 'var(--color-card-border)',
                      color: 'var(--color-text-main)',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.makerAccount}
                </span>
                <AccountPicker value={makerAccount} onChange={setMakerAccount} />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.counterpartyAccount}
                </span>
                <AccountPicker value={takerAccount} onChange={setTakerAccount} />
                <div className="min-h-[14px]">
                  {sameAccountError && (
                    <p className="text-[11px] leading-tight font-medium text-red-500">
                      {t.accountMigrate.sameAccountError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 items-start" style={{ borderColor: 'var(--color-card-border)' }}>
            <EditableSwapSideColumn
              title={labels.youGive}
              hint={labels.youGiveHint}
              accentColor="var(--color-primary)"
              legs={offerLegs}
              onChangeLegs={setOfferLegs}
              infos={offerInfos}
              holdings={makerHoldings}
              network={activeNetwork}
              locale={language}
              labels={labels}
            />

            <div className="flex items-center justify-center self-center py-1 md:py-0">
              <ArrowLeftRight className="size-5" style={{ color: 'var(--color-text-muted)' }} />
            </div>

            <EditableSwapSideColumn
              title={labels.youReceive}
              hint={labels.youReceiveHint}
              accentColor="var(--color-accent)"
              legs={wantLegs}
              onChangeLegs={setWantLegs}
              infos={wantInfos}
              holdings={flow === 'direct' ? takerHoldings : undefined}
              network={activeNetwork}
              locale={language}
              labels={labels}
            />
          </div>

          <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--color-card-border)' }}>
            <TextField
              label={labels.messageLabel}
              value={message}
              onChange={(v) => setMessage(v.slice(0, 240))}
              placeholder={labels.messagePlaceholder}
              maxLength={240}
              trailingPadding="pr-14"
              trailing={
                <span
                  className="px-1.5 text-xs font-mono font-bold tabular-nums pointer-events-none"
                  style={{
                    color: 240 - message.length <= 20 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  }}
                >
                  {Math.max(0, 240 - message.length)}
                </span>
              }
            />

            {flow === 'direct' ? (
              <>
                <CollapsibleManifest
                  manifest={directSwapManifest}
                  showLabel={t.batches.showManifest}
                  hideLabel={t.batches.hideManifest}
                  copyLabel={t.common.copy}
                />
                <TxActions
                  t={t}
                  onSend={() => void tx.sendTransaction(directSwapManifest, { message })}
                  onSimulate={() => void preview.simulate(directSwapManifest)}
                  sendDisabled={!directSwapManifest || !!balanceBlockedReason || tx.isSending}
                  simulateDisabled={!directSwapManifest || !!balanceBlockedReason || preview.isSimulating}
                  sending={tx.isSending}
                  simulating={preview.isSimulating}
                  sendLabel={labels.sendDirectButton}
                  sendingLabel={t.common.sending}
                  blockedReason={directBlockedReason}
                />
                <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
                <TxResultBanner result={tx.result} error={tx.error} t={t.common} />
              </>
            ) : (
              <>
                {activeSubintentResult && signedOfferCode && (
                  <div
                    className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      background: 'color-mix(in srgb, var(--color-success) 6%, var(--color-surface))',
                      borderColor: 'color-mix(in srgb, var(--color-success) 35%, var(--color-card-border))',
                    }}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="block text-xs font-black" style={{ color: 'var(--color-success)' }}>
                        {labels.offerReadyTitle}
                      </span>
                      <p className="text-xs leading-snug" style={{ color: 'var(--color-text-main)' }}>
                        {labels.offerReadyHint}
                      </p>
                      <span className="block text-[11px] font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {labels.subintentHashLabel}: {truncateAddress(activeSubintentResult.subintentHash, 18, 12)}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <ShareTargets
                        url={shareUrl}
                        text={labels.offerReadyTitle}
                        copyLabel={labels.copyShareLink}
                        copiedLabel={t.common.copied}
                        qr={{ label: 'QR', hint: labels.offerReadyHint, size: 300 }}
                        size="panel"
                      />
                    </div>
                  </div>
                )}

                <CollapsibleManifest
                  manifest={makerSubintentManifest}
                  showLabel={t.batches.showManifest}
                  hideLabel={t.batches.hideManifest}
                  copyLabel={t.common.copy}
                />
                <TxActions
                  t={t}
                  onSend={() => void handleSignMakerSubintent()}
                  onSimulate={() => void preview.simulate(makerSubintentPreviewManifest)}
                  sendDisabled={!makerSubintentManifest || !!balanceBlockedReason || subintent.isSending}
                  simulateDisabled={!makerSubintentPreviewManifest || !!balanceBlockedReason || preview.isSimulating}
                  sending={subintent.isSending}
                  simulating={preview.isSimulating}
                  sendLabel={labels.signSubintentButton}
                  sendingLabel={t.common.sending}
                  blockedReason={
                    hasLockedResource
                      ? labels.notWithdrawableError
                      : balanceBlockedReason
                        ? balanceBlockedReason
                        : !makerSubintentManifest
                          ? labels.fillAllFields
                          : undefined
                  }
                />
                <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
                {subintent.error && (
                  <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                    {resolveConsoleError(subintent.error, errorMessages)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : tab === 'accept' ? (
        <div className="space-y-5">
          <ToolSection title={labels.acceptTitle} hint={labels.acceptHint}>
            <textarea
              rows={3}
              value={offerCodeInput}
              onChange={(e) => setOfferCodeInput(e.target.value)}
              placeholder={labels.acceptPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
            />
            {isWrongNetworkOffer && inputOfferNetwork ? (
              <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                {labels.wrongNetworkOffer
                  .replace('{offerNetwork}', inputOfferNetwork)
                  .replace('{activeNetwork}', activeNetwork)}
              </p>
            ) : isLookingUpRawSubintent ? (
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {labels.lookingUpSubintent}
              </p>
            ) : isUnsettledOffLedgerSubintent ? (
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {labels.subintentOffLedgerNotice}
              </p>
            ) : offerCodeInput.trim() && !decodedOffer ? (
              <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                {labels.invalidOfferCode}
              </p>
            ) : null}
          </ToolSection>

          {decodedOffer && (
            <>
              <ToolSection
                title={labels.acceptSummaryTitle}
                hint={labels.acceptSummaryHint}
                action={
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {hasSignedPartialTx && (
                      !allSavedOffers.some((e) => e.offer.subintentHash === decodedOffer.subintentHash) ? (
                        <button
                          type="button"
                          onClick={() => saveSignedSwapOffer(decodedOffer)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer hover:border-[var(--color-primary)]"
                          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-primary)' }}
                        >
                          <BookmarkPlus className="size-3.5" />
                          {labels.saveOfferButton}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          <Check className="size-3" />
                          {labels.savedInOffers}
                        </span>
                      )
                    )}
                    <OfferStatusBadge
                      status={isOfferCommitted ? 'committed' : isOfferExpired ? 'expired' : 'active'}
                      labels={labels}
                    />
                  </div>
                }
              >
                <SwapOfferAssetsGrid
                  leftAssets={normalizeSwapAssets(decodedOffer.offer)}
                  leftLabel={labels.takerReceives}
                  leftAccent="var(--color-accent)"
                  rightAssets={normalizeSwapAssets(decodedOffer.want)}
                  rightLabel={labels.takerPays}
                  rightAccent="var(--color-primary)"
                  network={decodedOffer.network}
                />

                <OfferMetadataBar
                  makerAccount={decodedOffer.makerAccount}
                  takerAccount={isOfferCommitted ? settledTakerAccount : null}
                  subintentHash={decodedOffer.subintentHash}
                  txid={isOfferCommitted ? subintentStatusInfo?.txid : null}
                  network={decodedOffer.network}
                  expirationTimestamp={decodedOffer.expirationTimestamp}
                  language={language}
                  labels={labels}
                />

                {decodedOffer.message && (
                  <div className="pt-3 border-t text-xs" style={{ borderColor: 'var(--color-card-border)' }}>
                    <span className="block text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.offerMessageLabel}
                    </span>
                    <p className="mt-1 leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
                      {decodedOffer.message}
                    </p>
                  </div>
                )}
              </ToolSection>

              {hasSignedPartialTx && !isOfferCommitted && (
                <>
                  <ToolSection title={labels.takerAccount}>
                    <AccountPicker value={acceptAccount} onChange={setAcceptAccount} />
                  </ToolSection>

                  <div className="space-y-4">
                    <CollapsibleManifest
                      manifest={takerSettlementManifest}
                      showLabel={t.batches.showManifest}
                      hideLabel={t.batches.hideManifest}
                      copyLabel={t.common.copy}
                    />

                    <TxActions
                      t={t}
                      onSend={() => void handleAcceptAndSettleV2()}
                      onSimulate={() => void acceptPreview.simulate(takerPreviewManifest)}
                      sendDisabled={!takerCounterSubintentManifest || isOfferExpired || isOfferCommitted || takerSubintent.isSending || isSettlingV2}
                      simulateDisabled={!takerPreviewManifest || isOfferExpired || isOfferCommitted || acceptPreview.isSimulating || isSettlingV2}
                      sending={takerSubintent.isSending || isSettlingV2}
                      simulating={acceptPreview.isSimulating}
                      sendLabel={labels.signTakerSubintentButton}
                      sendingLabel={isSettlingV2 ? labels.settlingStatus : t.common.sending}
                      blockedReason={isOfferCommitted ? labels.offerStatusCommitted : isOfferExpired ? labels.offerStatusExpired : undefined}
                    />

                    <SimulateResultCard t={t.simulate} preview={acceptPreview.preview} error={acceptPreview.error} onClose={acceptPreview.reset} />

                    {(takerSubintent.error || v2TxError) && (
                      <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                        {resolveConsoleError(takerSubintent.error ?? v2TxError, errorMessages)}
                      </p>
                    )}

                    <TxResultBanner result={v2TxResult} error={null} t={t.common} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (() => {
        const pendingOffers = networkSavedOffers
          .map((entry, idx) => ({
            entry,
            committed: savedStatusQueries[idx]?.data?.status === 'CommittedSuccess',
            expired: savedStatusQueries[idx]?.data?.status !== 'CommittedSuccess' && entry.offer.expirationTimestamp * 1000 < nowMs,
          }))
          .filter((item) => !item.committed);
        const committedLocalOffers = networkSavedOffers
          .map((entry, idx) => ({
            entry,
            committed: savedStatusQueries[idx]?.data?.status === 'CommittedSuccess',
            txid: savedStatusQueries[idx]?.data?.txid ?? null,
            takerAccount: extractTakerAccountFromCommittedTx(
              entry.offer.makerAccount,
              savedStatusQueries[idx]?.data?.committedTx,
            ),
          }))
          .filter((item) => item.committed);

        return (
          <div className="space-y-5">
            <OptionButtons<'pending' | 'settled'>
              size="md"
              value={offersFilter}
              onChange={setOffersFilter}
              options={[
                {
                  value: 'pending',
                  label: `${labels.offersSubtabPending} (${pendingOffers.length})`,
                  description: labels.offersSubtabPendingDesc,
                },
                {
                  value: 'settled',
                  label: `${labels.offersSubtabSettled} (${committedLocalOffers.length})`,
                  description: labels.offersSubtabSettledDesc,
                },
              ]}
            />

            {offersFilter === 'pending' ? (
              pendingOffers.length === 0 ? (
                <ToolSection title={labels.myOffersTitle} hint={labels.myOffersHint}>
                  <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                    {labels.myOffersEmpty}
                  </p>
                </ToolSection>
              ) : (
                pendingOffers.map(({ entry, expired }) => {
                  const itemShareUrl = buildOfferShareUrl(encodeSwapOffer(entry.offer));

                  return (
                    <ToolSection
                      key={entry.offer.subintentHash}
                      title={labels.acceptSummaryTitle}
                      hint={entry.offer.message || undefined}
                      action={<OfferStatusBadge status={expired ? 'expired' : 'active'} labels={labels} />}
                    >
                      <SwapOfferAssetsGrid
                        leftAssets={normalizeSwapAssets(entry.offer.offer)}
                        leftLabel={labels.youGive}
                        leftAccent="var(--color-primary)"
                        rightAssets={normalizeSwapAssets(entry.offer.want)}
                        rightLabel={labels.youReceive}
                        rightAccent="var(--color-accent)"
                        network={entry.offer.network}
                      />

                      <OfferMetadataBar
                        makerAccount={entry.offer.makerAccount}
                        takerAccount={null}
                        subintentHash={entry.offer.subintentHash}
                        network={entry.offer.network}
                        expirationTimestamp={entry.offer.expirationTimestamp}
                        language={language}
                        borderedBottom
                        labels={labels}
                      />

                      <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-between gap-3">
                        <ShareTargets
                          url={itemShareUrl}
                          text={labels.offerReadyTitle}
                          copyLabel={labels.copyShareLink}
                          copiedLabel={t.common.copied}
                          qr={{ label: 'QR', hint: labels.offerReadyHint, size: 300 }}
                          size="panel"
                        />

                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setOfferCodeInput(entry.code);
                              setTab('accept');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold leading-none py-1 cursor-pointer hover:opacity-75 transition-opacity"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span>{labels.openOfferButton}</span>
                          </button>
                          {!expired ? (
                            <button
                              type="button"
                              onClick={() => {
                                cancelTx.reset();
                                setCancelingHash((prev) =>
                                  prev === entry.offer.subintentHash ? null : entry.offer.subintentHash,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold leading-none py-1 cursor-pointer hover:opacity-75 transition-opacity"
                              style={{ color: 'var(--color-danger)' }}
                            >
                              <Ban className="size-3.5 shrink-0" />
                              <span>{labels.cancelOfferButton}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => removeSavedSwapOffer(entry.offer.subintentHash)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold leading-none py-1 cursor-pointer hover:opacity-75 transition-opacity"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              <Trash2 className="size-3.5 shrink-0" />
                              <span>{labels.deleteOfferButton}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {cancelingHash === entry.offer.subintentHash && !expired && (() => {
                        const sameCancelAccount = !!cancelDestAccount && cancelDestAccount === entry.offer.makerAccount;
                        const cancelManifest = cancelDestAccount
                          ? buildCancelSwapMoveManifest(entry.offer.makerAccount, cancelDestAccount, entry.offer.offer)
                          : '';
                        return (
                          <div
                            className="pt-3 border-t space-y-3"
                            style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 30%, var(--color-card-border))' }}
                          >
                            <div className="space-y-1">
                              <span className="block text-xs font-black" style={{ color: 'var(--color-danger)' }}>
                                {labels.cancelOfferTitle}
                              </span>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                                {labels.cancelOfferNote}
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <span className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                {labels.cancelMoveToAccount}
                              </span>
                              <AccountPicker value={cancelDestAccount} onChange={setCancelDestAccount} />
                              {sameCancelAccount && (
                                <p className="text-[11px] font-medium text-red-500">{t.accountMigrate.sameAccountError}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <button
                                type="button"
                                disabled={!cancelManifest || cancelTx.isSending}
                                onClick={() => {
                                  void cancelTx.sendTransaction(cancelManifest).then((ok) => {
                                    if (ok) {
                                      removeSavedSwapOffer(entry.offer.subintentHash);
                                      setCancelingHash(null);
                                    }
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-40"
                                style={{ background: 'var(--color-danger)' }}
                              >
                                <Ban className="size-3.5" />
                                {cancelTx.isSending ? t.common.sending : labels.cancelConfirmButton}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  removeSavedSwapOffer(entry.offer.subintentHash);
                                  setCancelingHash(null);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                <Trash2 className="size-3.5" />
                                {labels.removeFromHistoryButton}
                              </button>
                            </div>
                            <TxResultBanner result={cancelTx.result} error={cancelTx.error} t={t.common} />
                          </div>
                        );
                      })()}
                    </ToolSection>
                  );
                })
              )
            ) : committedLocalOffers.length === 0 ? (
              <ToolSection title={labels.myOffersTitle} hint={labels.myOffersHint}>
                <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.settledHistoryEmpty}
                </p>
              </ToolSection>
            ) : (
              <div className="space-y-5">
                {committedLocalOffers.map(({ entry, txid, takerAccount: settledTaker }) => (
                  <ToolSection
                    key={entry.offer.subintentHash}
                    title={labels.acceptSummaryTitle}
                    hint={entry.offer.message || undefined}
                    action={
                      <div className="flex items-center gap-2">
                        <OfferStatusBadge status="committed" labels={labels} />
                        <button
                          type="button"
                          onClick={() => removeSavedSwapOffer(entry.offer.subintentHash)}
                          className="inline-flex items-center p-1 rounded-lg cursor-pointer hover:opacity-80"
                          style={{ color: 'var(--color-text-muted)' }}
                          title={labels.deleteOfferButton}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    }
                  >
                    <SwapOfferAssetsGrid
                      leftAssets={normalizeSwapAssets(entry.offer.offer)}
                      leftLabel={labels.youGive}
                      leftAccent="var(--color-primary)"
                      rightAssets={normalizeSwapAssets(entry.offer.want)}
                      rightLabel={labels.youReceive}
                      rightAccent="var(--color-accent)"
                      network={entry.offer.network}
                    />

                    <OfferMetadataBar
                      makerAccount={entry.offer.makerAccount}
                      takerAccount={settledTaker}
                      subintentHash={entry.offer.subintentHash}
                      txid={txid}
                      network={entry.offer.network}
                      expirationTimestamp={entry.offer.expirationTimestamp}
                      language={language}
                      labels={labels}
                    />
                  </ToolSection>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
