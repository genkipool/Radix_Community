import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import esCommon from '@/i18n/locales/common/es.json';
import {
  DEFAULT_WALLET_MODAL_ORDER,
  DEFAULT_WALLET_MODAL_SECTIONS,
  useWalletModalSections,
} from '@/features/wallet/hooks/useWalletModalSections';
import { WalletSectionsMenu } from '@/features/wallet/components/WalletSectionsMenu';

const storageStore = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return storageStore.size;
  },
  clear: () => {
    storageStore.clear();
  },
  getItem: (key: string) => storageStore.get(key) ?? null,
  key: (index: number) => Array.from(storageStore.keys())[index] ?? null,
  removeItem: (key: string) => {
    storageStore.delete(key);
  },
  setItem: (key: string, value: string) => {
    storageStore.set(key, String(value));
  },
};

describe('useWalletModalSections & WalletSectionsMenu', () => {
  beforeEach(() => {
    storageStore.clear();
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    });
  });

  it('defaults all sections to visible & ordered, toggles, reorders, persists to localStorage, and resets', () => {
    const { result, unmount } = renderHook(() => useWalletModalSections());
    expect(result.current.visibleSections).toEqual(DEFAULT_WALLET_MODAL_SECTIONS);
    expect(result.current.sectionOrder).toEqual(DEFAULT_WALLET_MODAL_ORDER);
    expect(result.current.hasHiddenSections).toBe(false);
    expect(result.current.hasCustomOrder).toBe(false);

    act(() => {
      result.current.toggleSection('staking');
      result.current.toggleSection('nfts');
      result.current.reorderSections(4, 1); // move 'tokens' before 'send'
    });

    expect(result.current.visibleSections.staking).toBe(false);
    expect(result.current.visibleSections.nfts).toBe(false);
    expect(result.current.visibleSections.balance).toBe(true);
    expect(result.current.sectionOrder[1]).toBe('tokens');
    expect(result.current.hasHiddenSections).toBe(true);
    expect(result.current.hasCustomOrder).toBe(true);
    unmount();

    // Re-mounting restores persisted visibility and order
    const restored = renderHook(() => useWalletModalSections());
    expect(restored.result.current.visibleSections.staking).toBe(false);
    expect(restored.result.current.visibleSections.nfts).toBe(false);
    expect(restored.result.current.sectionOrder[1]).toBe('tokens');
    expect(restored.result.current.hasHiddenSections).toBe(true);
    expect(restored.result.current.hasCustomOrder).toBe(true);

    act(() => {
      restored.result.current.resetSections();
    });
    expect(restored.result.current.visibleSections).toEqual(DEFAULT_WALLET_MODAL_SECTIONS);
    expect(restored.result.current.sectionOrder).toEqual(DEFAULT_WALLET_MODAL_ORDER);
    expect(restored.result.current.hasHiddenSections).toBe(false);
    expect(restored.result.current.hasCustomOrder).toBe(false);
  });

  it('renders a mobile-sized 3-dots trigger, toggles SelectPopup rows, and supports real-time drag & keyboard reorder', () => {
    const onToggleSection = vi.fn();
    const onReorderSections = vi.fn();
    const onResetSections = vi.fn();
    const navT = esCommon.nav as Record<string, string>;
    const closeLabel = esCommon.ui.close;

    render(
      <WalletSectionsMenu
        visibleSections={{ ...DEFAULT_WALLET_MODAL_SECTIONS, lockers: false }}
        sectionOrder={DEFAULT_WALLET_MODAL_ORDER}
        hasHiddenSections
        hasCustomOrder={false}
        onToggleSection={onToggleSection}
        onReorderSections={onReorderSections}
        onResetSections={onResetSections}
        navT={navT}
        closeLabel={closeLabel}
      />,
    );

    const trigger = screen.getByRole('button', { name: navT.wallet_sections_menu });
    expect(trigger).toHaveClass('min-w-11', 'min-h-11');
    expect(screen.queryByText(navT.wallet_sections_title)).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText(navT.wallet_sections_title)).toBeInTheDocument();

    const balanceItem = screen.getByRole('button', { name: navT.wallet_section_balance });
    const lockersItem = screen.getByRole('button', { name: navT.wallet_section_lockers });
    expect(balanceItem).toHaveAttribute('aria-pressed', 'true');
    expect(lockersItem).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(balanceItem);
    expect(onToggleSection).toHaveBeenCalledWith('balance');

    // Keyboard reorder on the drag handle
    const balanceHandle = screen.getByRole('button', {
      name: `${navT.wallet_section_drag}: ${navT.wallet_section_balance}`,
    });
    fireEvent.keyDown(balanceHandle, { key: 'ArrowUp' });
    expect(onReorderSections).toHaveBeenCalledWith(2, 1);

    // Pointer drag reorder (down by 2 rows = 80px with fallback step 40px)
    fireEvent.pointerDown(balanceHandle, { clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
    fireEvent.pointerMove(balanceHandle, { clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(balanceHandle, { clientY: 180, pointerId: 1 });
    expect(onReorderSections).toHaveBeenCalledWith(2, 4);

    const showAllBtn = screen.getByRole('button', { name: navT.wallet_sections_show_all });
    fireEvent.click(showAllBtn);
    expect(onResetSections).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: closeLabel }));
    expect(screen.queryByText(navT.wallet_sections_title)).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText(navT.wallet_sections_title)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(navT.wallet_sections_title)).toBeNull();
  });
});
