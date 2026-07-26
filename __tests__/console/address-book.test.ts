// @vitest-environment jsdom
/**
 * The agenda is keyed by address AND by name: two entries with the same address
 * are the same contact, and two with the same name are indistinguishable
 * wherever the name is what shows. The manual form checked both; the one-click
 * saves added later did not, so the rule now lives in the hook every path goes
 * through.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';

const ADDRESS = 'account_tdx_2_1contact';
const OTHER = 'account_tdx_2_1other';

/** jsdom serves an opaque origin here, where real localStorage throws. */
const memoryStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
})();
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});

beforeEach(() => localStorage.clear());

describe('address book uniqueness', () => {
  it('stores a contact once, however many times it is saved', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addEntry({ name: 'Luis', address: ADDRESS });
    });
    act(() => {
      result.current.addEntry({ name: 'Luis again', address: ADDRESS });
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it('ignores case and stray spaces when comparing', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addEntry({ name: 'Luis', address: ADDRESS });
    });
    act(() => {
      result.current.addEntry({ name: '  luis  ', address: OTHER });
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.duplicateReason({ name: 'LUIS', address: OTHER })).toBe(
      'duplicate_name',
    );
    expect(
      result.current.duplicateReason({ name: 'x', address: ADDRESS.toUpperCase() }),
    ).toBe('duplicate_address');
  });

  it('lets an entry keep its own name and address when edited', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addEntry({ name: 'Luis', address: ADDRESS });
    });
    const { id } = result.current.entries[0];
    expect(
      result.current.duplicateReason({ name: 'Luis', address: ADDRESS }, id),
    ).toBeNull();
  });
});

describe('one-click save', () => {
  it('saves an address that is not there yet', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      expect(result.current.addContact(ADDRESS, 'Luis')).toBe('saved');
    });
    expect(result.current.entries[0]).toMatchObject({ name: 'Luis', address: ADDRESS });
  });

  it('reports an address already saved instead of duplicating it', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addContact(ADDRESS, 'Luis');
    });
    act(() => {
      expect(result.current.addContact(ADDRESS, 'Another name')).toBe(
        'duplicate_address',
      );
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it('falls back to the address when the preferred name is taken', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addContact(ADDRESS, 'Luis');
    });
    // A different account whose peer calls itself "Luis" too: still saved,
    // under a name that cannot collide.
    act(() => {
      expect(result.current.addContact(OTHER, 'Luis')).toBe('saved');
    });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[1]).toMatchObject({ name: OTHER, address: OTHER });
  });

  it('names an entry after its address when nothing better is known', () => {
    const { result } = renderHook(() => useAddressBook());
    act(() => {
      result.current.addContact(ADDRESS);
    });
    expect(result.current.entries[0].name).toBe(ADDRESS);
  });
});
