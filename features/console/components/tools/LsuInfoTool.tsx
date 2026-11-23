'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calculator, ExternalLink, Plus, Search, Users, Wallet, X } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import { useValidatorList } from '@/features/dashboard/staking';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useCryptoMarkets } from '../../hooks/useCryptoMarkets';
import { useTopHolders } from '../../hooks/useTopHolders';
import { fetchLsuInfo } from '../../lib/lsu-lookup';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { TopHoldersList } from '../shared/TopHoldersList';
import { TextField } from '../shared/fields';

export default function LsuInfoTool({ t }: ConsoleToolProps) {
  const labels = t.lsuInfo;
  const { language } = useLanguage();
  const { activeNetwork, accounts } = useRadixWallet();
  const currency = getCurrencyForLocale(language);

  const [lsuAddress, setLsuAddress] = useConsoleQueryState(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lsu') ?? '' : ''),
    '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [calcAmount, setCalcAmount] = useState('1');
  const [showAllHolders, setShowAllHolders] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const { data: validatorsData } = useValidatorList(activeNetwork);
  const validators = validatorsData?.validators ?? [];

  // Wallet holdings to highlight LSUs the user owns
  const firstAccount = accounts[0]?.address ?? '';
  const { data: holdings } = useAccountResources(firstAccount || null);
  const heldByResource = new Map<string, number>();
  for (const f of holdings?.fungibles ?? []) {
    const amt = parseFloat(f.amount);
    if (amt > 0) heldByResource.set(f.resourceAddress, amt);
  }

  // XRD fiat price (reuses /api/crypto-markets CDN cache, 0 Redis)
  const { data: markets } = useCryptoMarkets();
  const xrdCoin = markets?.coins.find((c) => c.id === 'radix');
  const xrdPriceFiat = !xrdCoin
    ? null
    : currency === 'EUR'
      ? xrdCoin.priceUsd * (markets?.eurPerUsd ?? 0.92)
      : xrdCoin.priceUsd;

  const trimmed = lsuAddress.trim();
  const looksLikeResource = trimmed.startsWith('resource_');

  const { data: lsu, isFetching, isError } = useQuery({
    queryKey: ['console', 'lsu-info', activeNetwork, trimmed],
    queryFn: () => fetchLsuInfo((ep, body) => gatewayPost(activeNetwork, ep, body), trimmed),
    enabled: looksLikeResource,
    staleTime: 60_000,
  });

  const { data: holdersData, isFetching: holdersLoading } = useTopHolders(
    lsu?.lsuAddress,
    activeNetwork,
  );

  // Picker options: all validators that have an LSU, wallet-held first
  const pickerQ = pickerSearch.trim().toLowerCase();
  const pickerOptions = validators
    .filter((v) => !!v.lsuResource)
    .filter((v) => {
      if (!pickerQ) return true;
      return (
        v.name.toLowerCase().includes(pickerQ)
        || v.address.toLowerCase().includes(pickerQ)
        || v.lsuResource.toLowerCase().includes(pickerQ)
      );
    })
    .sort((a, b) => {
      const ha = heldByResource.get(a.lsuResource) ?? 0;
      const hb = heldByResource.get(b.lsuResource) ?? 0;
      if (ha > 0 && hb === 0) return -1;
      if (hb > 0 && ha === 0) return 1;
      return b.totalStakeXRD - a.totalStakeXRD;
    });

  const myLsuBalance = lsu ? (heldByResource.get(lsu.lsuAddress) ?? 0) : 0;
  const parsedCalc = parseFloat(calcAmount.replace(/,/g, '.'));
  const calcLsu = Number.isFinite(parsedCalc) && parsedCalc > 0 ? parsedCalc : 0;

  const fmtFiat = (xrd: number) =>
    xrdPriceFiat !== null ? formatCurrency(xrd * xrdPriceFiat, currency, language) : '—';

  return (
    <div className="space-y-6">
      {/* Input with inline "+" button matching AddressField */}
      <ToolSection title={labels.inputTitle} hint={labels.inputHint}>
        <div ref={pickerRef} className="space-y-2">
        <TextField
          value={lsuAddress}
          onChange={setLsuAddress}
          placeholder={labels.placeholder}
          trailingPadding="pr-11"
          trailing={
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title={labels.pickerTitle}
              aria-label={labels.pickerTitle}
              aria-expanded={pickerOpen}
              className="inline-flex size-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer"
              style={{
                background: pickerOpen ? 'rgba(var(--color-primary-rgb), 0.12)' : 'var(--color-bg)',
                borderColor: pickerOpen ? 'var(--color-primary)' : 'var(--color-card-border)',
                color: pickerOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {pickerOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            </button>
          }
        />

        {/* Validator LSU Selector Popup */}
        {pickerOpen && (
          <div
            className="rounded-xl border shadow-xl overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
          >
            <div className="p-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-card-border)' }}>
              <Search className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={labels.pickerSearchPlaceholder}
                autoFocus
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: 'var(--color-text-main)' }}
              />
            </div>
            <ul className="max-h-72 overflow-y-auto divide-y custom-scrollbar" style={{ borderColor: 'var(--color-card-border)' }}>
              {pickerOptions.length === 0 ? (
                <li className="px-3 py-5 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.pickerEmpty}
                </li>
              ) : (
                pickerOptions.slice(0, 60).map((v) => {
                  const held = heldByResource.get(v.lsuResource) ?? 0;
                  return (
                    <li key={v.lsuResource} style={{ borderColor: 'var(--color-card-border)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setLsuAddress(v.lsuResource);
                          setPickerOpen(false);
                          setPickerSearch('');
                        }}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--color-surface-hover)] cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          {v.iconUrl ? (
                            <SafeImage src={v.iconUrl} alt={v.name} fallbackName={v.name} zoomable={false} className="size-6 rounded-full shrink-0" />
                          ) : (
                            <span
                              className="size-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                              style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}
                            >
                              {v.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                                {v.name}
                              </span>
                              {held > 0 && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                                  style={{
                                    background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                                    color: 'var(--color-accent)',
                                  }}
                                >
                                  {labels.inWallet}
                                </span>
                              )}
                            </span>
                            <span className="block font-mono text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                              {truncateAddress(v.lsuResource, 14, 8)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                          <span className="block font-semibold" style={{ color: 'var(--color-text-main)' }}>
                            {formatNumber(v.lsu2xrdFactor || 1, 4, language)} XRD
                          </span>
                          <span className="block text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                            {labels.feeShort}: {formatNumber(v.nominalFee, 2, language)}%
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
        </div>

        {isFetching && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {labels.loading}
          </p>
        )}
        {!isFetching && looksLikeResource && (isError || lsu === null) && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
            {labels.notAnLsu}
          </p>
        )}
      </ToolSection>

      {/* LSU Details */}
      {lsu && (
        <>
          {/* Validator identity header */}
          <div
            className="rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {(lsu.validatorIconUrl || lsu.lsuIconUrl) && (
                <SafeImage
                  src={lsu.validatorIconUrl || lsu.lsuIconUrl || ''}
                  alt={lsu.validatorName}
                  fallbackName={lsu.validatorName}
                  zoomable={false}
                  className="size-11 rounded-xl shrink-0"
                />
              )}
              <div className="min-w-0">
                <h2 className="text-base font-black truncate" style={{ color: 'var(--color-text-main)' }}>
                  {lsu.validatorName}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {labels.validatorLabel}:
                    <Link
                      href={dashboardRoutes.entity(language, lsu.validatorAddress, { network: activeNetwork })}
                      className="hover:underline"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {truncateAddress(lsu.validatorAddress, 12, 6)}
                    </Link>
                    <CopyButton value={lsu.validatorAddress} size="xs" variant="ghost" title={t.common.copy} />
                  </span>
                  <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {labels.feeLabel}: <strong style={{ color: 'var(--color-text-main)' }}>{formatNumber(lsu.feePercent, 2, language)}%</strong>
                  </span>
                  <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {labels.acceptsStake}:{' '}
                    <strong style={{ color: lsu.acceptsDelegatedStake ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {lsu.acceptsDelegatedStake ? labels.yes : labels.no}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={dashboardRoutes.entity(language, lsu.lsuAddress, { network: activeNetwork })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors hover:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)', color: 'var(--color-primary)' }}
            >
              {labels.openInExplorer}
              <ExternalLink className="size-3.5" />
            </Link>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.exchangeRate}
              </span>
              <p className="mt-1 text-lg font-black font-mono tabular-nums" style={{ color: 'var(--color-accent)' }}>
                1 LSU = {formatNumber(lsu.xrdPerLsu, 6, language)} XRD
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                1 XRD = {formatNumber(lsu.lsuPerXrd, 6, language)} LSU
              </p>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.fiatPerLsu}
              </span>
              <p className="mt-1 text-lg font-black font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                {xrdPriceFiat !== null
                  ? `${currency === 'EUR' ? '€' : '$'}${formatNumber(lsu.xrdPerLsu * xrdPriceFiat, 5, language)}`
                  : '—'}
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {labels.tvlFiat}: {fmtFiat(lsu.stakeVaultXrd)}
              </p>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.totalStaked}
              </span>
              <p className="mt-1 text-lg font-black font-mono tabular-nums" style={{ color: 'var(--color-primary)' }}>
                {formatNumber(lsu.stakeVaultXrd, 2, language)} XRD
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {labels.totalSupply}: {formatNumber(lsu.totalSupply, 2, language)} LSU
              </p>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.ownerLocked}
              </span>
              <p className="mt-1 text-base font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                {formatNumber(lsu.lockedOwnerXrd, 2, language)} XRD
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {formatNumber(lsu.lockedOwnerLsu, 2, language)} LSU ({fmtFiat(lsu.lockedOwnerXrd)})
              </p>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.pendingUnstake}
              </span>
              <p className="mt-1 text-base font-bold font-mono tabular-nums" style={{ color: 'var(--color-secondary)' }}>
                {formatNumber(lsu.pendingWithdrawXrd, 2, language)} XRD
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {fmtFiat(lsu.pendingWithdrawXrd)}
              </p>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
              <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {labels.holdersCount}
              </span>
              <p className="mt-1 text-base font-bold font-mono tabular-nums flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
                <Users className="size-4" style={{ color: 'var(--color-primary)' }} />
                {holdersLoading ? '…' : formatNumber(holdersData?.holders.length ?? 0, 0, language)}
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {lsu.lsuSymbol}
              </p>
            </div>
          </div>

          {/* Interactive LSU to XRD and Fiat calculator */}
          <ToolSection title={labels.calculatorTitle} hint={labels.calculatorHint}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Calculator className="size-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  inputMode="decimal"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="w-full pl-9 pr-14 py-2.5 rounded-xl border text-sm font-mono outline-none focus:border-[var(--color-primary)]"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  {lsu.lsuSymbol}
                </span>
              </div>
              {myLsuBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setCalcAmount(myLsuBalance.toFixed(4))}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors hover:border-[var(--color-primary)] cursor-pointer"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)', color: 'var(--color-primary)' }}
                >
                  <Wallet className="size-3.5" />
                  {labels.useMyLsu} ({formatNumber(myLsuBalance, 2, language)} {lsu.lsuSymbol})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border p-3.5" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}>
                <span className="block text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.xrdEquivalent}
                </span>
                <span className="block mt-1 text-lg font-black font-mono tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {`${formatNumber(calcLsu * lsu.xrdPerLsu, 4, language)} XRD`}
                </span>
              </div>
              <div className="rounded-xl border p-3.5" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}>
                <span className="block text-[11px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.fiatValue}
                </span>
                <span className="block mt-1 text-lg font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                  {fmtFiat(calcLsu * lsu.xrdPerLsu)}
                </span>
              </div>
            </div>
          </ToolSection>

          {/* Holders list */}
          <ToolSection title={labels.holdersTitle} hint={labels.holdersHint}>
            {holdersLoading ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.loadingHolders}</p>
            ) : holdersData && holdersData.holders.length > 0 ? (
              <div className="space-y-3">
                <TopHoldersList
                  holders={holdersData.holders}
                  supply={lsu.totalSupply}
                  unit="LSU"
                  network={activeNetwork}
                  limit={showAllHolders ? 50 : 10}
                  copyLabel={t.common.copy}
                  detail={(h) => {
                    const xrdEq = Number(h.amount) * lsu.xrdPerLsu;
                    return `${formatNumber(xrdEq, 2, language)} XRD${xrdPriceFiat !== null ? ` · ${fmtFiat(xrdEq)}` : ''}`;
                  }}
                />
                {holdersData.holders.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHolders((v) => !v)}
                    className="text-xs font-bold hover:underline cursor-pointer"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {showAllHolders
                      ? labels.showLessHolders
                      : labels.showMoreHolders.replace('{count}', String(Math.min(50, holdersData.holders.length)))}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.noHolders}</p>
            )}
          </ToolSection>
        </>
      )}
    </div>
  );
}
