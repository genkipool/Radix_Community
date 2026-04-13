import React from 'react';
import { type Validator } from '@/types/radix';
import { type Network, type TranslationsT, type DashboardDict } from '@/features/dashboard/types';

/**
 * StatItem
 * Used in ValidatorLayoutPrimitives.tsx
 */
export interface StatItem {
    label: string;
    value: React.ReactNode;
    accent?: string;
    tooltip?: string;
}

/**
 * LayoutProps
 * Shared by all Column Layouts in ValidatorLayouts.tsx
 */
export interface LayoutProps {
    validator: Validator;
    searchQuery: string;
    isExpanded: boolean;
    t?: TranslationsT;
    onExpand: () => void;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    network?: Network;
    columns: number;
}

/**
 * ValidatorCardProps
 * Props for the main ValidatorCard component
 */
export interface ValidatorCardProps {
    validator: Validator;
    index: number;
    searchQuery: string;
    isExpanded: boolean;
    columns: number;
    onExpand: (id: string) => void;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    t?: TranslationsT;
    network?: Network;
    onOpenModalPrev?: () => void;
    onOpenModalNext?: () => void;
}

/**
 * LocalModalProps
 * Portal Modal used within ValidatorCard.tsx
 */
export interface LocalModalProps {
    validator: Validator;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    t?: TranslationsT;
    copiedAddress: string | null;
    onCopy: (a: string) => void;
    network?: Network;
}

/**
 * ValidatorDetailViewProps
 * Full-screen / Portal view of a validator
 */
export interface ValidatorDetailViewProps {
    validator: Validator;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    t?: TranslationsT;
    dt?: DashboardDict;
    copiedAddress: string | null;
    copyAddress: (addr: string) => void;
    network?: Network;
    direction?: number;
    setDirection?: (d: number) => void;
}

/**
 * ValidatorExpandedBodyProps
 * The accordion/expanded content of a validator row
 */
export interface ValidatorExpandedBodyProps {
    validator: Validator;
    t?: TranslationsT;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    network?: Network;
    columns: number;
    /** When true, hides the delegation CTA footer */
    hideCta?: boolean;
}

/**
 * LiveProposalsTextProps
 * Utility component for real-time proposal display
 */
export interface LiveProposalsTextProps {
    validator: Validator;
    type: 'epochMade' | 'epochMissed' | 'recentMade' | 'recentMissed' | 'totalMade' | 'totalMissed';
    className?: string;
}

/**
 * LabelProps
 * Section heading in ValidatorExpandedPrimitives.tsx
 */
export interface LabelProps {
    children: React.ReactNode;
    title?: string;
}

/**
 * DRProps
 * Data row (label/value) in ValidatorExpandedPrimitives.tsx
 */
export interface DRProps {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    hi?: string;
    vertical?: boolean;
    tooltip?: string;
}

/**
 * ARProps
 * Address row with copy in ValidatorExpandedPrimitives.tsx
 */
export interface ARProps {
    label: string;
    addr: string;
    onCopy: (a: string) => void;
    copied: boolean;
    brackets?: boolean;
}

/**
 * StatDividerProps
 * Used in ValidatorLayoutPrimitives.tsx
 */
export interface StatDividerProps {
    items: StatItem[];
    textCenter?: boolean;
}

/**
 * BizRowProps
 * Used in ValidatorLayoutPrimitives.tsx and Layouts
 */
export interface BizRowProps {
    label: string;
    value: React.ReactNode;
    accent?: string;
    tooltip?: string;
    vertical?: boolean;
}

/**
 * PremiumStatProps
 * Used in ValidatorLayoutPrimitives.tsx
 */
export interface PremiumStatProps {
    label: string;
    value: string | number;
    sub?: string;
    accent?: string;
    glow?: boolean;
    flexRow?: boolean;
    tooltip?: string;
}

/**
 * SectionHeaderProps
 * Used in ValidatorLayoutPrimitives.tsx
 */
export interface SectionHeaderProps {
    title: string;
    icon: React.ElementType;
}

/**
 * ExpandPanelProps
 * Used in ValidatorLayouts.tsx
 */
export interface ExpandPanelProps {
    isExpanded: boolean;
    validator: Validator;
    t?: TranslationsT;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    columns: number;
    network?: Network;
}

/**
 * CopyAddressButtonProps
 * Used in ValidatorLayouts.tsx
 */
export interface CopyAddressButtonProps {
    address: string;
    onCopy: (a: string) => void;
    copiedAddress: string | null;
    small?: boolean;
    truncate?: boolean;
    noTruncate?: boolean;
    start?: number;
    end?: number;
}

/**
 * DelegateButtonProps
 * Used in ValidatorLayouts.tsx
 */
export interface DelegateButtonProps {
    label: string;
    small?: boolean;
    tiny?: boolean;
    title?: string;
}

/**
 * StakeTooltipProps
 * Used in ValidatorStakeCharts.tsx
 */
export interface StakeTooltipProps {
    active?: boolean;
    payload?: Array<Record<string, unknown>>;
    label?: string;
    t?: TranslationsT;
    locale: string;
}

/**
 * StakeEvolutionChartProps
 * Used in ValidatorStakeCharts.tsx
 */
export interface StakeEvolutionChartProps {
    data: { date: string; totalStake: number }[];
    t?: TranslationsT;
    locale: string;
}

/**
 * StakeHistoryChartProps
 * Used in ValidatorStakeCharts.tsx
 */
export interface StakeHistoryChartProps {
    data: { date: string; stake: number; unstake: number; claim: number }[];
    t?: TranslationsT;
    locale: string;
}
