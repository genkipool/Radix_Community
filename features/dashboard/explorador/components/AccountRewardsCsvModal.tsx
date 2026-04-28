'use client';

import React, { useState, useEffect } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { X, Download, AlertCircle, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetchAccountRewardsYears } from '@/features/dashboard/services/apiClient';
import { formatXRD } from '@/utils/formatters';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import type { MarketData } from '@/features/dashboard/types';
import type { AccountRewardsCsvModalDict } from '../types/components.types';

export interface AccountRewardsCsvModalProps {
    isOpen: boolean;
    onClose: () => void;
    accountAddress: string;
    /** Translations from the explorador locale */
    tt?: AccountRewardsCsvModalDict;
    locale?: string;
    marketData?: MarketData | null;
}

export const AccountRewardsCsvModal: React.FC<AccountRewardsCsvModalProps> = ({
    isOpen,
    onClose,
    accountAddress,
    tt,
    locale,
    marketData,
}) => {
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [summary, setSummary] = useState<{ totalXrd: number; fiatValue: number; dreamValue: number; currency: 'USD' | 'EUR' | string } | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const mounted = useMounted();

    const { data: yearsData, isLoading: yearsLoading, error: yearsError } = useQuery({
        queryKey: ['account-rewards-years', accountAddress],
        queryFn: () => apiFetchAccountRewardsYears(accountAddress),
        enabled: isOpen,
        staleTime: 5 * 60_000,
    });

    const years = (yearsData?.years ?? []).map(y => String(y));
    const error = localError || (yearsError instanceof Error ? yearsError.message : yearsError ? String(yearsError) : null);

    const activeYear = selectedYear || (years.length > 0 ? years[0] : null);


    // Progress simulation
    useEffect(() => {
        if (!downloading) return;
        
        let currentProgress = 0;
        const interval = setInterval(() => {
            const remaining = 98 - currentProgress;
            // Asymptotic curve: fast at first, then slows down progressively over several minutes
            currentProgress += (remaining * 0.015) + (Math.random() * 0.2);
            if (currentProgress > 98) currentProgress = 98;
            setProgress(currentProgress);
        }, 1000);

        return () => clearInterval(interval);
    }, [downloading]);


    const handleDownload = async () => {
        if (!activeYear) return;

        setDownloading(true);
        setProgress(0);
        setLocalError(null);
        setSummary(null);

        try {
            const res = await fetch(
                `/api/account-rewards?address=${encodeURIComponent(accountAddress)}&action=csv&year=${activeYear}`,
            );

            const data = await res.json();
            if (!data.csv) {
                throw new Error('CSV is empty');
            }

            setProgress(100);

            // Calculate values
            const currency = getCurrencyForLocale(locale || 'en');
            const priceXRD = currency === 'EUR' ? (marketData?.priceEur || 0) : (marketData?.priceUsd || 0);
            const totalXrdValue = data.totalXrd || 0;
            const fiatValue = totalXrdValue * priceXRD;
            const dreamValue = totalXrdValue * 1; // 1 EUR or 1 USD

            setSummary({
                totalXrd: totalXrdValue,
                fiatValue,
                dreamValue,
                currency
            });

            const blob = new Blob([data.csv], { type: 'text/csv; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `account_rewards_${accountAddress.substring(0, 15)}_${activeYear}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : String(err));
        } finally {
            setDownloading(false);
            setProgress(0);
        }
    };

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !downloading) onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose, downloading]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget && !downloading) onClose();
            }}
        >
            <div
                className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-card-border)]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">
                        {tt?.account_rewards_modal_title ?? 'Download Account Reward History'}
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={downloading}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {tt?.account_rewards_modal_desc ??
                            'Select a year to download the staking reward breakdown in CoinTracking CSV format. This process may take several minutes.'}
                    </p>

                    {yearsLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                                {tt?.account_rewards_modal_loading ?? 'Loading...'}
                            </span>
                        </div>
                    ) : downloading ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-4">
                            <div className="relative">
                                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                                <Clock className="w-3.5 h-3.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--color-primary)]" />
                            </div>
                            <div className="text-center space-y-1 w-full max-w-[280px]">
                                <p className="text-xs font-bold text-[var(--color-text-main)]">
                                    {tt?.account_rewards_modal_generating ?? 'Generating CSV...'}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-muted)] max-w-[280px] mx-auto text-balance">
                                    {tt?.account_rewards_modal_generating_desc ??
                                        'Querying the Radix Ledger API for daily stake snapshots. This can take 2–5 minutes depending on the number of validators and days.'}
                                </p>
                                <div className="h-2 w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-full overflow-hidden mt-3">
                                    <div 
                                        className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : summary ? (
                        <div className="py-4 space-y-4">
                            <div className="flex flex-col items-center justify-center text-center space-y-2 mb-4">
                                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-1">
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                </div>
                                <h4 className="text-sm font-bold text-[var(--color-text-main)]">
                                    {tt?.account_rewards_summary_title ?? 'Download Complete!'}
                                </h4>
                            </div>
                            <div className="bg-[var(--color-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
                                <div className="p-3 border-b border-[var(--color-card-border)] flex justify-between items-center bg-[var(--color-surface)]">
                                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                        {tt?.account_rewards_summary_total ?? 'Total earned'}
                                    </span>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-[var(--color-text-main)]">
                                            {formatXRD(summary.totalXrd, locale)} XRD
                                        </div>
                                        <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                            <span>≈</span> {formatCurrency(summary.fiatValue, summary.currency as 'USD' | 'EUR', locale || 'en')}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--color-primary)]/5">
                                    <p 
                                        className="text-[11px] leading-relaxed text-center font-medium text-[var(--color-primary)]"
                                        dangerouslySetInnerHTML={{ 
                                            __html: (tt?.account_rewards_summary_dream ?? (
                                                (locale && locale.startsWith('es')) 
                                                    ? "Si Radix valiera 1 {currency}, habrías ganado <b>{value}</b> con el staking este año." 
                                                    : "If Radix reached 1 {currency}, you would have earned <b>{value}</b> from staking this year."
                                            ))
                                            .replace('{currency}', summary.currency === 'EUR' ? ((locale && locale.startsWith('es')) ? 'Euro' : 'Euro') : ((locale && locale.startsWith('es')) ? 'Dólar' : 'Dollar'))
                                            .replace('{value}', formatCurrency(summary.dreamValue, summary.currency as 'USD' | 'EUR', locale || 'en'))
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-8 bg-[var(--color-bg)]/50 rounded-2xl border border-dashed border-[var(--color-card-border)]">
                            <p className="text-xs text-[var(--color-text-muted)] px-4">
                                {tt?.account_rewards_modal_no_data ??
                                    'No reward data available for this account.'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {years.map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                                        activeYear === year
                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                            : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-main)]'
                                    }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Error display */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-500">
                                    {tt?.account_rewards_modal_error ?? 'Error'}
                                </p>
                                <p className="text-xs text-red-400 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                    <button
                        onClick={handleDownload}
                        disabled={!selectedYear || downloading || years.length === 0}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        {downloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        {tt?.account_rewards_modal_download ?? 'Download CSV'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
