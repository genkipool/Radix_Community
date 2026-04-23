'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, AlertCircle, Loader2 } from 'lucide-react';
import type { DashboardDict } from '@/features/dashboard/types';

interface RewardsCsvModalProps {
    isOpen: boolean;
    onClose: () => void;
    validatorAddress: string;
    dt?: DashboardDict;
}

export const RewardsCsvModal: React.FC<RewardsCsvModalProps> = ({
    isOpen,
    onClose,
    validatorAddress,
    dt,
}) => {
    const [years, setYears] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch available years when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setSelectedYear(null);

        fetch(`/api/validator-rewards?address=${encodeURIComponent(validatorAddress)}&action=years`)
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
    }, [isOpen, validatorAddress]);

    const handleDownload = async () => {
        if (!selectedYear) return;

        setDownloading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/validator-rewards?address=${encodeURIComponent(validatorAddress)}&action=csv&year=${selectedYear}`,
            );

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `radix_rewards_${validatorAddress.substring(0, 20)}_${selectedYear}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setDownloading(false);
        }
    };

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-card-border)]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">
                        {dt?.details?.rewards_modal_title ?? 'Download Reward History'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {dt?.details?.rewards_modal_desc ??
                            'Select a year to download the daily reward breakdown in CoinTracking CSV format.'}
                    </p>

                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                                {dt?.details?.rewards_modal_loading ?? 'Loading...'}
                            </span>
                        </div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {dt?.details?.rewards_modal_no_data ??
                                    'No reward data available yet.'}
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
                                    {dt?.details?.rewards_modal_error ?? 'Error'}
                                </p>
                                <p className="text-xs text-red-400 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/20 transition-colors"
                    >
                        {dt?.details?.rewards_modal_close ?? 'Close'}
                    </button>
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
                        {dt?.details?.rewards_modal_download ?? 'Download CSV'}
                    </button>
                </div>
            </div>
        </div>
    );
};
