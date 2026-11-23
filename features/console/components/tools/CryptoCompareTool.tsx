'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Calculator, ChevronDown, Search, TrendingUp, Wallet } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { gatewayPost } from '@/services/gateway/bases';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useCryptoMarkets } from '../../hooks/useCryptoMarkets';
import {
  compareCryptoMarketCap,
  POPULAR_TARGET_IDS,
  type CompareMode,
  type CryptoMarketCoin,
} from '../../lib/crypto-compare';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { ToolSection } from '../shared/ToolSection';

function formatCompactFiat(value: number, currency: 'USD' | 'EUR', locale: string): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  if (value >= 1e12) return `${symbol}${formatNumber(value / 1e12, 2, locale)}T`;
  if (value >= 1e9) return `${symbol}${formatNumber(value / 1e9, 2, locale)}B`;
  if (value >= 1e6) return `${symbol}${formatNumber(value / 1e6, 2, locale)}M`;
  return formatCurrency(value, currency, locale);
}

function formatUnitFiat(value: number, currency: 'USD' | 'EUR', locale: string): string {
  if (value >= 100) return formatCurrency(value, currency, locale);
  const symbol = currency === 'EUR' ? '€' : '$';
  const decimals = value >= 1 ? 3 : value >= 0.01 ? 4 : 6;
  return `${symbol}${formatNumber(value, decimals, locale)}`;
}

function CoinSelector({
  label,
  coins,
  selected,
  onSelect,
  currency,
  eurPerUsd,
  locale,
  searchPlaceholder,
  noResultsLabel,
}: {
  label: string;
  coins: CryptoMarketCoin[];
  selected: CryptoMarketCoin | undefined;
  onSelect: (id: string) => void;
  currency: 'USD' | 'EUR';
  eurPerUsd: number;
  locale: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus without scrolling the viewport so opening the dropdown never moves the page.
    inputRef.current?.focus({ preventScroll: true });
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? coins.slice(0, 60)
    : coins
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q)
            || c.symbol.toLowerCase().includes(q)
            || c.id.toLowerCase().includes(q),
        )
        .slice(0, 60);

  const rate = currency === 'EUR' ? eurPerUsd : 1;

  return (
    <div ref={containerRef} className="relative space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-[58px] flex items-center justify-between gap-3 px-3.5 rounded-xl border text-left transition-colors hover:border-[var(--color-primary)]/50 cursor-pointer"
        style={{
          background: 'var(--color-surface)',
          borderColor: open ? 'var(--color-primary)' : 'var(--color-card-border)',
        }}
      >
        {selected ? (
          <span className="flex items-center gap-2.5 min-w-0">
            {selected.image ? (
              <SafeImage src={selected.image} alt={selected.name} fallbackName={selected.symbol} className="size-7 rounded-full shrink-0" />
            ) : (
              <span
                className="size-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black"
                style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}
              >
                {selected.symbol.slice(0, 3)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate leading-tight" style={{ color: 'var(--color-text-main)' }}>
                {selected.name}{' '}
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {selected.symbol}
                </span>
              </span>
              <span className="block text-[11px] font-mono tabular-nums leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {formatUnitFiat(selected.priceUsd * rate, currency, locale)} · {formatCompactFiat(selected.marketCapUsd * rate, currency, locale)}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1.5 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
        >
          <div className="p-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-card-border)' }}>
            <Search className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--color-text-main)' }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y custom-scrollbar" style={{ borderColor: 'var(--color-card-border)' }}>
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {noResultsLabel}
              </li>
            ) : (
              filtered.map((coin) => {
                const active = coin.id === selected?.id;
                return (
                  <li key={coin.id} style={{ borderColor: 'var(--color-card-border)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(coin.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-primary)]/10 cursor-pointer"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : undefined,
                      }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {coin.image ? (
                          <SafeImage src={coin.image} alt={coin.name} fallbackName={coin.symbol} className="size-5 rounded-full shrink-0" />
                        ) : (
                          <span className="size-5 rounded-full shrink-0 text-[9px] font-bold flex items-center justify-center bg-[var(--color-bg)]">
                            {coin.symbol.slice(0, 2)}
                          </span>
                        )}
                        <span className="truncate text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                          {coin.name}
                        </span>
                        <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {coin.symbol}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                        {formatCompactFiat(coin.marketCapUsd * rate, currency, locale)}
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
  );
}

export default function CryptoCompareTool({ t }: ConsoleToolProps) {
  const labels = t.cryptoCompare;
  const { language } = useLanguage();
  const { accounts, activeNetwork, activeNetworkId } = useRadixWallet();
  const currency = getCurrencyForLocale(language);

  const [baseId, setBaseId] = useState('radix');
  const [targetId, setTargetId] = useState('bitcoin');
  const [mode, setMode] = useState<CompareMode>('mcap');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const { data, isLoading, isError } = useCryptoMarkets();

  const coins = data?.coins ?? [];
  const eurPerUsd = data?.eurPerUsd ?? 0.92;
  const rate = currency === 'EUR' ? eurPerUsd : 1;

  const baseCoin = coins.find((c) => c.id === baseId) ?? coins[0];
  const targetCoin = coins.find((c) => c.id === targetId) ?? coins.find((c) => c.id === 'bitcoin') ?? coins[1];

  const xrdAddr = activeNetworkId ? RADIX_TOKEN_ADDRESSES[activeNetworkId]?.XRD : undefined;
  const accountAddrs = accounts.map((a) => a.address);

  // Fetch XRD balance for every connected wallet account in a single batched Gateway call (0 Redis).
  const { data: xrdByAccount = {} } = useQuery<Record<string, number>>({
    queryKey: ['console', 'crypto-compare-xrd', activeNetwork, accountAddrs.join(',')],
    enabled: accountAddrs.length > 0 && !!xrdAddr,
    staleTime: 60_000,
    queryFn: async () => {
      const map: Record<string, number> = {};
      for (let i = 0; i < accountAddrs.length; i += 20) {
        const res = await gatewayPost<{
          items?: Array<{
            address: string;
            fungible_resources?: {
              items?: Array<{ resource_address: string; amount?: string }>;
            };
          }>;
        }>(activeNetwork, '/state/entity/details', {
          addresses: accountAddrs.slice(i, i + 20),
          aggregation_level: 'Global',
        });
        for (const item of res.items ?? []) {
          const found = item.fungible_resources?.items?.find((f) => f.resource_address === xrdAddr);
          map[item.address] = found?.amount ? parseFloat(found.amount) || 0 : 0;
        }
      }
      return map;
    },
  });

  const parsedAmount = parseFloat(amountInput.replace(/,/g, '.'));
  const result = !baseCoin || !targetCoin
    ? null
    : compareCryptoMarketCap(
        baseCoin,
        targetCoin,
        mode,
        eurPerUsd,
        Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      );

  const swapCoins = () => {
    if (!baseCoin || !targetCoin) return;
    setBaseId(targetCoin.id);
    setTargetId(baseCoin.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
        <div className="h-44 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
      </div>
    );
  }

  if (isError || coins.length < 2) {
    return (
      <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
        {labels.loadError}
      </p>
    );
  }

  const projectedUnit = result ? (currency === 'EUR' ? result.projectedPriceEur : result.projectedPriceUsd) : 0;
  const currentUnit = result ? (currency === 'EUR' ? result.currentPriceEur : result.base.priceUsd) : 0;

  return (
    <div className="space-y-5">
      {/* Card 1: Mode, Quick targets & Coin selectors */}
      <ToolSection>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="w-full sm:w-auto sm:min-w-[260px]">
            <OptionButtons<CompareMode>
              size="sm"
              hideCheck
              value={mode}
              onChange={setMode}
              options={[
                { value: 'mcap', label: labels.modeMcap, title: labels.modeMcapTitle },
                { value: 'fdv', label: labels.modeFdv, title: labels.modeFdvTitle },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--color-text-muted)' }}>
              {labels.quickTargets}
            </span>
            {POPULAR_TARGET_IDS.map((id) => {
              const coin = coins.find((c) => c.id === id);
              if (!coin) return null;
              const active = targetId === coin.id;
              return (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => setTargetId(coin.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer"
                  style={{
                    borderColor: active ? 'var(--color-primary)' : 'var(--color-card-border)',
                    background: active ? 'rgba(var(--color-primary-rgb), 0.12)' : 'var(--color-surface)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {coin.symbol}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <CoinSelector
            label={labels.baseLabel}
            coins={coins}
            selected={baseCoin}
            onSelect={setBaseId}
            currency={currency}
            eurPerUsd={eurPerUsd}
            locale={language}
            searchPlaceholder={labels.searchPlaceholder}
            noResultsLabel={labels.noResults}
          />
          <button
            type="button"
            onClick={swapCoins}
            title={labels.swapTitle}
            aria-label={labels.swapTitle}
            className="h-[58px] w-full md:w-12 rounded-xl border flex items-center justify-center transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <CoinSelector
            label={labels.targetLabel}
            coins={coins}
            selected={targetCoin}
            onSelect={setTargetId}
            currency={currency}
            eurPerUsd={eurPerUsd}
            locale={language}
            searchPlaceholder={labels.searchPlaceholder}
            noResultsLabel={labels.noResults}
          />
        </div>
      </ToolSection>

      {/* Card 2: Unified Projection + Valuation Comparison + Portfolio Simulator (zero nested boxes, zero shift) */}
      {result && (
        <ToolSection className="space-y-6">
          {/* Hero projection & valuation split */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 items-center">
            <div className="space-y-2 min-w-0">
              <p
                className="text-xs font-bold uppercase tracking-wider truncate"
                style={{ color: 'var(--color-text-muted)' }}
                title={labels.resultHeadline
                  .replace('{base}', `${result.base.name} (${result.base.symbol})`)
                  .replace('{target}', `${result.target.name} (${result.target.symbol})`)}
              >
                {labels.resultHeadline
                  .replace('{base}', `${result.base.name} (${result.base.symbol})`)
                  .replace('{target}', `${result.target.name} (${result.target.symbol})`)}
              </p>

              <div className="flex flex-wrap items-baseline gap-3 min-h-[52px]">
                <span className="text-4xl sm:text-5xl font-black font-mono tabular-nums tracking-tight" style={{ color: 'var(--color-accent)' }}>
                  {formatUnitFiat(projectedUnit, currency, language)}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold tabular-nums"
                  style={{
                    color: result.multiplier >= 1 ? 'var(--color-success)' : 'var(--color-danger)',
                    background: result.multiplier >= 1
                      ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                      : 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                  }}
                >
                  <TrendingUp className="size-3.5" />
                  {formatNumber(result.multiplier, result.multiplier >= 10 ? 1 : 2, language)}×
                </span>
              </div>

              <p className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                {labels.currentPriceLabel}: {formatUnitFiat(currentUnit, currency, language)} ({result.percentChange >= 0 ? '+' : ''}
                {formatNumber(result.percentChange, 1, language)}%)
              </p>
            </div>

            <div
              className="lg:pl-6 lg:border-l space-y-4"
              style={{ borderColor: 'var(--color-card-border)' }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {result.base.symbol} · {mode === 'mcap' ? labels.modeMcap : labels.modeFdv}
                  </span>
                  <p className="text-lg font-bold font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-text-main)' }}>
                    {formatCompactFiat(result.baseCapUsd * rate, currency, language)}
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {result.target.symbol} · {mode === 'mcap' ? labels.modeMcap : labels.modeFdv}
                  </span>
                  <p className="text-lg font-bold font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-primary)' }}>
                    {formatCompactFiat(result.targetCapUsd * rate, currency, language)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${result.barSharePct}%`, background: 'linear-gradient(to right, var(--color-accent), var(--color-primary))' }}
                  />
                </div>
                <p className="text-[11px] font-mono tabular-nums truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.ratioNote
                    .replace('{base}', result.base.symbol)
                    .replace('{pct}', formatNumber((result.baseCapUsd / result.targetCapUsd) * 100, 4, language))
                    .replace('{target}', result.target.symbol)}
                </p>
              </div>
            </div>
          </div>

          {/* Hairline divider into Portfolio Simulator */}
          <div className="pt-5 border-t space-y-4" style={{ borderColor: 'var(--color-card-border)' }}>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                {labels.portfolioTitle}
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {labels.portfolioHint}
              </p>
            </div>

            {accounts.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {accounts.map((acc, index) => {
                  const bal = xrdByAccount[acc.address] ?? 0;
                  const isRadixBase = result.base.id === 'radix';
                  const isActive = isRadixBase && selectedAccount === acc.address;
                  return (
                    <button
                      key={acc.address}
                      type="button"
                      disabled={!isRadixBase}
                      onClick={() => {
                        setSelectedAccount(acc.address);
                        setAmountInput(bal > 0 ? bal.toFixed(2) : '0');
                      }}
                      title={acc.address}
                      className="flex-1 min-w-[180px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer hover:border-[var(--color-primary)]/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: isActive ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-surface)',
                        borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                      }}
                    >
                      <Wallet className="size-4 shrink-0" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate leading-tight">
                          {acc.label || `#${index + 1}`}
                        </span>
                        <span className="block text-[11px] font-mono tabular-nums truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {truncateAddress(acc.address, 6, 4)} · {formatNumber(bal, 0, language)} XRD
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative w-full">
              <Calculator className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  setSelectedAccount(null);
                  setAmountInput(e.target.value);
                }}
                placeholder={labels.amountPlaceholder.replace('{symbol}', result.base.symbol)}
                className="w-full h-11 pl-10 pr-16 rounded-xl border text-sm font-mono outline-none focus:border-[var(--color-primary)]"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              />
              <span
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {result.base.symbol}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
              <div>
                <span className="block text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.valueToday}
                </span>
                <span className="block mt-1 text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                  {result.holding
                    ? formatCurrency(currency === 'EUR' ? result.holding.currentEur : result.holding.currentUsd, currency, language)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.valueProjected.replace('{target}', result.target.symbol)}
                </span>
                <span className="block mt-1 text-xl font-black font-mono tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {result.holding
                    ? formatCurrency(currency === 'EUR' ? result.holding.projectedEur : result.holding.projectedUsd, currency, language)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.difference}
                </span>
                <span
                  className="block mt-1 text-xl font-bold font-mono tabular-nums"
                  style={{
                    color: !result.holding
                      ? 'var(--color-text-muted)'
                      : result.holding.gainUsd >= 0
                        ? 'var(--color-success)'
                        : 'var(--color-danger)',
                  }}
                >
                  {result.holding
                    ? `${result.holding.gainUsd >= 0 ? '+' : ''}${formatCurrency(currency === 'EUR' ? result.holding.gainEur : result.holding.gainUsd, currency, language)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </ToolSection>
      )}
    </div>
  );
}
