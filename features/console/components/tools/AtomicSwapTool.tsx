'use client';

import { useEffect, useState } from 'react';
import Big from 'big.js';
import { useSearchParams } from 'next/navigation';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, Clock, Link2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
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
  buildDirectAtomicSwapManifest,
  buildMakerSubintentManifest,
  buildMakerSubintentPreviewManifest,
  buildTakerSubintentManifest,
  buildTakerV2SettlementManifest,
  decodeSwapOffer,
  encodeSwapOffer,
  EXPIRATION_PRESETS,
  normalizeSwapAssets,
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
import { TxResultBanner } from '../shared/TxResultBanner';

type TabMode = 'create' | 'accept';
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

async function fetchResourceSummary(trimmed: string, network: 'mainnet' | 'stokenet'): Promise<ResourceSummary> {
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
    name: getMetadataString(meta, 'name') || '',
    symbol: getMetadataString(meta, 'symbol') || '',
    iconUrl: getMetadataString(meta, 'icon_url') || undefined,
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
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t text-[11px] font-mono" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
        <span className="truncate">{truncateAddress(asset.resourceAddress, 14, 10)}</span>
        <CopyButton value={asset.resourceAddress} size="xs" variant="ghost" />
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

  const [makerAccount, setMakerAccount] = useState<string | null>(null);
  const [takerAccount, setTakerAccount] = useState<string | null>(null);

  const [offerLegs, setOfferLegs] = useState<LegDraft[]>([{ id: 1, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }]);
  const [wantLegs, setWantLegs] = useState<LegDraft[]>([{ id: 1000, resource: '', amount: '', selectedNftIds: [], manualNftIds: '' }]);

  const [expirySec, setExpirySec] = useState<string>(String(EXPIRATION_PRESETS[1].seconds));
  const [customMinutes, setCustomMinutes] = useState('');
  const [message, setMessage] = useState('');

  const parsedCustomMinutes = parseFloat(customMinutes.replace(',', '.'));
  const effectiveExpirySec =
    customMinutes.trim() && Number.isFinite(parsedCustomMinutes) && parsedCustomMinutes > 0
      ? Math.max(60, Math.round(parsedCustomMinutes * 60))
      : Number(expirySec);

  const [copiedCode, setCopiedCode] = useState(false);

  const [offerCodeInput, setOfferCodeInput] = useState(initialOfferParam);
  const [acceptAccount, setAcceptAccount] = useState<string | null>(null);
  const [isSettlingV2, setIsSettlingV2] = useState(false);
  const [v2TxResult, setV2TxResult] = useState<ConsoleTxResult | null>(null);
  const [v2TxError, setV2TxError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: makerHoldings } = useAccountResources(makerAccount);
  const { data: takerHoldings } = useAccountResources(flow === 'direct' ? takerAccount : null);

  const offerInfoQueries = useQueries({
    queries: offerLegs.map((leg) => {
      const trimmed = leg.resource.trim();
      return {
        queryKey: ['console', 'resource-info-v3', activeNetwork, trimmed],
        enabled: trimmed.startsWith('resource_') && trimmed.length >= 20,
        staleTime: 5 * 60_000,
        retry: false,
        queryFn: () => fetchResourceSummary(trimmed, activeNetwork),
      };
    }),
  });

  const wantInfoQueries = useQueries({
    queries: wantLegs.map((leg) => {
      const trimmed = leg.resource.trim();
      return {
        queryKey: ['console', 'resource-info-v3', activeNetwork, trimmed],
        enabled: trimmed.startsWith('resource_') && trimmed.length >= 20,
        staleTime: 5 * 60_000,
        retry: false,
        queryFn: () => fetchResourceSummary(trimmed, activeNetwork),
      };
    }),
  });

  const offerInfos: ResourceSummary[] = offerLegs.map(
    (leg, idx) => offerInfoQueries[idx]?.data ?? { isNft: isNonFungibleResource(leg.resource.trim()), withdrawable: true, name: '', symbol: '' },
  );
  const wantInfos: ResourceSummary[] = wantLegs.map(
    (leg, idx) => wantInfoQueries[idx]?.data ?? { isNft: isNonFungibleResource(leg.resource.trim()), withdrawable: true, name: '', symbol: '' },
  );

  const hasLockedResource = offerInfos.some((i) => !i.withdrawable) || wantInfos.some((i) => !i.withdrawable);
  const offerBalanceStates = offerLegs.map((leg, i) => getLegBalanceState(leg, offerLegs, offerInfos[i].isNft, makerHoldings));
  const wantBalanceStates = wantLegs.map((leg, i) =>
    getLegBalanceState(leg, wantLegs, wantInfos[i].isNft, flow === 'direct' ? takerHoldings : undefined),
  );
  const firstOverBalance = [...offerBalanceStates, ...wantBalanceStates].find((s) => s.isOverBalance && s.available);
  const hasInvalidAmount = [...offerBalanceStates, ...wantBalanceStates].some((s) => s.isInvalidAmount);
  const balanceBlockedReason = hasInvalidAmount
    ? labels.invalidAmountError
    : firstOverBalance?.available
      ? labels.insufficientBalanceError.replace('{max}', formatBigForDisplay(firstOverBalance.available, language))
      : undefined;

  const offerAssets = offerLegs.map((leg, i) => toSwapAsset(offerInfos[i].isNft, leg));
  const wantAssets = wantLegs.map((leg, i) => toSwapAsset(wantInfos[i].isNft, leg));

  const makerSubintentManifest =
    makerAccount && !hasLockedResource ? buildMakerSubintentManifest(makerAccount, offerAssets, wantAssets) : '';

  const makerSubintentPreviewManifest =
    makerAccount && !hasLockedResource && makerSubintentManifest
      ? buildMakerSubintentPreviewManifest(makerAccount, offerAssets)
      : '';

  const directSwapManifest =
    makerAccount && takerAccount && !hasLockedResource
      ? buildDirectAtomicSwapManifest(makerAccount, takerAccount, offerAssets, wantAssets)
      : '';

  const signedOfferCode =
    !subintent.result || !makerAccount
      ? ''
      : encodeSwapOffer({
          v: 1,
          network: activeNetwork === 'stokenet' ? 'stokenet' : 'mainnet',
          makerAccount,
          offer: offerAssets.length === 1 ? offerAssets[0] : offerAssets,
          want: wantAssets.length === 1 ? wantAssets[0] : wantAssets,
          subintentHash: subintent.result.subintentHash,
          signedPartialTransaction: subintent.result.signedPartialTransaction,
          expirationTimestamp: subintent.result.expirationTimestamp,
          ...(message.trim() ? { message: message.trim() } : {}),
        });

  const decodedOffer = decodeSwapOffer(offerCodeInput);
  const isOfferExpired = decodedOffer ? decodedOffer.expirationTimestamp * 1000 < nowMs : false;

  // Check on-ledger status of the Subintent via Gateway so settled offers show as Committed.
  const { data: subintentStatus } = useQuery<string | null>({
    queryKey: ['console', 'subintent-status', decodedOffer?.network, decodedOffer?.subintentHash],
    enabled: !!decodedOffer?.subintentHash,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await gatewayPost<{ subintent_status?: string }>(
          decodedOffer!.network,
          '/transaction/subintent-status',
          { subintent_hash: decodedOffer!.subintentHash },
        );
        return res.subintent_status ?? null;
      } catch {
        return null;
      }
    },
  });
  const isOfferCommitted = subintentStatus === 'CommittedSuccess';

  const takerSettlementManifest =
    decodedOffer && acceptAccount ? buildTakerV2SettlementManifest(acceptAccount, decodedOffer) : '';

  const takerCounterSubintentManifest =
    decodedOffer && acceptAccount ? buildTakerSubintentManifest(acceptAccount, decodedOffer.want, decodedOffer.offer) : '';

  // Simulate the full two-sided swap (Maker <-> Taker) so Preview displays the exact
  // real balance changes (-paid / +received for both accounts) using assume_all_signature_proofs.
  const takerPreviewManifest =
    decodedOffer && acceptAccount
      ? buildDirectAtomicSwapManifest(decodedOffer.makerAccount, acceptAccount, decodedOffer.offer, decodedOffer.want)
        || buildMakerSubintentPreviewManifest(acceptAccount, decodedOffer.want)
      : '';

  const copyShareUrl = () => {
    if (!signedOfferCode || typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?offer=${signedOfferCode}`;
    void navigator.clipboard?.writeText(url);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 2000);
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
        queryKey: ['console', 'subintent-status', decodedOffer.network, decodedOffer.subintentHash],
      });
    } catch (err) {
      setV2TxError(err instanceof Error ? err.message : 'V2 settlement failed');
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
        <div className="flex gap-6">
          {(['create', 'accept'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="relative pb-2.5 text-sm font-bold transition-colors cursor-pointer"
              style={{ color: tab === key ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
            >
              {key === 'create' ? labels.tabCreate : labels.tabAccept}
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
            {/* Entregas column */}
            <div className="space-y-4">
              <div className="pb-2 border-b space-y-0.5" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="block text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>
                  {labels.youGive}
                </span>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.youGiveHint}
                </p>
              </div>
              {offerLegs.map((leg, idx) => (
                <div key={leg.id} className={idx > 0 ? 'pt-3 border-t' : ''} style={{ borderColor: 'var(--color-card-border)' }}>
                  <AssetLegRow
                    leg={leg}
                    allLegs={offerLegs}
                    onChange={(next) => setOfferLegs((prev) => prev.map((l) => (l.id === leg.id ? next : l)))}
                    onRemove={() => setOfferLegs((prev) => prev.filter((l) => l.id !== leg.id))}
                    canRemove={offerLegs.length > 1}
                    info={offerInfos[idx]}
                    holdings={makerHoldings}
                    network={activeNetwork}
                    locale={language}
                    labels={labels}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOfferLegs((prev) => [...prev, emptyLeg()])}
                className="inline-flex items-center gap-1.5 text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
              >
                <Plus className="size-3.5" />
                {labels.addResource}
              </button>
            </div>

            <div className="hidden md:flex items-center justify-center pt-10">
              <ArrowLeftRight className="size-5" style={{ color: 'var(--color-text-muted)' }} />
            </div>

            {/* Recibes column */}
            <div className="space-y-4">
              <div className="pb-2 border-b space-y-0.5" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="block text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                  {labels.youReceive}
                </span>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.youReceiveHint}
                </p>
              </div>
              {wantLegs.map((leg, idx) => (
                <div key={leg.id} className={idx > 0 ? 'pt-3 border-t' : ''} style={{ borderColor: 'var(--color-card-border)' }}>
                  <AssetLegRow
                    leg={leg}
                    allLegs={wantLegs}
                    onChange={(next) => setWantLegs((prev) => prev.map((l) => (l.id === leg.id ? next : l)))}
                    onRemove={() => setWantLegs((prev) => prev.filter((l) => l.id !== leg.id))}
                    canRemove={wantLegs.length > 1}
                    info={wantInfos[idx]}
                    holdings={flow === 'direct' ? takerHoldings : undefined}
                    network={activeNetwork}
                    locale={language}
                    labels={labels}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWantLegs((prev) => [...prev, emptyLeg()])}
                className="inline-flex items-center gap-1.5 text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: 'var(--color-accent)' }}
              >
                <Plus className="size-3.5" />
                {labels.addResource}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--color-card-border)' }}>
            <TextField
              label={labels.messageLabel}
              value={message}
              onChange={setMessage}
              placeholder={labels.messagePlaceholder}
              maxLength={240}
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
                {subintent.result && signedOfferCode && (
                  <div
                    className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      background: 'color-mix(in srgb, var(--color-success) 6%, var(--color-surface))',
                      borderColor: 'color-mix(in srgb, var(--color-success) 35%, var(--color-card-border))',
                    }}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="block text-xs font-black" style={{ color: 'var(--color-success)' }}>
                        {labels.offerReadyTitle}
                      </span>
                      <span className="block text-[11px] font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {labels.subintentHashLabel}: {truncateAddress(subintent.result.subintentHash, 18, 12)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyShareUrl}
                      className="min-w-[180px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:border-[var(--color-primary)] shrink-0"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)', color: 'var(--color-primary)' }}
                    >
                      {copiedCode ? <Check className="size-3.5 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
                      <span>{copiedCode ? t.common.copied : labels.copyShareLink}</span>
                    </button>
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
                  onSend={() => void subintent.sendSubintent(makerSubintentManifest, effectiveExpirySec, message)}
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
                    {errorMessages[subintent.error] ?? subintent.error}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
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
            {offerCodeInput.trim() && !decodedOffer && (
              <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                {labels.invalidOfferCode}
              </p>
            )}
          </ToolSection>

          {decodedOffer && (
            <>
              <ToolSection
                title={labels.acceptSummaryTitle}
                hint={labels.acceptSummaryHint}
                action={
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{
                      color: isOfferCommitted
                        ? 'var(--color-primary)'
                        : isOfferExpired
                          ? 'var(--color-danger)'
                          : 'var(--color-success)',
                      background: isOfferCommitted
                        ? 'rgba(var(--color-primary-rgb), 0.12)'
                        : isOfferExpired
                          ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                          : 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                    }}
                  >
                    <Clock className="size-3.5" />
                    {isOfferCommitted
                      ? labels.offerStatusCommitted
                      : isOfferExpired
                        ? labels.offerStatusExpired
                        : labels.offerStatusActive}
                  </span>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                  <div className="space-y-2.5">
                    {normalizeSwapAssets(decodedOffer.offer).map((asset, idx) => (
                      <OfferAssetBox
                        key={`${asset.resourceAddress}-${idx}`}
                        label={labels.takerReceives}
                        accentVar="var(--color-accent)"
                        asset={asset}
                        network={decodedOffer.network}
                      />
                    ))}
                  </div>
                  <div className="hidden md:flex items-center justify-center pt-10">
                    <ArrowLeftRight className="size-5" style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <div className="space-y-2.5">
                    {normalizeSwapAssets(decodedOffer.want).map((asset, idx) => (
                      <OfferAssetBox
                        key={`${asset.resourceAddress}-${idx}`}
                        label={labels.takerPays}
                        accentVar="var(--color-primary)"
                        asset={asset}
                        network={decodedOffer.network}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs" style={{ borderColor: 'var(--color-card-border)' }}>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.makerLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 mt-0.5 font-mono" style={{ color: 'var(--color-text-main)' }}>
                      {truncateAddress(decodedOffer.makerAccount, 12, 8)}
                      <CopyButton value={decodedOffer.makerAccount} size="xs" variant="ghost" />
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.networkLabel}
                    </span>
                    <span className="block mt-0.5 font-mono font-semibold uppercase" style={{ color: 'var(--color-text-main)' }}>
                      {decodedOffer.network}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.expiresAtLabel}
                    </span>
                    <span className="block mt-0.5 font-mono" style={{ color: 'var(--color-text-main)' }}>
                      {new Date(decodedOffer.expirationTimestamp * 1000).toLocaleString(language)}
                    </span>
                  </div>
                </div>

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
                    {errorMessages[takerSubintent.error ?? v2TxError ?? ''] ?? takerSubintent.error ?? v2TxError}
                  </p>
                )}

                <TxResultBanner result={v2TxResult} error={null} t={t.common} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
