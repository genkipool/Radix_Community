import { useState, useEffect } from 'react';

/** Radix on-ledger entity families the agenda can store, one tab each. */
export type AddressCategory =
    | 'account'
    | 'validator'
    | 'pool'
    | 'component'
    | 'package'
    | 'resource'
    | 'other';

export interface AddressBookEntry {
    id: string;
    name: string;
    address: string;
    note?: string;
    /** Derived from the address prefix; backfilled for legacy entries. */
    category?: AddressCategory;
}

const STORAGE_KEY = 'radix_address_book';

/** Classifies an address by its bech32 prefix. */
export function addressCategory(address: string): AddressCategory {
    const addr = address.trim();
    if (addr.startsWith('account_')) return 'account';
    if (addr.startsWith('validator_')) return 'validator';
    if (addr.startsWith('pool_')) return 'pool';
    if (addr.startsWith('component_')) return 'component';
    if (addr.startsWith('package_')) return 'package';
    if (addr.startsWith('resource_')) return 'resource';
    return 'other';
}

/** Adds a `category` to any entry missing one (older saves predate categories). */
function withCategory(entry: AddressBookEntry): AddressBookEntry {
    return { ...entry, category: entry.category ?? addressCategory(entry.address) };
}

export function useAddressBook() {
    const [entries, setEntries] = useState<AddressBookEntry[]>([]);

    useEffect(() => {
        const loadEntries = () => {
            if (typeof window === 'undefined') return;
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                setEntries([]);
                return;
            }
            try {
                const parsed = JSON.parse(stored) as AddressBookEntry[];
                setEntries(parsed.map(withCategory));
            } catch (e) {
                console.error('Failed to parse address book', e);
            }
        };

        loadEntries();

        // Same-tab writes fire a custom event; other tabs fire the native one.
        window.addEventListener('addressBookUpdated', loadEntries);
        window.addEventListener('storage', loadEntries);
        return () => {
            window.removeEventListener('addressBookUpdated', loadEntries);
            window.removeEventListener('storage', loadEntries);
        };
    }, []);

    const saveEntries = (newEntries: AddressBookEntry[]) => {
        setEntries(newEntries);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
            window.dispatchEvent(new Event('addressBookUpdated'));
        }
    };

    /**
     * Why an entry was refused. The agenda is keyed by address AND by name:
     * two contacts with the same address are the same contact, and two with
     * the same name are indistinguishable wherever the name is what shows.
     */
    const duplicateReason = (
        entry: { name: string; address: string },
        ignoreId?: string,
    ): 'duplicate_address' | 'duplicate_name' | null => {
        const name = entry.name.trim().toLowerCase();
        const address = entry.address.trim().toLowerCase();
        const others = entries.filter((e) => e.id !== ignoreId);
        if (others.some((e) => e.address.trim().toLowerCase() === address)) {
            return 'duplicate_address';
        }
        if (others.some((e) => e.name.trim().toLowerCase() === name)) {
            return 'duplicate_name';
        }
        return null;
    };

    const addEntry = (entry: Omit<AddressBookEntry, 'id' | 'category'>) => {
        const newEntry: AddressBookEntry = {
            ...entry,
            id: crypto.randomUUID(),
            category: addressCategory(entry.address),
        };
        if (duplicateReason(newEntry)) return;
        saveEntries([...entries, newEntry]);
    };

    /**
     * One-click save from anywhere an address is shown. Falls back to the
     * address as the name when the preferred one is taken, so a save never
     * fails for a reason the user cannot see or fix from there.
     */
    const addContact = (
        address: string,
        preferredName?: string,
    ): 'saved' | 'duplicate_address' => {
        const clean = address.trim();
        if (duplicateReason({ name: '', address: clean }) === 'duplicate_address') {
            return 'duplicate_address';
        }
        const name = (preferredName ?? '').trim() || clean;
        addEntry({
            address: clean,
            name: duplicateReason({ name, address: clean }) ? clean : name,
        });
        return 'saved';
    };

    const updateEntry = (id: string, updated: Omit<AddressBookEntry, 'id' | 'category'>) => {
        saveEntries(
            entries.map((e) =>
                e.id === id
                    ? { ...e, ...updated, category: addressCategory(updated.address) }
                    : e,
            ),
        );
    };

    const deleteEntry = (id: string) => {
        saveEntries(entries.filter((e) => e.id !== id));
    };

    return {
        entries,
        addEntry,
        addContact,
        duplicateReason,
        updateEntry,
        deleteEntry,
    };
}
