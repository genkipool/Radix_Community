'use client';

import React, { useState, useEffect } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { X, Download, AlertCircle, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { MarketData } from '@/features/dashboard/types';
import { formatXRD, formatNumber } from '@/utils/formatters';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';

interface AccountRewardsCsvModalProps {
    isOpen: boolean;
    onClose: () => void;
    accountAddress: string;
    /** Translations from the explorador locale */
    tt?: {
        download_account_rewards?: string;
        account_rewards_modal_title?: string;
        account_rewards_modal_desc?: string;
        account_rewards_modal_download?: string;
        account_rewards_modal_no_data?: string;
        account_rewards_modal_error?: string;
        account_rewards_modal_loading?: string;
        account_rewards_modal_generating?: string;
        account_rewards_modal_generating_desc?: string;
        account_rewards_modal_close?: string;
        account_rewards_summary_title?: string;
        account_rewards_summary_total?: string;
        account_rewards_summary_fiat?: string;
        account_rewards_summary_dream?: string;
    };
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
    const [years, setYears] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [summary, setSummary] = useState<{ totalXrd: number; fiatValue: number; dreamValue: number; currency: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mounted = useMounted();

    // Sync state when modal opens (render-time prop comparison)
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setLoading(true);
            setError(null);
            setSelectedYear(null);
            setSummary(null);
            setProgress(0);
        }
    }

    // Progress simulation
    useEffect(() => {
        if (!downloading) return;
        
        let currentProgress = 0;
        const interval = setInterval(() => {
            currentProgress += Math.random() * 5;
            if (currentProgress > 95) currentProgress = 95;
            setProgress(currentProgress);
        }, 1500);

        return () => clearInterval(interval);
    }, [downloading]);

    // Fetch available years when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;

        fetch(`/api/account-rewards?address=${encodeURIComponent(accountAddress)}&action=years`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!cancelled) {
                    setYears(data.years ?? []);
                    if (data.years?.length > 0) {
                        setSelectedYear(data.years[0]);
                    }
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, accountAddress]);

    const handleDownload = async () => {
        if (!selectedYear) return;

        setDownloading(true);
        setProgress(0);
        setError(null);
        setSummary(null);

        try {
            const res = await fetch(
                `/api/account-rewards?address=${encodeURIComponent(accountAddress)}&action=csv&year=${selectedYear}`,
            );

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (!data.csv) {
                throw new Error('CSV is empty');
            }

            setProgress(100);

            // Calculate values
            const currency = getCurrencyForLocale(locale || 'en');
            const priceXRD = currency === 'EUR' ? (marketData?.priceEur || 0) : (marketData?.priceUsd || 0);
            const fiatValue = data.totalXrd * priceXRD;
            const dreamValue = data.totalXrd * 1; // 1 EUR or 1 USD

            setSummary({
                totalXrd: data.totalXrd,
                fiatValue,
                dreamValue,
                currency
            });

            const blob = new Blob([data.csv], { type: 'text/csv; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `radix_account_rewards_${accountAddress.substring(0, 25)}_${selectedYear}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
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

                    {loading ? (
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
                                        {summary.fiatValue > 0 && (
                                            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                                ≈ {formatCurrency(summary.fiatValue, summary.currency as any, locale || 'en')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--color-primary)]/5">
                                    <p className="text-[11px] leading-relaxed text-center font-medium text-[var(--color-primary)]">
                                        {locale === 'es' ? (
                                            <>Si Radix valiera 1 {summary.currency === 'EUR' ? 'Euro' : 'Dólar'}, habrías ganado <b>{formatCurrency(summary.dreamValue, summary.currency as any, locale || 'en')}</b> con el staking este año.</>
                                        ) : (
                                            <>If Radix reached 1 {summary.currency === 'EUR' ? 'Euro' : 'Dollar'}, you would have earned <b>{formatCurrency(summary.dreamValue, summary.currency as any, locale || 'en')}</b> from staking this year.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {tt?.account_rewards_modal_no_data ??
                                    'No reward data available. The account may not have any active stakes.'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {years.map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                                        selectedYear === year
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
