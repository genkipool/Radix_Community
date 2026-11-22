'use client';

import { useState } from 'react';

export const WALLET_MODAL_SECTION_KEYS = [
  'filter',
  'send',
  'balance',
  'staking',
  'tokens',
  'nfts',
  'poolUnits',
  'lockers',
] as const;

export type WalletModalSectionKey = (typeof WALLET_MODAL_SECTION_KEYS)[number];
export type WalletModalSectionsVisibility = Record<WalletModalSectionKey, boolean>;

export const DEFAULT_WALLET_MODAL_ORDER: WalletModalSectionKey[] = [...WALLET_MODAL_SECTION_KEYS];

const STORAGE_KEY = 'wallet_modal_sections_v1';

export const DEFAULT_WALLET_MODAL_SECTIONS: WalletModalSectionsVisibility = {
  filter: true,
  send: true,
  balance: true,
  staking: true,
  tokens: true,
  nfts: true,
  poolUnits: true,
  lockers: true,
};

interface WalletModalSectionsState {
  visible: WalletModalSectionsVisibility;
  order: WalletModalSectionKey[];
}

const DEFAULT_STATE: WalletModalSectionsState = {
  visible: DEFAULT_WALLET_MODAL_SECTIONS,
  order: DEFAULT_WALLET_MODAL_ORDER,
};

function isSectionKey(value: unknown): value is WalletModalSectionKey {
  return typeof value === 'string' && (WALLET_MODAL_SECTION_KEYS as readonly string[]).includes(value);
}

function normalizeOrder(rawOrder: unknown): WalletModalSectionKey[] {
  if (!Array.isArray(rawOrder)) return DEFAULT_WALLET_MODAL_ORDER;
  const seen = new Set<WalletModalSectionKey>();
  const valid: WalletModalSectionKey[] = [];
  for (const item of rawOrder) {
    if (isSectionKey(item) && !seen.has(item)) {
      seen.add(item);
      valid.push(item);
    }
  }
  for (const key of WALLET_MODAL_SECTION_KEYS) {
    if (!seen.has(key)) valid.push(key);
  }
  return valid;
}

function normalizeVisibility(rawVisible: unknown): WalletModalSectionsVisibility {
  if (!rawVisible || typeof rawVisible !== 'object') return DEFAULT_WALLET_MODAL_SECTIONS;
  const record = rawVisible as Partial<Record<string, unknown>>;
  const next: WalletModalSectionsVisibility = { ...DEFAULT_WALLET_MODAL_SECTIONS };
  for (const key of WALLET_MODAL_SECTION_KEYS) {
    if (typeof record[key] === 'boolean') {
      next[key] = record[key];
    }
  }
  return next;
}

function readStoredState(): WalletModalSectionsState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Backwards-compatible: support both `{ visible, order }` and legacy flat visibility map
    if (parsed && typeof parsed === 'object' && ('visible' in parsed || 'order' in parsed)) {
      return {
        visible: normalizeVisibility(parsed.visible),
        order: normalizeOrder(parsed.order),
      };
    }
    return {
      visible: normalizeVisibility(parsed),
      order: DEFAULT_WALLET_MODAL_ORDER,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeStoredState(next: WalletModalSectionsState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable in private browsing modes
  }
}

export function reorderSectionList(
  list: readonly WalletModalSectionKey[],
  fromIndex: number,
  toIndex: number,
): WalletModalSectionKey[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return [...list];
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Manages which sections of the Wallet Profile Modal are visible and their
 * display order, persisted in localStorage with safe SSR fallback.
 */
export function useWalletModalSections() {
  const [state, setState] = useState<WalletModalSectionsState>(readStoredState);

  const toggleSection = (key: WalletModalSectionKey) => {
    setState((prev) => {
      const next: WalletModalSectionsState = {
        ...prev,
        visible: { ...prev.visible, [key]: !prev.visible[key] },
      };
      writeStoredState(next);
      return next;
    });
  };

  const reorderSections = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setState((prev) => {
      const next: WalletModalSectionsState = {
        ...prev,
        order: reorderSectionList(prev.order, fromIndex, toIndex),
      };
      writeStoredState(next);
      return next;
    });
  };

  const resetSections = () => {
    setState(DEFAULT_STATE);
    writeStoredState(DEFAULT_STATE);
  };

  const hasHiddenSections = WALLET_MODAL_SECTION_KEYS.some((key) => !state.visible[key]);
  const hasCustomOrder = state.order.some((key, index) => key !== WALLET_MODAL_SECTION_KEYS[index]);
  const hasCustomization = hasHiddenSections || hasCustomOrder;

  return {
    visibleSections: state.visible,
    sectionOrder: state.order,
    toggleSection,
    reorderSections,
    resetSections,
    hasHiddenSections,
    hasCustomOrder,
    hasCustomization,
  };
}
