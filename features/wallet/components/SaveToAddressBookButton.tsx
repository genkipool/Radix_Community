'use client';

import { useState } from 'react';
import { BookUser, Check } from 'lucide-react';
import { useAddressBook } from '../hooks/useAddressBook';

/**
 * Icon-only "save this address to the agenda" button, to sit beside a copy
 * button wherever an address is shown.
 *
 * An address you are looking at is exactly the one you may want to keep, and
 * until now keeping it meant copying it, opening the address book tool and
 * pasting. Already saved addresses show as saved and do nothing, so the same
 * address can never be stored twice.
 */
export function SaveToAddressBookButton({
  address,
  name,
  saveLabel,
  savedLabel,
  className = '',
}: {
  address: string;
  /** Suggested name; the address itself when nothing better is known. */
  name?: string;
  saveLabel: string;
  savedLabel: string;
  className?: string;
}) {
  const { entries, addContact } = useAddressBook();
  const [justSaved, setJustSaved] = useState(false);
  const clean = address.trim();
  if (!clean) return null;

  const saved = justSaved || entries.some((entry) => entry.address === clean);

  return (
    <button
      type="button"
      disabled={saved}
      onClick={() => {
        addContact(clean, name);
        setJustSaved(true);
      }}
      aria-label={saved ? savedLabel : saveLabel}
      title={saved ? savedLabel : saveLabel}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-default ${className}`}
      style={{ color: saved ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
    >
      {saved ? <Check className="size-3.5" /> : <BookUser className="size-3.5" />}
    </button>
  );
}
