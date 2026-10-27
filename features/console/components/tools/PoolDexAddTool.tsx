'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ShieldQuestion, TriangleAlert } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useDexListing, useDexPool } from '../../hooks/useDexPools';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { accountFromQuery, consoleQueryParam } from '../../lib/console-query';
import { isPositiveDecimal, lteDecimal, normalizeDecimal } from '../../lib/decimal';
import {
  addLiquidityManifest,
  fullRangeTicks,
  pairedAmount,
  precisionPairedAmount,
  rangeSides,
  rangeTicks,
  tickToPrice,
  toDecimalString,
  type DexPool,
} from '../../lib/dex-pools';
import { previewTransaction } from '../../services/transactionPreview';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { PoolAmountField } from '../pool/PoolAmountField';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { AddressField, TextField } from '../shared/fields';
import { MessageLine } from '../shared/MessageLine';
import { OptionButtons } from '../shared/OptionButtons';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';

type RangePreset = 'full' | 'narrow' | 'wide' | 'custom';
/** Price span of each preset around the current price (×/÷). */
const PRESET_SPAN: Record<'narrow' | 'wide', number> = { narrow: 1.05, wide: 1.25 };

/**
 * Liquidity for pools a DEX runs. Their native pool answers only to the DEX
 * component, so it goes in through the component: Ociswap Basic and Flex (both
 * tokens), DefiPlaza (one side, plus the other token when that side is short)
 * and Ociswap Precision (a price range, as an NFT position). The other amount
 * follows the reserves or the range, what you receive is simulated with the
 * very transaction you sign, and a component the DEX does not list has to be
 * acknowledged first.
 */
export default function PoolDexAddTool({ t }: ConsoleToolProps) {
  const labels = t.poolDexAdd;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [address, setAddress] = useConsoleQueryState<string>(() => consoleQueryParam('pool') ?? '', '');
  const target = address.trim();
  const { data: dex, isFetching: resolving, isFetched } = useDexPool(target);
  const listing = useDexListing(dex ? dex.component : null);
  const holdings = useAccountResources(account);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [side, setSide] = useState<'base' | 'quote'>('base');
  const [preset, setPreset] = useState<RangePreset>('full');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const { sendTransaction, isSending, result, error: sendError, reset } = useConsoleTransaction();
  const simulate = useTransactionPreview();
  const queryClient = useQueryClient();

  const names = useResourceLabels(dex ? [dex.x, dex.y] : []);
  const nameOf = (resource: string) => names[resource] ?? truncateAddress(resource, 10, 6);
  const balanceOf = (resource: string) => holdings.data?.fungibles.find((f) => f.resourceAddress === resource)?.amount ?? '0';
  const fmt = (value: number) => formatNumber(value, 6, language);

  // Precision: the range the preset or the typed prices give, on the pool's tick grid.
  const price = dex?.kind === 'ociswap-precision' ? dex.priceSqrt ** 2 : 0;
  const range =
    dex?.kind !== 'ociswap-precision'
      ? null
      : preset === 'full'
        ? fullRangeTicks(dex.tickSpacing)
        : preset === 'custom'
          ? rangeTicks(Number(normalizeDecimal(minPrice)), Number(normalizeDecimal(maxPrice)), dex.tickSpacing)
          : rangeTicks(price / PRESET_SPAN[preset], price * PRESET_SPAN[preset], dex.tickSpacing);
  const sides = dex?.kind === 'ociswap-precision' && range ? rangeSides(dex.priceSqrt, range) : { x: true, y: true };

  /** Typing one amount proposes the other, from the reserves or the range. */
  const setAmount = (resource: string, raw: string) => {
    if (!dex) return;
    const value = Number(normalizeDecimal(raw));
    const other = resource === dex.x ? dex.y : dex.x;
    let paired: number | null = null;
    if (dex.kind === 'ociswap-basic' || dex.kind === 'ociswap-flex') paired = pairedAmount(dex.pool.reserves, resource, other, value);
    if (dex.kind === 'defiplaza') {
      const pool = side === 'quote' ? dex.quotePool : dex.basePool;
      paired = needsCo(dex, side) ? pairedAmount(pool.reserves, resource, other, value) : null;
    }
    if (dex.kind === 'ociswap-precision' && range) paired = precisionPairedAmount(dex.priceSqrt, range, resource === dex.x ? 'x' : 'y', value);
    setAmounts({ [resource]: raw, ...(paired !== null ? { [other]: paired > 0 ? toDecimalString(paired, 8) : '' } : {}) });
  };

  // What goes into the transaction: only the sides this pool and range take.
  const inputs = !dex
    ? []
    : dex.kind === 'defiplaza'
      ? [side === 'quote' ? dex.y : dex.x, ...(needsCo(dex, side) ? [side === 'quote' ? dex.x : dex.y] : [])]
      : [dex.x, dex.y].filter((r) => (r === dex.x ? sides.x : sides.y));
  const clean = Object.fromEntries(inputs.map((r) => [r, normalizeDecimal(amounts[r] ?? '')]));
  const amountError = (resource: string) => {
    const v = clean[resource];
    if (!v) return undefined;
    if (!isPositiveDecimal(v)) return labels.amountError;
    return lteDecimal(v, balanceOf(resource)) ? undefined : labels.balanceError;
  };
  const complete = inputs.length > 0 && inputs.every((r) => clean[r] && !amountError(r));

  let manifest = '';
  try {
    manifest = account && dex && complete ? addLiquidityManifest({ account, dex, amounts: clean, side, range: range ?? undefined }) : '';
  } catch {
    manifest = '';
  }

  // The DEX must vouch for the component; otherwise the user says they accept the risk.
  const listed = listing.data ?? null;
  const verified = activeNetwork === 'mainnet' && listing.isSuccess && listed !== null;
  const blockedReason = manifest && !verified && !acknowledged ? labels.acknowledgeFirst : undefined;

  // What the account would receive, simulated with this very manifest.
  const estimate = useQuery({
    queryKey: ['console-dex-add-estimate', activeNetwork, manifest],
    enabled: !!manifest && !!account,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => {
      const preview = await previewTransaction(manifest, activeNetwork);
      if (preview.status !== 'Succeeded') throw new Error(preview.errorMessage || preview.status);
      return preview.balanceChanges.filter((c) => c.entityAddress === account && Number(c.amount) > 0);
    },
  });
  const received = useResourceLabels((estimate.data ?? []).map((c) => c.resourceAddress));

  const send = async () => {
    if (await sendTransaction(manifest)) {
      setAmounts({});
      for (const key of ['console-account-resources', 'console-dex-pool', 'console-pool-unit-positions', 'console-precision-positions']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  };

  const pick = (next: string) => {
    setAddress(next);
    setAmounts({});
    setAcknowledged(false);
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      <ToolSection title={labels.poolTitle} hint={labels.poolHint}>
        <AddressField
          label={labels.poolLabel}
          categories={['pool', 'component']}
          value={address}
          onChange={pick}
          placeholder={labels.poolPlaceholder}
          reserveMessage
          error={target && isFetched && !resolving && dex === null ? labels.notDex : undefined}
        />
        {resolving && !dex && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.reading}</p>}
        {dex && (
          <DexSummary
            dex={dex}
            labels={labels}
            listingState={activeNetwork !== 'mainnet' ? 'offMainnet' : listing.isError ? 'unknown' : listing.isPending ? 'loading' : listed ? 'listed' : 'notListed'}
            apr={listed ? (dex.kind === 'defiplaza' ? listed.aprByPool[(side === 'quote' ? dex.quotePool : dex.basePool).address] : listed.apr) ?? null : null}
            nameOf={nameOf}
            fmt={fmt}
            copyTitle={t.common.copy}
          />
        )}
      </ToolSection>

      {dex && account && (
        <ToolSection title={labels.amountsTitle} hint={hintFor(dex, labels, side)}>
          <div className="space-y-4">
            {dex.kind === 'defiplaza' && (
              <OptionButtons<'base' | 'quote'>
                options={[
                  { value: 'base', label: labels.sideOption.replace('{token}', nameOf(dex.x)) },
                  { value: 'quote', label: labels.sideOption.replace('{token}', nameOf(dex.y)) },
                ]}
                value={side}
                onChange={(next) => {
                  setSide(next);
                  setAmounts({});
                }}
              />
            )}

            {dex.kind === 'ociswap-precision' && (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.currentPrice.replace('{price}', fmt(price)).replace('{y}', nameOf(dex.y)).replace('{x}', nameOf(dex.x))}
                </p>
                <OptionButtons<RangePreset>
                  options={[
                    { value: 'full', label: labels.rangeFull },
                    { value: 'wide', label: labels.rangeWide },
                    { value: 'narrow', label: labels.rangeNarrow },
                    { value: 'custom', label: labels.rangeCustom },
                  ]}
                  value={preset}
                  onChange={(next) => {
                    setPreset(next);
                    setAmounts({});
                  }}
                />
                {preset === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextField label={labels.minPrice} value={minPrice} onChange={setMinPrice} placeholder={fmt(price / 2)} />
                    <TextField label={labels.maxPrice} value={maxPrice} onChange={setMaxPrice} placeholder={fmt(price * 2)} />
                  </div>
                )}
                {range ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {preset === 'full'
                      ? labels.rangeFullNote
                      : labels.rangeNote.replace('{min}', fmt(tickToPrice(range.left))).replace('{max}', fmt(tickToPrice(range.right)))}
                    {!sides.x || !sides.y ? ` ${labels.oneSided.replace('{token}', nameOf(sides.x ? dex.x : dex.y))}` : ''}
                  </p>
                ) : (
                  <MessageLine tone="error">{labels.rangeError}</MessageLine>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inputs.map((resource) => (
                <PoolAmountField
                  key={resource}
                  label={nameOf(resource)}
                  resource={resource}
                  name={nameOf(resource)}
                  value={amounts[resource] ?? ''}
                  onChange={(v) => setAmount(resource, v)}
                  balance={balanceOf(resource)}
                  balanceLabel={t.pool.balance}
                  maxLabel={t.pool.max}
                  error={amountError(resource)}
                />
              ))}
            </div>

            {manifest && (
              <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{labels.receiveTitle}</span>
                {estimate.isPending ? (
                  <span className="block h-4 w-32 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
                ) : estimate.isError ? (
                  <MessageLine tone="error">{labels.estimateError.replace('{message}', estimate.error instanceof Error ? estimate.error.message : String(estimate.error))}</MessageLine>
                ) : (
                  estimate.data?.map((c) => (
                    <span key={c.resourceAddress} className="block text-sm tabular-nums" style={{ color: 'var(--color-text-main)' }} title={c.resourceAddress}>
                      + {fmt(Number(c.amount))} {received[c.resourceAddress] ?? truncateAddress(c.resourceAddress, 10, 6)}
                    </span>
                  ))
                )}
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{labels.receiveNote}</p>
              </div>
            )}

            {manifest && !verified && (
              <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-main)' }}>
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
                <span>{activeNetwork === 'mainnet' ? labels.acknowledge : labels.acknowledgeTestnet}</span>
              </label>
            )}
          </div>
        </ToolSection>
      )}

      <div className="space-y-4">
        <CollapsibleManifest manifest={manifest} showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={send}
          onSimulate={() => simulate.simulate(manifest)}
          sendDisabled={!manifest || !!blockedReason || isSending}
          simulateDisabled={!manifest || isSending}
          sending={isSending}
          simulating={simulate.isSimulating}
          sendLabel={labels.sendButton}
          sendingLabel={t.common.sending}
          blockedReason={blockedReason}
        />
      </div>
      <SimulateResultCard t={t.simulate} preview={simulate.preview} error={simulate.error} onClose={simulate.reset} />
      <TxResultBanner t={t.common} result={result} error={sendError} onReset={reset} />
    </div>
  );
}

/** A DefiPlaza side short of tokens takes the other token too. */
function needsCo(dex: DexPool, side: 'base' | 'quote') {
  return dex.kind === 'defiplaza' && dex.shortage === (side === 'quote' ? 'QuoteShortage' : 'BaseShortage');
}

function hintFor(dex: DexPool, labels: ConsoleToolProps['t']['poolDexAdd'], side: 'base' | 'quote') {
  if (dex.kind === 'defiplaza') return needsCo(dex, side) ? labels.hintPlazaShort : labels.hintPlaza;
  if (dex.kind === 'ociswap-precision') return labels.hintPrecision;
  return labels.hintBoth;
}

/** Which DEX it is, whether the DEX lists it, its tokens and the yield the DEX reports. */
function DexSummary({
  dex,
  labels,
  listingState,
  apr,
  nameOf,
  fmt,
  copyTitle,
}: {
  dex: DexPool;
  labels: ConsoleToolProps['t']['poolDexAdd'];
  listingState: 'listed' | 'notListed' | 'loading' | 'unknown' | 'offMainnet';
  apr: number | null;
  nameOf: (resource: string) => string;
  fmt: (value: number) => string;
  copyTitle: string;
}) {
  const status = {
    listed: { icon: BadgeCheck, color: 'var(--color-success)', text: labels.listed },
    notListed: { icon: TriangleAlert, color: 'var(--color-warning)', text: labels.notListed },
    unknown: { icon: ShieldQuestion, color: 'var(--color-warning)', text: labels.listingUnknown },
    offMainnet: { icon: ShieldQuestion, color: 'var(--color-text-muted)', text: labels.listingOffMainnet },
    loading: { icon: ShieldQuestion, color: 'var(--color-text-muted)', text: labels.listingLoading },
  }[listingState];
  const Icon = status.icon;
  return (
    <div className="mt-3 rounded-xl border p-3 space-y-2 text-sm" style={{ borderColor: 'var(--color-card-border)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>
          {labels.kinds[dex.kind]} · {nameOf(dex.x)} / {nameOf(dex.y)}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: status.color }}>
          <Icon className="size-3.5" /> {status.text}
        </span>
      </div>
      <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {labels.componentLabel} <span className="font-mono">{truncateAddress(dex.component, 10, 6)}</span>
        <CopyButton value={dex.component} size="xs" variant="ghost" title={copyTitle} />
      </span>
      {apr !== null && (
        <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {labels.dexApr.replace('{apr}', fmt(apr * 100))}
        </span>
      )}
    </div>
  );
}
