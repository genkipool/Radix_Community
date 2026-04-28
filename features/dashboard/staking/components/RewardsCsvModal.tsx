'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Download, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMounted } from '@/hooks/useMounted';
import { apiFetchValidatorRewardsYears } from '@/features/dashboard/services/apiClient';
import { formatXRD } from '@/utils/formatters';
import { formatCurrency, getCurrencyForLocale } from '@/utils/currencyUtils';
import type { RewardsCsvModalProps } from '../types/components.types';

export const RewardsCsvModal: React.FC<RewardsCsvModalProps> = ({
    isOpen,
    onClose,
    validatorAddress,
    dt,
    locale,
    marketData,
}) => {
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [summary, setSummary] = useState<{ totalXrd: number; fiatValue: number; dreamValue: number; currency: string } | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const mounted = useMounted();

    const { data: yearsData, isLoading: yearsLoading, error: yearsError } = useQuery({
        queryKey: ['validator-rewards-years', validatorAddress],
        queryFn: () => apiFetchValidatorRewardsYears(validatorAddress),
        enabled: isOpen,
        staleTime: 5 * 60_000,
    });

    const years = yearsData?.years ?? [];
    const error = localError || (yearsError instanceof Error ? yearsError.message : yearsError ? String(yearsError) : null);

    const activeYear = selectedYear || (years.length > 0 ? years[0] : null);

    // Handle progress simulation
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (downloading) {
            interval = setInterval(() => {
                setProgress((prev) => (prev < 90 ? prev + Math.random() * 15 : prev));
            }, 400);
        }
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
                `/api/validator-rewards?address=${validatorAddress}&action=csv&year=${activeYear}`,
            );

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (!data.csv) {
                throw new Error('CSV is empty');
            }

            // Get currency for locale
            const currency = getCurrencyForLocale(locale || 'en');
            const price = currency === 'EUR' ? (marketData?.priceEur || 0) : (marketData?.priceUsd || 0);

            const totalXrd = data.totalXrd || 0;

            setSummary({
                totalXrd: totalXrd,
                fiatValue: totalXrd * price,
                dreamValue: totalXrd * 1.0, // If Radix reached 1 unit of currency
                currency
            });

            const blob = new Blob([data.csv], { type: 'text/csv; charset=utf-8' });

            setProgress(100);
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `validator_rewards_${validatorAddress.substring(0, 15)}_${activeYear}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Keep success message for a bit then allow retry/close
            setTimeout(() => {
                setDownloading(false);
            }, 500);

        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'An error occurred');
            setDownloading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black/50"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header-like part of the modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-card-border)]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">
                        {dt?.validator_rewards_modal_title ?? 'Download Validator History'}
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={downloading}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {dt?.validator_rewards_modal_desc ??
                            'Select a year to download the complete validator staking rewards in CSV format.'}
                    </p>

                    {yearsLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                                {dt?.validator_rewards_modal_loading ?? 'Loading available years...'}
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
                                    {dt?.validator_rewards_modal_generating ?? 'Generating CSV...'}
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
                                    {dt?.validator_rewards_summary_title ?? 'Download Complete!'}
                                </h4>
                            </div>
                            <div className="bg-[var(--color-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
                                <div className="p-3 border-b border-[var(--color-card-border)] flex justify-between items-center bg-[var(--color-surface)]">
                                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                        {dt?.validator_rewards_summary_total ?? 'Total generated'}
                                    </span>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-[var(--color-text-main)]">
                                            {formatXRD(summary.totalXrd, locale)} XRD
                                        </div>
                                        <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                            ≈ {formatCurrency(summary.fiatValue, summary.currency as 'USD' | 'EUR', locale || 'en')}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--color-primary)]/5 text-center">
                                    <p 
                                        className="text-[11px] leading-relaxed font-medium text-[var(--color-primary)]"
                                        dangerouslySetInnerHTML={{ 
                                            __html: (dt?.validator_rewards_summary_dream ?? (
                                                (locale && locale.startsWith('es')) 
                                                    ? "Si Radix valiera 1 {currency}, este validador habría ganado <b>{value}</b> este año." 
                                                    : "If Radix reached 1 {currency}, this validator would have earned <b>{value}</b> this year."
                                            ))
                                            .replace('{currency}', summary.currency === 'EUR' ? ((locale && locale.startsWith('es')) ? 'Euro' : 'Euro') : ((locale && locale.startsWith('es')) ? 'Dólar' : 'Dollar'))
                                            .replace('{value}', formatCurrency(summary.dreamValue, summary.currency as 'USD' | 'EUR', locale || 'en'))
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {dt?.validator_rewards_modal_no_data ?? 'No reward data available for this validator.'}
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

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-500">Error</p>
                                <p className="text-xs text-red-400 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-[var(--color-bg)] border-t border-[var(--color-card-border)] flex items-center justify-end">
                    <button
                        onClick={handleDownload}
                        disabled={downloading || years.length === 0 || !!summary}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-[var(--color-primary)]/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {downloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        {downloading ? (dt?.validator_rewards_modal_generating_btn ?? 'Working...') : (dt?.validator_rewards_modal_download_btn ?? 'Download CSV')}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
