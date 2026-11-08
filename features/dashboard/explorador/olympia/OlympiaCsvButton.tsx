'use client';
/**
 * The CSV download button that sits right of the copy button of every Olympia
 * account or validator address. It opens the download dialog (year and, for
 * accounts, which rewards) and downloads the Olympia staking rewards CSV (account: delegator rewards and,
 * for validator owners, the fee; validator: its owner's daily fee).
 *
 * Self-contained (words and language come from the app context), so any view
 * can put it next to an Olympia address with nothing but the address.
 */
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDashboardDictionary } from '@/features/dashboard/hooks/useDashboardDictionary';
import { olympiaKindOf } from '@/features/dashboard/lib/olympia';
import { olympiaDict } from './dict';
import { OlympiaRewardsCsvModal } from './OlympiaRewardsCsv';

/** Olympia ran from 2021 to 2023; a year without rewards says so when chosen. */
const YEARS = [2021, 2022, 2023];

export function OlympiaCsvButton({ address, className = '' }: { address: string; className?: string }) {
  const kind = olympiaKindOf(address);
  const [open, setOpen] = useState(false);
  const dict = useDashboardDictionary();
  const { language } = useLanguage();
  if (kind !== 'account' && kind !== 'validator') return null;
  const o = olympiaDict(dict?.dashboard?.transactions);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] shrink-0 ${className}`}
        title={o.rewards_csv_tooltip}
        aria-label={o.rewards_csv_tooltip}
      >
        <Download className="size-3" />
      </button>
      {open && (
        <OlympiaRewardsCsvModal
          subject={kind}
          address={address}
          years={YEARS}
          o={o}
          locale={language}
          onClose={() => setOpen(false)}
          closeLabel={dict?.dashboard?.reading?.close}
        />
      )}
    </>
  );
}
