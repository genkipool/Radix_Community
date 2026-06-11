import { useState, useEffect } from 'react';

export interface AddressBookEntry {
    id: string;
    name: string;
    address: string;
    note?: string;
}

export function useAddressBook() {
    const [entries, setEntries] = useState<AddressBookEntry[]>([]);

    useEffect(() => {
        const loadEntries = () => {
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem('radix_address_book');
                if (stored) {
                    try {
                        setEntries(JSON.parse(stored));
                    } catch (e) {
                        console.error("Failed to parse address book", e);
                    }
                }
            }
        };

        loadEntries();

        window.addEventListener('addressBookUpdated', loadEntries);
        return () => window.removeEventListener('addressBookUpdated', loadEntries);
    }, []);

    const saveEntries = (newEntries: AddressBookEntry[]) => {
        setEntries(newEntries);
        if (typeof window !== 'undefined') {
            localStorage.setItem('radix_address_book', JSON.stringify(newEntries));
            window.dispatchEvent(new Event('addressBookUpdated'));
        }
    };

    const addEntry = (entry: Omit<AddressBookEntry, 'id'>) => {
        const newEntry = { ...entry, id: crypto.randomUUID() };
        saveEntries([...entries, newEntry]);
    };

    const updateEntry = (id: string, updated: Omit<AddressBookEntry, 'id'>) => {
        saveEntries(entries.map(e => e.id === id ? { ...e, ...updated } : e));
    };

    const deleteEntry = (id: string) => {
        saveEntries(entries.filter(e => e.id !== id));
    };

    return {
        entries,
        addEntry,
        updateEntry,
        deleteEntry
    };
}
