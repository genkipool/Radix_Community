'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { MoreMenuButton } from '@/components/ui/MoreMenuButton';
import { SelectPopup, SelectPopupRow } from '@/components/ui/SelectPopup';
import {
  type WalletModalSectionKey,
  type WalletModalSectionsVisibility,
} from '../hooks/useWalletModalSections';

interface WalletSectionsMenuProps {
  visibleSections: WalletModalSectionsVisibility;
  sectionOrder: WalletModalSectionKey[];
  hasHiddenSections: boolean;
  hasCustomOrder: boolean;
  onToggleSection: (key: WalletModalSectionKey) => void;
  onReorderSections: (fromIndex: number, toIndex: number) => void;
  onResetSections: () => void;
  navT: Record<string, string>;
  closeLabel: string;
}

interface DragState {
  key: WalletModalSectionKey;
  fromIndex: number;
  overIndex: number;
  startY: number;
  offsetY: number;
  itemStep: number;
}

const SECTION_LABEL_KEYS: Record<WalletModalSectionKey, string> = {
  filter: 'wallet_section_filter',
  send: 'wallet_section_send',
  balance: 'wallet_section_balance',
  staking: 'wallet_section_staking',
  tokens: 'wallet_section_tokens',
  nfts: 'wallet_section_nfts',
  poolUnits: 'wallet_section_pool_units',
  lockers: 'wallet_section_lockers',
};

const ROW_FALLBACK_STEP = 40;

/**
 * Click-toggled 3-dots menu reusing the site-wide `SelectPopup` and
 * `SelectPopupRow` components, enhanced with smooth pointer-driven
 * drag-and-drop reordering and keyboard reordering on the handle.
 */
export function WalletSectionsMenu({
  visibleSections,
  sectionOrder,
  hasHiddenSections,
  hasCustomOrder,
  onToggleSection,
  onReorderSections,
  onResetSections,
  navT,
  closeLabel,
}: WalletSectionsMenuProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isAnyDragging = dragState !== null;

  useEffect(() => {
    if (!isAnyDragging) return;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isAnyDragging]);

  const hasCustomization = hasHiddenSections || hasCustomOrder;

  const measureItemStep = (fromIndex: number): number => {
    const current = rowRefs.current[fromIndex];
    const next = rowRefs.current[fromIndex + 1];
    const prev = rowRefs.current[fromIndex - 1];
    if (current && next) {
      const diff = next.getBoundingClientRect().top - current.getBoundingClientRect().top;
      if (diff > 0) return diff;
    }
    if (current && prev) {
      const diff = current.getBoundingClientRect().top - prev.getBoundingClientRect().top;
      if (diff > 0) return diff;
    }
    if (current) {
      const height = current.getBoundingClientRect().height;
      if (height > 0) return height + 4;
    }
    return ROW_FALLBACK_STEP;
  };

  const handleDragStart = (
    e: React.PointerEvent<HTMLButtonElement>,
    key: WalletModalSectionKey,
    index: number,
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events in tests may not have an active pointerId
      }
    }
    setDragState({
      key,
      fromIndex: index,
      overIndex: index,
      startY: e.clientY,
      offsetY: 0,
      itemStep: measureItemStep(index),
    });
  };

  const handleDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState) return;
    e.preventDefault();
    const minOffset = -dragState.fromIndex * dragState.itemStep;
    const maxOffset = (sectionOrder.length - 1 - dragState.fromIndex) * dragState.itemStep;
    const clampedOffset = Math.max(minOffset, Math.min(maxOffset, e.clientY - dragState.startY));
    const nextOverIndex = Math.max(
      0,
      Math.min(
        sectionOrder.length - 1,
        dragState.fromIndex + Math.round(clampedOffset / dragState.itemStep),
      ),
    );
    setDragState((prev) =>
      prev ? { ...prev, offsetY: clampedOffset, overIndex: nextOverIndex } : null,
    );
  };

  const finishDrag = (commit: boolean) => {
    if (!dragState) return;
    if (commit && dragState.overIndex !== dragState.fromIndex) {
      onReorderSections(dragState.fromIndex, dragState.overIndex);
    }
    setDragState(null);
  };

  const handleHandleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onReorderSections(index, index - 1);
    } else if (e.key === 'ArrowDown' && index < sectionOrder.length - 1) {
      e.preventDefault();
      onReorderSections(index, index + 1);
    }
  };

  const getRowTransform = (index: number): string | undefined => {
    if (!dragState) return undefined;
    if (index === dragState.fromIndex) {
      return `translate3d(0, ${dragState.offsetY}px, 0) scale(1.02)`;
    }
    if (
      dragState.fromIndex < dragState.overIndex &&
      index > dragState.fromIndex &&
      index <= dragState.overIndex
    ) {
      return `translate3d(0, ${-dragState.itemStep}px, 0)`;
    }
    if (
      dragState.fromIndex > dragState.overIndex &&
      index >= dragState.overIndex &&
      index < dragState.fromIndex
    ) {
      return `translate3d(0, ${dragState.itemStep}px, 0)`;
    }
    return 'translate3d(0, 0, 0)';
  };

  const footerLabel = hasCustomOrder
    ? (navT.wallet_sections_reset ?? '')
    : (navT.wallet_sections_show_all ?? '');

  return (
    <MoreMenuButton
      ariaLabel={navT.wallet_sections_menu ?? ''}
      customPanel
    >
      {(close) => (
        <SelectPopup
          title={navT.wallet_sections_title ?? ''}
          onClose={close}
          closeLabel={closeLabel}
          listClassName="overflow-visible"
          className="absolute right-0 top-full mt-2 w-64 z-50"
          footer={
            hasCustomization
              ? {
                  label: footerLabel,
                  onClick: onResetSections,
                }
              : undefined
          }
        >
          {sectionOrder.map((key, index) => {
            const isDragging = dragState?.key === key;
            const label = navT[SECTION_LABEL_KEYS[key]] ?? key;
            const transform = getRowTransform(index);
            return (
              <div
                key={key}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                style={{
                  transform,
                  transition:
                    dragState && !isDragging
                      ? 'transform 180ms cubic-bezier(0.2, 0, 0, 1)'
                      : 'none',
                }}
                className={`relative flex items-center gap-1.5 rounded-lg ${
                  isAnyDragging ? 'will-change-transform' : ''
                } ${
                  isDragging
                    ? 'z-20 bg-[var(--color-surface)] shadow-lg ring-1 ring-[var(--color-primary)]/40'
                    : 'z-0'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <SelectPopupRow
                    selected={visibleSections[key]}
                    onClick={() => onToggleSection(key)}
                    label={label}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`${navT.wallet_section_drag ?? ''}: ${label}`}
                  onPointerDown={(e) => handleDragStart(e, key, index)}
                  onPointerMove={handleDragMove}
                  onPointerUp={() => finishDrag(true)}
                  onPointerCancel={() => finishDrag(false)}
                  onKeyDown={(e) => handleHandleKeyDown(e, index)}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  className={`size-8 sm:w-6 -mr-0.5 shrink-0 flex items-center justify-center rounded-lg touch-none select-none transition-colors ${
                    isDragging
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)]/60 hover:text-[var(--color-text-main)]'
                  }`}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </SelectPopup>
      )}
    </MoreMenuButton>
  );
}
