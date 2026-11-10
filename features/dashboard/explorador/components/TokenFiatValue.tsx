'use client';
/**
 * A token balance's current fiat value, with the unit price and its source in
 * the tooltip. Nothing when the token has no known price.
 */
import React from 'react';
import { formatFiatPrecise } from '@/utils/currencyUtils';
import type { TokenFiatPrice } from '@/features/dashboard/hooks/useTokenPrices';

const SOURCE_NAMES: Record<TokenFiatPrice['source'], string> = { astrolescent: 'Astrolescent', ociswap: 'Ociswap' };

/** What a balance is worth, or null when its price is unknown. */
export function fiatValueOf(price: TokenFiatPrice | null, amount: string | number): number | null {
    const n = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!price || !Number.isFinite(n) || n <= 0) return null;
    return n * price.unit;
}

export function TokenFiatValue({ price, amount, symbol, locale, priceLabel, className = '' }: {
    price: TokenFiatPrice | null;
    amount: string | number;
    symbol: string;
    locale: string;
    /** "1 {symbol} = {price}, price from {source}". */
    priceLabel?: string;
    className?: string;
}) {
    const value = fiatValueOf(price, amount);
    if (value === null || !price) return null;
    const unit = formatFiatPrecise(price.unit, price.currency, locale);
    const title = priceLabel
        ? priceLabel.replace('{symbol}', symbol || '').replace('{price}', unit).replace('{source}', SOURCE_NAMES[price.source])
        : unit;
    return (
        <span className={`text-[10px] font-bold font-mono text-[var(--color-text-muted)] whitespace-nowrap ${className}`} title={title}>
            {formatFiatPrecise(value, price.currency, locale)}
        </span>
    );
}

/** The sum of what the balances with a known price are worth. */
export function totalFiatValue(items: { address: string; amount: string }[], priceOf: (a: string) => TokenFiatPrice | null): number {
    return items.reduce((sum, it) => sum + (fiatValueOf(priceOf(it.address), it.amount) ?? 0), 0);
}
