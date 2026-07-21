'use client';

import { useLanguage } from '@/context/LanguageContext';
import { AddressBook } from '@/features/wallet/components/AddressBook';
import type { ConsoleToolProps } from '../ConsoleToolView';

/**
 * Console tool: the address book (agenda). Thin adapter over the shared
 * `AddressBook` component (same one used in the wallet profile modal), so the
 * agenda has a single design and grows in one place. Rendered flat (no card),
 * each entry separated by a bottom border. Strings come from the global `nav`
 * namespace already used by the modal.
 */
export default function AddressBookTool({}: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const navT = ((full?.nav as Record<string, string>) ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <AddressBook navT={navT} showHeader={false} />
    </div>
  );
}
