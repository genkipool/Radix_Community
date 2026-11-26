'use client';

import { BookMarked, BookUser } from 'lucide-react';
import { useOptionalLanguage } from '@/context/LanguageContext';
import { addressCategory, isAddressBookSaveable, useAddressBook } from '../hooks/useAddressBook';

const SIZE_STYLES = {
  xs: { btn: 'p-0.5 rounded', icon: 'size-3' },
  sm: { btn: 'p-1 rounded-md', icon: 'size-3.5' },
  md: { btn: 'size-7 rounded-lg', icon: 'size-3.5' },
} as const;

/**
 * Icon-only toggle button to save or remove an address from the agenda,
 * designed to sit beside a copy button wherever an address is shown.
 *
 * Automatically hides itself for non-saveable addresses (tx hashes, internal
 * vaults, system singletons) and classifies saved addresses by their Radix
 * entity prefix (account, validator, pool, locker, component, package, resource).
 */
export function SaveToAddressBookButton({
  address,
  name,
  saveLabel,
  savedLabel,
  size = 'md',
  className = '',
}: {
  address: string;
  /** Suggested name; the address itself when nothing better is known. */
  name?: string | null;
  saveLabel?: string;
  savedLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const langCtx = useOptionalLanguage();
  const { entries, addContact, deleteEntry } = useAddressBook();
  const clean = address.trim();
  if (!clean || !isAddressBookSaveable(clean)) return null;

  const navT = (langCtx?.t?.nav ?? {}) as Record<string, string | undefined>;
  const category = addressCategory(clean);
  const categoryLabel = navT[`agenda_cat_${category}`] ?? category;
  const existing = entries.find((entry) => entry.address.trim().toLowerCase() === clean.toLowerCase());
  const saved = Boolean(existing);

  const baseSave = saveLabel ?? navT.wallet_save_contact ?? '';
  const resolvedSaveLabel = categoryLabel && baseSave ? `${baseSave} (${categoryLabel})` : baseSave;

  const hasCustomName = Boolean(existing?.name && existing.name.trim().toLowerCase() !== clean.toLowerCase());
  const removeTemplate = hasCustomName ? navT.wallet_remove_contact_named : navT.wallet_remove_contact;
  const resolvedSavedLabel = removeTemplate
    ? removeTemplate.replaceAll('{name}', existing?.name ?? '').replaceAll('{category}', categoryLabel)
    : (savedLabel ?? navT.wallet_saved_contact ?? '');

  const { btn, icon } = SIZE_STYLES[size];
  const label = saved ? resolvedSavedLabel : resolvedSaveLabel;

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={(e) => {
        e.stopPropagation();
        if (existing) {
          deleteEntry(existing.id);
        } else {
          addContact(clean, name ?? undefined);
        }
      }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center transition-colors cursor-pointer ${
        saved
          ? 'text-[var(--color-primary)] hover:text-[var(--color-secondary)] hover:bg-[var(--color-primary)]/10'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]'
      } ${btn} ${className}`}
    >
      {saved ? <BookMarked className={icon} /> : <BookUser className={icon} />}
    </button>
  );
}
