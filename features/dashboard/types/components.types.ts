import React from 'react';
import type { Validator, TransactionInfo, NetworkStats } from '@/types/radix';
import type { DashboardView, Network, TranslationsT } from './core.types';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';

export interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent?: boolean;
    description?: string;
    copyText?: string;
    isLoading?: boolean;
}

export interface ExplorerStats {
    maxSending: number;
    maxSendingHash: string;
}

export interface DashboardStatsRowProps {
    activeView: 'staking' | 'transactions';
    stats: NetworkStats;
    explorerStats: ExplorerStats | null;
    isLoading?: boolean;
    dt?: TranslationsT['dashboard'];
    locale: string;
}

export interface DashboardToolbarProps {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    activeView: 'staking' | 'transactions';
    onViewChange: (view: 'staking' | 'transactions') => void;
    network: Network;
    onNetworkChange: (net: Network) => void;
    activeTags: string[];
    onActiveTagChange: (tag: string) => void;
    transactionActiveTag: string;
    onTransactionTagChange: (tag: string) => void;
    sortMode: 'newest' | 'oldest' | 'date' | 'random';
    onSortModeChange: (mode: 'newest' | 'oldest' | 'date' | 'random') => void;
    readingMode: boolean;
    onReadingModeChange: (v: boolean) => void;
    isReadingModeManual?: boolean;
    autoCollapse: boolean;
    onAutoCollapseChange: (v: boolean) => void;
    expandedCount: number;
    filteredCount: number;
    onToggleAll: () => void;
    calendarOpen: boolean;
    onCalendarToggle: (v: boolean) => void;
    dateRange: { start: string | null; end: string | null };
    onSelectRange: (range: { start: string | null; end: string | null }) => void;
    onResetRange: () => void;
    calendarT?: CalendarTranslations;
    columns: number;
    onColumnsChange: (cols: number) => void;
    dt?: TranslationsT['dashboard'];
}

export interface DashboardCardGridProps {
    activeView: DashboardView;
    gridClass: string;
    filteredValidators: Validator[];
    visibleValCount: number;
    sentinelRef: React.RefObject<HTMLDivElement | null>;
    filteredTxs: TransactionInfo[];
    loadingTxs: boolean;
    txsInitialized: boolean;
    columns: number;
    expandedPosts: Set<string>;
    readingMode: boolean;
    copiedAddress: string | null;
    searchQuery: string;
    network: Network;
    timezone: string;
    locale: string;
    t?: TranslationsT;
    dt?: TranslationsT['dashboard'];
    onExpand: (id: string) => void;
    onCopy: (addr: string) => void;
}

export interface DashboardModalsProps {
    activeView: DashboardView;
    readingMode: boolean;
    expandedPost: Validator | null;
    filteredValidators: Validator[];
    expandedTx: TransactionInfo | null;
    filteredTxs: TransactionInfo[];
    closeExpanded: () => void;
    setExpandedPosts: React.Dispatch<React.SetStateAction<Set<string>>>;
    t?: TranslationsT;
    dt?: TranslationsT['dashboard'];
    copiedAddress: string | null;
    copyAddress: (addr: string) => void;
    network: Network;
    direction: number;
    setDirection: React.Dispatch<React.SetStateAction<number>>;
    timezone: string;
    locale: string;
}

export interface DetailRowProps {
    label: React.ReactNode;
    value: React.ReactNode;
    copyable?: string;
    onCopy?: (addr: string) => void;
    copiedAddress?: string | null;
}
