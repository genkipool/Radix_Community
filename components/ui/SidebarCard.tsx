'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { HighlightText } from '@/components/ui/HighlightText';

// Re-export so existing consumers (DocsSidebar) can keep their import path
export { HighlightText };

export interface SidebarCardItem {
    id: string;
    label: string;
    /** Optional secondary label — string or any ReactNode (e.g. highlighted snippet) */
    sublabel?: ReactNode;
    /** Optional left visual (avatar img src, icon node, etc.) */
    leftVisual?: ReactNode;
    /** Optional right badge */
    badge?: ReactNode;
    isSelected?: boolean;
    isUserItem?: boolean;
    /** Native Next.js link URL for the sub-item */
    href?: string;
    /** @deprecated Use actions instead */
    onAction?: () => void;
    /** @deprecated Use actions instead */
    actionIcon?: ReactNode;
    /** List of action buttons (e.g. edit, delete) */
    actions?: { icon: ReactNode; onClick: () => void; title?: string; color?: string }[];
}

interface SidebarCardProps {
    /** Unique id */
    id: string;
    /** Card header icon */
    icon: ReactNode;
    /** Gradient string for top-border accent and icon */
    gradient: string;
    /** Card title */
    title: string;
    /** Highlight query for title */
    searchQuery?: string;
    /** Is the card expanded */
    isExpanded: boolean;
    /** Does the card contain the selected item */
    hasSelectedItem?: boolean;
    /** Special active state (e.g. admin editor open) */
    isSpecialActive?: boolean;
    /** Badge on the card header (e.g. item count, custom node) */
    headerBadge?: ReactNode;
    /** Toggle the card open/closed */
    onToggle: () => void;
    /** Optional URL if the card header itself should act as a link (with preventDefault for instant toggle) */
    href?: string;
    /** Items rendered inside when expanded */
    items: SidebarCardItem[];
    onSelectItem: (id: string) => void;
    /** If true, render items as list rows with left visual */
    richItems?: boolean;
    /** Empty state message */
    emptyMessage?: string;
}

/* ─── SidebarCard ──────────────────────────────────────── */
export function SidebarCard({
    icon,
    gradient,
    title,
    searchQuery = '',
    isExpanded,
    hasSelectedItem = false,
    isSpecialActive = false,
    headerBadge,
    onToggle,
    href,
    items,
    onSelectItem,
    richItems = false,
    emptyMessage = 'No items',
}: SidebarCardProps) {
    const isActive = isSpecialActive || hasSelectedItem || isExpanded;



    return (
        <div
            className="rounded-2xl overflow-hidden transition-all duration-200"
            style={{
                background: 'var(--color-card-bg)',
                border: '2px solid transparent',
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
            }}
        >
            {/* ── Header button or Link ── */}
            {href ? (
                <Link
                    href={href}
                    onClick={(e) => {
                        // Let middle-click or cmd-click pass through purely native
                        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            onToggle();
                        }
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 group transition-all duration-200 active:scale-100"
                    aria-expanded={isExpanded}
                >
                    <div
                        className="shrink-0 transition-colors duration-200"
                        style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                        {icon}
                    </div>
                    <span
                        className="font-semibold text-sm tracking-wide flex-1"
                        style={{
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                        }}
                    >
                        <HighlightText text={title} query={searchQuery} />
                    </span>
                    {headerBadge && <span className="shrink-0">{headerBadge}</span>}
                </Link>
            ) : (
                <button
                    type="button"
                    onClick={onToggle}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 group transition-all duration-200 active:scale-100"
                    aria-expanded={isExpanded}
                >
                    <div
                        className="shrink-0 transition-colors duration-200"
                        style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                        {icon}
                    </div>
                    <span
                        className="font-semibold text-sm tracking-wide flex-1"
                        style={{
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                        }}
                    >
                        <HighlightText text={title} query={searchQuery} />
                    </span>
                    {headerBadge && <span className="shrink-0">{headerBadge}</span>}
                </button>
            )}

            {/* ── Item list ── */}
            {isExpanded && (
                <div className="px-3 pb-3">
                    <div
                        className={`h-px w-full mb-2.5 bg-gradient-to-r ${gradient}`}
                        style={{ opacity: 0.2 }}
                    />
                    {items.length === 0 ? (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                            {emptyMessage}
                        </p>
                    ) : (
                        <div className="space-y-0.5">
                            {items.map(item => (
                                <SidebarCardRow
                                    key={item.id}
                                    item={item}
                                    searchQuery={searchQuery}
                                    richItems={richItems}
                                    onSelectItem={onSelectItem}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── SidebarCardRow ───────────────────────────────────── */
function SidebarCardRow({
    item,
    searchQuery,
    richItems,
    onSelectItem,
}: {
    item: SidebarCardItem;
    searchQuery: string;
    richItems: boolean;
    onSelectItem: (id: string) => void;
}) {
    const { id, label, sublabel, leftVisual, badge, isSelected = false, onAction, actionIcon, actions, href } = item;

    const Component = (href ? Link : 'button') as React.ElementType;
    const componentProps = href
        ? {
            href,
            onClick: (e: React.MouseEvent) => {
                // Native open in new tab support
                if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                    onSelectItem(id);
                }
            }
        }
        : { onClick: () => onSelectItem(id) };

    const commonStyle = isSelected
        ? { background: 'var(--color-primary)', color: 'var(--color-bg)', fontWeight: 600 }
        : {};

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (!isSelected) {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-main)';
        }
    };
    const handleMouseLeave = (e: React.MouseEvent) => {
        if (!isSelected) {
            (e.currentTarget as HTMLElement).style.background = '';
            (e.currentTarget as HTMLElement).style.color = '';
        }
    };

    return (
        <div className="relative group/row">
            <Component
                {...componentProps}
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium"
                style={commonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {richItems && leftVisual ? (
                    /* Rich item: avatar + text stacked */
                    <div className="flex items-center gap-3">
                        <div className="shrink-0">{leftVisual}</div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate">
                                <HighlightText text={label} query={searchQuery} />
                            </p>
                            {sublabel && (
                                <p
                                    className="text-xs mt-0.5 truncate"
                                    style={{
                                        color: isSelected ? 'rgba(var(--color-bg-rgb,0,0,0),0.7)' : 'var(--color-text-muted)',
                                        opacity: isSelected ? 0.85 : 1,
                                    }}
                                >
                                    {sublabel}
                                </p>
                            )}
                        </div>
                        {badge && <span className="shrink-0 ml-auto">{badge}</span>}
                    </div>
                ) : (
                    /* Simple text item */
                    <div className="flex items-center gap-2">
                        <span className="flex-1 truncate">
                            <HighlightText text={label} query={searchQuery} />
                        </span>
                        {sublabel && (
                            <span
                                className="text-xs shrink-0"
                                style={{ color: isSelected ? 'var(--color-bg)' : 'var(--color-text-muted)', opacity: 0.8 }}
                            >
                                {sublabel}
                            </span>
                        )}
                        {badge && <span className="shrink-0">{badge}</span>}
                    </div>
                )}
            </Component>

            {/* Optional action buttons (edit, delete, etc.) */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                {/* Backward compatibility for single onAction */}
                {onAction && actionIcon && !actions && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onAction(); }}
                        className="size-6 flex items-center justify-center rounded-md transition-all"
                        style={{
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                            color: isSelected ? 'var(--color-bg)' : 'var(--color-text-muted)',
                            border: `1px solid ${isSelected ? 'transparent' : 'var(--color-card-border)'}`,
                        }}
                    >
                        {actionIcon}
                    </button>
                )}

                {/* Multiple actions support */}
                {actions?.map((act, i) => (
                    <button
                        type="button"
                        key={`action-${act.title}-${i}`}
                        title={act.title}
                        onClick={e => { e.stopPropagation(); act.onClick(); }}
                        className="size-6 flex items-center justify-center rounded-md transition-all"
                        style={{
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                            color: isSelected ? 'var(--color-bg)' : (act.color ?? 'var(--color-text-muted)'),
                            border: `1px solid ${isSelected ? 'transparent' : 'var(--color-card-border)'}`,
                        }}
                        onMouseEnter={e => {
                            if (!isSelected) {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-border)';
                                (e.currentTarget as HTMLButtonElement).style.color = act.color ?? 'var(--color-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isSelected) {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)';
                                (e.currentTarget as HTMLButtonElement).style.color = act.color ?? 'var(--color-text-muted)';
                            }
                        }}
                    >
                        {act.icon}
                    </button>
                ))}
            </div>
        </div>
    );
}
